import { formatFilenameDate } from '@xen-orchestra/backups/filenameDate'

import { asyncMap } from '../../../_asyncMap'

import { Task } from './_Task'

export const DIR_XO_CONFIG_BACKUPS = 'xo-config-backups'

export class XoMetadataBackup {
  constructor({ config, job, remoteAdapters, schedule, settings }) {
    this._config = config
    this._job = job
    this._remoteAdapters = remoteAdapters
    this._schedule = schedule
    this._settings = settings
  }

  async run() {
    const timestamp = Date.now()

    const { _job: job, _schedule: schedule } = this
    const scheduleDir = `${DIR_XO_CONFIG_BACKUPS}/${schedule.id}`
    const dir = `${scheduleDir}/${formatFilenameDate(timestamp)}`

    const data = JSON.stringify(job.xoMetadata, null, 2)
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

    await asyncMap(
      Object.entries(this._remoteAdapters),
      ([remoteId, adapter]) =>
        Task.run(
          {
            name: `Starting XO metadata backup for the remote (${remoteId}). (${job.id})`,
            data: {
              id: remoteId,
              type: 'remote',
            },
          },
          async () => {
            const handler = adapter.handler
            const dirMode = this._config.dirMode
            await handler.outputFile(fileName, data, { dirMode })
            await handler.outputFile(metaDataFileName, metadata, {
              dirMode,
            })
            await adapter.deleteOldMetadataBackups(scheduleDir, this._settings.retentionXoMetadata)
          }
        ).catch(() => {}) // errors are handled by logs
    )
  }
}