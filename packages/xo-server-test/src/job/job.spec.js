/* eslint-env jest */

import { difference, keyBy } from 'lodash'

import config from '../_config'
import xo, { testWithOtherConnection } from '../_xoConnection'

const ADMIN_USER = {
  email: 'admin2@admin.net',
  password: 'admin',
  permission: 'admin',
}

describe('job', () => {
  let defaultJob

  beforeAll(() => {
    defaultJob = {
      name: 'jobTest',
      timeout: 2000,
      type: 'call',
      key: 'snapshot',
      method: 'vm.snapshot',
      paramsVector: {
        type: 'crossProduct',
        items: [
          {
            type: 'set',
            values: [
              {
                id: config.vms.default,
                name: 'test-snapshot',
              },
            ],
          },
        ],
      },
    }
  })

  describe('.create() :', () => {
    it('creates a new job', async () => {
      jest.setTimeout(6e3)
      const userId = await xo.createTempUser(ADMIN_USER)
      const { email, password } = ADMIN_USER
      await testWithOtherConnection({ email, password }, async xo => {
        const id = await xo.call('job.create', { job: defaultJob })
        expect(typeof id).toBe('string')

        const job = await xo.call('job.get', { id })
        expect(job).toMatchSnapshot({
          id: expect.any(String),
          paramsVector: expect.any(Object),
          userId: expect.any(String),
        })
        expect(job.paramsVector).toEqual(defaultJob.paramsVector)
        expect(job.userId).toBe(userId)
        await xo.call('job.delete', { id })
      })
    })

    it('creates a job with a userId', async () => {
      const userId = await xo.createTempUser(ADMIN_USER)
      const id = await xo.createTempJob({ ...defaultJob, userId })
      const { userId: expectedUserId } = await xo.call('job.get', { id })
      expect(userId).toBe(expectedUserId)
    })

    it('fails trying to create a job without job params', async () => {
      await expect(xo.createTempJob({})).rejects.toMatchSnapshot()
    })
  })

  describe('.getAll() :', () => {
    it('gets all available jobs', async () => {
      const jobId1 = await xo.createTempJob(defaultJob)
      const job2 = {
        ...defaultJob,
        name: 'jobTest2',
        paramsVector: {
          type: 'crossProduct',
          items: [
            {
              type: 'set',
              values: [
                {
                  id: config.vms.default,
                  name: 'test2-snapshot',
                },
              ],
            },
          ],
        },
      }
      const jobId2 = await xo.createTempJob(job2)
      let jobs = await xo.call('job.getAll')
      expect(Array.isArray(jobs)).toBe(true)
      jobs = keyBy(jobs, 'id')

      const newJob1 = jobs[jobId1]
      expect(newJob1).toMatchSnapshot({
        id: expect.any(String),
        paramsVector: expect.any(Object),
        userId: expect.any(String),
      })
      expect(newJob1.paramsVector).toEqual(defaultJob.paramsVector)

      const newJob2 = jobs[jobId2]
      expect(newJob2).toMatchSnapshot({
        id: expect.any(String),
        paramsVector: expect.any(Object),
        userId: expect.any(String),
      })
      expect(newJob2.paramsVector).toEqual(job2.paramsVector)
    })
  })

  describe('.get() :', () => {
    it('gets an existing job', async () => {
      const id = await xo.createTempJob(defaultJob)
      const job = await xo.call('job.get', { id })
      expect(job).toMatchSnapshot({
        id: expect.any(String),
        paramsVector: expect.any(Object),
        userId: expect.any(String),
      })
      expect(job.paramsVector).toEqual(defaultJob.paramsVector)
    })

    it('fails trying to get a job with a non existent id', async () => {
      await expect(
        xo.call('job.get', { id: 'non-existent-id' })
      ).rejects.toMatchSnapshot()
    })
  })

  describe('.set() :', () => {
    it('sets a job', async () => {
      const id = await xo.createTempJob(defaultJob)
      const job = {
        id,
        type: 'call',
        key: 'snapshot',
        method: 'vm.clone',
        paramsVector: {
          type: 'crossProduct',
          items: [
            {
              type: 'set',
              values: [
                {
                  id: config.vms.default,
                  name: 'clone',
                  full_copy: true,
                },
              ],
            },
          ],
        },
      }

      await xo.call('job.set', {
        job,
      })

      const newJob = await xo.call('job.get', { id })
      expect(newJob).toMatchSnapshot({
        id: expect.any(String),
        paramsVector: expect.any(Object),
        userId: expect.any(String),
      })
      expect(newJob.paramsVector).toEqual(job.paramsVector)
    })

    it('fails trying to set a job without job.id', async () => {
      await expect(xo.call('job.set', defaultJob)).rejects.toMatchSnapshot()
    })
  })

  describe('.delete() :', () => {
    it('deletes an existing job', async () => {
      const id = await xo.call('job.create', { job: defaultJob })
      const { id: scheduleId } = await xo.call('schedule.create', {
        jobId: id,
        cron: '* * * * * *',
        enabled: false,
      })
      await xo.call('job.delete', { id })
      await expect(xo.call('job.get', { id })).rejects.toMatchSnapshot()
      await expect(
        xo.call('schedule.get', { id: scheduleId })
      ).rejects.toMatchSnapshot()
    })

    it.skip('fails trying to delete a job with a non existent id', async () => {
      await expect(
        xo.call('job.delete', { id: 'non-existent-id' })
      ).rejects.toMatchSnapshot()
    })
  })

  describe('.runSequence() :', () => {
    let id

    afterEach(async () => {
      await xo
        .call('vm.delete', { id, deleteDisks: true })
        .catch(error => console.error(error))
    })

    it('runs a job', async () => {
      jest.setTimeout(7e4)
      await xo.createTempServer(config.servers.default)
      const jobId = await xo.createTempJob(defaultJob)
      const snapshots = xo.objects.all[config.vms.default].snapshots
      await xo.call('job.runSequence', { idSequence: [jobId] })
      await xo.waitObjectState(
        config.vms.default,
        ({ snapshots: actualSnapshots }) => {
          expect(actualSnapshots.length).toBe(snapshots.length + 1)
          id = difference(actualSnapshots, snapshots)[0]
        }
      )
    })
  })
})
