import _, { messages } from 'intl'
import ActionButton from 'action-button'
import ActionRowButton from 'action-row-button'
import BaseComponent from 'base-component'
import concat from 'lodash/concat'
import every from 'lodash/every'
import find from 'lodash/find'
import Icon from 'icon'
import isEmpty from 'lodash/isEmpty'
import map from 'lodash/map'
import propTypes from 'prop-types'
import React from 'react'
import remove from 'lodash/remove'
import TabButton from 'tab-button'
import Tooltip from 'tooltip'
import { isIp, isIpV4 } from 'ip'
import { ButtonGroup } from 'react-bootstrap-4/lib'
import { connectStore, noop } from 'utils'
import { Container, Row, Col } from 'grid'
import {
  createFinder,
  createGetObject,
  createGetObjectsOfType,
  createSelector
} from 'selectors'
import { injectIntl } from 'react-intl'
import { SelectNetwork, SelectIp } from 'select-objects'
import { XoSelect } from 'editable'

import {
  connectVif,
  createVmInterface,
  deleteVif,
  disconnectVif,
  isVmRunning,
  setVif
} from 'xo'

const IP_COLUMN_STYLE = { maxWidth: '20em' }
const TABLE_STYLE = { minWidth: '0' }

@connectStore(() => {
  const getVif = createGetObject(
    (_, props) => props.vifId
  )
  const getNetwork = createGetObject(
    createSelector(
      getVif,
      vif => vif.$network
    )
  )

  return (state, props) => ({
    vif: getVif(state, props),
    network: getNetwork(state, props)
  })
})
class VifItem extends BaseComponent {
  _saveIp = (ipIndex, newIp) => {
    if (!isIp(newIp.id)) {
      throw new Error('Not a valid IP')
    }
    const { vif } = this.props
    const { allowedIpv4Addresses, allowedIpv6Addresses } = vif
    if (isIpV4(newIp.id)) {
      allowedIpv4Addresses[ipIndex] = newIp.id
    } else {
      allowedIpv6Addresses[ipIndex - allowedIpv4Addresses.length] = newIp.id
    }
    setVif(vif, { allowedIpv4Addresses, allowedIpv6Addresses })
  }
  _addIp = ip => {
    if (!isIp(ip.id)) {
      return
    }
    const { vif } = this.props
    let { allowedIpv4Addresses, allowedIpv6Addresses } = vif
    if (isIpV4(ip.id)) {
      allowedIpv4Addresses = [ ...allowedIpv4Addresses, ip.id ]
    } else {
      allowedIpv6Addresses = [ ...allowedIpv6Addresses, ip.id ]
    }
    setVif(vif, { allowedIpv4Addresses, allowedIpv6Addresses })
  }
  _deleteIp = ipIndex => {
    const { vif } = this.props
    const { allowedIpv4Addresses, allowedIpv6Addresses } = vif
    if (ipIndex < allowedIpv4Addresses.length) {
      remove(allowedIpv4Addresses, (_, i) => i === ipIndex)
    } else {
      remove(allowedIpv6Addresses, (_, i) => i === ipIndex - allowedIpv4Addresses.length)
    }
    setVif(vif, { allowedIpv4Addresses, allowedIpv6Addresses })
  }

  _getIps = createSelector(
    () => this.props.vif.allowedIpv4Addresses,
    () => this.props.vif.allowedIpv6Addresses,
    concat
  )

  _noIps = createSelector(
    this._getIps,
    isEmpty
  )

  _ipPredicate = selectedIp =>
    every(this._getIps(), vifIp => vifIp !== selectedIp.id)
  _ipPoolPredicate = ipPool =>
    find(ipPool.networks, network => network === this.props.networks[this.props.vif.$network])

  _toggleNewIp = () =>
    this.setState({ showNewIpForm: !this.state.showNewIpForm })

  render () {
    const { showNewIpForm } = this.state
    const { isVmRunning, network, vif } = this.props

    if (!vif) {
      return null
    }

    return <tr key={vif.id}>
      <td>VIF #{vif.device}</td>
      <td><pre>{vif.MAC}</pre></td>
      <td>{vif.MTU}</td>
      <td>{network && network.name_label}</td>
      <td style={IP_COLUMN_STYLE}>
        <Container>
          {this._noIps()
            ? <Row>
              <Col><em>{_('vifNoIps')}</em></Col>
            </Row>
            : map(this._getIps(), (ip, ipIndex) => <Row>
              <Col size={10}>
                <XoSelect
                  onChange={newIp => this._saveIp(ipIndex, newIp)}
                  predicate={this._ipPredicate}
                  value={ip}
                  xoType='ip'
                >
                  {ip}
                </XoSelect>
              </Col>
              <Col size={1}>
                <ActionRowButton handler={this._deleteIp} handlerParam={ipIndex} icon='delete' />
              </Col>
            </Row>)
          }
          <Row>
            <Col size={10}>
              {showNewIpForm
              ? <span onBlur={this._toggleNewIp}>
                <SelectIp
                  autoFocus
                  onChange={ip => this._addIp(ip)}
                  containerPredicate={this.ipPoolPredicate}
                  predicate={this._ipPredicate}
                  required
                />
              </span>
              : <ActionButton btnStyle='success' size='small' handler={this._toggleNewIp} icon='add' />}
            </Col>
          </Row>
        </Container>
      </td>
      <td>
        {vif.attached
          ? <span>
            <span className='tag tag-success'>
              {_('vifStatusConnected')}
            </span>
            <ButtonGroup className='pull-xs-right'>
              <ActionRowButton
                handler={disconnectVif}
                handlerParam={vif}
                icon='disconnect'
                tooltip={_('vifDisconnect')}
              />
            </ButtonGroup>
          </span>
          : <span>
            <span className='tag tag-default'>
              {_('vifStatusDisconnected')}
            </span>
            <ButtonGroup className='pull-xs-right'>
              {isVmRunning &&
                <ActionRowButton
                  handler={connectVif}
                  handlerParam={vif}
                  icon='connect'
                  tooltip={_('vifConnect')}
                />
              }
              <ActionRowButton
                handler={deleteVif}
                handlerParam={vif}
                icon='remove'
                tooltip={_('vifRemove')}
              />
            </ButtonGroup>
          </span>
        }
        {' '}
        {this._noIps()
        ? (
          network
          ? (
            network.defaultIsLocked
            ? <Tooltip content={_('vifLockedNetworkNoIps')}>
              <Icon icon='error' />
            </Tooltip>
            : <Tooltip content={_('vifUnLockedNetwork')}>
              <Icon icon='unlock' />
            </Tooltip>
          ) : <Tooltip content={_('vifUnknownNetwork')}>
            <Icon icon='unknown-status' />
          </Tooltip>
        ) : <Tooltip content={_('vifLockedNetwork')}>
          <Icon icon='lock' />
        </Tooltip>}
      </td>
    </tr>
  }
}

@propTypes({
  onClose: propTypes.func,
  vm: propTypes.object.isRequired
})
@connectStore(() => {
  const getHostMaster = createGetObject(
    (_, props) => props.pool && props.pool.master
  )
  const getPifs = createGetObjectsOfType('PIF').pick(
    (state, props) => {
      const hostMaster = getHostMaster(state, props)
      return hostMaster && hostMaster.$PIFs
    }
  )
  const getDefaultNetwork = createGetObject(
    createSelector(
      createFinder(
        getPifs,
        [ pif => pif.management ]
      ),
      pif => pif && pif.$network
    )
  )
  return {
    defaultNetwork: getDefaultNetwork
  }
})
@injectIntl
class NewVif extends BaseComponent {
  componentWillMount () {
    this._autoFill(this.props)
  }

  componentWillReceiveProps (props) {
    this._autoFill(props)
  }

  _autoFill = props => {
    const { defaultNetwork } = props
    if (defaultNetwork && !this.state.network) {
      this.setState({
        mtu: defaultNetwork.MTU,
        network: defaultNetwork
      })
    }
  }

  _getNetworkPredicate = createSelector(
    () => {
      const { vm } = this.props
      return vm && vm.$pool
    },
    poolId => network => network.$pool === poolId
  )

  _selectNetwork = network => {
    this.setState({
      mtu: network.MTU,
      network
    })
  }

  _createVif = () => {
    const { vm, onClose = noop } = this.props
    const { mac, mtu, network } = this.state
    return createVmInterface(vm, network, mac, mtu)
      .then(onClose)
  }

  render () {
    const formatMessage = this.props.intl.formatMessage
    const {
      mac,
      mtu,
      network
    } = this.state
    return <form id='newVifForm'>
      <div className='form-group'>
        <SelectNetwork value={network} predicate={this._getNetworkPredicate()} onChange={this._selectNetwork} required />
      </div>
      <fieldset className='form-inline'>
        <div className='form-group'>
          <input type='text' value={mac || ''} onChange={this.linkState('mac')} placeholder={formatMessage(messages.vifMacLabel)} className='form-control' /> ({_('vifMacAutoGenerate')})
        </div>
        {' '}
        <div className='form-group'>
          <input type='number' value={mtu || ''} onChange={this.linkState('mtu')} placeholder={formatMessage(messages.vifMtuLabel)} className='form-control' />
        </div>
        <span className='pull-right'>
          <ActionButton form='newVifForm' icon='add' btnStyle='primary' handler={this._createVif}>Create</ActionButton>
        </span>
      </fieldset>
    </form>
  }
}

export default class TabNetwork extends BaseComponent {
  _toggleNewVif = () => this.setState({
    newVif: !this.state.newVif
  })

  render () {
    const { newVif } = this.state
    const { pool, vm } = this.props

    return <Container>
      <Row>
        <Col className='text-xs-right'>
          <TabButton
            btnStyle='primary'
            handler={this._toggleNewVif}
            icon='add'
            labelId='vifCreateDeviceButton'
          />
        </Col>
      </Row>
      {newVif && <Row className='m-b-1'>
        <Col>
          <NewVif vm={vm} pool={pool} onClose={this._toggleNewVif} />
        </Col>
      </Row>}
      <Row>
        <Col>
          {!isEmpty(vm.VIFs)
            ? <span>
              <table className='table' style={TABLE_STYLE}>
                <thead>
                  <tr>
                    <th>{_('vifDeviceLabel')}</th>
                    <th>{_('vifMacLabel')}</th>
                    <th>{_('vifMtuLabel')}</th>
                    <th>{_('vifNetworkLabel')}</th>
                    <th>{_('vifAllowedIps')}</th>
                    <th>{_('vifStatusLabel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {map(vm.VIFs, vif => <VifItem vifId={vif} isVmRunning={isVmRunning(vm)} />)}
                </tbody>
              </table>
              {vm.addresses && !isEmpty(vm.addresses)
                ? <span>
                  <h4>{_('vifIpAddresses')}</h4>
                  {map(vm.addresses, address => <span key={address} className='tag tag-info tag-ip'>{address}</span>)}
                </span>
                : _('noIpRecord')
              }
            </span>
            : <h4 className='text-xs-center'>{_('vifNoInterface')}</h4>
          }
        </Col>
      </Row>
    </Container>
  }
}
