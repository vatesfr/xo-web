import ActionButton from 'action-button'
import moment from 'moment-timezone'
import React from 'react'
import Scheduler, { SchedulePreview } from 'scheduling'
import SmartBackupPreview from 'smart-backup-preview'
import Upgrade from 'xoa-upgrade'
import { Card, CardBlock, CardHeader } from 'card'
import { connectStore, resolveIds } from 'utils'
import {
  constructSmartPattern,
  destructSmartPattern,
} from 'smart-backup-pattern'
import { createGetObjectsOfType } from 'selectors'
import { injectState, provideState } from '@julien-f/freactal'
import { orderBy, isEmpty, map, some } from 'lodash'
import { Select, Toggle } from 'form'
import {
  SelectPool,
  SelectRemote,
  SelectSr,
  SelectTag,
  SelectVm,
} from 'select-objects'
import {
  createBackupNgJob,
  createSchedule,
  deleteSchedule,
  editBackupNgJob,
  editSchedule,
} from 'xo'

// ===================================================================

const constructPattern = values => ({
  id: {
    __or: resolveIds(values),
  },
})

const destructPattern = pattern => pattern.id.__or

const destructVmsPattern = pattern =>
  pattern.id === undefined
    ? destructSmartPattern(pattern)
    : destructPattern(pattern)

const SMART_MODE_INITIAL_STATE = {
  powerState: 'All',
  poolValues: [],
  poolNotValues: [],
  tagValues: [],
  tagNotValues: [],
}

const SMART_MODE_FUNCTIONS = {
  setPowerState: (_, powerState) => state => ({
    ...state,
    powerState,
  }),
  setPoolValues: (_, poolValues) => state => ({
    ...state,
    poolValues,
  }),
  setPoolNotValues: (_, poolNotValues) => state => ({
    ...state,
    poolNotValues,
  }),
  setTagValues: (_, tagValues) => state => ({
    ...state,
    tagValues,
  }),
  setTagNotValues: (_, tagNotValues) => state => ({
    ...state,
    tagNotValues,
  }),
}

const normaliseTagValues = values => resolveIds(values).map(value => [value])

const SMART_MODE_COMPUTED = {
  vmsSmartPattern: state => ({
    $pool: constructSmartPattern({
      values: resolveIds(state.poolValues),
      notValues: resolveIds(state.poolNotValues),
    }),
    power_state: state.powerState === 'All' ? undefined : state.powerState,
    tags: constructSmartPattern({
      values: normaliseTagValues(state.tagValues),
      notValues: normaliseTagValues(state.tagNotValues),
    }),
    type: 'VM',
  }),
}

const VMS_STATUSES_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'Running', label: 'Running' },
  { value: 'Halted', label: 'Halted' },
]

const SmartBackup = injectState(({ state, effects }) => (
  <Card>
    <CardHeader>Smart Mode</CardHeader>
    <CardBlock>
      <FormGroup>
        <label>
          <strong>VMs statuses</strong>
        </label>
        <Select
          options={VMS_STATUSES_OPTIONS}
          onChange={effects.setPowerState}
          value={state.powerState}
          simpleValue
          required
        />
      </FormGroup>
      <FormGroup>
        <label>
          <strong>Pools</strong>
        </label>
        <hr />
        <label>
          <strong>Resident on</strong>
        </label>
        <SelectPool
          multi
          onChange={effects.setPoolValues}
          value={state.poolValues}
        />
        <label>
          <strong>Not resident on</strong>
        </label>
        <br />
        <SelectPool
          multi
          onChange={effects.setPoolNotValues}
          value={state.poolNotValues}
        />
      </FormGroup>
      <FormGroup>
        <label>
          <strong>Tags</strong>
        </label>
        <hr />
        <label>
          <strong>VMs Tags</strong>
        </label>
        <SelectTag
          multi
          onChange={effects.setTagValues}
          value={state.tagValues}
        />
        <label>
          <strong>Excluded VMs tags</strong>
        </label>
        <br />
        <SelectTag
          multi
          onChange={effects.setTagNotValues}
          value={state.tagNotValues}
        />
      </FormGroup>
      <SmartBackupPreview vms={state.allVms} pattern={state.vmsSmartPattern} />
    </CardBlock>
  </Card>
))

// ===================================================================

const FormGroup = props => <div {...props} className='form-group' />
const Input = props => <input {...props} className='form-control' />

const DEFAULT_CRON_PATTERN = '0 0 * * *'
const DEFAULT_TIMEZONE = moment.tz.guess()

const getNewSettings = schedules => {
  const newSettings = {}

  for (const schedule in schedules) {
    newSettings[schedule] = {
      exportRetention: +schedules[schedule].exportRetention,
      snapshotRetention: +schedules[schedule].snapshotRetention,
    }
  }

  return newSettings
}

const getRandomId = () =>
  Math.random()
    .toString(36)
    .slice(2)

export default [
  New => props => (
    <Upgrade place='newBackup' required={2}>
      <New {...props} />
    </Upgrade>
  ),
  connectStore({
    allVms: createGetObjectsOfType('VM'),
  }),
  provideState({
    initialState: () => ({
      compression: true,
      delta: false,
      exportRetention: 0,
      formId: getRandomId(),
      name: '',
      paramsUpdated: false,
      remotes: [],
      schedules: {},
      snapshotRetention: 0,
      smartMode: false,
      srs: [],
      tmpSchedule: {
        cron: DEFAULT_CRON_PATTERN,
        timezone: DEFAULT_TIMEZONE,
      },
      tmpSchedules: {},
      vms: [],
      ...SMART_MODE_INITIAL_STATE,
    }),
    effects: {
      addSchedule: () => state => {
        const id = getRandomId()

        return {
          ...state,
          tmpSchedules: {
            ...state.tmpSchedules,
            [id]: {
              ...state.tmpSchedule,
              exportRetention: state.exportRetention,
              snapshotRetention: state.snapshotRetention,
            },
          },
        }
      },
      createJob: () => async state => {
        await createBackupNgJob({
          name: state.name,
          mode: state.delta ? 'delta' : 'full',
          compression: state.compression ? 'native' : '',
          schedules: state.tmpSchedules,
          settings: {
            ...getNewSettings(state.tmpSchedules),
          },
          remotes: constructPattern(state.remotes),
          srs: constructPattern(state.srs),
          vms: state.smartMode
            ? state.vmsSmartPattern
            : constructPattern(state.vms),
        })
      },
      editJob: () => async (state, props) => {
        const newSettings = {}
        if (!isEmpty(state.tmpSchedules)) {
          await Promise.all(
            map(state.tmpSchedules, async schedule => {
              const scheduleId = (await createSchedule(props.job.id, {
                cron: schedule.cron,
                timezone: schedule.timezone,
              })).id
              newSettings[scheduleId] = {
                exportRetention: +schedule.exportRetention,
                snapshotRetention: +schedule.snapshotRetention,
              }
            })
          )
        }

        await editBackupNgJob({
          id: props.job.id,
          name: state.name,
          mode: state.delta ? 'delta' : 'full',
          compression: state.compression ? 'native' : '',
          remotes: constructPattern(state.remotes),
          srs: constructPattern(state.srs),
          vms: state.smartMode
            ? state.vmsSmartPattern
            : constructPattern(state.vms),
          settings: {
            ...newSettings,
            ...props.job.settings,
          },
        })
      },
      setTmpSchedule: (_, schedule) => state => ({
        ...state,
        tmpSchedule: {
          cron: schedule.cronPattern,
          timezone: schedule.timezone,
        },
      }),
      setExportRetention: (_, { target: { value } }) => state => ({
        ...state,
        exportRetention: value,
      }),
      setSnapshotRetention: (_, { target: { value } }) => state => ({
        ...state,
        snapshotRetention: value,
      }),
      populateSchedule: (_, { cron, timezone, ...props }) => state => ({
        ...state,
        ...props,
        tmpSchedule: {
          cron,
          timezone,
        },
      }),
      editSchedule: (_, { scheduleId }) => async (state, props) => {
        await editSchedule({
          id: scheduleId,
          jobId: props.job.id,
          ...state.tmpSchedule,
        })
        await editBackupNgJob({
          id: props.job.id,
          settings: {
            ...props.job.settings,
            [scheduleId]: {
              exportRetention: +state.exportRetention,
              snapshotRetention: +state.snapshotRetention,
            },
          },
        })
      },
      deleteSchedule: (_, { scheduleId }) => async (state, props) => {
        await deleteSchedule(scheduleId)

        delete props.job.settings[scheduleId]
        await editBackupNgJob({
          id: props.job.id,
          settings: {
            ...props.job.settings,
          },
        })
      },
      editTmpSchedule: (_, { scheduleId }) => state => ({
        ...state,
        tmpSchedules: {
          ...state.tmpSchedules,
          [scheduleId]: {
            ...state.tmpSchedule,
            exportRetention: state.exportRetention,
            snapshotRetention: state.snapshotRetention,
          },
        },
      }),
      deleteTmpSchedule: (_, { scheduleId }) => state => {
        const tmpSchedules = { ...state.tmpSchedules }
        delete tmpSchedules[scheduleId]
        return {
          ...state,
          tmpSchedules,
        }
      },
      setDelta: (_, { target: { checked } }) => state => ({
        ...state,
        delta: checked,
      }),
      setCompression: (_, { target: { checked } }) => state => ({
        ...state,
        compression: checked,
      }),
      setSmartMode: (_, smartMode) => state => ({
        ...state,
        smartMode,
      }),
      setName: (_, { target: { value } }) => state => ({
        ...state,
        name: value,
      }),
      setRemotes: (_, remotes) => state => ({ ...state, remotes }),
      setSrs: (_, srs) => state => ({ ...state, srs }),
      setVms: (_, vms) => state => ({ ...state, vms }),
      updateParams: () => (state, { job }) => ({
        ...state,
        compression: job.compression === 'native',
        delta: job.mode === 'delta',
        name: job.name,
        paramsUpdated: true,
        smartMode: job.vms.id === undefined,
        remotes: destructPattern(job.remotes),
        srs: destructPattern(job.srs),
        vms: destructVmsPattern(job.vms),
      }),
      ...SMART_MODE_FUNCTIONS,
    },
    computed: {
      allVms: (state, { allVms }) => allVms,
      jobSettings: (state, { job }) => job && job.settings,
      schedules: (state, { schedules }) => schedules,
      needUpdateParams: (state, { job }) =>
        job !== undefined && !state.paramsUpdated,
      isScheduleInvalid: state =>
        (+state.snapshotRetention === 0 || state.snapshotRetention === '') &&
        (+state.exportRetention === 0 || state.exportRetention === ''),
      isInvalid: state =>
        state.name.trim() === '' ||
        (isEmpty(state.schedules) && isEmpty(state.tmpSchedules)) ||
        (isEmpty(state.vms) && !state.smartMode),
      showCompression: (state, { job }) =>
        !state.delta &&
        (some(
          state.tmpSchedules,
          schedule => +schedule.exportRetention !== 0
        ) ||
          (job &&
            some(job.settings, schedule => schedule.exportRetention !== 0))),
      sortedSchedules: ({ schedules }) => orderBy(schedules, 'name'),
      // TO DO: use sortedTmpSchedules
      sortedTmpSchedules: ({ tmpSchedules }) => orderBy(tmpSchedules, 'id'),
      ...SMART_MODE_COMPUTED,
    },
  }),
  injectState,
  ({ effects, state }) => {
    if (state.needUpdateParams) {
      effects.updateParams()
    }

    return (
      <form id={state.formId}>
        <FormGroup>
          <h1>BackupNG</h1>
          <label>
            <strong>Name</strong>
          </label>
          <Input onChange={effects.setName} value={state.name} />
        </FormGroup>
        <FormGroup>
          <label>
            <strong>Target remotes (for Export)</strong>
          </label>
          <SelectRemote
            multi
            onChange={effects.setRemotes}
            value={state.remotes}
          />
        </FormGroup>
        <FormGroup>
          <label>
            <strong>Target SRs (for Replication)</strong>
          </label>
          <SelectSr multi onChange={effects.setSrs} value={state.srs} />
        </FormGroup>
        <FormGroup>
          <label>
            <strong>Smart selection</strong>
          </label>
          <br />
          <Toggle onChange={effects.setSmartMode} value={state.smartMode} />
        </FormGroup>
        {state.smartMode ? (
          <Upgrade place='newBackup' required={3}>
            <SmartBackup />
          </Upgrade>
        ) : (
          <FormGroup>
            <label>
              <strong>Vms to Backup</strong>
            </label>
            <SelectVm multi onChange={effects.setVms} value={state.vms} />
          </FormGroup>
        )}
        {(!isEmpty(state.srs) || !isEmpty(state.remotes)) && (
          <Upgrade place='newBackup' required={4}>
            <FormGroup>
              <label>
                <input
                  type='checkbox'
                  onChange={effects.setDelta}
                  checked={state.delta}
                />{' '}
                Use delta
              </label>
            </FormGroup>
          </Upgrade>
        )}
        {state.showCompression && (
          <label>
            <input
              type='checkbox'
              onChange={effects.setCompression}
              checked={state.compression}
            />{' '}
            Enable compression
          </label>
        )}
        {!isEmpty(state.sortedSchedules) && (
          <FormGroup>
            <h3>Saved schedules</h3>
            <ul>
              {state.sortedSchedules.map(schedule => (
                <li key={schedule.id}>
                  {schedule.name} {schedule.cron} {schedule.timezone}{' '}
                  {state.jobSettings[schedule.id].exportRetention}{' '}
                  {state.jobSettings[schedule.id].snapshotRetention}
                  <ActionButton
                    handler={effects.populateSchedule}
                    data-cron={schedule.cron}
                    data-timezone={schedule.timezone}
                    data-exportRetention={
                      state.jobSettings[schedule.id].exportRetention
                    }
                    data-snapshotRetention={
                      state.jobSettings[schedule.id].snapshotRetention
                    }
                    icon='edit'
                    size='small'
                  />
                  <ActionButton
                    data-scheduleId={schedule.id}
                    disabled={state.isScheduleInvalid}
                    handler={effects.editSchedule}
                    icon='save'
                    size='small'
                  />
                  <ActionButton
                    data-scheduleId={schedule.id}
                    handler={effects.deleteSchedule}
                    icon='delete'
                    size='small'
                  />
                </li>
              ))}
            </ul>
          </FormGroup>
        )}
        {!isEmpty(state.tmpSchedules) && (
          <FormGroup>
            <h3>New schedules</h3>
            <ul>
              {map(state.tmpSchedules, (schedule, key) => (
                <li key={key}>
                  {schedule.cron} {schedule.timezone} {schedule.exportRetention}{' '}
                  {schedule.snapshotRetention}
                  <ActionButton
                    data-scheduleId={key}
                    disabled={state.isScheduleInvalid}
                    handler={effects.editTmpSchedule}
                    icon='edit'
                    size='small'
                  />
                  <ActionButton
                    data-scheduleId={key}
                    handler={effects.deleteTmpSchedule}
                    icon='delete'
                    size='small'
                  />
                </li>
              ))}
            </ul>
          </FormGroup>
        )}
        <FormGroup>
          <h1>Schedule</h1>
          <label>
            <strong>Export retention</strong>
          </label>
          <Input
            type='number'
            onChange={effects.setExportRetention}
            value={state.exportRetention}
          />
          <label>
            <strong>Snapshot retention</strong>
          </label>
          <Input
            type='number'
            onChange={effects.setSnapshotRetention}
            value={state.snapshotRetention}
          />
          <Scheduler
            cronPattern={state.tmpSchedule.cron}
            onChange={effects.setTmpSchedule}
            timezone={state.tmpSchedule.timezone}
          />
          <SchedulePreview
            cronPattern={state.tmpSchedule.cron}
            timezone={state.tmpSchedule.timezone}
          />
          <br />
          <ActionButton
            disabled={state.isScheduleInvalid}
            handler={effects.addSchedule}
            icon='add'
          >
            Add a schedule
          </ActionButton>
        </FormGroup>
        {state.paramsUpdated ? (
          <ActionButton
            disabled={state.isInvalid}
            handler={effects.editJob}
            form={state.formId}
            icon='save'
            redirectOnSuccess='/backup-ng'
          >
            Edit
          </ActionButton>
        ) : (
          <ActionButton
            disabled={state.isInvalid}
            form={state.formId}
            handler={effects.createJob}
            redirectOnSuccess='/backup-ng'
            icon='save'
          >
            Create
          </ActionButton>
        )}
      </form>
    )
  },
].reduceRight((value, decorator) => decorator(value))
