// @flow

// $FlowFixMe
import type RemoteHandler from '@xen-orchestra/fs'
import asyncMap from '@xen-orchestra/async-map'
import createLogger from '@xen-orchestra/log'
import defer from 'golike-defer'
import limitConcurrency from 'limit-concurrency-decorator'
import safeTimeout from 'strict-timeout/safe'
import { type Pattern, createPredicate } from 'value-matcher'
import { PassThrough } from 'stream'
import { AssertionError } from 'assert'
import { basename, dirname } from 'path'
import { decorateWith } from '@vates/decorate-with'
import { invalidParameters } from 'xo-common/api-errors'
import { isValidXva } from '@xen-orchestra/backups/isValidXva'
import { parseDuration } from '@vates/parse-duration'
import {
  countBy,
  findLast,
  flatMap,
  forOwn,
  groupBy,
  isEmpty,
  last,
  mapValues,
  merge,
  noop,
  some,
  sum,
  values,
} from 'lodash'
import { CancelToken, ignoreErrors, timeout } from 'promise-toolbox'
import Vhd, { chainVhd, checkVhdChain, createSyntheticStream as createVhdReadStream } from 'vhd-lib'

import type Logger from '../logs/loggers/abstract'
import { type CallJob, type Executor, type Job } from '../jobs'
import { type Schedule } from '../scheduling'

import createSizeStream from '../../size-stream'
import { debounceWithKey, REMOVE_CACHE_ENTRY } from '../../_pDebounceWithKey'
import { waitAll } from '../../_waitAll'
import { type DeltaVmExport, type DeltaVmImport, type Vdi, type Vm, type Xapi, TAG_COPY_SRC } from '../../xapi'
import { formatDateTime, getVmDisks } from '../../xapi/utils'
import {
  resolveRelativeFromFile,
  safeDateFormat,
  serializeError,
  type SimpleIdPattern,
  unboxIdsFromPattern,
} from '../../utils'

import { translateLegacyJob } from './migration'

const log = createLogger('xo:xo-mixins:backups-ng')

export type Mode = 'full' | 'delta'
export type ReportWhen = 'always' | 'failure' | 'never'

type Settings = {|
  bypassVdiChainsCheck?: boolean,
  checkpointSnapshot?: boolean,
  concurrency?: number,
  deleteFirst?: boolean,
  copyRetention?: number,
  exportRetention?: number,
  offlineBackup?: boolean,
  offlineSnapshot?: boolean,
  reportRecipients?: Array<string>,
  reportWhen?: ReportWhen,
  snapshotRetention?: number,
  timeout?: number,
  vmTimeout?: number,
|}

export type BackupJob = {|
  ...$Exact<Job>,
  compression?: 'native' | 'zstd' | '',
  mode: Mode,
  proxy?: string,
  remotes?: SimpleIdPattern,
  settings: $Dict<Settings>,
  srs?: SimpleIdPattern,
  type: 'backup',
  vms: Pattern,
|}

type MetadataBase = {|
  _filename?: string,
  jobId: string,
  scheduleId: string,
  timestamp: number,
  version: '2.0.0',
  vm: Object,
  vmSnapshot: Object,
|}
type MetadataDelta = {|
  ...MetadataBase,
  mode: 'delta',
  vdis: $PropertyType<DeltaVmExport, 'vdis'>,
  vbds: $PropertyType<DeltaVmExport, 'vbds'>,
  vhds: { [vdiId: string]: string },
  vifs: $PropertyType<DeltaVmExport, 'vifs'>,
|}
type MetadataFull = {|
  ...MetadataBase,
  mode: 'full',
  xva: string,
|}
type Metadata = MetadataDelta | MetadataFull

const compareSnapshotTime = (a: Vm, b: Vm): number => (a.snapshot_time < b.snapshot_time ? -1 : 1)

const getReplicatedVmDatetime = (vm: Vm) => {
  const { 'xo:backup:datetime': datetime = vm.name_label.slice(-17, -1) } = vm.other_config
  return datetime
}

const compareReplicatedVmDatetime = (a: Vm, b: Vm): number =>
  getReplicatedVmDatetime(a) < getReplicatedVmDatetime(b) ? -1 : 1

const compareTimestamp = (a: Metadata, b: Metadata): number => a.timestamp - b.timestamp

// returns all entries but the last retention-th
const getOldEntries = <T>(retention: number, entries?: T[]): T[] =>
  entries === undefined ? [] : retention > 0 ? entries.slice(0, -retention) : entries

const defaultSettings: Settings = {
  bypassVdiChainsCheck: false,
  checkpointSnapshot: false,
  concurrency: 0,
  deleteFirst: false,
  exportRetention: 0,
  fullInterval: 0,
  offlineBackup: false,
  offlineSnapshot: false,
  reportRecipients: undefined,
  reportWhen: 'failure',
  snapshotRetention: 0,
  timeout: 0,
  vmTimeout: 0,
}
const getSetting = <T, K: $Keys<Settings>>(
  settings: $Dict<Settings>,
  name: K,
  keys: string[],
  defaultValue?: T
): T | $ElementType<Settings, K> => {
  for (let i = 0, n = keys.length; i < n; ++i) {
    const objectSettings = settings[keys[i]]
    if (objectSettings !== undefined) {
      const setting = objectSettings[name]
      if (setting !== undefined) {
        return setting
      }
    }
  }
  if (defaultValue !== undefined) {
    return defaultValue
  }
  return defaultSettings[name]
}

const BACKUP_DIR = 'xo-vm-backups'
const getVmBackupDir = (uuid: string) => `${BACKUP_DIR}/${uuid}`

const isHiddenFile = (filename: string) => filename[0] === '.'
const isMetadataFile = (filename: string) => filename.endsWith('.json')
const isVhd = (filename: string) => filename.endsWith('.vhd')
const isXva = (filename: string) => filename.endsWith('.xva')

const getJobCompression = ({ compression: c }) =>
  c === undefined || c === '' ? false : c === 'native' ? 'gzip' : 'zstd'

const listReplicatedVms = (xapi: Xapi, scheduleOrJobId: string, srUuid?: string, vmUuid?: string): Vm[] => {
  const { all } = xapi.objects
  const vms = {}
  for (const key in all) {
    const object = all[key]
    const oc = object.other_config
    if (
      object.$type === 'VM' &&
      !object.is_a_snapshot &&
      !object.is_a_template &&
      'start' in object.blocked_operations &&
      (oc['xo:backup:job'] === scheduleOrJobId || oc['xo:backup:schedule'] === scheduleOrJobId) &&
      oc['xo:backup:sr'] === srUuid &&
      (oc['xo:backup:vm'] === vmUuid ||
        // 2018-03-28, JFT: to catch VMs replicated before this fix
        oc['xo:backup:vm'] === undefined)
    ) {
      vms[object.$id] = object
    }
  }

  return values(vms).sort(compareReplicatedVmDatetime)
}

const importers: $Dict<
  (
    handler: RemoteHandler,
    metadataFilename: string,
    metadata: Metadata,
    xapi: Xapi,
    sr: { $id: string },
    taskId: string,
    logger: Logger
  ) => Promise<string>,
  Mode
> = {
  async delta(handler, metadataFilename, metadata, xapi, sr, taskId, logger) {
    metadata = ((metadata: any): MetadataDelta)
    const { vdis, vhds, vm } = metadata

    const streams = {}
    await asyncMap(vdis, async (vdi, id) => {
      streams[`${id}.vhd`] = await createVhdReadStream(handler, resolveRelativeFromFile(metadataFilename, vhds[id]))
    })

    const delta: DeltaVmImport = {
      streams,
      vbds: metadata.vbds,
      vdis,
      version: '1.0.0',
      vifs: metadata.vifs,
      vm: {
        ...vm,
        name_label: `${vm.name_label} (${safeDateFormat(metadata.timestamp)})`,
        tags: [...vm.tags, 'restored from backup'],
      },
    }

    const { vm: newVm } = await wrapTask(
      {
        logger,
        message: 'transfer',
        parentId: taskId,
        result: ({ transferSize, vm: { $id: id } }) => ({
          size: transferSize,
          id,
        }),
      },
      xapi.importDeltaVm(delta, {
        detectBase: false,
        disableStartAfterImport: false,
        srId: sr,
        // TODO: support mapVdisSrs
      })
    )
    return newVm.$id
  },
  async full(handler, metadataFilename, metadata, xapi, sr, taskId, logger) {
    metadata = ((metadata: any): MetadataFull)

    const xva = await handler.createReadStream(resolveRelativeFromFile(metadataFilename, metadata.xva), {
      checksum: true,
      ignoreMissingChecksum: true, // provide an easy way to opt-out
    })

    const vm = await wrapTask(
      {
        logger,
        message: 'transfer',
        parentId: taskId,
        result: ({ $id: id }) => ({ size: xva.length, id }),
      },
      xapi.importVm(xva, { srId: sr.$id })
    )
    await Promise.all([
      vm.add_tags('restored from backup'),
      xapi.editVm(vm.$id, {
        name_label: `${metadata.vm.name_label} (${safeDateFormat(metadata.timestamp)})`,
      }),
    ])
    return vm.$id
  },
}

const PARSE_UUID_RE = /-/g
const parseUuid = (uuid: string) => Buffer.from(uuid.replace(PARSE_UUID_RE, ''), 'hex')

const parseVmBackupId = (id: string) => {
  const i = id.indexOf('/')
  return {
    metadataFilename: id.slice(i + 1),
    remoteId: id.slice(0, i),
  }
}

const wrapTask = async <T>(opts: any, task: Promise<T>): Promise<T> => {
  const { data, logger, message, parentId, result } = opts

  const taskId = logger.notice(message, {
    event: 'task.start',
    parentId,
    data,
  })

  return task.then(
    value => {
      logger.notice(message, {
        event: 'task.end',
        result: typeof result === 'function' ? result(value) : result,
        status: 'success',
        taskId,
      })
      return task
    },
    result => {
      logger.error(message, {
        event: 'task.end',
        result: serializeError(result),
        status: 'failure',
        taskId,
      })
      return task
    }
  )
}

const wrapTaskFn = <T>(opts: any, task: (...any) => Promise<T>): ((taskId: string, ...any) => Promise<T>) =>
  async function () {
    const { data, logger, message, parentId, result } = typeof opts === 'function' ? opts.apply(this, arguments) : opts

    const taskId = logger.notice(message, {
      event: 'task.start',
      parentId,
      data,
    })

    try {
      const value = await task.apply(this, [taskId, ...arguments])
      logger.notice(message, {
        event: 'task.end',
        result: typeof result === 'function' ? result(value) : result,
        status: 'success',
        taskId,
      })
      return value
    } catch (result) {
      logger.error(message, {
        event: 'task.end',
        result: serializeError(result),
        status: 'failure',
        taskId,
      })
      throw result
    }
  }

const extractIdsFromSimplePattern = (pattern: mixed) => {
  if (pattern === null || typeof pattern !== 'object') {
    return
  }

  let keys = Object.keys(pattern)
  if (keys.length !== 1 || keys[0] !== 'id') {
    return
  }

  pattern = pattern.id
  if (typeof pattern === 'string') {
    return [pattern]
  }
  if (pattern === null || typeof pattern !== 'object') {
    return
  }

  keys = Object.keys(pattern)
  if (
    keys.length === 1 &&
    keys[0] === '__or' &&
    Array.isArray((pattern = pattern.__or)) &&
    pattern.every(_ => typeof _ === 'string')
  ) {
    return pattern
  }
}

const disableVmHighAvailability = async (xapi: Xapi, vm: Vm) => {
  if (vm.ha_restart_priority === '') {
    return
  }

  return Promise.all([vm.set_ha_restart_priority(''), vm.add_tags('HA disabled')])
}

// File structure on remotes:
//
// <remote>
// └─ xo-vm-backups
//   ├─ index.json // TODO
//   └─ <VM UUID>
//      ├─ index.json // TODO
//      ├─ vdis
//      │  └─ <job UUID>
//      │     └─ <VDI UUID>
//      │        ├─ index.json // TODO
//      │        └─ <YYYYMMDD>T<HHmmss>.vhd
//      ├─ <YYYYMMDD>T<HHmmss>.json // backup metadata
//      ├─ <YYYYMMDD>T<HHmmss>.xva
//      └─ <YYYYMMDD>T<HHmmss>.xva.checksum
//
// Attributes on created VM snapshots:
//
// - `other_config`:
//    - `xo:backup:deltaChainLength` = n (number of delta copies/replicated since a full)
//    - `xo:backup:exported` = 'true' (added at the end of the backup)
//
// Attributes on created VMs and created snapshots:
//
// - `other_config`:
//    - `xo:backup:datetime`: format is UTC %Y%m%dT%H:%M:%SZ
//       - from snapshots: snapshot.snapshot_time
//       - with offline backup: formatDateTime(Date.now())
//    - `xo:backup:job` = job.id
//    - `xo:backup:schedule` = schedule.id
//    - `xo:backup:vm` = vm.uuid
//
// Attributes of created VMs:
//
// - `name_label`: `${original name} - ${job name} - (${safeDateFormat(backup timestamp)})`
// - tag:
//    - copy in delta mode: `Continuous Replication`
//    - copy in full mode: `Disaster Recovery`
//    - imported from backup: `restored from backup`
// - `blocked_operations.start`: message
// - for copies/replications only, added after complete transfer
//    - `other_config[xo:backup:sr]` = sr.uuid
//
// Task logs emitted in a backup execution:
//
// job.start(data: { mode: Mode, reportWhen: ReportWhen })
// ├─ task.info(message: 'vms', data: { vms: string[] })
// ├─ task.warning(message: string)
// ├─ task.start(data: { type: 'VM', id: string })
// │  ├─ task.warning(message: string)
// │  ├─ task.start(message: 'snapshot')
// │  │  └─ task.end
// │  ├─ task.start(message: 'export', data: { type: 'SR' | 'remote', id: string })
// │  │  ├─ task.warning(message: string)
// │  │  ├─ task.start(message: 'transfer')
// │  │  │  ├─ task.warning(message: string)
// │  │  │  └─ task.end(result: { size: number })
// │  │  │
// │  │  │  // in case of full backup, DR and CR
// │  │  ├─ task.start(message: 'clean')
// │  │  │  ├─ task.warning(message: string)
// │  │  │  └─ task.end
// │  │  │
// │  │  │ // in case of delta backup
// │  │  ├─ task.start(message: 'merge')
// │  │  │  ├─ task.warning(message: string)
// │  │  │  └─ task.end(result: { size: number })
// │  │  │
// │  │  └─ task.end
// │  └─ task.end
// └─ job.end
export default class BackupNg {
  _app: {
    createJob: ($Diff<BackupJob, {| id: string |}>) => Promise<BackupJob>,
    createSchedule: ($Diff<Schedule, {| id: string |}>) => Promise<Schedule>,
    deleteSchedule: (id: string) => Promise<void>,
    getAllSchedules: () => Promise<Schedule[]>,
    getRemoteHandler: (id: string) => Promise<RemoteHandler>,
    getXapi: (id: string) => Xapi,
    getJob: ((id: string, 'backup') => Promise<BackupJob>) & ((id: string, 'call') => Promise<CallJob>),
    getLogs: (namespace: string) => Promise<{ [id: string]: Object }>,
    updateJob: (($Shape<BackupJob>, ?boolean) => Promise<BackupJob>) &
      (($Shape<CallJob>, ?boolean) => Promise<CallJob>),
    removeJob: (id: string) => Promise<void>,
    worker: $Dict<any>,
  }
  _logger: Logger
  _runningRestores: Set<string>

  get runningRestores() {
    return this._runningRestores
  }

  constructor(app: any, { backup }) {
    this._app = app
    this._logger = undefined
    this._runningRestores = new Set()
    this._backupOptions = backup

    app.on('start', async () => {
      this._logger = await app.getLogger('restore')

      const executor: Executor = async ({ cancelToken, data, job: job_, logger, runJobId, schedule }) => {
        if (schedule === undefined) {
          throw new Error('backup job cannot run without a schedule')
        }

        let vmsId = data?.vms

        const job: BackupJob = (job_: any)
        const vmsPattern = job.vms

        let vms: $Dict<Vm>
        if (vmsId !== undefined || (vmsId = extractIdsFromSimplePattern(vmsPattern)) !== undefined) {
          vms = {}
          vmsId.forEach(id => {
            try {
              vms[id] = app.getObject(id, 'VM')
            } catch (error) {
              // log failure task in case of missing VM
              const taskId = logger.notice(`Starting backup of ${id}. (${job.id})`, {
                data: {
                  type: 'VM',
                  id,
                },
                event: 'task.start',
                parentId: runJobId,
              })
              logger.error(`Backuping ${id} has failed. (${job.id})`, {
                event: 'task.end',
                result: serializeError(error),
                status: 'failure',
                taskId,
              })
            }
          })
        } else {
          vms = app.getObjects({
            filter: createPredicate({
              type: 'VM',
              ...vmsPattern,
            }),
          })
          if (isEmpty(vms)) {
            throw new Error('no VMs match this pattern')
          }
        }
        const jobId = job.id

        const remoteIds = unboxIdsFromPattern(job.remotes)
        const srIds = unboxIdsFromPattern(job.srs)

        const proxyId = job.proxy
        if (proxyId !== undefined) {
          const vmIds = Object.keys(vms)

          const recordToXapi = {}
          const servers = new Set()
          const handleRecord = uuid => {
            const serverId = app.getXenServerIdByObject(uuid)
            recordToXapi[uuid] = serverId
            servers.add(serverId)
          }
          vmIds.forEach(handleRecord)
          srIds.forEach(handleRecord)

          const remotes = {}
          const xapis = {}
          await waitAll([
            asyncMap(remoteIds, async id => {
              const remote = await app.getRemoteWithCredentials(id)
              if (remote.proxy !== proxyId) {
                throw new Error(`The remote ${remote.name} must be linked to the proxy ${proxyId}`)
              }

              remotes[id] = remote
            }),
            asyncMap([...servers], async id => {
              const { allowUnauthorized, host, password, username } = await app.getXenServer(id)
              xapis[id] = {
                allowUnauthorized,
                credentials: {
                  username,
                  password,
                },
                url: host,
              }
            }),
          ])

          const params = {
            job: {
              ...job,

              // Make sure we are passing only the VM to run which can be
              // different than the VMs in the job itself.
              vms: { id: { __or: vmIds } },
            },
            recordToXapi,
            remotes,
            schedule,
            streamLogs: true,
            xapis,
          }

          try {
            const logsStream = await app.callProxyMethod(proxyId, 'backup.run', params, {
              assertType: 'iterator',
            })

            const localTaskIds = { __proto__: null }
            for await (const log of logsStream) {
              const { event, message, taskId } = log

              const common = {
                data: log.data,
                event: 'task.' + event,
                result: log.result,
                status: log.status,
              }

              if (event === 'start') {
                const { parentId } = log
                if (parentId === undefined) {
                  // ignore root task (already handled by runJob)
                  localTaskIds[taskId] = runJobId
                } else {
                  common.parentId = localTaskIds[parentId]
                  localTaskIds[taskId] = logger.notice(message, common)
                }
              } else {
                const localTaskId = localTaskIds[taskId]
                if (localTaskId === runJobId) {
                  if (event === 'end') {
                    if (log.status === 'failure') {
                      throw log.result
                    }
                    return log.result
                  }
                } else {
                  common.taskId = localTaskId
                  logger.notice(message, common)
                }
              }
            }
            return
          } catch (error) {
            if (invalidParameters.is(error)) {
              delete params.streamLogs
              return app.callProxyMethod(proxyId, 'backup.run', params)
            }
            throw error
          } finally {
            remoteIds.forEach(id => this._listVmBackupsOnRemote(REMOVE_CACHE_ENTRY, id))
          }
        }

        const srs = srIds.map(id => app.getXapiObject(id, 'SR'))
        const remotes = await Promise.all(
          remoteIds.map(async id => {
            const remote = await app.getRemoteWithCredentials(id)
            if (remote.proxy !== undefined) {
              throw new Error(`The remote ${remote.name} must not be linked to a proxy`)
            }

            return {
              id,
              handler: await app.getRemoteHandler(remote),
            }
          })
        )

        const settings = merge(job.settings, data?.settings)

        const timeout = getSetting(settings, 'timeout', [''])
        if (timeout !== 0) {
          const source = CancelToken.source([cancelToken])
          cancelToken = source.token
          safeTimeout(source.cancel, timeout)
        }

        let handleVm = async vm => {
          const { name_label: name, uuid } = vm
          const taskId: string = logger.notice(`Starting backup of ${name}. (${jobId})`, {
            event: 'task.start',
            parentId: runJobId,
            data: {
              type: 'VM',
              id: uuid,
            },
          })
          let vmCancel
          try {
            cancelToken.throwIfRequested()

            const isMigrating = Object.values(vm.current_operations).some(
              op => op === 'migrate_send' || op === 'pool_migrate'
            )
            if (isMigrating) {
              throw new Error('VM is currently migrating')
            }

            vmCancel = CancelToken.source([cancelToken])

            // $FlowFixMe injected $defer param
            const p = this._backupVm(vmCancel.token, uuid, job, schedule, logger, taskId, settings, srs, remotes)

            // 2018-07-20, JFT: vmTimeout is disabled for the time being until
            // we figure out exactly how it should behave.
            //
            // const vmTimeout: number = getSetting(settings, 'vmTimeout', [
            //   uuid,
            //   scheduleId,
            // ])
            // if (vmTimeout !== 0) {
            //   p = pTimeout.call(p, vmTimeout)
            // }

            await p
            logger.notice(`Backuping ${name} is a success. (${jobId})`, {
              event: 'task.end',
              taskId,
              status: 'success',
            })
          } catch (error) {
            if (vmCancel !== undefined) {
              vmCancel.cancel()
            }
            logger.error(`Backuping ${name} has failed. (${jobId})`, {
              event: 'task.end',
              taskId,
              status: 'failure',
              result: Array.isArray(error) ? error.map(serializeError) : serializeError(error),
            })
          }
        }

        const concurrency: number = getSetting(settings, 'concurrency', [''])
        if (concurrency !== 0) {
          handleVm = limitConcurrency(concurrency)(handleVm)
          logger.notice('vms', {
            event: 'task.info',
            taskId: runJobId,
            data: {
              vms: Object.keys(vms),
            },
          })
        }
        await asyncMap(vms, handleVm)

        remotes.forEach(({ id }) => this._listVmBackupsOnRemote(REMOVE_CACHE_ENTRY, id))
      }
      app.registerJobExecutor('backup', executor)
    })
  }

  async createBackupNgJob(
    props: $Diff<BackupJob, {| id: string |}>,
    schedules?: $Dict<$Diff<Schedule, {| id: string |}>>
  ): Promise<BackupJob> {
    const app = this._app
    props.type = 'backup'
    const job: BackupJob = await app.createJob(props)

    if (schedules !== undefined) {
      const { id, settings } = job
      const tmpIds = Object.keys(schedules)
      await asyncMap(tmpIds, async (tmpId: string) => {
        // $FlowFixMe don't know what is the problem (JFT)
        const schedule = schedules[tmpId]
        schedule.jobId = id
        settings[(await app.createSchedule(schedule)).id] = settings[tmpId]
        delete settings[tmpId]
      })
      await app.updateJob({ id, settings })
    }

    return job
  }

  async deleteBackupNgJob(id: string): Promise<void> {
    const app = this._app
    const [schedules] = await Promise.all([app.getAllSchedules(), app.getJob(id, 'backup')])
    await Promise.all([
      app.removeJob(id),
      asyncMap(schedules, schedule => {
        if (schedule.id === id) {
          app.deleteSchedule(schedule.id)
        }
      }),
    ])
  }

  async deleteVmBackupNg(id: string): Promise<void> {
    const app = this._app
    const { metadataFilename, remoteId } = parseVmBackupId(id)
    const { proxy, url, options } = await app.getRemoteWithCredentials(remoteId)
    if (proxy !== undefined) {
      await app.callProxyMethod(proxy, 'backup.deleteVmBackup', {
        filename: metadataFilename,
        remote: {
          url,
          options,
        },
      })
    } else {
      const handler = await app.getRemoteHandler(remoteId)
      const metadata: Metadata = JSON.parse(String(await handler.readFile(metadataFilename)))
      metadata._filename = metadataFilename

      if (metadata.mode === 'delta') {
        await this._deleteDeltaVmBackups(handler, [metadata])
      } else if (metadata.mode === 'full') {
        await this._deleteFullVmBackups(handler, [metadata])
      } else {
        throw new Error(`no deleter for backup mode ${metadata.mode}`)
      }
    }

    this._listVmBackupsOnRemote(REMOVE_CACHE_ENTRY, remoteId)
  }

  // Task logs emitted in a restore execution:
  //
  // task.start(message: 'restore', data: { jobId: string, srId: string, time: number })
  // ├─ task.start(message: 'transfer')
  // │  └─ task.end(result: { id: string, size: number })
  // └─ task.end
  async importVmBackupNg(id: string, srId: string): Promise<string> {
    const app = this._app
    const xapi = app.getXapi(srId)
    const sr = xapi.getObject(srId)

    const { metadataFilename, remoteId } = parseVmBackupId(id)
    const { proxy, url, options } = await app.getRemoteWithCredentials(remoteId)

    let rootTaskId
    const logger = this._logger
    try {
      if (proxy !== undefined) {
        const { allowUnauthorized, host, password, username } = await app.getXenServer(
          app.getXenServerIdByObject(sr.$id)
        )

        const params = {
          backupId: metadataFilename,
          remote: {
            url,
            options,
          },
          srUuid: sr.uuid,
          streamLogs: true,
          xapi: {
            allowUnauthorized,
            credentials: {
              username,
              password,
            },
            url: host,
          },
        }

        try {
          const logsStream = await app.callProxyMethod(proxy, 'backup.importVmBackup', params, {
            assertType: 'iterator',
          })

          const localTaskIds = { __proto__: null }
          for await (const log of logsStream) {
            const { event, message, taskId } = log

            const common = {
              data: log.data,
              event: 'task.' + event,
              result: log.result,
              status: log.status,
            }

            if (event === 'start') {
              const { parentId } = log
              if (parentId === undefined) {
                rootTaskId = localTaskIds[taskId] = logger.notice(message, common)
                this._runningRestores.add(rootTaskId)
              } else {
                common.parentId = localTaskIds[parentId]
                localTaskIds[taskId] = logger.notice(message, common)
              }
            } else {
              common.taskId = localTaskIds[taskId]
              logger.notice(message, common)
            }
          }

          return
        } catch (error) {
          if (invalidParameters.is(error)) {
            delete params.streamLogs
            return app.callProxyMethod(proxy, 'backup.importVmBackup', params)
          }
          throw error
        }
      }

      const handler = await app.getRemoteHandler(remoteId)
      const metadata: Metadata = JSON.parse(String(await handler.readFile(metadataFilename)))

      const importer = importers[metadata.mode]
      if (importer === undefined) {
        throw new Error(`no importer for backup mode ${metadata.mode}`)
      }

      const { jobId, timestamp: time } = metadata
      return wrapTaskFn(
        {
          data: {
            jobId,
            srId,
            time,
          },
          logger,
          message: 'restore',
        },
        taskId => {
          rootTaskId = taskId
          this._runningRestores.add(taskId)
          return importer(handler, metadataFilename, metadata, xapi, sr, taskId, logger)
        }
      )()
    } finally {
      this._runningRestores.delete(rootTaskId)
    }
  }

  @decorateWith(
    debounceWithKey,
    function () {
      return parseDuration(this._backupOptions.listingDebounce)
    },
    function keyFn(remoteId) {
      return [this, remoteId]
    }
  )
  async _listVmBackupsOnRemote(remoteId: string) {
    const app = this._app
    const backupsByVm = {}
    try {
      const { proxy, url, options } = await app.getRemoteWithCredentials(remoteId)
      if (proxy !== undefined) {
        const { [remoteId]: backupsByVm } = await app.callProxyMethod(proxy, 'backup.listVmBackups', {
          remotes: {
            [remoteId]: {
              url,
              options,
            },
          },
        })

        // inject the remote id on the backup which is needed for importVmBackupNg()
        forOwn(backupsByVm, backups =>
          backups.forEach(backup => {
            backup.id = `${remoteId}${backup.id}`
          })
        )
        return backupsByVm
      }

      const handler = await app.getRemoteHandler(remoteId)

      const entries = (
        await handler.list(BACKUP_DIR).catch(error => {
          if (error == null || error.code !== 'ENOENT') {
            throw error
          }
          return []
        })
      ).filter(name => name !== 'index.json')

      await Promise.all(
        entries.map(async vmUuid => {
          // $FlowFixMe don't know what is the problem (JFT)
          const backups = await this._listVmBackups(handler, vmUuid)

          if (backups.length === 0) {
            return
          }

          backupsByVm[vmUuid] = backups.map(backup => ({
            disks:
              backup.vhds === undefined
                ? []
                : Object.keys(backup.vhds).map(vdiId => {
                    const vdi = backup.vdis[vdiId]
                    return {
                      id: `${dirname(backup._filename)}/${backup.vhds[vdiId]}`,
                      name: vdi.name_label,
                      uuid: vdi.uuid,
                    }
                  }),

            // inject an id usable by importVmBackupNg()
            id: `${remoteId}/${backup._filename}`,
            jobId: backup.jobId,
            mode: backup.mode,
            scheduleId: backup.scheduleId,
            size: backup.size,
            timestamp: backup.timestamp,
            vm: {
              name_description: backup.vm.name_description,
              name_label: backup.vm.name_label,
            },
          }))
        })
      )
    } catch (error) {
      log.warn(`listVmBackups for remote ${remoteId}:`, { error })
    }
    return backupsByVm
  }

  async listVmBackupsNg(remotes: string[], _forceRefresh = false) {
    const backupsByVmByRemote: $Dict<$Dict<Metadata[]>> = {}

    await Promise.all(
      remotes.map(async remoteId => {
        if (_forceRefresh) {
          this._listVmBackupsOnRemote(REMOVE_CACHE_ENTRY, remoteId)
        }

        backupsByVmByRemote[remoteId] = await this._listVmBackupsOnRemote(remoteId)
      })
    )

    return backupsByVmByRemote
  }

  async migrateLegacyBackupJob(jobId: string) {
    const [job, schedules] = await Promise.all([this._app.getJob(jobId, 'call'), this._app.getAllSchedules()])
    await this._app.updateJob(translateLegacyJob(job, schedules), false)
  }

  // High:
  // - [ ] in case of merge failure
  //       1. delete (or isolate) the tainted VHD
  //       2. next run should be a full
  // - [ ] add a lock on the job/VDI during merge which should prevent other merges and restoration
  // - [ ] in case of failure, correctly clean VHDs for all VDIs
  //
  // Low:
  // - [ ] display queued VMs
  // - [ ] snapshots and files of an old job should be detected and removed
  // - [ ] delta import should support mapVdisSrs
  // - [ ] size of the path? (base64url(parseUuid(uuid)))
  // - [ ] what does mean the vmTimeout with the new concurrency? a VM can take
  //       a very long time to finish if there are other VMs before…
  // - [ ] detect and gc uncomplete replications
  // - [ ] attach VDIs ASAP to be able to clean them in case of interruption
  // - [ ] orphan VDIs on the source side
  //
  // Triage:
  // - [ ] logs
  //
  // Done:
  //
  // - [x] files (.tmp) should be renamed at the end of job
  // - [x] detect full remote
  // - [x] can the snapshot and export retention be different? → Yes
  // - [x] deleteFirst per target
  // - [x] timeout per VM
  // - [x] backups should be deletable from the API
  // - [x] adding and removing VDIs should behave
  // - [x] isolate VHD chains by job
  // - [x] do not delete rolling snapshot in case of failure!
  // - [x] do not create snapshot if unhealthy vdi chain
  // - [x] replicated VMs should be discriminated by VM (vatesfr/xen-orchestra#2807)
  // - [x] clones of replicated VMs should not be garbage collected
  // - [x] import for delta
  // - [x] fix backup reports
  // - [x] jobs should be cancelable
  // - [x] possibility to (re-)run a single VM in a backup?
  // - [x] validate VHDs after exports and before imports, how?
  // - [x] check merge/transfert duration/size are what we want for delta
  // - [x] delete interrupted *importing* VMs
  @defer
  async _backupVm(
    $defer: any,
    $cancelToken: any,
    vmUuid: string,
    job: BackupJob,
    schedule: Schedule,
    logger: any,
    taskId: string,
    settings: Settings,
    srs: any[],
    remotes: any[]
  ): Promise<void> {
    const app = this._app
    const xapi = app.getXapi(vmUuid)
    const vm: Vm = (xapi.getObject(vmUuid): any)

    // ensure the VM itself does not have any backup metadata which would be
    // copied on manual snapshots and interfere with the backup jobs
    if ('xo:backup:job' in vm.other_config) {
      await wrapTask(
        {
          logger,
          message: 'clean backup metadata on VM',
          parentId: taskId,
        },
        vm.update_other_config({
          'xo:backup:datetime': null,
          'xo:backup:deltaChainLength': null,
          'xo:backup:exported': null,
          'xo:backup:job': null,
          'xo:backup:schedule': null,
          'xo:backup:vm': null,
        })
      )
    }

    const { id: jobId, mode } = job
    const { id: scheduleId } = schedule

    let exportRetention: number = getSetting(settings, 'exportRetention', [scheduleId])
    let copyRetention: number | void = getSetting(settings, 'copyRetention', [scheduleId])

    if (copyRetention === undefined) {
      // if copyRetention is not defined, it uses exportRetention's value due to
      // previous implementation which did not support copyRetention
      copyRetention = srs.length === 0 ? 0 : exportRetention

      if (remotes.length === 0) {
        exportRetention = 0
      }
    } else if (exportRetention !== 0 && remotes.length === 0) {
      throw new Error('export retention must be 0 without remotes')
    }

    if (copyRetention !== 0 && srs.length === 0) {
      throw new Error('copy retention must be 0 without SRs')
    }

    if (remotes.length !== 0 && srs.length !== 0 && (copyRetention === 0) !== (exportRetention === 0)) {
      throw new Error('both or neither copy and export retentions must be 0')
    }

    const snapshotRetention: number = getSetting(settings, 'snapshotRetention', [scheduleId])

    if (copyRetention === 0 && exportRetention === 0 && snapshotRetention === 0) {
      throw new Error('copy, export and snapshot retentions cannot both be 0')
    }

    const isOfflineBackup = mode === 'full' && getSetting(settings, 'offlineBackup', [vmUuid, ''])
    if (isOfflineBackup && snapshotRetention > 0) {
      throw new Error('offline backup is not compatible with rolling snapshot')
    }

    if (!some(vm.$VBDs, vbd => vbd.type === 'Disk' && vbd.VDI !== 'OpaqueRef:NULL')) {
      throw new Error('no disks found')
    }

    let baseSnapshot, exported: Vm, exportDateTime
    if (isOfflineBackup) {
      exported = vm
      exportDateTime = formatDateTime(Date.now())
      if (vm.power_state === 'Running') {
        await wrapTask(
          {
            logger,
            message: 'shutdown VM',
            parentId: taskId,
          },
          xapi.shutdownVm(vm)
        )
        $defer(() => xapi.startVm(vm))
      }
    } else {
      const snapshots = vm.$snapshots.filter(_ => _.other_config['xo:backup:job'] === jobId).sort(compareSnapshotTime)

      const bypassVdiChainsCheck: boolean = getSetting(settings, 'bypassVdiChainsCheck', [vmUuid, ''])
      if (!bypassVdiChainsCheck) {
        xapi._assertHealthyVdiChains(vm)
      }

      const offlineSnapshot: boolean = getSetting(settings, 'offlineSnapshot', [vmUuid, ''])
      const startAfterSnapshot = offlineSnapshot && vm.power_state === 'Running'
      if (startAfterSnapshot) {
        await wrapTask(
          {
            logger,
            message: 'shutdown VM',
            parentId: taskId,
          },
          xapi.shutdownVm(vm)
        )
      }

      const checkpointSnapshot = !offlineSnapshot && getSetting(settings, 'checkpointSnapshot', [vmUuid, ''])
      exported = (await wrapTask(
        {
          logger,
          message: 'snapshot',
          parentId: taskId,
          result: _ => _.uuid,
        },
        checkpointSnapshot
          ? xapi.checkpointVm($cancelToken, vm.$id, `[XO Backup ${job.name}] ${vm.name_label}`)
          : xapi._snapshotVm($cancelToken, vm, `[XO Backup ${job.name}] ${vm.name_label}`)
      ): any)

      if (startAfterSnapshot) {
        ignoreErrors.call(xapi.startVm(vm))
      }

      await wrapTask(
        {
          logger,
          message: 'add metadata to snapshot',
          parentId: taskId,
        },
        exported.update_other_config({
          'xo:backup:datetime': exported.snapshot_time,
          'xo:backup:job': jobId,
          'xo:backup:schedule': scheduleId,
          'xo:backup:vm': vmUuid,
        })
      )

      exported = await xapi.barrier(exported.$ref)

      if (mode === 'delta') {
        baseSnapshot = findLast(snapshots, _ => 'xo:backup:exported' in _.other_config)

        // JFT 2018-10-02: support previous snapshots which did not have this
        // entry, can be removed after 2018-12.
        if (baseSnapshot === undefined) {
          baseSnapshot = last(snapshots)
        }
      }
      snapshots.push(exported)

      // snapshots to delete due to the snapshot retention settings
      const snapshotsToDelete = flatMap(
        groupBy(snapshots, _ => _.other_config['xo:backup:schedule']),
        (snapshots, scheduleId) => getOldEntries(getSetting(settings, 'snapshotRetention', [scheduleId]), snapshots)
      )

      // delete unused snapshots
      await asyncMap(snapshotsToDelete, vm => {
        // snapshot and baseSnapshot should not be deleted right now
        if (vm !== exported && vm !== baseSnapshot) {
          return xapi.deleteVm(vm)
        }
      })

      exported = ((await wrapTask(
        {
          logger,
          message: 'waiting for uptodate snapshot record',
          parentId: taskId,
        },
        xapi.barrier(exported.$ref)
      ): any): Vm)

      if (mode === 'full' && snapshotsToDelete.includes(exported)) {
        // TODO: do not create the snapshot if there are no snapshotRetention and
        // the VM is not running
        $defer.call(xapi, 'deleteVm', exported)
      } else if (mode === 'delta') {
        if (snapshotsToDelete.includes(exported)) {
          $defer.onFailure.call(xapi, 'deleteVm', exported)
        }
        if (snapshotsToDelete.includes(baseSnapshot)) {
          $defer.onSuccess.call(xapi, 'deleteVm', baseSnapshot)
        }
      }
    }

    if (copyRetention === 0 && exportRetention === 0) {
      return
    }

    const nTargets = remotes.length + srs.length

    const now = Date.now()
    const vmDir = getVmBackupDir(vmUuid)

    const basename = safeDateFormat(now)

    const metadataFilename = `${vmDir}/${basename}.json`

    if (mode === 'full') {
      let compress = getJobCompression(job)
      const pool = exported.$pool
      if (compress === 'zstd' && pool.restrictions.restrict_zstd_export !== 'false') {
        compress = false
        logger.warning(
          `Zstd is not supported on the pool ${pool.name_label}, the VM will be exported without compression`,
          {
            event: 'task.warning',
            taskId,
          }
        )
      }
      let xva: any = await wrapTask(
        {
          logger,
          message: 'start VM export',
          parentId: taskId,
        },
        xapi.exportVm($cancelToken, exported, {
          compress,
        })
      )
      const exportTask = xva.task
      xva = xva.pipe(createSizeStream())

      const forkExport =
        nTargets === 1
          ? () => xva
          : () => {
              const fork = xva.pipe(new PassThrough())
              fork.task = exportTask
              return fork
            }

      const dataBasename = `${basename}.xva`

      const metadata: MetadataFull = {
        jobId,
        mode: 'full',
        scheduleId,
        timestamp: now,
        version: '2.0.0',
        vm,
        vmSnapshot: exported.id !== vm.id ? exported : undefined,
        xva: `./${dataBasename}`,
      }
      const dataFilename = `${vmDir}/${dataBasename}`

      const jsonMetadata = JSON.stringify(metadata)

      await waitAll([
        ...remotes.map(
          wrapTaskFn(
            ({ id }) => ({
              data: { id, type: 'remote' },
              logger,
              message: 'export',
              parentId: taskId,
            }),
            async (taskId, { handler, id: remoteId }) => {
              const fork = forkExport()

              // remove incomplete XVAs
              await asyncMap(
                handler.list(vmDir, {
                  filter: filename => isHiddenFile(filename) && isXva(filename),
                  prependDir: true,
                }),
                file => handler.unlink(file)
              )::ignoreErrors()

              const oldBackups: MetadataFull[] = (getOldEntries(
                exportRetention - 1,
                await this._listVmBackups(handler, vm, _ => _.mode === 'full' && _.scheduleId === scheduleId)
              ): any)

              const deleteOldBackups = () =>
                wrapTask(
                  {
                    logger,
                    message: 'clean',
                    parentId: taskId,
                  },
                  this._deleteFullVmBackups(handler, oldBackups)
                )
              const deleteFirst = getSetting(settings, 'deleteFirst', [remoteId])
              if (deleteFirst) {
                await deleteOldBackups()
              }

              const { dirMode } = this._backupOptions
              await wrapTask(
                {
                  logger,
                  message: 'transfer',
                  parentId: taskId,
                  result: () => ({ size: xva.size }),
                },
                handler.outputStream(dataFilename, fork, {
                  dirMode,
                })
              )

              if (handler._getFilePath !== undefined) {
                await isValidXva(handler._getFilePath('/' + dataFilename))
              }

              await handler.outputFile(metadataFilename, jsonMetadata, {
                dirMode,
              })

              if (!deleteFirst) {
                await deleteOldBackups()
              }
            }
          )
        ),
        ...srs.map(
          wrapTaskFn(
            ({ $id: id }) => ({
              data: { id, type: 'SR' },
              logger,
              message: 'export',
              parentId: taskId,
            }),
            async (taskId, sr) => {
              const fork = forkExport()

              const { uuid: srUuid, $xapi: xapi } = sr

              // delete previous interrupted copies
              ignoreErrors.call(this._deleteVms(xapi, listReplicatedVms(xapi, scheduleId, undefined, vmUuid)))

              const oldVms = getOldEntries(copyRetention - 1, listReplicatedVms(xapi, scheduleId, srUuid, vmUuid))

              const deleteOldBackups = () =>
                wrapTask(
                  {
                    logger,
                    message: 'clean',
                    parentId: taskId,
                  },
                  this._deleteVms(xapi, oldVms)
                )
              const deleteFirst = getSetting(settings, 'deleteFirst', [srUuid])
              if (deleteFirst) {
                await deleteOldBackups()
              }

              const vm = await xapi.barrier(
                await wrapTask(
                  {
                    logger,
                    message: 'transfer',
                    parentId: taskId,
                    result: () => ({ size: xva.size }),
                  },
                  xapi._importVm($cancelToken, fork, sr, vm =>
                    Promise.all([
                      vm.add_tags('Disaster Recovery'),
                      vm.set_name_label(
                        `${metadata.vm.name_label} - ${job.name} - (${safeDateFormat(metadata.timestamp)})`
                      ),
                    ])
                  )
                )
              )

              await Promise.all([
                disableVmHighAvailability(xapi, vm),
                vm.update_blocked_operations(
                  'start',
                  'Start operation for this vm is blocked, clone it if you want to use it.'
                ),
                !isOfflineBackup
                  ? vm.update_other_config('xo:backup:sr', srUuid)
                  : vm.update_other_config({
                      'xo:backup:datetime': exportDateTime,
                      'xo:backup:job': jobId,
                      'xo:backup:schedule': scheduleId,
                      'xo:backup:sr': srUuid,
                      'xo:backup:vm': exported.uuid,
                    }),
              ])

              if (!deleteFirst) {
                await deleteOldBackups()
              }
            }
          )
        ),
      ]).catch(noop) // errors are handled in logs
    } else if (mode === 'delta') {
      let deltaChainLength = 0
      let fullVdisRequired
      await (async () => {
        if (baseSnapshot === undefined) {
          return
        }

        let prevDeltaChainLength = +baseSnapshot.other_config['xo:backup:deltaChainLength']
        if (Number.isNaN(prevDeltaChainLength)) {
          prevDeltaChainLength = 0
        }
        deltaChainLength = prevDeltaChainLength + 1

        const fullInterval = getSetting(settings, 'fullInterval', [vmUuid, scheduleId, ''])
        if (fullInterval !== 0 && fullInterval <= deltaChainLength) {
          baseSnapshot = undefined
          return
        }

        const fullRequired = { __proto__: null }
        const vdis: $Dict<Vdi> = getVmDisks(baseSnapshot)

        // ignore VDI snapshots which no longer have a parent
        forOwn(vdis, (vdi, key, vdis) => {
          // `vdi.snapshot_of` is not always set to the null ref, it can contain
          // an invalid ref, that's why the test is on `vdi.$snapshot_of`
          if (vdi.$snapshot_of === undefined) {
            delete vdis[key]
          }
        })

        for (const { uuid: srUuid, $xapi: xapi } of srs) {
          const replicatedVm = listReplicatedVms(xapi, jobId, srUuid, vmUuid).find(
            vm => vm.other_config[TAG_COPY_SRC] === baseSnapshot.uuid
          )
          if (replicatedVm === undefined) {
            baseSnapshot = undefined
            return
          }

          const replicatedVdis = countBy(getVmDisks(replicatedVm), vdi => vdi.other_config[TAG_COPY_SRC])
          forOwn(vdis, vdi => {
            if (!(vdi.uuid in replicatedVdis)) {
              fullRequired[vdi.$snapshot_of.$id] = true
            }
          })
        }

        await asyncMap(remotes, ({ handler }) => {
          return asyncMap(vdis, async vdi => {
            const snapshotOf = vdi.$snapshot_of
            const dir = `${vmDir}/vdis/${jobId}/${snapshotOf.uuid}`
            const files = await handler.list(dir, { filter: isVhd }).catch(_ => [])
            let full = true
            await asyncMap(files, async file => {
              if (file[0] !== '.') {
                try {
                  const path = `${dir}/${file}`
                  const vhd = new Vhd(handler, path)
                  await vhd.readHeaderAndFooter()

                  if (vhd.footer.uuid.equals(parseUuid(vdi.uuid))) {
                    await checkVhdChain(handler, path)
                    full = false
                  }

                  return
                } catch (error) {
                  const corruptedVhdOrMissingParent = error instanceof AssertionError || error?.code === 'ENOENT'
                  if (!corruptedVhdOrMissingParent) {
                    throw error
                  }
                }
              }

              // either a temporary file or an invalid VHD
              await handler.unlink(`${dir}/${file}`)
            })
            if (full) {
              fullRequired[snapshotOf.$id] = true
            }
          })
        })
        fullVdisRequired = Object.keys(fullRequired)
      })()

      const deltaExport = await wrapTask(
        {
          logger,
          message: 'start snapshot export',
          parentId: taskId,
        },
        xapi.exportDeltaVm($cancelToken, exported, baseSnapshot, {
          fullVdisRequired,
        })
      )

      const metadata: MetadataDelta = {
        jobId,
        mode: 'delta',
        scheduleId,
        timestamp: now,
        vbds: deltaExport.vbds,
        vdis: deltaExport.vdis,
        version: '2.0.0',
        vifs: deltaExport.vifs,
        vhds: mapValues(
          deltaExport.vdis,
          vdi =>
            `vdis/${jobId}/${
              (vdi.type === 'suspend'
                ? // doesn't make sense to group by parent for memory because we
                  // don't do delta for it
                  vdi
                : (xapi.getObject(vdi.snapshot_of): Object)
              ).uuid
            }/${basename}.vhd`
        ),
        vm,
        vmSnapshot: exported,
      }

      const jsonMetadata = JSON.stringify(metadata)

      // create a fork of the delta export
      const forkExport =
        nTargets === 1
          ? () => deltaExport
          : (() => {
              // replace the stream factories by fork factories
              const streams: any = mapValues(deltaExport.streams, lazyStream => {
                // wait for all targets to require the stream and then starts
                // the real export and create the forks.
                const resolves = []
                function resolver(resolve) {
                  resolves.push(resolve)

                  if (resolves.length === nTargets) {
                    const pStream = lazyStream()
                    resolves.forEach(resolve => {
                      resolve(
                        pStream.then(stream => {
                          const fork: any = stream.pipe(new PassThrough())
                          fork.task = stream.task
                          return fork
                        })
                      )
                    })
                    resolves.length = 0
                  }
                }

                return () => new Promise(resolver)
              })
              return () => {
                return {
                  __proto__: deltaExport,
                  streams,
                }
              }
            })()

      const isFull = some(deltaExport.vdis, vdi => vdi.other_config['xo:base_delta'] === undefined)
      await waitAll([
        ...remotes.map(
          wrapTaskFn(
            ({ id }) => ({
              data: { id, isFull, type: 'remote' },
              logger,
              message: 'export',
              parentId: taskId,
            }),
            async (taskId, { handler, id: remoteId }) => {
              const fork = forkExport()

              const oldBackups: MetadataDelta[] = (getOldEntries(
                exportRetention - 1,
                await this._listVmBackups(handler, vm, _ => _.mode === 'delta' && _.scheduleId === scheduleId)
              ): any)

              // FIXME: implement optimized multiple VHDs merging with synthetic
              // delta
              //
              // For the time being, limit the number of deleted backups by run
              // because it can take a very long time and can lead to
              // interrupted backup with broken VHD chain.
              //
              // The old backups will be eventually merged in future runs of the
              // job.
              const { maxMergedDeltasPerRun } = this._backupOptions
              if (oldBackups.length > maxMergedDeltasPerRun) {
                oldBackups.length = maxMergedDeltasPerRun
              }

              const deleteOldBackups = () =>
                wrapTask(
                  {
                    logger,
                    message: 'merge',
                    parentId: taskId,
                    result: size => ({ size }),
                  },
                  this._deleteDeltaVmBackups(handler, oldBackups)
                )

              const deleteFirst = exportRetention > 1 && getSetting(settings, 'deleteFirst', [remoteId])
              if (deleteFirst) {
                await deleteOldBackups()
              }

              const { dirMode } = this._backupOptions

              await wrapTask(
                {
                  logger,
                  message: 'transfer',
                  parentId: taskId,
                  result: size => ({ size }),
                },
                asyncMap(
                  fork.vdis,
                  defer(async ($defer, vdi, id) => {
                    const path = `${vmDir}/${metadata.vhds[id]}`

                    const isDelta = vdi.other_config['xo:base_delta'] !== undefined
                    let parentPath
                    if (isDelta) {
                      const vdiDir = dirname(path)
                      parentPath = (
                        await handler.list(vdiDir, {
                          filter: filename => !isHiddenFile(filename) && isVhd(filename),
                          prependDir: true,
                        })
                      )
                        .sort()
                        .pop()
                        .slice(1) // remove leading slash

                      // ensure parent exists and is a valid VHD
                      await new Vhd(handler, parentPath).readHeaderAndFooter()
                    }

                    // FIXME: should only be renamed after the metadata file has been written
                    await handler.outputStream(path, fork.streams[`${id}.vhd`](), {
                      // no checksum for VHDs, because they will be invalidated by
                      // merges and chainings
                      checksum: false,
                      dirMode,
                    })
                    $defer.onFailure.call(handler, 'unlink', path)

                    if (isDelta) {
                      await chainVhd(handler, parentPath, handler, path)
                    }

                    // set the correct UUID in the VHD
                    const vhd = new Vhd(handler, path)
                    await vhd.readHeaderAndFooter()
                    vhd.footer.uuid = parseUuid(vdi.uuid)
                    await vhd.readBlockAllocationTable() // required by writeFooter()
                    await vhd.writeFooter()

                    return handler.getSize(path)
                  })
                ).then(sum)
              )
              await handler.outputFile(metadataFilename, jsonMetadata, {
                dirMode,
              })

              if (!deleteFirst) {
                await deleteOldBackups()
              }
            }
          )
        ),
        ...srs.map(
          wrapTaskFn(
            ({ $id: id }) => ({
              data: { id, isFull, type: 'SR' },
              logger,
              message: 'export',
              parentId: taskId,
            }),
            async (taskId, sr) => {
              const fork = forkExport()

              const { uuid: srUuid, $xapi: xapi } = sr

              // delete previous interrupted copies
              ignoreErrors.call(this._deleteVms(xapi, listReplicatedVms(xapi, scheduleId, undefined, vmUuid)))

              const oldVms = getOldEntries(copyRetention - 1, listReplicatedVms(xapi, scheduleId, srUuid, vmUuid))

              const deleteOldBackups = () =>
                wrapTask(
                  {
                    logger,
                    message: 'clean',
                    parentId: taskId,
                  },
                  this._deleteVms(xapi, oldVms)
                )

              const deleteFirst = getSetting(settings, 'deleteFirst', [srUuid])
              if (deleteFirst) {
                await deleteOldBackups()
              }

              const { vm } = await wrapTask(
                {
                  logger,
                  message: 'transfer',
                  parentId: taskId,
                  result: ({ transferSize }) => ({ size: transferSize }),
                },
                xapi.importDeltaVm(
                  {
                    __proto__: fork,
                    vm: {
                      ...fork.vm,
                      tags: [...fork.vm.tags, 'Continuous Replication'],
                    },
                  },
                  {
                    disableStartAfterImport: false, // we'll take care of that
                    name_label: `${metadata.vm.name_label} - ${job.name} - (${safeDateFormat(metadata.timestamp)})`,
                    srId: sr.$id,
                  }
                )
              )

              await Promise.all([
                disableVmHighAvailability(xapi, vm),
                vm.update_blocked_operations(
                  'start',
                  'Start operation for this vm is blocked, clone it if you want to use it.'
                ),
                vm.update_other_config('xo:backup:sr', srUuid),
              ])

              if (!deleteFirst) {
                await deleteOldBackups()
              }
            }
          )
        ),
      ]).catch(noop) // errors are handled in logs

      if (!isFull) {
        ignoreErrors.call(exported.update_other_config('xo:backup:deltaChainLength', String(deltaChainLength)))
      }
    } else {
      throw new Error(`no exporter for backup mode ${mode}`)
    }

    if (!isOfflineBackup) {
      await wrapTask(
        {
          logger,
          message: 'set snapshot.other_config[xo:backup:exported]',
          parentId: taskId,
        },
        exported.update_other_config('xo:backup:exported', 'true')
      )
    }
  }

  async _deleteDeltaVmBackups(handler: RemoteHandler, backups: MetadataDelta[]): Promise<number> {
    return asyncMap(backups, async backup => {
      const filename = ((backup._filename: any): string)

      await handler.unlink(filename)

      return asyncMap(backup.vhds, _ =>
        // $FlowFixMe injected $defer param
        this._deleteVhd(handler, resolveRelativeFromFile(filename, _))
      ).then(sum)
    }).then(sum)
  }

  async _deleteFullVmBackups(handler: RemoteHandler, backups: MetadataFull[]): Promise<void> {
    await asyncMap(backups, ({ _filename, xva }) => {
      _filename = ((_filename: any): string)
      return Promise.all([handler.unlink(_filename), handler.unlink(resolveRelativeFromFile(_filename, xva))])
    })
  }

  // FIXME: synchronize by job/VDI, otherwise it can cause issues with the merge
  @defer
  async _deleteVhd($defer: any, handler: RemoteHandler, path: string): Promise<number> {
    const vhds = await asyncMap(await handler.list(dirname(path), { filter: isVhd, prependDir: true }), async path => {
      try {
        const vhd = new Vhd(handler, path)
        await vhd.readHeaderAndFooter()
        return {
          footer: vhd.footer,
          header: vhd.header,
          path,
        }
      } catch (error) {
        // Do not fail on corrupted VHDs (usually uncleaned temporary files),
        // they are probably inconsequent to the backup process and should not
        // fail it.
        log.warn(`BackupNg#_deleteVhd ${path}`, { error })
      }
    })
    const base = basename(path)
    const child = vhds.find(_ => _ !== undefined && _.header.parentUnicodeName === base)
    if (child === undefined) {
      await handler.unlink(path)
      return 0
    }

    $defer.onFailure.call(handler, 'unlink', path)

    const childPath = child.path
    const mergedDataSize: number = await this._app.worker.mergeVhd(handler._remote, path, handler._remote, childPath)
    await handler.rename(path, childPath)
    return mergedDataSize
  }

  async _deleteVms(xapi: Xapi, vms: Vm[]): Promise<void> {
    await asyncMap(vms, vm => xapi.deleteVm(vm))
  }

  async _listVmBackups(
    handler: RemoteHandler,
    vm: Object | string,
    predicate?: Metadata => boolean
  ): Promise<Metadata[]> {
    const backups = []

    const dir = getVmBackupDir(typeof vm === 'string' ? vm : vm.uuid)
    try {
      const files = await handler.list(dir)
      await Promise.all(
        files.filter(isMetadataFile).map(async file => {
          const path = `${dir}/${file}`
          try {
            const metadata = JSON.parse(String(await handler.readFile(path)))
            if (metadata.mode === 'full') {
              metadata.size = await timeout
                .call(
                  handler.getSize(resolveRelativeFromFile(path, metadata.xva)),
                  parseDuration(this._backupOptions.vmBackupSizeTimeout)
                )
                .catch(err => {
                  log.warn(`_listVmBackups, getSize`, { err })
                })
            }
            if (predicate === undefined || predicate(metadata)) {
              Object.defineProperty(metadata, '_filename', {
                value: path,
              })
              backups.push(metadata)
            }
          } catch (error) {
            log.warn(`_listVmBackups ${path}`, { error })
          }
        })
      )
    } catch (error) {
      let code
      if (error == null || ((code = error.code) !== 'ENOENT' && code !== 'ENOTDIR')) {
        throw error
      }
    }

    return backups.sort(compareTimestamp)
  }
}
