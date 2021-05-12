const assert = require('assert')
// const asyncFn = require('promise-toolbox/asyncFn')
const findLast = require('lodash/findLast.js')
const ignoreErrors = require('promise-toolbox/ignoreErrors.js')
const keyBy = require('lodash/keyBy.js')
const mapValues = require('lodash/mapValues.js')
const { asyncMap, asyncMapSettled } = require('@xen-orchestra/async-map')
const { createLogger } = require('@xen-orchestra/log')
const { defer } = require('golike-defer')
const { formatDateTime } = require('@xen-orchestra/xapi')

const { DeltaBackupWriter } = require('./writers/DeltaBackupWriter.js')
const { DeltaReplicationWriter } = require('./writers/DeltaReplicationWriter.js')
const { exportDeltaVm } = require('./_deltaVm.js')
const { forkStreamUnpipe } = require('./_forkStreamUnpipe.js')
const { FullBackupWriter } = require('./writers/FullBackupWriter.js')
const { FullReplicationWriter } = require('./writers/FullReplicationWriter.js')
const { getOldEntries } = require('./_getOldEntries.js')
const { Task } = require('./Task.js')
const { watchStreamSize } = require('./_watchStreamSize.js')

const { debug, warn } = createLogger('xo:backups:VmBackup')

const asyncEach = async (iterable, fn, thisArg = iterable) => {
  for (const item of iterable) {
    await fn.call(thisArg, item)
  }
}

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
      const writers = new Set()
      this._writers = writers

      const [BackupWriter, ReplicationWriter] = this._isDelta
        ? [DeltaBackupWriter, DeltaReplicationWriter]
        : [FullBackupWriter, FullReplicationWriter]

      const allSettings = job.settings

      Object.keys(remoteAdapters).forEach(remoteId => {
        const targetSettings = {
          ...settings,
          ...allSettings[remoteId],
        }
        if (targetSettings.exportRetention !== 0) {
          writers.add(new BackupWriter({ backup: this, remoteId, settings: targetSettings }))
        }
      })
      srs.forEach(sr => {
        const targetSettings = {
          ...settings,
          ...allSettings[sr.uuid],
        }
        if (targetSettings.copyRetention !== 0) {
          writers.add(new ReplicationWriter({ backup: this, sr, settings: targetSettings }))
        }
      })
    }
  }

  // calls fn for each function, warns of any errors, and throws only if there are no writers left
  async _callWriters(fn, warnMessage, parallel = true) {
    const writers = this._writers
    if (writers.size === 0) {
      return
    }
    await (parallel ? asyncMap : asyncEach)(writers, async function (writer) {
      try {
        await fn(writer)
      } catch (error) {
        this.delete(writer)
        warn(warnMessage, { error, writer: writer.constructor.name })
      }
    })
    if (writers.size === 0) {
      throw new Error('all targets have failed, step: ' + warnMessage)
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

    const doSnapshot =
      this._isDelta || (!settings.offlineBackup && vm.power_state === 'Running') || settings.snapshotRetention !== 0
    console.log({ doSnapshot })
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
    const fullVdisRequired = this._fullVdisRequired

    const isFull = fullVdisRequired === undefined || fullVdisRequired.size !== 0

    await this._callWriters(writer => writer.prepare({ isFull }), 'writer.prepare()')

    const deltaExport = await exportDeltaVm(exportedVm, baseVm, {
      cancelToken: Task.cancelToken,
      fullVdisRequired,
    })
    const sizeContainers = mapValues(deltaExport.streams, stream => watchStreamSize(stream))

    const timestamp = Date.now()

    await this._callWriters(
      writer =>
        writer.transfer({
          deltaExport: forkDeltaExport(deltaExport),
          sizeContainers,
          timestamp,
        }),
      'writer.transfer()'
    )

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

    await this._callWriters(writer => writer.cleanup(), 'writer.cleanup()')
  }

  async _copyFull() {
    const { compression } = this.job
    const stream = await this._xapi.VM_export(this.exportedVm.$ref, {
      cancelToken: Task.cancelToken,
      compress: Boolean(compression) && (compression === 'native' ? 'gzip' : 'zstd'),
      useSnapshot: false,
    })
    const sizeContainer = watchStreamSize(stream)

    const timestamp = Date.now()

    await this._callWriters(
      writer =>
        writer.run({
          sizeContainer,
          stream: forkStreamUnpipe(stream),
          timestamp,
        }),
      'writer.run()'
    )

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
    await this._callWriters(
      writer => presentBaseVdis.size !== 0 && writer.checkBaseVdis(presentBaseVdis, baseVm),
      'writer.checkBaseVdis()',
      false
    )

    const fullVdisRequired = new Set()
    baseUuidToSrcVdi.forEach((srcVdi, baseUuid) => {
      if (!presentBaseVdis.has(baseUuid)) {
        fullVdisRequired.add(srcVdi.uuid)
      }
    })

    this._baseVm = baseVm
    this._fullVdisRequired = fullVdisRequired

    Task.info('base data', {
      vm: baseVm.uuid,
      fullVdisRequired: Array.from(fullVdisRequired),
    })
  }

  run = defer(this.run)
  async run($defer) {
    this.exportedVm = this.vm
    this.timestamp = Date.now()

    const doSnapshot = this._isDelta || vm.power_state === 'Running' || settings.snapshotRetention !== 0
    if (!this._isDelta) {
    }

    const settings = this._settings
    assert(
      !settings.offlineBackup || settings.snapshotRetention === 0,
      'offlineBackup is not compatible with snapshotRetention'
    )

    await this._callWriters(async writer => {
      await writer.beforeBackup()
      $defer(() => writer.afterBackup())
    }, 'writer.beforeBackup()')

    await this._fetchJobSnapshots()

    if (this._isDelta) {
      await this._selectBaseVm()
    }

    await this._cleanMetadata()
    await this._removeUnusedSnapshots()

    const { vm } = this
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

      if (this._writers.size !== 0) {
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

// const { prototype } = exports.VmBackup
// prototype.run = asyncFn.cancelable(prototype.run)
