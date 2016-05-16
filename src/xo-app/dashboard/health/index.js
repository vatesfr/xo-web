import _ from 'messages'
import ActionRowButton from 'action-row-button'
import filter from 'lodash/filter'
import forEach from 'lodash/forEach'
import Icon from 'icon'
import isEmpty from 'lodash/isEmpty'
import map from 'lodash/map'
import TabButton from 'tab-button'
import React, { Component } from 'react'
import { confirm } from 'modal'
import { deleteMessage, deleteVdi, deleteVm } from 'xo'
import { FormattedRelative, FormattedTime } from 'react-intl'
import { Row, Col } from 'grid'
import {
  createFilter,
  createGetObjects,
  createSelector,
  createSort,
  messages,
  objects,
  userSrs
} from 'selectors'
import {
  connectStore,
  formatSize,
  noop
} from 'utils'

@connectStore(() => {
  const getVdiSnapshots = createSort(
    createFilter(objects, object => object.type === 'VDI-snapshot')
  )
  const getVmSnapshots = createSort(
    createFilter(objects, object => object.type === 'VM-snapshot')
  )
  const getVdiOrphanedSnapshots = createSelector(
    getVdiSnapshots,
    vdiSnapshots => {
      const orphanedVdis = filter(vdiSnapshots, vdi => vdi && !vdi.$snapshot_of)
      return orphanedVdis
    }
  )
  const getVmOrphanedSnapshots = createSelector(
    getVmSnapshots,
    vmSnapshots => {
      const orphanedVms = filter(vmSnapshots, vm => vm && !vm.$snapshot_of)
      return orphanedVms
    }
  )
  const getVmContainers = createGetObjects(
    createSelector(
      getVmOrphanedSnapshots,
      vmOrphaned => map(vmOrphaned, '$container')
    )
  )
  const getSrContainers = createGetObjects(
    createSelector(
      userSrs,
      userSrs => map(userSrs, '$container')
    )
  )
  const getVdiSrs = createGetObjects(
    createSelector(
      getVdiOrphanedSnapshots,
      vdiOrphaned => map(vdiOrphaned, '$SR')
    )
  )
  const getAlertMessages = createFilter(messages, message => message.name === 'ALARM')
  const getAlertObject = createGetObjects(
    createSelector(
      getAlertMessages,
      alertMessages => map(alertMessages, '$object')
    )
  )
  const getAlertPool = createGetObjects(
    createSelector(
      getAlertMessages,
      alertMessages => map(alertMessages, '$pool')
    )
  )
  return (state, props) => {
    return {
      alertMessages: getAlertMessages(state, props),
      alertObject: getAlertObject(state, props),
      alertPool: getAlertPool(state, props),
      messages: messages(state, props),
      srContainers: getSrContainers(state, props),
      userSrs: userSrs(state, props),
      vdiOrphaned: getVdiOrphanedSnapshots(state, props),
      vdiSnapshots: getVdiSnapshots(state, props),
      vdiSr: getVdiSrs(state, props),
      vmContainers: getVmContainers(state, props),
      vmOrphaned: getVmOrphanedSnapshots(state, props),
      vmSnapshots: getVmSnapshots(state, props)
    }
  }
})
export default class Health extends Component {
  _deleteOrphanedVdis = () => (
    confirm({
      title: 'Remove all orphaned VDIs',
      body: <div>
        <p>Are you sure you want to remove all orphaned VDIs?</p>
        <p>This operation is definitive.</p>
      </div>
    }).then(
      () => map(this.props.vdiOrphaned, deleteVdi),
      noop
    )
  )
  _deleteAllLogs = () => (
    confirm({
      title: 'Remove all logs',
      body: <div>
        <p>Are you sure you want to remove all logs?</p>
        <p>This operation is definitive.</p>
      </div>
    }).then(
      () => map(this.props.alertMessages, deleteMessage),
      noop
    )
  )

  render () {
    return <div className='container-fluid'>
      <h2><Icon icon='menu-dashboard-health' /> {_('overviewHealthDashboardPage')}</h2>
      <Row>
        <Col mediumSize={12}>
          <div className='card-dashboard'>
            <div className='card-header-dashboard'>
              <Icon icon='disk' /> {_('orphanedVdis')}
            </div>
            <div className='card-block'>
              {isEmpty(this.props.vdiOrphaned)
                ? <p className='text-xs-center'>{_('noOrphanedObject')}</p>
                : <div>
                  <Row>
                    <Col smallSize={12} className='text-xs-right'>
                      <TabButton
                        btnStyle='danger'
                        handler={this._deleteOrphanedVdis}
                        icon='delete'
                        labelId='logRemoveAll'
                      />
                    </Col>
                  </Row>
                  <Row>
                    <table className='table'>
                      <thead className='thead-default'>
                        <tr>
                          <th>{_('snapshotDate')}</th>
                          <th>{_('vdiNameLabel')}</th>
                          <th>{_('vdiNameDescription')}</th>
                          <th>{_('vdiSize')}</th>
                          <th>{_('vdiSr')}</th>
                          <th>{_('logAction')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {map(this.props.vdiOrphaned, vdi =>
                          <tr key={vdi.id}>
                            <td>
                              <FormattedTime
                                value={vdi.snapshot_time * 1000}
                                minute='numeric'
                                hour='numeric'
                                day='numeric'
                                month='long'
                                year='numeric' />
                              (<FormattedRelative value={vdi.snapshot_time * 1000} />)
                            </td>
                            <td>{vdi.name_label}</td>
                            <td>{vdi.name_description}</td>
                            <td>{formatSize(vdi.size)}</td>
                            <td>{this.props.vdiSr[vdi.$SR].name_label}</td>
                            <td>
                              <ActionRowButton
                                btnStyle='danger'
                                handler={deleteVdi}
                                handlerParam={vdi}
                                icon='delete'
                                />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Row>
                </div>
              }
            </div>
          </div>
        </Col>
      </Row>
      <Row>
        <Col mediumSize={12}>
          <div className='card-dashboard'>
            <div className='card-header-dashboard'>
              <Icon icon='vm' /> {_('orphanedVms')}
            </div>
            <div className='card-block'>
              {isEmpty(this.props.vmOrphaned)
                ? <p className='text-xs-center'>{_('noOrphanedObject')}</p>
                : <table className='table'>
                  <thead className='thead-default'>
                    <tr>
                      <th>{_('snapshotDate')}</th>
                      <th>{_('vmNameLabel')}</th>
                      <th>{_('vmNameDescription')}</th>
                      <th>{_('vmContainer')}</th>
                      <th>{_('logAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {map(this.props.vmOrphaned, vm =>
                      <tr key={vm.id}>
                        <td><FormattedTime value={vm.snapshot_time * 1000} minute='numeric' hour='numeric' day='numeric' month='long' year='numeric' /> (<FormattedRelative value={vm.snapshot_time * 1000} />)</td>
                        <td>{vm.name_label}</td>
                        <td>{vm.name_description}</td>
                        <td>{this.props.vmContainers[vm.$container].name_label}</td>
                        <td>
                          <ActionRowButton
                            btnStyle='danger'
                            handler={deleteVm}
                            handlerParam={vm}
                            icon='delete'
                            />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              }
            </div>
          </div>
        </Col>
      </Row>
      <Row>
        <Col mediumSize={12}>
          <div className='card-dashboard'>
            <div className='card-header-dashboard'>
              <Icon icon='disk' /> {_('srStatePanel')}
            </div>
            <div className='card-block'>
              {isEmpty(this.props.userSrs)
                ? <Row>
                  <Col smallSize={6} className='text-xs-center'>
                    <br />
                    <h4>{_('noSrs')}</h4>
                  </Col>
                </Row>
                : <Row>
                  <Col smallSize={12}>
                    <table className='table'>
                      <thead className='thead-default'>
                        <tr>
                          <th>{_('srName')}</th>
                          <th>{_('srPool')}/{_('srHost')}</th>
                          <th>{_('srFormat')}</th>
                          <th>{_('srSize')}</th>
                          <th>{_('srUsage')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {map(this.props.userSrs, sr =>
                          <tr key={sr.id}>
                            <td>{sr.name_label}</td>
                            <td>{this.props.srContainers[sr.$container].name_label}</td>
                            <td>{sr.SR_type}</td>
                            <td>{formatSize(sr.size)}</td>
                            <td>
                              <progress className='progress' value={sr.physical_usage} max={sr.size}></progress></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Col>
                </Row>
              }
            </div>
          </div>
        </Col>
      </Row>
      <Row>
        <Col mediumSize={12}>
          <div className='card-dashboard'>
            <div className='card-header-dashboard'>
              <Icon icon='alarm' /> {_('alarmMessage')}
            </div>
            <div className='card-block'>
              {isEmpty(this.props.alertMessages)
                ? <p className='text-xs-center'>{_('noAlarms')}</p>
                : <div>
                  <Row>
                    <Col smallSize={12} className='text-xs-right'>
                      <TabButton
                        btnStyle='danger'
                        handler={this._deleteAllLogs}
                        icon='delete'
                        labelId='logRemoveAll'
                      />
                    </Col>
                  </Row>
                  <Row>
                    <table className='table'>
                      <thead className='thead-default'>
                        <tr>
                          <th>{_('alarmDate')}</th>
                          <th>{_('alarmContent')}</th>
                          <th>{_('alarmObject')}</th>
                          <th>{_('alarmPool')}</th>
                          <th>{_('logAction')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {map(this.props.alertMessages, message =>
                          <tr key={message.id}>
                            <td><FormattedTime value={message.time * 1000} minute='numeric' hour='numeric' day='numeric' month='long' year='numeric' /> (<FormattedRelative value={message.time * 1000} />)</td>
                            <td>{message.body}</td>
                            <td>{this.props.alertObject[message.$object].name_label}</td>
                            <td>{this.props.alertPool[message.$pool].name_label}</td>
                            <td>
                              <ActionRowButton
                                btnStyle='danger'
                                handler={deleteMessage}
                                handlerParam={message}
                                icon='delete'
                                />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Row>
                </div>
              }
            </div>
          </div>
        </Col>
      </Row>
    </div>
  }
}
