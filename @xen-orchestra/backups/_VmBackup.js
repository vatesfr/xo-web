const findLast = require('lodash/findLast')
const ignoreErrors = require('promise-toolbox/ignoreErrors')
const keyBy = require('lodash/keyBy')
const mapValues = require('lodash/mapValues')
const { asyncMap } = require('@xen-orchestra/async-map')
const { createLogger } = require('@xen-orchestra/log')
const { formatDateTime } = require('@xen-orchestra/xapi')

const { ContinuousReplicationWriter } = require('./_ContinuousReplicationWriter')
const { DeltaBackupWriter } = require('./_DeltaBackupWriter')
const { DisasterRecoveryWriter } = require('./_DisasterRecoveryWriter')
const { exportDeltaVm } = require('./_deltaVm')
const { forkStreamUnpipe } = require('./_forkStreamUnpipe')
const { FullBackupWriter } = require('./_FullBackupWriter')
const { getOldEntries } = require('./_getOldEntries')
const { Task } = require('./Task')
const { watchStreamSize } = require('./_watchStreamSize')

const { debug, warn } = createLogger('xo:backups:VmBackup')

const forkDeltaExport = deltaExport =>
  Object.create(deltaExport, {
    streams: {
      value: mapValues(deltaExport.streams, forkStreamUnpipe),
    },
  })

exports.VmBackup = class VmBackup {
  constructor({ config, getSnapshotNameLabel, job, remoteAdapters, remotes, schedule, settings, srs, vm }) {
    this.config = config
    this.job = job
    this.remoteAdapters = remoteAdapters
    this.remotes = remotes
    this.scheduleId = schedule.id
    this.timestamp = undefined

    // VM currently backed up
    this.vm = vm
    const { tags } = this.vm

    // VM (snapshot) that is really exported
    this.exportedVm = undefined

    this._fullVdisRequired = undefined
    this._getSnapshotNameLabel = getSnapshotNameLabel
    this._isDelta = job.mode === 'delta'
    this._jobId = job.id
    this._jobSnapshots = undefined
    this._xapi = vm.$xapi

    // Base VM for the export
    this._baseVm = undefined

    // Settings for this specific run (job, schedule, VM)
    if (tags.includes('xo-memory-backup')) {
      settings.checkpointSnapshot = true
    }
    if (tags.includes('xo-offline-backup')) {
      settings.offlineSnapshot = true
    }
    this._settings = settings

    // Create writers
    {
      const writers = []
      this._writers = writers

      const [BackupWriter, ReplicationWriter] = this._isDelta
        ? [DeltaBackupWriter, ContinuousReplicationWriter]
        : [FullBackupWriter, DisasterRecoveryWriter]

      const allSettings = job.settings

      Object.keys(remoteAdapters).forEach(remoteId => {
        const targetSettings = {
          ...settings,
          ...allSettings[remoteId],
        }
        if (targetSettings.exportRetention !== 0) {
          writers.push(new BackupWriter(this, remoteId, targetSettings))
        }
      })
      srs.forEach(sr => {
        const targetSettings = {
          ...settings,
          ...allSettings[sr.uuid],
        }
        if (targetSettings.copyRetention !== 0) {
          writers.push(new ReplicationWriter(this, sr, targetSettings))
        }
      })
    }
  }

  // ensure the VM itself does not have any backup metadata which would be
  // copied on manual snapshots and interfere with the backup jobs
  async _cleanMetadata() {
    const { vm } = this
    if ('xo:backup:job' in vm.other_config) {
      await vm.update_other_config({
        'xo:backup:datetime': null,
        'xo:backup:deltaChainLength': null,
        'xo:backup:exported': null,
        'xo:backup:job': null,
        'xo:backup:schedule': null,
        'xo:backup:vm': null,
      })
    }
  }

  async _snapshot() {
    const { vm } = this
    const xapi = this._xapi

    const settings = this._settings

    const doSnapshot = this._isDelta || vm.power_state === 'Running' || settings.snapshotRetention !== 0
    if (doSnapshot) {
      await Task.run({ name: 'snapshot' }, async () => {
        if (!settings.bypassVdiChainsCheck) {
          await vm.$assertHealthyVdiChains()
        }

        const snapshotRef = await vm[settings.checkpointSnapshot ? '$checkpoint' : '$snapshot']({
          name_label: this._getSnapshotNameLabel(vm),
        })
        this.timestamp = Date.now()

        await xapi.setFieldEntries('VM', snapshotRef, 'other_config', {
          'xo:backup:datetime': formatDateTime(this.timestamp),
          'xo:backup:job': this._jobId,
          'xo:backup:schedule': this.scheduleId,
          'xo:backup:vm': vm.uuid,
        })

        this.exportedVm = await xapi.getRecord('VM', snapshotRef)

        return this.exportedVm.uuid
      })
    } else {
      this.exportedVm = vm
      this.timestamp = Date.now()
    }
  }

  async _copyDelta() {
    const { exportedVm } = this
    const baseVm = this._baseVm

    const deltaExport = await exportDeltaVm(exportedVm, baseVm, {
      fullVdisRequired: this._fullVdisRequired,
    })
    const sizeContainers = mapValues(deltaExport.streams, watchStreamSize)

    const timestamp = Date.now()

    await asyncMap(this._writers, async writer => {
      try {
        await writer.run({
          deltaExport: forkDeltaExport(deltaExport),
          sizeContainers,
          timestamp,
        })
      } catch (error) {
        warn('copy failure', {
          error,
          target: writer.target,
          vm: this.vm,
        })
      }
    })

    this._baseVm = exportedVm

    if (baseVm !== undefined) {
      await exportedVm.update_other_config(
        'xo:backup:deltaChainLength',
        String(+(baseVm.other_config['xo:backup:deltaChainLength'] ?? 0) + 1)
      )
    }

    // not the case if offlineBackup
    if (exportedVm.is_a_snapshot) {
      await exportedVm.update_other_config('xo:backup:exported', 'true')
    }

    const size = Object.values(sizeContainers).reduce((sum, { size }) => sum + size, 0)
    const end = Date.now()
    const duration = end - timestamp
    debug('transfer complete', {
      duration,
      speed: duration !== 0 ? (size * 1e3) / 1024 / 1024 / duration : 0,
      size,
    })
  }

  async _copyFull() {
    const { compression } = this.job
    const stream = await this._xapi.VM_export(this.exportedVm.$ref, {
      compress: Boolean(compression) && (compression === 'native' ? 'gzip' : 'zstd'),
      useSnapshot: false,
    })
    const sizeContainer = watchStreamSize(stream)

    const timestamp = Date.now()

    const progress = {
      handle: setInterval(() => {
        const { size } = sizeContainer
        const timestamp = Date.now()
        Task.info('transfer', {
          speed: (size - progress.size) / (timestamp - progress.timestamp),
        })
        progress.size = size
        progress.timestamp = timestamp
      }, 5e3 * 60),
      size: sizeContainer.size,
      timestamp,
    }

    await asyncMap(this._writers, async writer => {
      try {
        await writer.run({
          sizeContainer,
          stream: forkStreamUnpipe(stream),
          timestamp,
        })
      } catch (error) {
        warn('copy failure', {
          error,
          target: writer.target,
          vm: this.vm,
        })
      }
    })

    clearInterval(progress.handle)

    const { size } = sizeContainer
    const end = Date.now()
    const duration = end - timestamp
    debug('transfer complete', {
      duration,
      speed: duration !== 0 ? (size * 1e3) / 1024 / 1024 / duration : 0,
      size,
    })
  }

  async _fetchJobSnapshots() {
    const jobId = this._jobId
    const vmRef = this.vm.$ref
    const xapi = this._xapi

    const snapshotsRef = await xapi.getField('VM', vmRef, 'snapshots')
    const snapshotsOtherConfig = await asyncMap(snapshotsRef, ref => xapi.getField('VM', ref, 'other_config'))

    const snapshots = []
    snapshotsOtherConfig.forEach((other_config, i) => {
      if (other_config['xo:backup:job'] === jobId) {
        snapshots.push({ other_config, $ref: snapshotsRef[i] })
      }
    })
    snapshots.sort((a, b) => (a.other_config['xo:backup:datetime'] < b.other_config['xo:backup:datetime'] ? -1 : 1))
    this._jobSnapshots = snapshots
  }

  async _removeUnusedSnapshots() {
    // TODO: handle all schedules (no longer existing schedules default to 0 retention)

    const { scheduleId } = this
    const scheduleSnapshots = this._jobSnapshots.filter(_ => _.other_config['xo:backup:schedule'] === scheduleId)

    const baseVmRef = this._baseVm?.$ref
    const xapi = this._xapi
    await asyncMap(getOldEntries(this._settings.snapshotRetention, scheduleSnapshots), ({ $ref }) => {
      if ($ref !== baseVmRef) {
        return xapi.VM_destroy($ref)
      }
    })
  }

  async _selectBaseVm() {
    const xapi = this._xapi

    let baseVm = findLast(this._jobSnapshots, _ => 'xo:backup:exported' in _.other_config)
    if (baseVm === undefined) {
      return
    }

    const fullInterval = this._settings.fullInterval
    const deltaChainLength = +(baseVm.other_config['xo:backup:deltaChainLength'] ?? 0) + 1
    if (!(fullInterval === 0 || fullInterval > deltaChainLength)) {
      return
    }

    const srcVdis = keyBy(await xapi.getRecords('VDI', await this.vm.$getDisks()), '$ref')

    // resolve full record
    baseVm = await xapi.getRecord('VM', baseVm.$ref)

    const baseUuidToSrcVdi = new Map()
    await asyncMap(await baseVm.$getDisks(), async baseRef => {
      const snapshotOf = await xapi.getField('VDI', baseRef, 'snapshot_of')
      const srcVdi = srcVdis[snapshotOf]
      if (srcVdi !== undefined) {
        baseUuidToSrcVdi.set(await xapi.getField('VDI', baseRef, 'uuid'), srcVdi)
      }
    })

    const presentBaseVdis = new Map(baseUuidToSrcVdi)
    const writers = this._writers
    for (let i = 0, n = writers.length; presentBaseVdis.size !== 0 && i < n; ++i) {
      await writers[i].checkBaseVdis(presentBaseVdis, baseVm)
    }

    if (presentBaseVdis.size === 0) {
      return
    }

    const fullVdisRequired = new Set()
    baseUuidToSrcVdi.forEach((srcVdi, baseUuid) => {
      if (!presentBaseVdis.has(baseUuid)) {
        fullVdisRequired.add(srcVdi.uuid)
      }
    })

    this._baseVm = baseVm
    this._fullVdisRequired = fullVdisRequired
  }

  async run() {
    await this._fetchJobSnapshots()

    if (this._isDelta) {
      await this._selectBaseVm()
    }

    await this._cleanMetadata()
    await this._removeUnusedSnapshots()

    const { _settings: settings, vm } = this
    const isRunning = vm.power_state === 'Running'
    const startAfter = isRunning && (settings.offlineBackup ? 'backup' : settings.offlineSnapshot && 'snapshot')
    if (startAfter) {
      await vm.$callAsync('clean_shutdown')
    }

    try {
      await this._snapshot()
      if (startAfter === 'snapshot') {
        ignoreErrors.call(vm.$callAsync('start', false, false))
      }

      if (this._writers.length !== 0) {
        await (this._isDelta ? this._copyDelta() : this._copyFull())
      }
    } finally {
      if (startAfter) {
        ignoreErrors.call(vm.$callAsync('start', false, false))
      }

      await this._fetchJobSnapshots()
      await this._removeUnusedSnapshots()
    }
  }
}
