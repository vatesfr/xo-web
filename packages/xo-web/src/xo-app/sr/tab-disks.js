import _, { messages } from 'intl'
import ActionButton from 'action-button'
import ActionRowButton from 'action-row-button'
import ButtonGroup from 'button-group'
import Component from 'base-component'
import copy from 'copy-to-clipboard'
import Icon from 'icon'
import Link from 'link'
import MigrateVdiModalBody from 'xo/migrate-vdi-modal'
import PropTypes from 'prop-types'
import React from 'react'
import SortedTable from 'sorted-table'
import TabButton from 'tab-button'
import renderXoItem, { Vdi } from 'render-xo-item'
import { confirm } from 'modal'
import { injectIntl } from 'react-intl'
import { Text } from 'editable'
import { SizeInput, Toggle } from 'form'
import { Container, Row, Col } from 'grid'
import { connectStore, formatSize, noop } from 'utils'
import { concat, every, groupBy, isEmpty, map, mapValues, pick, some } from 'lodash'
import { createCollectionWrapper, createGetObjectsOfType, createSelector, getCheckPermissions } from 'selectors'
import {
  connectVbd,
  createDisk,
  deleteVbd,
  deleteVdi,
  deleteVdis,
  disconnectVbd,
  editVdi,
  exportVdi,
  importVdi,
  isVmRunning,
  isSrShared,
  migrateVdi,
} from 'xo'
import { error } from 'notification'

// ===================================================================
const VDIS_BY_BASE_COPY = {}

const COLUMNS = [
  {
    name: _('vdiNameLabel'),
    itemRenderer: vdi => {
      const baseCopy = VDIS_BY_BASE_COPY[vdi.uuid]
      let numberOfActiveVdis
      if (baseCopy !== undefined) {
        numberOfActiveVdis = baseCopy.length
      }
      return (
        <span>
          <Text value={vdi.name_label} onChange={value => editVdi(vdi, { name_label: value })} />{' '}
          {vdi.type === 'VDI-snapshot' && (
            <span className='tag tag-info'>
              <Icon icon='vm-snapshot' />
            </span>
          )}
          {vdi.type === 'VDI-unmanaged' &&
            (baseCopy !== undefined ? (
              <span>
                (
                <Link
                  to={`/srs/${baseCopy[0].$SR}/disks?s=${encodeURIComponent(
                    `uuid:|(${baseCopy.map(activeVdi => activeVdi.uuid).join(' ')})`
                  )}`}
                >
                  <Vdi id={baseCopy[0].id} showSize={numberOfActiveVdis === 1} />
                  {`${numberOfActiveVdis > 1 ? ` and ${numberOfActiveVdis - 1} more` : ''}`}
                </Link>
                )
              </span>
            ) : (
              <span>({_('noActiveVdi')})</span>
            ))}
        </span>
      )
    },
    sortCriteria: vdi => vdi.name_label,
  },
  {
    name: _('vdiNameDescription'),
    itemRenderer: vdi => (
      <Text value={vdi.name_description} onChange={value => editVdi(vdi, { name_description: value })} />
    ),
  },
  {
    name: _('vdiTags'),
    itemRenderer: vdi => vdi.tags,
  },
  {
    name: _('vdiSize'),
    itemRenderer: vdi => formatSize(vdi.size),
    sortCriteria: vdi => vdi.size,
  },
  {
    name: _('vdiVms'),
    component: connectStore(() => {
      const getVbds = createGetObjectsOfType('VBD')
        .pick((_, props) => props.item.$VBDs)
        .sort()
      const getVmIds = createSelector(getVbds, vbds => map(vbds, 'VM'))
      const getVms = createGetObjectsOfType('VM').pick(getVmIds)
      const getVmControllers = createGetObjectsOfType('VM-controller').pick(getVmIds)
      const getVmSnapshots = createGetObjectsOfType('VM-snapshot').pick(getVmIds)
      const getVmTemplates = createGetObjectsOfType('VM-template').pick(getVmIds)
      const getAllVms = createSelector(
        getVms,
        getVmControllers,
        getVmSnapshots,
        getVmTemplates,
        (vms, vmControllers, vmSnapshots, vmTemplates) => ({
          ...vms,
          ...vmControllers,
          ...vmSnapshots,
          ...vmTemplates,
        })
      )

      return (state, props) => ({
        vms: getAllVms(state, props),
        vbds: getVbds(state, props),
      })
    })(({ vbds, vms }) => {
      if (isEmpty(vms)) {
        return null
      }

      return (
        <Container>
          {map(vbds, (vbd, index) => {
            const vm = vms[vbd.VM]

            if (vm === undefined) {
              return null
            }

            const type = vm.type
            let link
            if (type === 'VM') {
              link = `/vms/${vm.id}`
            } else if (type === 'VM-template') {
              link = `/home?s=${vm.id}&t=VM-template`
            } else {
              link = vm.$snapshot_of === undefined ? '/dashboard/health' : `/vms/${vm.$snapshot_of}/snapshots`
            }

            return (
              <Row className={index > 0 && 'mt-1'}>
                <Col mediumSize={8}>
                  <Link to={link}>{renderXoItem(vm)}</Link>
                </Col>
                <Col mediumSize={4}>
                  <ButtonGroup>
                    {vbd.attached ? (
                      <ActionRowButton
                        btnStyle='danger'
                        handler={disconnectVbd}
                        handlerParam={vbd}
                        icon='disconnect'
                        tooltip={_('vbdDisconnect')}
                      />
                    ) : (
                      <ActionRowButton
                        btnStyle='primary'
                        disabled={some(vbds, 'attached') || !isVmRunning(vm)}
                        handler={connectVbd}
                        handlerParam={vbd}
                        icon='connect'
                        tooltip={_('vbdConnect')}
                      />
                    )}
                    <ActionRowButton
                      btnStyle='danger'
                      handler={deleteVbd}
                      handlerParam={vbd}
                      icon='vdi-forget'
                      tooltip={_('vdiForget')}
                    />
                  </ButtonGroup>
                </Col>
              </Row>
            )
          })}
        </Container>
      )
    }),
  },
]

const GROUPED_ACTIONS = [
  {
    disabled: vdis => some(vdis, { type: 'VDI-unmanaged' }),
    handler: deleteVdis,
    icon: 'delete',
    label: _('destroySelectedVdis'),
    level: 'danger',
  },
]

const INDIVIDUAL_ACTIONS = [
  ...(process.env.XOA_PLAN > 1
    ? [
        {
          disabled: ({ id, type }, { isVdiAttached }) => isVdiAttached[id] || type === 'VDI-unmanaged',
          handler: importVdi,
          icon: 'import',
          label: _('importVdi'),
        },
        {
          disabled: ({ type }) => type === 'VDI-unmanaged',
          handler: exportVdi,
          icon: 'export',
          label: _('exportVdi'),
        },
      ]
    : []),
  {
    handler: vdi => copy(vdi.uuid),
    icon: 'clipboard',
    label: vdi => _('copyUuid', { uuid: vdi.uuid }),
  },
  {
    disabled: ({ type }) => type === 'VDI-unmanaged',
    handler: deleteVdi,
    icon: 'delete',
    label: _('destroyVdi'),
    level: 'danger',
  },
]

const FILTERS = {
  filterOnlyManaged: 'type:!VDI-unmanaged',
  filterOnlyRegular: '!type:|(VDI-snapshot VDI-unmanaged)',
  filterOnlySnapshots: 'type:VDI-snapshot',
  filterOnlyOrphaned: 'type:!VDI-unmanaged $VBDs:!""',
  filterOnlyUnmanaged: 'type:VDI-unmanaged',
}

// ===================================================================

@injectIntl
class NewDisk extends Component {
  static propTypes = {
    onClose: PropTypes.func,
    sr: PropTypes.object.isRequired,
  }

  _createDisk = () => {
    const { sr, onClose = noop } = this.props
    const { name, readOnly, size } = this.state

    return createDisk(name, size, sr, {
      mode: readOnly ? 'RO' : 'RW',
    }).then(onClose)
  }

  render() {
    const { formatMessage } = this.props.intl
    const { name, readOnly, size } = this.state

    return (
      <form id='newDiskForm' className='form-inline'>
        <div className='form-group'>
          <input
            autoFocus
            className='form-control'
            onChange={this.linkState('name')}
            placeholder={formatMessage(messages.vbdNamePlaceHolder)}
            required
            type='text'
            value={name}
          />
        </div>
        <div className='form-group ml-1'>
          <SizeInput
            onChange={this.linkState('size')}
            placeholder={formatMessage(messages.vbdSizePlaceHolder)}
            required
            value={size}
          />
        </div>
        <div className='form-group ml-1'>
          <span>
            {_('vbdReadonly')} <Toggle onChange={this.toggleState('readOnly')} value={readOnly} />
          </span>
        </div>
        <ActionButton
          className='pull-right'
          btnStyle='primary'
          form='newDiskForm'
          handler={this._createDisk}
          icon='add'
        >
          {_('vbdCreate')}
        </ActionButton>
      </form>
    )
  }
}

@connectStore(() => ({
  checkPermissions: getCheckPermissions,
  vbds: createGetObjectsOfType('VBD'),
}))
export default class SrDisks extends Component {
  _closeNewDiskForm = () => this.setState({ newDisk: false })

  _getAllVdis = createSelector(
    () => this.props.vdis,
    () => this.props.vdiSnapshots,
    () => this.props.unmanagedVdis,
    concat
  )

  _getIsSrAdmin = createSelector(
    () => this.props.checkPermissions,
    () => this.props.sr.id,
    (check, id) => check(id, 'administrate')
  )

  _getIsVdiAttached = createSelector(
    createSelector(
      () => this.props.vbds,
      createCollectionWrapper(() => map(this.props.vdis, 'id')),
      (vbds, vdis) => pick(groupBy(vbds, 'VDI'), vdis)
    ),
    vbdsByVdi => mapValues(vbdsByVdi, vbds => some(vbds, 'attached'))
  )

  // the warning will be displayed if the SR is local
  // or the VDIs contain at least one VBD.
  _getGenerateWarningBeforeMigrate = createSelector(
    createCollectionWrapper(_ => _),
    vdis => sr =>
      sr === undefined || isSrShared(sr) || every(vdis, _ => isEmpty(_.$VBDs)) ? null : (
        <span className='text-warning'>
          <Icon icon='alarm' /> {_('migrateVdiMessage')}
        </span>
      )
  )

  _migrateVdis = vdis =>
    confirm({
      title: _('vdiMigrate'),
      body: (
        <MigrateVdiModalBody
          pool={this.props.sr.$pool}
          warningBeforeMigrate={this._getGenerateWarningBeforeMigrate(vdis)}
        />
      ),
    }).then(({ sr }) => {
      if (sr === undefined) {
        return error(_('vdiMigrateNoSr'), _('vdiMigrateNoSrMessage'))
      }

      return Promise.all(map(vdis, vdi => migrateVdi(vdi, sr)))
    }, noop)

  _actions = [
    {
      disabled: vdis => some(vdis, ({ type }) => type === 'VDI-unmanaged' || type === 'VDI-snapshot'),
      handler: this._migrateVdis,
      icon: 'vdi-migrate',
      individualLabel: vdis => {
        const { type } = vdis[0]
        return type === 'VDI-unmanaged' || type === 'VDI-snapshot' ? _('disabledVdiMigrateTooltip') : _('vdiMigrate')
      },
      label: vdis => {
        return some(vdis, ({ type }) => type === 'VDI-unmanaged' || type === 'VDI-snapshot')
          ? _('disabledVdiMigrateTooltip')
          : _('migrateSelectedVdis')
      },
    },
  ]

  _setVdisByBaseCopy = createSelector(
    () => this.props.vdis,
    () => this.props.unmanagedVdis,
    (vdis, unmanagedVdis) => {
      Object.keys(VDIS_BY_BASE_COPY).map(k => delete VDIS_BY_BASE_COPY[k])

      vdis.forEach(activeVdi => {
        if (activeVdi.parent === undefined) {
          return
        }

        let baseCopy = unmanagedVdis.find(vdi => activeVdi.parent === vdi.uuid)
        let iterate = true
        while (iterate) {
          const baseCopyUuid = baseCopy.uuid
          const currentBaseCopy = VDIS_BY_BASE_COPY[baseCopyUuid]

          if (currentBaseCopy !== undefined) {
            VDIS_BY_BASE_COPY[baseCopyUuid] = [...currentBaseCopy, activeVdi]
          } else {
            VDIS_BY_BASE_COPY[baseCopyUuid] = [activeVdi]
          }

          if (baseCopy.parent !== undefined) {
            baseCopy = unmanagedVdis.find(vdi => baseCopy.parent === vdi.uuid)
          } else {
            iterate = false
          }
        }
      })
    }
  )

  render() {
    const vdis = this._getAllVdis()
    const { newDisk } = this.state

    this._setVdisByBaseCopy()

    return (
      <Container>
        {this._getIsSrAdmin() && [
          <Row key='new-disk'>
            <Col className='text-xs-right'>
              <TabButton
                btnStyle={newDisk ? 'info' : 'primary'}
                handler={this.toggleState('newDisk')}
                icon='add'
                labelId='vbdCreateDeviceButton'
              />
            </Col>
          </Row>,
          newDisk && (
            <Row key='new-disk-form'>
              <Col>
                <NewDisk sr={this.props.sr} onClose={this._closeNewDiskForm} />
                <hr />
              </Col>
            </Row>
          ),
        ]}
        <Row>
          <Col>
            {!isEmpty(vdis) ? (
              <SortedTable
                actions={this._actions}
                collection={vdis}
                columns={COLUMNS}
                data-isVdiAttached={this._getIsVdiAttached()}
                defaultFilter='filterOnlyManaged'
                filters={FILTERS}
                groupedActions={GROUPED_ACTIONS}
                individualActions={INDIVIDUAL_ACTIONS}
                shortcutsTarget='body'
                stateUrlParam='s'
              />
            ) : (
              <h4 className='text-xs-center'>{_('srNoVdis')}</h4>
            )}
          </Col>
        </Row>
      </Container>
    )
  }
}
