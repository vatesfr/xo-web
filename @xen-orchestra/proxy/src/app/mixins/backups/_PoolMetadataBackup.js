import { formatFilenameDate } from '@xen-orchestra/backups/filenameDate'

import { asyncMap } from '../../../_asyncMap'

import { forkStreamUnpipe } from './_forkStreamUnpipe'
import { Task } from './_Task'

export const DIR_XO_POOL_METADATA_BACKUPS = 'xo-pool-metadata-backups'
const PATH_DB_DUMP = '/pool/xmldbdump'

export class PoolMetadataBackup {
  constructor({ config, job, pool, remoteAdapters, schedule, settings }) {
    this._config = config
    this._job = job
    this._pool = pool
    this._remoteAdapters = remoteAdapters
    this._schedule = schedule
    this._settings = settings
  }

  _exportPoolMetadata() {
    const xapi = this._pool.$xapi
    return xapi.getResource(PATH_DB_DUMP, {
      task: xapi.createTask('Export pool metadata'),
    })
  }

  async run() {
    const timestamp = Date.now()

    const { _job: job, _schedule: schedule, _pool: pool } = this
    const poolDir = `${DIR_XO_POOL_METADATA_BACKUPS}/${schedule.id}/${pool.$id}`
    const dir = `${poolDir}/${formatFilenameDate(timestamp)}`

    const stream = await this._exportPoolMetadata()
    const fileName = `${dir}/data`

    const metadata = JSON.stringify(
      {
        jobId: job.id,
        jobName: job.name,
        pool,
        poolMaster: pool.$master,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        timestamp,
      },
      null,
      2
    )
    const metaDataFileName = `${dir}/metadata.json`

    await asyncMap(
      Object.entries(this._remoteAdapters),
      ([remoteId, adapter]) =>
        Task.run(
          {
            name: `Starting metadata backup for the pool (${pool.$id}) for the remote (${remoteId}). (${job.id})`,
            data: {
              id: remoteId,
              type: 'remote',
            },
          },
          async () => {
            // forkStreamUnpipe should be used in a sync way, do not wait for a promise before using it
            await adapter.outputStream(forkStreamUnpipe(stream), fileName, { checksum: false })
            await adapter.handler.outputFile(metaDataFileName, metadata, {
              dirMode: this._config.dirMode,
            })
            await adapter.deleteOldMetadataBackups(poolDir, this._settings.retentionPoolMetadata)
          }
        ).catch(() => {}) // errors are handled by logs
    )
  }
}