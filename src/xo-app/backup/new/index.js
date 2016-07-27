import _ from 'intl'
import ActionButton from 'action-button'
import Component from 'base-component'
import delay from 'lodash/delay'
import GenericInput from 'json-schema-input'
import Icon from 'icon'
import map from 'lodash/map'
import React from 'react'
import Scheduler, { SchedulePreview } from 'scheduling'
import Upgrade from 'xoa-upgrade'
import Wizard, { Section } from 'wizard'
import { Container, Row, Col } from 'grid'
import { error } from 'notification'
import { generateUiSchema } from 'xo-json-schema-input'

import {
  createJob,
  createSchedule,
  setJob,
  updateSchedule
} from 'xo'

// ===================================================================

const NO_SMART_SCHEMA = {
  type: 'object',
  properties: {
    vms: {
      type: 'array',
      items: {
        type: 'string',
        'xo:type': 'vm'
      },
      title: 'VMs',
      description: 'Choose VMs to backup.'
    }
  },
  required: [ 'vms' ]
}
const NO_SMART_UI_SCHEMA = generateUiSchema(NO_SMART_SCHEMA)

const SMART_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      default: 'All',
      enum: [ 'All', 'Running', 'Halted' ],
      title: 'VMs statuses',
      description: 'The statuses of VMs to backup.'
    },
    pools: {
      type: 'array',
      items: {
        type: 'string',
        'xo:type': 'pool'
      },
      title: 'Resident on'
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        'xo:type': 'tag'
      },
      title: 'VMs Tags',
      description: 'VMs which contains at least one of these tags. Not used if empty.'
    }
  },
  required: [ 'status', 'pools' ]
}
const SMART_UI_SCHEMA = generateUiSchema(SMART_SCHEMA)

// ===================================================================

const COMMON_SCHEMA = {
  type: 'object',
  properties: {
    tag: {
      type: 'string',
      title: 'Tag',
      description: 'Back-up tag.'
    },
    _reportWhen: {
      enum: [ 'never', 'always', 'failure' ],
      title: 'Report',
      description: 'When to send reports.'
    },
    enabled: {
      type: 'boolean',
      title: 'Enable immediately after creation'
    }
  },
  required: [ 'tag', 'vms', '_reportWhen' ]
}

const DEPTH_PROPERTY = {
  type: 'integer',
  title: 'Depth',
  description: 'How many backups to rollover.'
}

const REMOTE_PROPERTY = {
  type: 'string',
  'xo:type': 'remote',
  title: 'Remote'
}

const BACKUP_SCHEMA = {
  type: 'object',
  properties: {
    ...COMMON_SCHEMA.properties,
    depth: DEPTH_PROPERTY,
    remoteId: REMOTE_PROPERTY,
    onlyMetadata: {
      type: 'boolean',
      title: 'Only MetaData',
      description: 'No disks export.'
    },
    compress: {
      type: 'boolean',
      title: 'Enable compression',
      default: true
    }
  },
  required: COMMON_SCHEMA.required.concat([ 'depth', 'remoteId' ])
}

const ROLLING_SNAPSHOT_SCHEMA = {
  type: 'object',
  properties: {
    ...COMMON_SCHEMA.properties,
    depth: DEPTH_PROPERTY
  },
  required: COMMON_SCHEMA.required.concat('depth')
}

const DELTA_BACKUP_SCHEMA = {
  type: 'object',
  properties: {
    ...COMMON_SCHEMA.properties,
    depth: DEPTH_PROPERTY,
    remote: REMOTE_PROPERTY
  },
  required: COMMON_SCHEMA.required.concat([ 'depth', 'remote' ])
}

const DISASTER_RECOVERY_SCHEMA = {
  type: 'object',
  properties: {
    ...COMMON_SCHEMA.properties,
    depth: DEPTH_PROPERTY,
    sr: {
      type: 'string',
      'xo:type': 'sr',
      title: 'To SR'
    }
  },
  required: COMMON_SCHEMA.required.concat([ 'depth', 'sr' ])
}

const CONTINUOUS_REPLICATION_SCHEMA = {
  type: 'object',
  properties: {
    ...COMMON_SCHEMA.properties,
    sr: {
      type: 'string',
      'xo:type': 'sr',
      title: 'To SR'
    }
  },
  required: COMMON_SCHEMA.required.concat('sr')
}

let REQUIRED_XOA_PLAN
if (process.env.XOA_PLAN < 4) {
  REQUIRED_XOA_PLAN = {
    deltaBackup: 3,
    disasterRecovery: 3,
    continuousReplication: 4
  }
}

// ===================================================================

const BACKUP_METHOD_TO_INFO = {
  'vm.rollingBackup': {
    schema: BACKUP_SCHEMA,
    uiSchema: generateUiSchema(BACKUP_SCHEMA),
    label: 'backup',
    icon: 'backup',
    jobKey: 'rollingBackup',
    method: 'vm.rollingBackup'
  },
  'vm.rollingSnapshot': {
    schema: ROLLING_SNAPSHOT_SCHEMA,
    uiSchema: generateUiSchema(ROLLING_SNAPSHOT_SCHEMA),
    label: 'rollingSnapshot',
    icon: 'rolling-snapshot',
    jobKey: 'rollingSnapshot',
    method: 'vm.rollingSnapshot'
  },
  'vm.rollingDeltaBackup': {
    schema: DELTA_BACKUP_SCHEMA,
    uiSchema: generateUiSchema(DELTA_BACKUP_SCHEMA),
    label: 'deltaBackup',
    icon: 'delta-backup',
    jobKey: 'deltaBackup',
    method: 'vm.rollingDeltaBackup'
  },
  'vm.rollingDrCopy': {
    schema: DISASTER_RECOVERY_SCHEMA,
    uiSchema: generateUiSchema(DISASTER_RECOVERY_SCHEMA),
    label: 'disasterRecovery',
    icon: 'disaster-recovery',
    jobKey: 'disasterRecovery',
    method: 'vm.rollingDrCopy'
  },
  'vm.deltaCopy': {
    schema: CONTINUOUS_REPLICATION_SCHEMA,
    uiSchema: generateUiSchema(CONTINUOUS_REPLICATION_SCHEMA),
    label: 'continuousReplication',
    icon: 'continuous-replication',
    jobKey: 'continuousReplication',
    method: 'vm.deltaCopy'
  }
}

// ===================================================================

const DEFAULT_CRON_PATTERN = '0 0 * * *'

export default class New extends Component {
  constructor (props) {
    super(props)
    this.state.cronPattern = DEFAULT_CRON_PATTERN
  }

  componentWillMount () {
    const { job, schedule } = this.props
    if (!job || !schedule) {
      if (job || schedule) { // Having only one of them is unexpected incomplete information
        error(_('backupEditNotFoundTitle'), _('backupEditNotFoundMessage'))
      }
      return
    }
    this.setState({
      backupInfo: BACKUP_METHOD_TO_INFO[job.method],
      cronPattern: schedule.cron,
      timezone: schedule.timezone || null
    }, () => delay(this._populateForm, 250, job)) // Work around.
    // Without the delay, some selects are not always ready to load a value
    // Values are displayed, but html5 compliant browsers say the value is required and empty on submit
  }

  _populateForm = job => {
    let values = job.paramsVector.items
    const {
      backupInput,
      vmsInput
    } = this.refs

    if (values.length === 1) {
      // Older versions of XenOrchestra uses only values[0].
      values = values[0].values

      backupInput.value = values[0]
      vmsInput.value = { vms: values }
    } else {
      if (values[1].type === 'map') {
        // Smart backup.
        const {
          $pool: pools,
          tags,
          power_state: status = 'All'
        } = values[1].collection.pattern

        backupInput.value = values[0].values[0]

        this.setState({
          smartBackupMode: true
        }, () => { vmsInput.value = { pools, status, tags } })
      } else {
        // Normal backup.
        backupInput.value = values[1].values[0]
        vmsInput.value = { vms: values[0].values }
      }
    }
  }

  _handleSubmit = () => {
    const {
      enabled,
      ...callArgs
    } = this.refs.backupInput.value
    const vmsInputValue = this.refs.vmsInput.value

    const {
      backupInfo,
      smartBackupMode,
      timezone
    } = this.state

    const paramsVector = !smartBackupMode
      ? {
        type: 'crossProduct',
        items: [{
          type: 'set',
          values: map(vmsInputValue.vms, vm => ({ id: vm }))
        }, {
          type: 'set',
          values: [ callArgs ]
        }]
      } : {
        type: 'crossProduct',
        items: [{
          type: 'set',
          values: [ callArgs ]
        }, {
          type: 'map',
          collection: {
            type: 'fetchObjects',
            pattern: {
              $pool: vmsInputValue.pools.length === 0 ? undefined : vmsInputValue.pools,
              power_state: vmsInputValue.status === 'All' ? undefined : vmsInputValue.status,
              tags: vmsInputValue.tags.length === 0 ? undefined : vmsInputValue.tags,
              type: 'VM'
            }
          },
          iteratee: 'extractProperties',
          iterateeArgs: {
            pattern: { id: 'id' }
          }
        }]
      }

    const job = {
      type: 'call',
      key: backupInfo.jobKey,
      method: backupInfo.method,
      paramsVector
    }

    // Update backup schedule.
    const { job: oldJob, schedule: oldSchedule } = this.props

    if (oldJob && oldSchedule) {
      job.id = oldJob.id
      return setJob(job).then(() => updateSchedule({
        ...oldSchedule,
        cron: this.state.cronPattern,
        timezone
      }))
    }

    // Create backup schedule.
    return createJob(job).then(jobId => {
      createSchedule(jobId, { cron: this.state.cronPattern, enabled, timezone })
    })
  }

  _handleReset = () => {
    const { backupInput } = this.refs

    if (backupInput) {
      backupInput.value = undefined
    }

    this.setState({
      cronPattern: DEFAULT_CRON_PATTERN
    })
  }

  _updateCronPattern = value => {
    this.setState(value)
  }

  _handleBackupSelection = event => {
    this.setState({
      backupInfo: BACKUP_METHOD_TO_INFO[event.target.value]
    })
  }

  _handleSmartBackupMode = event => {
    this.setState({
      smartBackupMode: event.target.value === 'smart'
    })
  }

  render () {
    const {
      backupInfo,
      cronPattern,
      smartBackupMode,
      timezone
    } = this.state

    return process.env.XOA_PLAN > 1
      ? (
      <Wizard>
        <Section icon='backup' title={this.props.job ? 'editVmBackup' : 'newVmBackup'}>
          <Container>
            <Row>
              <Col>
                <fieldset className='form-group'>
                  <label htmlFor='selectBackup'>{_('newBackupSelection')}</label>
                  <select
                    className='form-control'
                    value={(backupInfo && backupInfo.method) || ''}
                    id='selectBackup'
                    onChange={this._handleBackupSelection}
                    required
                  >
                    {_('noSelectedValue', message => <option value=''>{message}</option>)}
                    {map(BACKUP_METHOD_TO_INFO, (info, key) =>
                      _(info.label, message => <option key={key} value={key}>{message}</option>)
                    )}
                  </select>
                </fieldset>
                <form id='form-new-vm-backup'>
                  {backupInfo && (
                    <div>
                      <GenericInput
                        label={<span><Icon icon={backupInfo.icon} /> {_(backupInfo.label)}</span>}
                        ref='backupInput'
                        required
                        schema={backupInfo.schema}
                        uiSchema={backupInfo.uiSchema}
                      />
                      <fieldset className='form-group'>
                        <label htmlFor='smartMode'>{_('smartBackupModeSelection')}</label>
                        <select
                          className='form-control'
                          id='smartMode'
                          onChange={this._handleSmartBackupMode}
                          required
                          value={smartBackupMode ? 'smart' : 'normal'}
                        >
                          {_('normalBackup', message => <option value='normal'>{message}</option>)}
                          {_('smartBackup', message => <option value='smart'>{message}</option>)}
                        </select>
                      </fieldset>
                      <GenericInput
                        label={<span><Icon icon='vm' /> {_('vmsToBackup')}</span>}
                        ref='vmsInput'
                        required
                        schema={smartBackupMode ? SMART_SCHEMA : NO_SMART_SCHEMA}
                        uiSchema={smartBackupMode ? SMART_UI_SCHEMA : NO_SMART_UI_SCHEMA}
                      />
                    </div>
                  )}
                </form>
              </Col>
            </Row>
          </Container>
        </Section>
        <Section icon='schedule' title='schedule'>
          <Scheduler
            cronPattern={cronPattern}
            onChange={this._updateCronPattern}
            timezone={timezone}
          />
        </Section>
        <Section icon='preview' title='preview' summary>
          <Container>
            <Row>
              <Col>
                <SchedulePreview cronPattern={cronPattern} />
                {process.env.XOA_PLAN < 4 && backupInfo && process.env.XOA_PLAN < REQUIRED_XOA_PLAN[backupInfo.jobKey]
                  ? <Upgrade place='newBackup' available={REQUIRED_XOA_PLAN[backupInfo.jobKey]} />
                  : <fieldset className='pull-xs-right p-t-1'>
                    <ActionButton
                      btnStyle='primary'
                      className='btn-lg m-r-1'
                      disabled={!backupInfo}
                      form='form-new-vm-backup'
                      handler={this._handleSubmit}
                      icon='save'
                      redirectOnSuccess='/backup/overview'
                    >
                      {_('saveBackupJob')}
                    </ActionButton>
                    <button type='button' className='btn btn-lg btn-secondary' onClick={this._handleReset}>
                      {_('selectTableReset')}
                    </button>
                  </fieldset>
                }
              </Col>
            </Row>
          </Container>
        </Section>
      </Wizard>
      )
      : <Container><Upgrade place='newBackup' available={2} /></Container>
  }
}
