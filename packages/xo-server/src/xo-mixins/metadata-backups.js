// @flow
import asyncMap from '@xen-orchestra/async-map'
import createLogger from '@xen-orchestra/log'
import { ignoreErrors, timeout } from 'promise-toolbox'
import { parseDuration } from '@vates/parse-duration'

import { debounceWithKey, REMOVE_CACHE_ENTRY } from '../_pDebounceWithKey'
import { waitAll } from '../_waitAll'
import { type Xapi } from '../xapi'
import { safeDateFormat, serializeError, type SimpleIdPattern, unboxIdsFromPattern } from '../utils'

import { type Executor, type Job } from './jobs'
import { type Schedule } from './scheduling'

const log = createLogger('xo:xo-mixins:metadata-backups')

const DIR_XO_CONFIG_BACKUPS = 'xo-config-backups'
const DIR_XO_POOL_METADATA_BACKUPS = 'xo-pool-metadata-backups'
const METADATA_BACKUP_JOB_TYPE = 'metadataBackup'

const compareTimestamp = (a, b) => a.timestamp - b.timestamp

const DEFAULT_RETENTION = 0

type ReportWhen = 'always' | 'failure' | 'never'

type Settings = {|
  reportWhen?: ReportWhen,
  retentionPoolMetadata?: number,
  retentionXoMetadata?: number,
|}

type MetadataBackupJob = {
  ...$Exact<Job>,
  pools?: SimpleIdPattern,
  proxy?: string,
  remotes: SimpleIdPattern,
  settings: $Dict<Settings>,
  type: METADATA_BACKUP_JOB_TYPE,
  xoMetadata?: boolean,
}

const logInstantFailureTask = (logger, { data, error, message, parentId }) => {
  const taskId = logger.notice(message, {
    data,
    event: 'task.start',
    parentId,
  })
  logger.error(message, {
    event: 'task.end',
    result: serializeError(error),
    status: 'failure',
    taskId,
  })
}

const createSafeReaddir = (handler, methodName) => (path, options) =>
  handler.list(path, options).catch(error => {
    if (error?.code !== 'ENOENT') {
      log.warn(`${methodName} ${path}`, { error })
    }
    return []
  })

const deleteOldBackups = (handler, dir, retention, handleError) =>
  handler.list(dir).then(list => {
    list.sort()
    list = list.filter(timestamp => /^\d{8}T\d{6}Z$/.test(timestamp)).slice(0, -retention)
    return Promise.all(
      list.map(timestamp => {
        const backupDir = `${dir}/${timestamp}`
        return handler.rmtree(backupDir).catch(error => handleError(error, backupDir))
      })
    )
  }, handleError)

// metadata.json
//
// {
//   jobId: String,
//   jobName: String,
//   scheduleId: String,
//   scheduleName: String,
//   timestamp: number,
//   pool?: <Pool />
//   poolMaster?: <Host />
// }
//
// File structure on remotes:
//
// <remote>
// ├─ xo-config-backups
// │  └─ <schedule ID>
// │     └─ <YYYYMMDD>T<HHmmss>
// │        ├─ metadata.json
// │        └─ data.json
// └─ xo-pool-metadata-backups
//    └─ <schedule ID>
//       └─ <pool UUID>
//          └─ <YYYYMMDD>T<HHmmss>
//             ├─ metadata.json
//             └─ data
//
// Task logs emitted in a metadata backup execution:
//
// job.start(data: { reportWhen: ReportWhen })
// ├─ task.start(data: { type: 'pool', id: string, pool?: <Pool />, poolMaster?: <Host /> })
// │  ├─ task.start(data: { type: 'remote', id: string })
// │  │  └─ task.end
// │  └─ task.end
// ├─ task.start(data: { type: 'xo' })
// │  ├─ task.start(data: { type: 'remote', id: string })
// │  │  └─ task.end
// │  └─ task.end
// └─ job.end
export default class metadataBackup {
  _app: {
    createJob: ($Diff<MetadataBackupJob, {| id: string |}>) => Promise<MetadataBackupJob>,
    createSchedule: ($Diff<Schedule, {| id: string |}>) => Promise<Schedule>,
    deleteSchedule: (id: string) => Promise<void>,
    getXapi: (id: string) => Xapi,
    getJob: (id: string, ?METADATA_BACKUP_JOB_TYPE) => Promise<MetadataBackupJob>,
    updateJob: ($Shape<MetadataBackupJob>, ?boolean) => Promise<MetadataBackupJob>,
    removeJob: (id: string) => Promise<void>,
  }

  get runningMetadataRestores() {
    return this._runningMetadataRestores
  }

  constructor(app: any, { backup }) {
    this._app = app
    this._backupOptions = backup
    this._logger = undefined
    this._runningMetadataRestores = new Set()
    this._poolMetadataTimeout = parseDuration(backup.poolMetadataTimeout)

    const debounceDelay = parseDuration(backup.listingDebounce)
    this._listXoMetadataBackups = debounceWithKey(this._listXoMetadataBackups, debounceDelay, remoteId => remoteId)
    this._listPoolMetadataBackups = debounceWithKey(this._listPoolMetadataBackups, debounceDelay, remoteId => remoteId)

    app.on('start', async () => {
      this._logger = await app.getLogger('metadataRestore')

      app.registerJobExecutor(METADATA_BACKUP_JOB_TYPE, this._executor.bind(this))
    })
  }

  async _backupXo({ handlers, job, logger, retention, runJobId, schedule }) {
    const app = this._app

    const timestamp = Date.now()
    const taskId = logger.notice(`Starting XO metadata backup. (${job.id})`, {
      data: {
        type: 'xo',
      },
      event: 'task.start',
      parentId: runJobId,
    })

    try {
      const scheduleDir = `${DIR_XO_CONFIG_BACKUPS}/${schedule.id}`
      const dir = `${scheduleDir}/${safeDateFormat(timestamp)}`

      const data = await app.exportConfig()
      const fileName = `${dir}/data.json`

      const metadata = JSON.stringify(
        {
          jobId: job.id,
          jobName: job.name,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          timestamp,
        },
        null,
        2
      )
      const metaDataFileName = `${dir}/metadata.json`

      await asyncMap(handlers, async (handler, remoteId) => {
        const subTaskId = logger.notice(`Starting XO metadata backup for the remote (${remoteId}). (${job.id})`, {
          data: {
            id: remoteId,
            type: 'remote',
          },
          event: 'task.start',
          parentId: taskId,
        })

        try {
          const { dirMode } = this._backupOptions
          await Promise.all([
            handler.outputFile(fileName, data, { dirMode }),
            handler.outputFile(metaDataFileName, metadata, {
              dirMode,
            }),
          ])

          await deleteOldBackups(handler, scheduleDir, retention, (error, backupDir) => {
            logger.warning(
              backupDir !== undefined
                ? `unable to delete the folder ${backupDir}`
                : `unable to list backups for the remote (${remoteId})`,
              {
                event: 'task.warning',
                taskId: subTaskId,
                data: {
                  error,
                },
              }
            )
          })

          logger.notice(`Backuping XO metadata for the remote (${remoteId}) is a success. (${job.id})`, {
            event: 'task.end',
            status: 'success',
            taskId: subTaskId,
          })

          this._listXoMetadataBackups(REMOVE_CACHE_ENTRY, remoteId)
        } catch (error) {
          await handler.rmtree(dir).catch(error => {
            logger.warning(`unable to delete the folder ${dir}`, {
              event: 'task.warning',
              taskId: subTaskId,
              data: {
                error,
              },
            })
          })

          logger.error(`Backuping XO metadata for the remote (${remoteId}) has failed. (${job.id})`, {
            event: 'task.end',
            result: serializeError(error),
            status: 'failure',
            taskId: subTaskId,
          })
        }
      })

      logger.notice(`Backuping XO metadata is a success. (${job.id})`, {
        event: 'task.end',
        status: 'success',
        taskId,
      })
    } catch (error) {
      logger.error(`Backuping XO metadata has failed. (${job.id})`, {
        event: 'task.end',
        result: serializeError(error),
        status: 'failure',
        taskId,
      })
    }
  }

  async _backupPool(poolId, { cancelToken, handlers, job, logger, retention, runJobId, schedule, xapi }) {
    const poolMaster = await xapi.getRecord('host', xapi.pool.master)::ignoreErrors()
    const timestamp = Date.now()
    const taskId = logger.notice(`Starting metadata backup for the pool (${poolId}). (${job.id})`, {
      data: {
        id: poolId,
        pool: xapi.pool,
        poolMaster,
        type: 'pool',
      },
      event: 'task.start',
      parentId: runJobId,
    })

    try {
      const poolDir = `${DIR_XO_POOL_METADATA_BACKUPS}/${schedule.id}/${poolId}`
      const dir = `${poolDir}/${safeDateFormat(timestamp)}`

      // TODO: export the metadata only once then split the stream between remotes
      const stream = await xapi.exportPoolMetadata(cancelToken)
      const fileName = `${dir}/data`

      const metadata = JSON.stringify(
        {
          jobId: job.id,
          jobName: job.name,
          pool: xapi.pool,
          poolMaster,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          timestamp,
        },
        null,
        2
      )
      const metaDataFileName = `${dir}/metadata.json`

      await asyncMap(handlers, async (handler, remoteId) => {
        const subTaskId = logger.notice(
          `Starting metadata backup for the pool (${poolId}) for the remote (${remoteId}). (${job.id})`,
          {
            data: {
              id: remoteId,
              type: 'remote',
            },
            event: 'task.start',
            parentId: taskId,
          }
        )

        try {
          const { dirMode } = this._backupOptions
          await waitAll([
            (async () => {
              return timeout.call(
                handler.outputStream(fileName, stream, { cancelToken }).catch(error => {
                  stream.destroy()
                  if (error.message !== 'aborted') {
                    throw error
                  }
                }),
                this._poolMetadataTimeout
              )
            })(),
            handler.outputFile(metaDataFileName, metadata, {
              dirMode,
            }),
          ])

          await deleteOldBackups(handler, poolDir, retention, (error, backupDir) => {
            logger.warning(
              backupDir !== undefined
                ? `unable to delete the folder ${backupDir}`
                : `unable to list backups for the remote (${remoteId})`,
              {
                event: 'task.warning',
                taskId: subTaskId,
                data: {
                  error,
                },
              }
            )
          })

          logger.notice(`Backuping pool metadata (${poolId}) for the remote (${remoteId}) is a success. (${job.id})`, {
            event: 'task.end',
            status: 'success',
            taskId: subTaskId,
          })

          this._listPoolMetadataBackups(REMOVE_CACHE_ENTRY, remoteId)
        } catch (error) {
          await handler.rmtree(dir).catch(error => {
            logger.warning(`unable to delete the folder ${dir}`, {
              event: 'task.warning',
              taskId: subTaskId,
              data: {
                error,
              },
            })
          })

          logger.error(`Backuping pool metadata (${poolId}) for the remote (${remoteId}) has failed. (${job.id})`, {
            event: 'task.end',
            result: serializeError(error),
            status: 'failure',
            taskId: subTaskId,
          })
        }
      })

      logger.notice(`Backuping pool metadata (${poolId}) is a success. (${job.id})`, {
        event: 'task.end',
        status: 'success',
        taskId,
      })
    } catch (error) {
      logger.error(`Backuping pool metadata (${poolId}) has failed. (${job.id})`, {
        event: 'task.end',
        result: serializeError(error),
        status: 'failure',
        taskId,
      })
    }
  }

  async _executor({ cancelToken, job: job_, logger, runJobId, schedule }): Executor {
    if (schedule === undefined) {
      throw new Error('backup job cannot run without a schedule')
    }

    const job: MetadataBackupJob = (job_: any)
    const remoteIds = unboxIdsFromPattern(job.remotes)
    if (remoteIds.length === 0) {
      throw new Error('metadata backup job cannot run without remotes')
    }

    const poolIds = unboxIdsFromPattern(job.pools)
    const isEmptyPools = poolIds.length === 0
    if (!job.xoMetadata && isEmptyPools) {
      throw new Error('no metadata mode found')
    }

    let { retentionXoMetadata, retentionPoolMetadata } = job.settings[schedule.id] || {}

    // it also replaces null retentions introduced by the commit
    // https://github.com/vatesfr/xen-orchestra/commit/fea5117ed83b58d3a57715b32d63d46e3004a094#diff-c02703199db2a4c217943cf8e02b91deR40
    if (retentionXoMetadata == null) {
      retentionXoMetadata = DEFAULT_RETENTION
    }
    if (retentionPoolMetadata == null) {
      retentionPoolMetadata = DEFAULT_RETENTION
    }

    if (
      (retentionPoolMetadata === 0 && retentionXoMetadata === 0) ||
      (!job.xoMetadata && retentionPoolMetadata === 0) ||
      (isEmptyPools && retentionXoMetadata === 0)
    ) {
      throw new Error('no retentions corresponding to the metadata modes found')
    }

    const proxyId = job.proxy
    if (proxyId !== undefined) {
      const app = this._app

      const recordToXapi = {}
      const servers = new Set()
      const handleRecord = uuid => {
        const serverId = app.getXenServerIdByObject(uuid)
        recordToXapi[uuid] = serverId
        servers.add(serverId)
      }
      poolIds.forEach(handleRecord)

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
        job,
        recordToXapi,
        remotes,
        schedule,
        streamLogs: true,
        xapis,
      }

      if (job.xoMetadata) {
        params.job.xoMetadata = await app.exportConfig()
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
      } finally {
        remoteIds.forEach(id => {
          this._listPoolMetadataBackups(REMOVE_CACHE_ENTRY, id)
          this._listXoMetadataBackups(REMOVE_CACHE_ENTRY, id)
        })
      }
    }

    cancelToken.throwIfRequested()

    const app = this._app

    const handlers = {}
    await Promise.all(
      remoteIds.map(id =>
        app.getRemoteHandler(id).then(
          handler => {
            handlers[id] = handler
          },
          error => {
            logInstantFailureTask(logger, {
              data: {
                type: 'remote',
                id,
              },
              error,
              message: `unable to get the handler for the remote (${id})`,
              parentId: runJobId,
            })
          }
        )
      )
    )

    if (Object.keys(handlers).length === 0) {
      return
    }

    const promises = []
    if (job.xoMetadata && retentionXoMetadata !== 0) {
      promises.push(
        this._backupXo({
          handlers,
          job,
          logger,
          retention: retentionXoMetadata,
          runJobId,
          schedule,
        })
      )
    }

    if (!isEmptyPools && retentionPoolMetadata !== 0) {
      poolIds.forEach(id => {
        let xapi
        try {
          xapi = this._app.getXapi(id)
        } catch (error) {
          logInstantFailureTask(logger, {
            data: {
              type: 'pool',
              id,
            },
            error,
            message: `unable to get the xapi associated to the pool (${id})`,
            parentId: runJobId,
          })
        }
        if (xapi !== undefined) {
          promises.push(
            this._backupPool(id, {
              cancelToken,
              handlers,
              job,
              logger,
              retention: retentionPoolMetadata,
              runJobId,
              schedule,
              xapi,
            })
          )
        }
      })
    }

    return Promise.all(promises)
  }

  async createMetadataBackupJob(
    props: $Diff<MetadataBackupJob, {| id: string |}>,
    schedules: $Dict<$Diff<Schedule, {| id: string |}>>
  ): Promise<MetadataBackupJob> {
    const app = this._app

    const job: MetadataBackupJob = await app.createJob({
      ...props,
      type: METADATA_BACKUP_JOB_TYPE,
    })

    const { id: jobId, settings } = job
    await asyncMap(schedules, async (schedule, tmpId) => {
      const { id: scheduleId } = await app.createSchedule({
        ...schedule,
        jobId,
      })
      settings[scheduleId] = settings[tmpId]
      delete settings[tmpId]
    })
    await app.updateJob({ id: jobId, settings })

    return job
  }

  async deleteMetadataBackupJob(id: string): Promise<void> {
    const app = this._app
    const [schedules] = await Promise.all([
      app.getAllSchedules(),
      // it test if the job is of type metadataBackup
      app.getJob(id, METADATA_BACKUP_JOB_TYPE),
    ])

    await Promise.all([
      app.removeJob(id),
      asyncMap(schedules, schedule => {
        if (schedule.id === id) {
          return app.deleteSchedule(id)
        }
      }),
    ])
  }

  // xoBackups
  // [{
  //   id: `${remoteId}/folderPath`,
  //   jobId,
  //   jobName,
  //   scheduleId,
  //   scheduleName,
  //   timestamp
  // }]
  async _listXoMetadataBackups(remoteId) {
    const app = this._app
    const { proxy, url, options } = await app.getRemoteWithCredentials(remoteId)
    if (proxy !== undefined) {
      const { [remoteId]: backups } = await app.callProxyMethod(proxy, 'backup.listXoMetadataBackups', {
        remotes: {
          [remoteId]: {
            url,
            options,
          },
        },
      })

      // inject the remote id on the backup which is needed for restoreMetadataBackup()
      backups.forEach(backup => {
        backup.id = `${remoteId}${backup.id}`
      })

      return backups
    }

    const handler = await this._app.getRemoteHandler(remoteId)
    const safeReaddir = createSafeReaddir(handler, 'listXoMetadataBackups')

    const backups = []
    await asyncMap(safeReaddir(DIR_XO_CONFIG_BACKUPS, { prependDir: true }), scheduleDir =>
      asyncMap(safeReaddir(scheduleDir, { prependDir: true }), async backupDir => {
        try {
          backups.push({
            id: `${remoteId}${backupDir}`,
            ...JSON.parse(String(await handler.readFile(`${backupDir}/metadata.json`))),
          })
        } catch (error) {
          log.warn(`listXoMetadataBackups ${backupDir}`, { error })
        }
      })
    )

    return backups.sort(compareTimestamp)
  }

  // poolBackups
  // {
  //   [<Pool ID>]: [{
  //     id: `${remoteId}/folderPath`,
  //     jobId,
  //     jobName,
  //     scheduleId,
  //     scheduleName,
  //     timestamp,
  //     pool,
  //     poolMaster,
  //   }]
  // }
  async _listPoolMetadataBackups(remoteId) {
    const app = this._app
    const { proxy, url, options } = await app.getRemoteWithCredentials(remoteId)
    if (proxy !== undefined) {
      const { [remoteId]: backupsByPool } = await app.callProxyMethod(proxy, 'backup.listPoolMetadataBackups', {
        remotes: {
          [remoteId]: {
            url,
            options,
          },
        },
      })

      // inject the remote id on the backup which is needed for restoreMetadataBackup()
      Object.values(backupsByPool).forEach(backups =>
        backups.forEach(backup => {
          backup.id = `${remoteId}${backup.id}`
        })
      )

      return backupsByPool
    }

    const handler = await this._app.getRemoteHandler(remoteId)
    const safeReaddir = createSafeReaddir(handler, 'listXoMetadataBackups')

    const backupsByPool = {}
    await asyncMap(safeReaddir(DIR_XO_POOL_METADATA_BACKUPS, { prependDir: true }), scheduleDir =>
      asyncMap(safeReaddir(scheduleDir), poolId => {
        const backups = backupsByPool[poolId] ?? (backupsByPool[poolId] = [])
        return asyncMap(safeReaddir(`${scheduleDir}/${poolId}`, { prependDir: true }), async backupDir => {
          try {
            backups.push({
              id: `${remoteId}${backupDir}`,
              ...JSON.parse(String(await handler.readFile(`${backupDir}/metadata.json`))),
            })
          } catch (error) {
            log.warn(`listPoolMetadataBackups ${backupDir}`, {
              error,
            })
          }
        })
      })
    )

    // delete empty entries and sort backups
    Object.keys(backupsByPool).forEach(poolId => {
      const backups = backupsByPool[poolId]
      if (backups.length === 0) {
        delete backupsByPool[poolId]
      } else {
        backups.sort(compareTimestamp)
      }
    })

    return backupsByPool
  }

  //  {
  //    xo: {
  //      [remote ID]: xoBackups
  //    },
  //    pool: {
  //      [remote ID]: poolBackups
  //    }
  //  }
  async listMetadataBackups(remoteIds: string[]) {
    const xo = {}
    const pool = {}
    await Promise.all(
      remoteIds.map(async remoteId => {
        try {
          const [xoList, poolList] = await Promise.all([
            this._listXoMetadataBackups(remoteId),
            this._listPoolMetadataBackups(remoteId),
          ])
          if (xoList.length !== 0) {
            xo[remoteId] = xoList
          }
          if (Object.keys(poolList).length !== 0) {
            pool[remoteId] = poolList
          }
        } catch (error) {
          log.warn(`listMetadataBackups for remote ${remoteId}`, { error })
        }
      })
    )

    return {
      xo,
      pool,
    }
  }

  // Task logs emitted in a restore execution:
  //
  // task.start(message: 'restore', data: <Metadata />)
  // └─ task.end
  async restoreMetadataBackup(id: string) {
    const app = this._app
    const logger = this._logger
    const [remoteId, dir, ...path] = id.split('/')
    const metadataFolder = `${dir}/${path.join('/')}`

    const { proxy, url, options } = await app.getRemoteWithCredentials(remoteId)

    let rootTaskId
    try {
      if (proxy !== undefined) {
        let xapi
        if (dir === DIR_XO_POOL_METADATA_BACKUPS) {
          const poolUuid = path[1]
          const { allowUnauthorized, host, password, username } = await app.getXenServer(
            app.getXenServerIdByObject(poolUuid)
          )
          xapi = {
            allowUnauthorized,
            credentials: {
              username,
              password,
            },
            url: host,
          }
        }

        const logsStream = await app.callProxyMethod(
          proxy,
          'backup.restoreMetadataBackup',
          {
            backupId: metadataFolder,
            remote: { url, options },
            xapi,
          },
          {
            assertType: 'iterator',
          }
        )

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
              this._runningMetadataRestores.add(rootTaskId)
            } else {
              common.parentId = localTaskIds[parentId]
              localTaskIds[taskId] = logger.notice(message, common)
            }
          } else {
            const localTaskId = localTaskIds[taskId]
            if (localTaskId === rootTaskId && dir === DIR_XO_CONFIG_BACKUPS && log.status === 'success') {
              try {
                await app.importConfig(log.result)
              } catch (error) {
                common.result = serializeError(error)
                common.status = 'failure'
              }
            }

            common.taskId = localTaskId
            logger.notice(message, common)
          }
        }
        return
      }

      const message = 'metadataRestore'
      const handler = await app.getRemoteHandler(remoteId)

      rootTaskId = logger.notice(message, {
        event: 'task.start',
        data: JSON.parse(String(await handler.readFile(`${metadataFolder}/metadata.json`))),
      })
      try {
        this._runningMetadataRestores.add(rootTaskId)

        let result
        if (dir === DIR_XO_CONFIG_BACKUPS) {
          result = await app.importConfig(await handler.readFile(`${metadataFolder}/data.json`))
        } else {
          result = await app
            .getXapi(path[1])
            .importPoolMetadata(await handler.createReadStream(`${metadataFolder}/data`), true)
        }

        logger.notice(message, {
          event: 'task.end',
          result,
          status: 'success',
          taskId: rootTaskId,
        })
      } catch (error) {
        logger.error(message, {
          event: 'task.end',
          result: serializeError(error),
          status: 'failure',
          taskId: rootTaskId,
        })
        throw error
      }
    } finally {
      this._runningMetadataRestores.delete(rootTaskId)
    }
  }

  async deleteMetadataBackup(id: string) {
    const app = this._app
    const [remoteId, ...path] = id.split('/')
    const metadataFolder = path.join('/')
    const { proxy, url, options } = await app.getRemoteWithCredentials(remoteId)
    if (proxy !== undefined) {
      await app.callProxyMethod(proxy, 'backup.deleteMetadataBackup', {
        backupId: metadataFolder,
        remote: { url, options },
      })
    } else {
      const uuidReg = '\\w{8}(-\\w{4}){3}-\\w{12}'
      const metadataDirReg = 'xo-(config|pool-metadata)-backups'
      const timestampReg = '\\d{8}T\\d{6}Z'

      const regexp = new RegExp(`^/?${uuidReg}/${metadataDirReg}/${uuidReg}(/${uuidReg})?/${timestampReg}`)

      if (!regexp.test(id)) {
        throw new Error(`The id (${id}) not correspond to a metadata folder`)
      }

      const handler = await app.getRemoteHandler(remoteId)
      await handler.rmtree(metadataFolder)
    }

    if (path[0] === 'xo-config-backups') {
      this._listXoMetadataBackups(REMOVE_CACHE_ENTRY, remoteId)
    } else {
      this._listPoolMetadataBackups(REMOVE_CACHE_ENTRY, remoteId)
    }
  }
}
