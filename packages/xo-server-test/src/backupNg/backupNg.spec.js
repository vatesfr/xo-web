/* eslint-env jest */

import { forOwn } from 'lodash'
import { noSuchObject } from 'xo-common/api-errors'

import config from '../_config'
import randomId from '../_randomId'
import xo from '../_xoConnection'

const DEFAULT_SCHEDULE = {
  name: 'scheduleTest',
  cron: '0 * * * * *',
}

const validateRootTask = (log, props) =>
  expect(log).toMatchSnapshot({
    end: expect.any(Number),
    id: expect.any(String),
    jobId: expect.any(String),
    scheduleId: expect.any(String),
    start: expect.any(Number),
    ...props,
  })

const validateVmTask = (task, vmId, props = {}) => {
  expect(task).toMatchSnapshot({
    data: {
      id: expect.any(String),
    },
    end: expect.any(Number),
    id: expect.any(String),
    message: expect.any(String),
    start: expect.any(Number),
    ...props,
  })
  expect(task.data.id).toBe(vmId)
}

const validateSnapshotTask = (task, props) =>
  expect(task).toMatchSnapshot({
    end: expect.any(Number),
    id: expect.any(String),
    result: expect.any(String),
    start: expect.any(Number),
    ...props,
  })

const validateExportTask = (task, srOrRemoteIds, props) => {
  expect(task).toMatchSnapshot({
    end: expect.any(Number),
    id: expect.any(String),
    message: expect.any(String),
    start: expect.any(Number),
    ...props,
  })
  expect(srOrRemoteIds).toContain(task.data.id)
}

const validateOperationTask = (task, props) => {
  expect(task).toMatchSnapshot({
    end: expect.any(Number),
    id: expect.any(String),
    message: expect.any(String),
    start: expect.any(Number),
    ...props,
  })
}

describe('backupNg', () => {
  let defaultBackupNg

  beforeAll(() => {
    defaultBackupNg = {
      name: 'default-backupNg',
      mode: 'full',
      vms: {
        id: config.vms.default,
      },
      settings: {
        '': {
          reportWhen: 'never',
        },
      },
    }
  })

  describe('.createJob() :', () => {
    it('creates a new backup job without schedules', async () => {
      const backupNg = await xo.createTempBackupNgJob(defaultBackupNg)
      expect(backupNg).toMatchSnapshot({
        id: expect.any(String),
        userId: expect.any(String),
        vms: expect.any(Object),
      })
      expect(backupNg.vms).toEqual(defaultBackupNg.vms)
      expect(backupNg.userId).toBe(xo._user.id)
    })

    it('creates a new backup job with schedules', async () => {
      const scheduleTempId = randomId()
      const { id: jobId } = await xo.createTempBackupNgJob({
        ...defaultBackupNg,
        schedules: {
          [scheduleTempId]: DEFAULT_SCHEDULE,
        },
        settings: {
          ...defaultBackupNg.settings,
          [scheduleTempId]: { snapshotRetention: 1 },
        },
      })

      const backupNgJob = await xo.call('backupNg.getJob', { id: jobId })

      expect(backupNgJob).toMatchSnapshot({
        id: expect.any(String),
        userId: expect.any(String),
        settings: expect.any(Object),
        vms: expect.any(Object),
      })
      expect(backupNgJob.vms).toEqual(defaultBackupNg.vms)
      expect(backupNgJob.userId).toBe(xo._user.id)

      expect(Object.keys(backupNgJob.settings).length).toBe(2)
      const schedule = await xo.getSchedule({ jobId })
      expect(typeof schedule).toBe('object')
      expect(backupNgJob.settings[schedule.id]).toEqual({
        snapshotRetention: 1,
      })

      expect(schedule).toMatchSnapshot({
        id: expect.any(String),
        jobId: expect.any(String),
      })
    })
  })

  describe('.delete() :', () => {
    it('deletes a backup job', async () => {
      const scheduleTempId = randomId()
      const { id: jobId } = await xo.call('backupNg.createJob', {
        ...defaultBackupNg,
        schedules: {
          [scheduleTempId]: DEFAULT_SCHEDULE,
        },
        settings: {
          ...defaultBackupNg.settings,
          [scheduleTempId]: { snapshotRetention: 1 },
        },
      })

      const schedule = await xo.getSchedule({ jobId })
      expect(typeof schedule).toBe('object')

      await xo.call('backupNg.deleteJob', { id: jobId })

      let isRejectedJobErrorValid = false
      await xo.call('backupNg.getJob', { id: jobId }).catch(error => {
        isRejectedJobErrorValid = noSuchObject.is(error)
      })
      expect(isRejectedJobErrorValid).toBe(true)

      let isRejectedScheduleErrorValid = false
      await xo.call('schedule.get', { id: schedule.id }).catch(error => {
        isRejectedScheduleErrorValid = noSuchObject.is(error)
      })
      expect(isRejectedScheduleErrorValid).toBe(true)
    })
  })

  describe('.runJob() :', () => {
    it('fails trying to run a backup job without schedule', async () => {
      const { id } = await xo.createTempBackupNgJob(defaultBackupNg)
      await expect(xo.call('backupNg.runJob', { id })).rejects.toMatchSnapshot()
    })

    it('fails trying to run a backup job with no matching VMs', async () => {
      const scheduleTempId = randomId()
      const { id: jobId } = await xo.createTempBackupNgJob({
        ...defaultBackupNg,
        schedules: {
          [scheduleTempId]: DEFAULT_SCHEDULE,
        },
        settings: {
          [scheduleTempId]: { snapshotRetention: 1 },
        },
        vms: {
          id: config.vms.default,
          name: 'test-vm-backupNg',
        },
      })

      const schedule = await xo.getSchedule({ jobId })
      expect(typeof schedule).toBe('object')

      await expect(
        xo.call('backupNg.runJob', { id: jobId, schedule: schedule.id })
      ).rejects.toMatchSnapshot()
    })

    it('fails trying to run a backup job with non-existent vm', async () => {
      jest.setTimeout(7e3)
      const scheduleTempId = randomId()
      const { id: jobId } = await xo.createTempBackupNgJob({
        ...defaultBackupNg,
        schedules: {
          [scheduleTempId]: DEFAULT_SCHEDULE,
        },
        settings: {
          [scheduleTempId]: { snapshotRetention: 1 },
        },
        vms: {
          id: 'non-existent-id',
        },
      })

      const schedule = await xo.getSchedule({ jobId })
      expect(typeof schedule).toBe('object')

      await xo.call('backupNg.runJob', { id: jobId, schedule: schedule.id })
      const [log] = await xo.call('backupNg.getLogs', {
        scheduleId: schedule.id,
      })
      expect(log.warnings).toMatchSnapshot()
    })

    it('fails trying to run a backup job with a VM without disks', async () => {
      jest.setTimeout(8e3)
      await xo.createTempServer(config.servers.default)
      const vmIdWithoutDisks = await xo.createTempVm({
        name_label: 'XO Test Without Disks',
        name_description: 'Creating a vm without disks',
        template: config.templates.templateWithoutDisks,
      })

      const scheduleTempId = randomId()
      const { id: jobId } = await xo.createTempBackupNgJob({
        ...defaultBackupNg,
        schedules: {
          [scheduleTempId]: DEFAULT_SCHEDULE,
        },
        settings: {
          ...defaultBackupNg.settings,
          [scheduleTempId]: { snapshotRetention: 1 },
        },
        vms: {
          id: vmIdWithoutDisks,
        },
      })

      const schedule = await xo.getSchedule({ jobId })
      expect(typeof schedule).toBe('object')
      await xo.call('backupNg.runJob', { id: jobId, schedule: schedule.id })

      const [
        {
          tasks: [vmTask],
          ...log
        },
      ] = await xo.call('backupNg.getLogs', {
        jobId,
        scheduleId: schedule.id,
      })
      expect(log).toMatchSnapshot({
        end: expect.any(Number),
        id: expect.any(String),
        jobId: expect.any(String),
        scheduleId: expect.any(String),
        start: expect.any(Number),
      })

      expect(vmTask).toMatchSnapshot({
        end: expect.any(Number),
        data: {
          id: expect.any(String),
        },
        id: expect.any(String),
        message: expect.any(String),
        result: {
          stack: expect.any(String),
        },
        start: expect.any(Number),
      })

      expect(vmTask.data.id).toBe(vmIdWithoutDisks)
    })

    it('fails trying to run backup job without retentions', async () => {
      jest.setTimeout(7e3)
      const scheduleTempId = randomId()
      await xo.createTempServer(config.servers.default)
      const { id: remoteId } = await xo.createTempRemote(config.remotes.default)
      const { id: jobId } = await xo.createTempBackupNgJob({
        ...defaultBackupNg,
        remotes: {
          id: remoteId,
        },
        schedules: {
          [scheduleTempId]: DEFAULT_SCHEDULE,
        },
        settings: {
          ...defaultBackupNg.settings,
          [scheduleTempId]: {},
        },
        srs: {
          id: config.srs.default,
        },
      })

      const schedule = await xo.getSchedule({ jobId })
      expect(typeof schedule).toBe('object')
      await xo.call('backupNg.runJob', { id: jobId, schedule: schedule.id })

      const [
        {
          tasks: [task],
          ...log
        },
      ] = await xo.call('backupNg.getLogs', {
        jobId,
        scheduleId: schedule.id,
      })

      expect(log).toMatchSnapshot({
        end: expect.any(Number),
        id: expect.any(String),
        jobId: expect.any(String),
        scheduleId: expect.any(String),
        start: expect.any(Number),
      })

      expect(task).toMatchSnapshot({
        data: {
          id: expect.any(String),
        },
        end: expect.any(Number),
        id: expect.any(String),
        message: expect.any(String),
        result: {
          stack: expect.any(String),
        },
        start: expect.any(Number),
      })
      expect(task.data.id).toBe(config.vms.default)
    })
  })

  test('execute three times a rolling snapshot with 2 as retention & revert to an old state', async () => {
    jest.setTimeout(6e4)
    await xo.createTempServer(config.servers.default)
    const vmId = await xo.createTempVm({
      name_label: 'XO Test Temp',
      name_description: 'Creating a temporary vm',
      template: config.templates.default,
      VDIs: [
        {
          size: 1,
          SR: config.srs.default,
          type: 'user',
        },
      ],
    })

    const scheduleTempId = randomId()
    const { id: jobId } = await xo.createTempBackupNgJob({
      ...defaultBackupNg,
      vms: {
        id: vmId,
      },
      schedules: {
        [scheduleTempId]: DEFAULT_SCHEDULE,
      },
      settings: {
        ...defaultBackupNg.settings,
        [scheduleTempId]: { snapshotRetention: 2 },
      },
    })

    const schedule = await xo.getSchedule({ jobId })
    expect(typeof schedule).toBe('object')
    for (let i = 0; i < 3; i++) {
      const oldSnapshots = xo.objects.all[vmId].snapshots
      await xo.call('backupNg.runJob', { id: jobId, schedule: schedule.id })
      await xo.waitObjectState(vmId, ({ snapshots }) => {
        // Test on updating snapshots.
        expect(snapshots).not.toEqual(oldSnapshots)
      })
    }

    const { snapshots, videoram: oldVideoram } = xo.objects.all[vmId]

    // Test on the retention, how many snapshots should be saved.
    expect(snapshots.length).toBe(2)

    const newVideoram = 16
    await xo.call('vm.set', { id: vmId, videoram: newVideoram })
    await xo.waitObjectState(vmId, ({ videoram }) => {
      expect(videoram).toBe(newVideoram.toString())
    })

    await xo.call('vm.revert', {
      snapshot: snapshots[0],
    })

    await xo.waitObjectState(vmId, ({ videoram }) => {
      expect(videoram).toBe(oldVideoram)
    })

    const [
      {
        tasks: [{ tasks: subTasks, ...vmTask }],
        ...log
      },
    ] = await xo.call('backupNg.getLogs', {
      jobId,
      scheduleId: schedule.id,
    })

    expect(log).toMatchSnapshot({
      end: expect.any(Number),
      id: expect.any(String),
      jobId: expect.any(String),
      scheduleId: expect.any(String),
      start: expect.any(Number),
    })

    const subTaskSnapshot = subTasks.find(
      ({ message }) => message === 'snapshot'
    )
    expect(subTaskSnapshot).toMatchSnapshot({
      end: expect.any(Number),
      id: expect.any(String),
      result: expect.any(String),
      start: expect.any(Number),
    })

    expect(vmTask).toMatchSnapshot({
      data: {
        id: expect.any(String),
      },
      end: expect.any(Number),
      id: expect.any(String),
      message: expect.any(String),
      start: expect.any(Number),
    })
    expect(vmTask.data.id).toBe(vmId)
  })

  test('execute three times a delta backup with 2 remotes, 2 as retention and 2 as fullInterval', async () => {
    jest.setTimeout(6e4)
    const {
      vms: { default: defaultVm, vmToBackup = defaultVm },
      remotes: { default: defaultRemote, remote1, remote2 = defaultRemote },
      srs: { localSr, sharedSr },
      servers: { default: defaultServer },
    } = config

    expect(vmToBackup).not.toBe(undefined)
    expect(remote1).not.toBe(undefined)
    expect(remote2).not.toBe(undefined)
    expect(localSr).not.toBe(undefined)
    expect(sharedSr).not.toBe(undefined)

    await xo.createTempServer(defaultServer)
    const { id: remoteId1 } = await xo.createTempRemote(remote1)
    const { id: remoteId2 } = await xo.createTempRemote(remote2)
    const remotes = [remoteId1, remoteId2]

    const exportRetention = 2
    const fullInterval = 2
    const scheduleTempId = randomId()
    const { id: jobId } = await xo.createTempBackupNgJob({
      mode: 'delta',
      remotes: {
        id: {
          __or: remotes,
        },
      },
      schedules: {
        [scheduleTempId]: DEFAULT_SCHEDULE,
      },
      settings: {
        '': {
          reportWhen: 'never',
          fullInterval,
        },
        [remoteId1]: { deleteFirst: true },
        [scheduleTempId]: { exportRetention },
      },
      vms: {
        id: vmToBackup,
      },
    })

    const schedule = await xo.getSchedule({ jobId })
    expect(typeof schedule).toBe('object')

    const nExecutions = 3
    const backupsByRemote = await xo.runBackupJob(jobId, schedule.id, {
      remotes,
      nExecutions,
    })
    forOwn(backupsByRemote, backups =>
      expect(backups.length).toBe(exportRetention)
    )

    const backupLogs = await xo.call('backupNg.getLogs', {
      jobId,
      scheduleId: schedule.id,
    })
    expect(backupLogs.length).toBe(nExecutions)

    backupLogs.forEach(({ tasks, ...log }, key) => {
      validateRootTask(log, {
        data: {
          mode: 'delta',
          reportWhen: 'never',
        },
        message: 'backup',
        status: 'success',
      })

      const numberOfTasks = {
        export: 0,
        merge: 0,
        snapshot: 0,
        transfer: 0,
        vm: 0,
      }
      tasks.forEach(({ tasks, ...vmTask }) => {
        if (vmTask.data !== undefined && vmTask.data.type === 'VM') {
          validateVmTask(vmTask, vmToBackup, { status: 'success' })
          numberOfTasks.vm++
          tasks.forEach(({ tasks, ...subTask }) => {
            if (subTask.message === 'snapshot') {
              validateSnapshotTask(subTask, { status: 'success' })
              numberOfTasks.snapshot++
            }
            if (subTask.message === 'export') {
              validateExportTask(subTask, remotes, {
                data: {
                  id: expect.any(String),
                  isFull: key % fullInterval === 0,
                  type: 'remote',
                },
                status: 'success',
              })
              numberOfTasks.export++
              let mergeTaskKey, transferTaskKey
              tasks.forEach((operationTask, key) => {
                if (
                  operationTask.message === 'transfer' ||
                  operationTask.message === 'merge'
                ) {
                  validateOperationTask(operationTask, {
                    result: { size: expect.any(Number) },
                    status: 'success',
                  })
                  if (operationTask.message === 'transfer') {
                    mergeTaskKey = key
                    numberOfTasks.merge++
                  } else {
                    transferTaskKey = key
                    numberOfTasks.transfer++
                  }
                }
              })
              expect(
                subTask.data.id === remoteId1
                  ? mergeTaskKey > transferTaskKey
                  : mergeTaskKey < transferTaskKey
              ).toBe(true)
            }
          })
        }
      })
      expect(numberOfTasks).toEqual({
        export: 2,
        merge: 2,
        snapshot: 1,
        transfer: 2,
        vm: 1,
      })
    })

    const vmBackupOnLocalSr = await xo.importVmBackup({
      id: backupsByRemote[remoteId1][0],
      sr: localSr,
    })
    const vmBackupOnSharedSr = await xo.importVmBackup({
      id: backupsByRemote[remoteId2][0],
      sr: sharedSr,
    })

    expect(xo.objects.all[vmBackupOnLocalSr]).not.toBe(undefined)
    expect(xo.objects.all[vmBackupOnSharedSr]).not.toBe(undefined)

    await xo.call('vm.start', { id: vmBackupOnLocalSr })
    await xo.call('vm.start', { id: vmBackupOnSharedSr })
  })
})
