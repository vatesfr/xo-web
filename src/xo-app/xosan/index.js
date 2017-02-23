import _ from 'intl'
import ActionButton from 'action-button'
import Collapse from 'collapse'
import Component from 'base-component'
import getEventValue from 'get-event-value'
import Icon from 'icon'
import Link from 'link'
import Page from '../page'
import React from 'react'
import SingleLineRow from 'single-line-row'
import Tooltip from 'tooltip'
import { Container, Col } from 'grid'
import { Toggle } from 'form'
import { confirm } from 'modal'
import { SelectPif } from 'select-objects'
import {
  every,
  filter,
  find,
  forEach,
  isEmpty,
  keys,
  map,
  pickBy,
  uniq
} from 'lodash'
import {
  createGetObjectsOfType,
  createGroupBy,
  createSelector,
  createSort
} from 'selectors'
import {
  addSubscriptions,
  compareVersions,
  connectStore,
  formatSize
} from 'utils'
import {
  computeXosanPossibleOptions,
  createXosanSR,
  downloadAndInstallXosanPack,
  getVolumeInfo,
  registerXosan,
  subscribeIsInstallingXosan,
  subscribePlugins,
  subscribeResourceCatalog
} from 'xo'

import Graph from './graph'
import InstallXosanPackModal from './install-xosan-pack-modal'

// ==================================================================

const HEADER = <Container>
  <h2><Icon icon='menu-xosan' /> {_('xosanTitle')}</h2>
</Container>

// ==================================================================

@connectStore(() => ({
  vifs: createGetObjectsOfType('VIF'),
  vms: createGetObjectsOfType('VM'),
  vbds: createGetObjectsOfType('VBD'),
  vdis: createGetObjectsOfType('VDI')
}))
export class XosanVolumesTable extends Component {
  constructor (props) {
    super(props)
    this.state = {
      peers: null,
      volumesByConfig: null,
      volumesByID: null
    }
  }

  componentDidMount () {
    if (this.props.xosansrs && this.props.xosansrs.length > 0) {
      Promise.all(this.props.xosansrs.map(sr => getVolumeInfo(sr.id))).then(volumes => {
        const volumeConfig = {}
        volumes.forEach((volume, index) => {
          volumeConfig[this.props.xosansrs[index].id] = volume
        })
        this.setState({
          volumeConfig
        })
      })
    }
  }

  render () {
    const { xosansrs } = this.props
    return <div>
      <h3>{_('xosanSrTitle')}</h3>
      <table className='table table-striped'>
        <thead>
          <tr>
            <th>{_('xosanName')}</th>
            <th>{_('xosanHosts')}</th>
            <th>{_('xosanVolumeId')}</th>
            <th>{_('xosanSize')}</th>
            <th>{_('xosanUsedSpace')}</th>
          </tr>
        </thead>
        <tbody>
          {map(xosansrs, sr => {
            const configsMap = {}
            sr.PBDs.forEach(pbd => { configsMap[pbd.device_config['server']] = true })
            return <tr key={sr.id}>
              <td>
                <Link to={`/srs/${sr.id}/xosan`}>{sr.name_label}</Link>
              </td>
              <td>
                { sr.PBDs.map(pbd => pbd.realHost.name_label).join(', ') }
              </td>
              <td>
                { this.state.volumeConfig && this.state.volumeConfig[sr.id] && this.state.volumeConfig[sr.id]['Volume ID'] }
              </td>
              <td>
                {formatSize(sr.size)}
              </td>
              <td>
                {sr.size > 0 &&
                  <Tooltip content={_('spaceLeftTooltip', {
                    used: String(Math.round((sr.physical_usage / sr.size) * 100)),
                    free: formatSize(sr.size - sr.physical_usage)
                  })}>
                    <progress
                      className='progress'
                      max='100'
                      style={{ margin: 0 }}
                      value={(sr.physical_usage / sr.size) * 100}
                    />
                  </Tooltip>
                }
              </td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  }
}

// ==================================================================

const _handleInstallPack = pool =>
  confirm({
    title: _('xosanInstallPackTitle', { pool: pool.name_label }),
    icon: 'export',
    body: <InstallXosanPackModal pool={pool} />
  }).then(
    pack => downloadAndInstallXosanPack({ id: pack.id, version: pack.version, pool })
  )

const _findLatestTemplate = templates => {
  let latestTemplate = templates[0]

  forEach(templates, pack => {
    if (compareVersions(pack.version, latestTemplate.version) > 0) {
      latestTemplate = pack
    }
  })

  return latestTemplate
}

const _mapUniqLayouts = collection => uniq(map(collection, 'layout'))
const _mapUniqRedundancies = (layout, collection) => uniq(map(filter(collection, { layout }), 'redundancy')).sort()

@connectStore({
  poolMaster: createGetObjectsOfType('host').find(
    (_, props) => ({ id }) => props.pool.master === id
  )
})
class PoolAvailableSrs extends Component {
  state = {
    selectedSrs: {}
  }

  componentDidMount () {
    this.componentWillUnmount = subscribeIsInstallingXosan(this.props.pool, isInstallingXosan => {
      this.setState({ isInstallingXosan })
    })
  }

  _selectSr = (event, srId) => {
    const selectedSrs = { ...this.state.selectedSrs }
    selectedSrs[srId] = event.target.checked
    this.setState({ selectedSrs })

    computeXosanPossibleOptions(keys(pickBy(selectedSrs))).then(suggestions => {
      const layout = _mapUniqLayouts(suggestions)[0]
      const redundancy = layout && _mapUniqRedundancies(layout, suggestions)[0]

      this.setState({
        layout,
        redundancy,
        suggestions
      })
    })
  }

  _selectLayout = event => {
    const layout = getEventValue(event)

    this.setState({
      layout,
      redundancy: _mapUniqRedundancies(layout, this.state.suggestions)[0]
    })
  }

  _getPifPredicate = createSelector(
    () => this.props.pool,
    pool => pif => pif.vlan === -1 && pif.$host === pool.master
  )

  _getNSelectedSrs = createSelector(
    () => this.state.selectedSrs,
    srs => filter(srs).length
  )

  _getLatestTemplate = createSelector(
    () => this.props.templates,
    _findLatestTemplate
  )

  _getPossibleLayouts = createSelector(
    () => this.state.suggestions,
    _mapUniqLayouts
  )

  _getPossibleRedundancies = createSelector(
    () => this.state.layout,
    () => this.state.suggestions,
    _mapUniqRedundancies
  )

  _getDisableSrCheckbox = createSelector(
    () => this.state.selectedSrs,
    () => this.props.lvmsrs,
    (selectedSrs, lvmsrs) => sr =>
      !every(keys(pickBy(selectedSrs)), selectedSrId =>
        selectedSrId === sr.id ||
        find(lvmsrs, { id: selectedSrId }).$container !== sr.$container
      )
  )

  _createXosanVm = () => {
    const { pif, vlan, layout, selectedSrs, redundancy } = this.state

    return createXosanSR({
      template: this._getLatestTemplate(),
      pif,
      vlan: vlan || 0,
      srs: keys(pickBy(selectedSrs)),
      glusterType: layout,
      redundancy
    })
  }

  render () {
    const { pool, lvmsrs, noPack, poolMaster } = this.props
    const {
      isInstallingXosan,
      layout,
      pif,
      redundancy,
      selectedSrs,
      suggestions,
      useVlan,
      vlan
    } = this.state

    if (isInstallingXosan) {
      return <em><Icon icon='loading' /> {_('xosanInstalling')}</em>
    }

    if (poolMaster && compareVersions(poolMaster.version, '7') < 0) {
      return <div>
        <Icon icon='error' /> <em>{_('xosanBadVersion')}</em>
      </div>
    }

    if (noPack) {
      return <div className='mb-3'>
        <Icon icon='error' /> {_('xosanNeedPack')}
        <br />
        <ActionButton btnStyle='success' icon='export' handler={_handleInstallPack} handlerParam={pool}>{_('xosanInstallIt')}</ActionButton>
      </div>
    }

    const disableSrCheckbox = this._getDisableSrCheckbox()

    return <div className='mb-3'>
      <h3>{_('xosanAvailableSrsTitle')}</h3>
      <table className='table table-striped'>
        <thead>
          <tr>
            <th />
            <th>{_('xosanName')}</th>
            <th>{_('xosanHost')}</th>
            <th>{_('xosanSize')}</th>
            <th>{_('xosanUsedSpace')}</th>
          </tr>
        </thead>
        <tbody>
          {map(lvmsrs, sr => {
            const host = sr.PBDs[0].realHost
            return <tr key={sr.id}>
              <td>
                <input
                  checked={selectedSrs[sr.id] || false}
                  disabled={disableSrCheckbox(sr)}
                  onChange={event => this._selectSr(event, sr.id)}
                  type='checkbox'
                />
              </td>
              <td>
                <Link to={`/srs/${sr.id}/general`}>{sr.name_label}</Link>
              </td>
              <td>
                <Link to={`/hosts/${host.id}/general`}>{host.name_label}</Link>
              </td>
              <td>
                {formatSize(sr.size)}
              </td>
              <td>
                {sr.size > 0 &&
                <Tooltip content={_('spaceLeftTooltip', {
                  used: String(Math.round((sr.physical_usage / sr.size) * 100)),
                  free: formatSize(sr.size - sr.physical_usage)
                })}>
                  <progress
                    className='progress'
                    max='100'
                    value={(sr.physical_usage / sr.size) * 100}
                  />
                </Tooltip>
                }
              </td>
            </tr>
          })}
        </tbody>
      </table>
      <h3>{_('xosanSuggestions')}</h3>
      {isEmpty(suggestions)
        ? <em>{_('xosanSelect2Srs')}</em>
        : [
          <table className='table table-striped'>
            <thead>
              <tr>
                <th>{_('xosanLayout')}</th>
                <th>{_('xosanRedundancy')}</th>
                <th>{_('xosanCapacity')}</th>
                <th>{_('xosanAvailableSpace')}</th>
              </tr>
            </thead>
            <tbody>
              {map(suggestions, ({ layout, redundancy, capacity, availableSpace }, index) => <tr key={index}>
                <td>{layout}</td>
                <td>{redundancy}</td>
                <td>{capacity}</td>
                <td>{formatSize(availableSpace)}</td>
              </tr>)}
            </tbody>
          </table>,
          <Graph layout={layout} redundancy={redundancy} nSrs={this._getNSelectedSrs()} />,
          <hr />,
          <Container>
            <SingleLineRow>
              <Col size={3}>
                <SelectPif
                  onChange={this.linkState('pif')}
                  predicate={this._getPifPredicate()}
                  value={pif}
                />
              </Col>
              <Col size={2}>
                <input
                  className='form-control pull-right'
                  disabled={!useVlan}
                  onChange={this.linkState('vlan')}
                  placeholder='VLAN'
                  style={{ width: '50%' }}
                  type='text'
                  value={vlan}
                />
                <Toggle className='pull-right mr-1' onChange={this.linkState('useVlan')} value={useVlan} />
              </Col>
              <Col size={2}>
                <select
                  className='form-control'
                  disabled={!suggestions}
                  onChange={this._selectLayout}
                  required
                  value={layout}
                >
                  {map(this._getPossibleLayouts(), layout =>
                    <option key={layout} value={layout}>{layout}</option>
                  )}
                </select>
              </Col>
              <Col size={2}>
                <select
                  className='form-control'
                  disabled={!suggestions}
                  onChange={this.linkState('redundancy')}
                  placeholder='redundancy'
                  required
                  value={redundancy}
                >
                  {map(this._getPossibleRedundancies(), redundancy =>
                    <option key={redundancy} value={redundancy}>{_('xosanRedundancyN', { redundancy })}</option>
                  )}
                </select>
              </Col>
              <Col size={3}>
                <ActionButton
                  btnStyle='success'
                  disabled={!suggestions || !pif || !layout || this._getNSelectedSrs() < 3} // TODO: "< 2" when arbitrer VM has been implemented
                  icon='add'
                  handler={this._createXosanVm}
                >
                  {_('xosanCreate')}
                </ActionButton>
              </Col>
            </SingleLineRow>
          </Container>
        ]
      }
    </div>
  }
}

// ==================================================================

@connectStore(() => {
  const pools = createGetObjectsOfType('pool')

  const hosts = createGetObjectsOfType('host').groupBy('$pool')

  const lvmSrsByPool = createGroupBy(createSort(createSelector(
    createGetObjectsOfType('SR').filter([sr => !sr.shared && sr.SR_type === 'lvm']),
    createGetObjectsOfType('PBD').groupBy('SR'),
    createGetObjectsOfType('host'),
    (srs, pbds, hosts) => map(srs, sr => {
      const list = pbds[sr.id]
      sr.PBDs = list || []
      sr.PBDs.forEach(pbd => {
        pbd.realHost = hosts[pbd.host]
      })
      sr.PBDs.sort()
      return sr
    }).filter(sr => Boolean(sr.PBDs.length))
  ), 'name_label'), '$pool')

  const xosanSrsByPool = createGroupBy(createSort(createSelector(
    createGetObjectsOfType('SR').filter([sr => sr.shared && sr.SR_type === 'xosan']),
    createGetObjectsOfType('PBD').groupBy('SR'),
    createGetObjectsOfType('host'),
    (srs, pbds, hosts) => map(srs, sr => {
      const list = pbds[sr.id]
      sr.PBDs = list || []
      sr.PBDs.forEach(pbd => {
        pbd.realHost = hosts[pbd.host]
      })
      sr.PBDs.sort((pbd1, pbd2) => pbd1.realHost.name_label.localeCompare(pbd2.realHost.name_label))
      return sr
    })
  ), 'name_label'), '$pool')

  return {
    hosts,
    pools,
    xosanSrsByPool,
    lvmSrsByPool,
    networks: createGetObjectsOfType('network').groupBy('$pool')
  }
})
@addSubscriptions({
  catalog: subscribeResourceCatalog,
  plugins: subscribePlugins
})
export default class Xosan extends Component {
  _getError = createSelector(
    () => this.props.plugins,
    () => this.props.catalog,
    (plugins, catalog) => {
      const cloudPlugin = find(plugins, { id: 'cloud' })
      if (!cloudPlugin) {
        return _('xosanInstallCloudPlugin')
      }

      if (!cloudPlugin.loaded) {
        return _('xosanLoadCloudPlugin')
      }

      if (!catalog) {
        return _('xosanLoading')
      }

      const { xosan } = catalog._namespaces
      if (!xosan) {
        return <span><Icon icon='error' /> {_('xosanNotAvailable')}</span>
      }

      if (xosan.available) {
        return <ActionButton handler={registerXosan} btnStyle='primary' icon='add'>{_('xosanRegisterBeta')}</ActionButton>
      }

      if (xosan.pending) {
        return _('xosanSuccessfullyRegistered')
      }
    }
  )

  render () {
    const { pools, xosanSrsByPool, lvmSrsByPool, catalog } = this.props
    const error = this._getError()

    return <Page header={HEADER} title='xosan' formatTitle>
      <Container>
        {error
          ? <em>{error}</em>
          : map(pools, pool => {
            const poolXosanSrs = xosanSrsByPool[pool.id]
            const poolLvmSrs = lvmSrsByPool[pool.id]
            // TODO: check hosts supplementalPacks directly instead of checking each SR
            const noPack = !every(poolLvmSrs, sr => sr.PBDs[0].realHost.supplementalPacks['vates:XOSAN'])

            return <Collapse className='mb-1' buttonText={<span>{noPack && <Icon icon='error' />} {pool.name_label}</span>}>
              <div className='m-1'>
                {poolXosanSrs && poolXosanSrs.length
                  ? <XosanVolumesTable xosansrs={poolXosanSrs} lvmsrs={poolLvmSrs} />
                  : <PoolAvailableSrs pool={pool} lvmsrs={poolLvmSrs} noPack={noPack} templates={filter(catalog.xosan, { type: 'xva' })} />
                }
              </div>
            </Collapse>
          })
        }
      </Container>
    </Page>
  }
}
