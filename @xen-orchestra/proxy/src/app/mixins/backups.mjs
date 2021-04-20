import Disposable from 'promise-toolbox/Disposable.js'
import fromCallback from 'promise-toolbox/fromCallback.js'
import { asyncMap } from '@xen-orchestra/async-map'
import { Backup } from '@xen-orchestra/backups/Backup.js'
import { compose } from '@vates/compose'
import { createLogger } from '@xen-orchestra/log'
import { decorateWith } from '@vates/decorate-with'
import { deduped } from '@vates/disposable/deduped.js'
import { defer } from 'golike-defer'
import { DurablePartition } from '@xen-orchestra/backups/DurablePartition.js'
import { execFile } from 'child_process'
import { formatVmBackups } from '@xen-orchestra/backups/formatVmBackups.js'
import { ImportVmBackup } from '@xen-orchestra/backups/ImportVmBackup.js'
import { Readable } from 'stream'
import { RemoteAdapter } from '@xen-orchestra/backups/RemoteAdapter.js'
import { RestoreMetadataBackup } from '@xen-orchestra/backups/RestoreMetadataBackup.js'
import { runBackupWorker } from '@xen-orchestra/backups/runBackupWorker.js'
import { Task } from '@xen-orchestra/backups/Task.js'
import { Xapi } from '@xen-orchestra/xapi'

const noop = Function.prototype

const { warn } = createLogger('xo:proxy:backups')

const runWithLogs = (runner, args) =>
  new Readable({
    objectMode: true,
    read() {
      this._read = noop

      runner(args, log => this.push(log)).then(
        () => this.push(null),
        error => this.emit('error', error)
      )
    },
  })[Symbol.asyncIterator]()

export default class Backups {
  constructor(app) {
    this._app = app

    // clean any LVM volumes that might have not been properly
    // unmounted
    app.hooks.on('start', async () => {
      await Promise.all([fromCallback(execFile, 'losetup', ['-D']), fromCallback(execFile, 'vgchange', ['-an'])])
      await fromCallback(execFile, 'pvscan', ['--cache'])
    })

    let run = (params, onLog) => {
      // don't change config during backup execution
      const config = app.config.get('backups')
      if (config.disableWorkers) {
        const { recordToXapi, remotes, xapis, ...rest } = params
        return new Backup({
          ...rest,

          config,

          // pass getAdapter in order to mutualize the adapter resources usage
          getAdapter: remoteId => this.getAdapter(remotes[remoteId]),

          getConnectedRecord: Disposable.factory(async function* getConnectedRecord(type, uuid) {
            const xapiId = recordToXapi[uuid]
            if (xapiId === undefined) {
              throw new Error('no XAPI associated to ' + uuid)
            }

            const xapi = yield this.getXapi(xapis[xapiId])
            return xapi.getRecordByUuid(type, uuid)
          }).bind(this),
        }).run()
      } else {
        return runBackupWorker(
          {
            config,
            remoteOptions: app.config.get('remoteOptions'),
            resourceCacheDelay: app.config.getDuration('resourceCacheDelay'),
            xapiOptions: app.config.get('xapiOptions'),
            ...params,
          },
          onLog
        )
      }
    }

    const runningJobs = { __proto__: null }
    run = (run => {
      return async function (params) {
        const jobId = params.job.id
        if (jobId === undefined) {
          return run.apply(this, arguments)
        }
        if (jobId in runningJobs) {
          const error = new Error('job is already running')
          error.jobId = jobId
          throw error
        }
        runningJobs[jobId] = true
        try {
          return await run.apply(this, arguments)
        } finally {
          delete runningJobs[jobId]
        }
      }
    })(run)
    run = (run =>
      async function () {
        if (!__DEV__) {
          const license = await app.appliance.getSelfLicense()
          if (license === undefined || license.expires < Date.now()) {
            throw new Error('the proxy license is not valid')
          }
        }
        return run.apply(this, arguments)
      })(run)
    run = (run => async (params, onLog) => {
      if (onLog === undefined || !app.config.get('backups').disableWorkers) {
        return run(params, onLog)
      }

      const { job, schedule } = params
      try {
        await Task.run(
          {
            name: 'backup run',
            data: {
              jobId: job.id,
              jobName: job.name,
              mode: job.mode,
              reportWhen: job.settings['']?.reportWhen,
              scheduleId: schedule.id,
            },
            onLog,
          },
          () => run(params)
        )
      } catch (error) {
        // do not rethrow, everything is handled via logging
      }
    })(run)

    app.api.addMethods({
      backup: {
        deleteMetadataBackup: [
          ({ backupId, remote }) =>
            Disposable.use(this.getAdapter(remote), adapter => adapter.deleteMetadataBackup(backupId)),
          {
            description: 'delete Metadata backup',
            params: {
              backupId: { type: 'string' },
              remote: { type: 'object' },
            },
          },
        ],
        deleteVmBackup: [
          ({ filename, remote }) =>
            Disposable.use(this.getAdapter(remote), adapter => adapter.deleteVmBackup(filename)),
          {
            description: 'delete VM backup',
            params: {
              filename: { type: 'string' },
              remote: { type: 'object' },
            },
          },
        ],
        fetchPartitionFiles: [
          ({ disk: diskId, remote, partition: partitionId, paths }) =>
            Disposable.use(this.getAdapter(remote), adapter => adapter.fetchPartitionFiles(diskId, partitionId, paths)),
          {
            description: 'fetch files from partition',
            params: {
              disk: { type: 'string' },
              partition: { type: 'string', optional: true },
              paths: { type: 'array', items: { type: 'string' } },
              remote: { type: 'object' },
            },
          },
        ],
        importVmBackup: [
          defer(($defer, { backupId, remote, srUuid, settings, streamLogs = false, xapi: xapiOpts }) =>
            Disposable.use(this.getAdapter(remote), this.getXapi(xapiOpts), async (adapter, xapi) => {
              const metadata = await adapter.readVmBackupMetadata(backupId)
              const run = () => new ImportVmBackup({ adapter, metadata, settings, srUuid, xapi }).run()
              return streamLogs
                ? runWithLogs(
                    async (args, onLog) =>
                      Task.run(
                        {
                          data: {
                            jobId: metadata.jobId,
                            srId: srUuid,
                            time: metadata.timestamp,
                          },
                          name: 'restore',
                          onLog,
                        },
                        run
                      ).catch(() => {}) // errors are handled by logs
                  )
                : run()
            })
          ),
          {
            description: 'create a new VM from a backup',
            params: {
              backupId: { type: 'string' },
              remote: { type: 'object' },
              settings: { type: 'object', optional: true },
              srUuid: { type: 'string' },
              streamLogs: { type: 'boolean', optional: true },
              xapi: { type: 'object' },
            },
          },
        ],
        listDiskPartitions: [
          ({ disk: diskId, remote }) =>
            Disposable.use(this.getAdapter(remote), adapter => adapter.listPartitions(diskId)),
          {
            description: 'list disk partitions',
            params: {
              disk: { type: 'string' },
              remote: { type: 'object' },
            },
          },
        ],
        listPartitionFiles: [
          ({ disk: diskId, remote, partition: partitionId, path }) =>
            Disposable.use(this.getAdapter(remote), adapter => adapter.listPartitionFiles(diskId, partitionId, path)),
          {
            description: 'list partition files',
            params: {
              disk: { type: 'string' },
              partition: { type: 'string', optional: true },
              path: { type: 'string' },
              remote: { type: 'object' },
            },
          },
        ],
        listPoolMetadataBackups: [
          async ({ remotes }) => {
            const backupsByRemote = {}
            await asyncMap(Object.entries(remotes), async ([remoteId, remote]) => {
              try {
                await Disposable.use(this.getAdapter(remote), async adapter => {
                  backupsByRemote[remoteId] = await adapter.listPoolMetadataBackups()
                })
              } catch (error) {
                warn('listPoolMetadataBackups', { error, remote })
              }
            })
            return backupsByRemote
          },
          {
            description: 'list pool metadata backups',
            params: {
              remotes: {
                type: 'object',
                additionalProperties: { type: 'object' },
              },
            },
          },
        ],
        listVmBackups: [
          async ({ remotes }) => {
            const backups = {}
            await asyncMap(Object.keys(remotes), async remoteId => {
              try {
                await Disposable.use(this.getAdapter(remotes[remoteId]), async adapter => {
                  backups[remoteId] = formatVmBackups(await adapter.listAllVmBackups())
                })
              } catch (error) {
                warn('listVmBackups', { error, remote: remotes[remoteId] })
              }
            })
            return backups
          },
          {
            description: 'list VM backups',
            params: {
              remotes: {
                type: 'object',
                additionalProperties: { type: 'object' },
              },
            },
          },
        ],
        listRunningJobs: [
          () => Object.keys(runningJobs),
          {
            description: 'returns a list of running jobs',
          },
        ],
        listXoMetadataBackups: [
          async ({ remotes }) => {
            const backupsByRemote = {}
            await asyncMap(Object.entries(remotes), async ([remoteId, remote]) => {
              try {
                await Disposable.use(this.getAdapter(remote), async adapter => {
                  backupsByRemote[remoteId] = await adapter.listXoMetadataBackups()
                })
              } catch (error) {
                warn('listXoMetadataBackups', { error, remote })
              }
            })
            return backupsByRemote
          },
          {
            description: 'list XO metadata backups',
            params: {
              remotes: {
                type: 'object',
                additionalProperties: { type: 'object' },
              },
            },
          },
        ],
        restoreMetadataBackup: [
          ({ backupId, remote, xapi: xapiOptions }) =>
            Disposable.use(app.remotes.getHandler(remote), xapiOptions && this.getXapi(xapiOptions), (handler, xapi) =>
              runWithLogs(
                async (args, onLog) =>
                  Task.run(
                    {
                      name: 'metadataRestore',
                      data: JSON.parse(String(await handler.readFile(`${backupId}/metadata.json`))),
                      onLog,
                    },
                    () =>
                      new RestoreMetadataBackup({
                        backupId,
                        handler,
                        xapi,
                      }).run()
                  ).catch(() => {}) // errors are handled by logs
              )
            ),
          {
            description: 'restore a metadata backup',
            params: {
              backupId: { type: 'string' },
              remote: { type: 'object' },
              xapi: { type: 'object', optional: true },
            },
          },
        ],
        run: [
          ({ streamLogs = false, ...rest }) => (streamLogs ? runWithLogs(run, rest) : run(rest)),
          {
            description: 'run a backup job',
            params: {
              job: { type: 'object' },
              remotes: { type: 'object' },
              schedule: { type: 'object' },
              xapis: { type: 'object', optional: true },
              recordToXapi: { type: 'object', optional: true },
              streamLogs: { type: 'boolean', optional: true },
            },
          },
        ],
      },
    })

    const durablePartition = new DurablePartition()
    app.hooks.once('stop', () => durablePartition.flushAll())

    app.api.addMethods({
      backup: {
        mountPartition: [
          async ({ disk, partition, remote }) =>
            Disposable.use(this.getAdapter(remote), adapter => durablePartition.mount(adapter, disk, partition)),
          {
            description: 'mount a partition',
            params: {
              disk: { type: 'string' },
              partition: { type: 'string', optional: true },
              remote: { type: 'object' },
            },
          },
        ],
        unmountPartition: [
          async ({ path }) => durablePartition.unmount(path),
          {
            description: 'unmount a partition',
            params: {
              path: { type: 'string' },
            },
          },
        ],
      },
    })
  }

  // FIXME: invalidate cache on remote option change
  @decorateWith(compose, function (resource) {
    return this._app.debounceResource(resource)
  })
  @decorateWith(deduped, remote => [remote.url])
  @decorateWith(Disposable.factory)
  *getAdapter(remote) {
    const app = this._app
    return new RemoteAdapter(yield app.remotes.getHandler(remote), {
      debounceResource: app.debounceResource.bind(app),
      dirMode: app.config.get('backups.dirMode'),
    })
  }

  // FIXME: invalidate cache on options change
  @decorateWith(compose, function (resource) {
    return this._app.debounceResource(resource)
  })
  @decorateWith(deduped, ({ url }) => [url])
  @decorateWith(Disposable.factory)
  async *getXapi({ credentials: { username: user, password }, ...opts }) {
    const xapi = new Xapi({
      ...this._app.config.get('xapiOptions'),
      ...opts,
      auth: {
        user,
        password,
      },
    })

    await xapi.connect()
    try {
      await xapi.objectsFetched

      yield xapi
    } finally {
      await xapi.disconnect()
    }
  }
}
