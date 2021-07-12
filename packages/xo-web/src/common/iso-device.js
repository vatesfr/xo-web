import PropTypes from 'prop-types'
import React from 'react'

import _ from 'intl'
import ActionButton from './action-button'
import Component from './base-component'
import Icon from 'icon'
import Tooltip from 'tooltip'
import { alert } from 'modal'
import { isAdmin } from 'selectors'
import { isEmpty } from 'lodash'
import { addSubscriptions, connectStore, resolveResourceSet } from './utils'
import { ejectCd, insertCd, rescanSrs, subscribeResourceSets } from './xo'
import { createGetObjectsOfType, createFinder, createGetObject, createSelector } from './selectors'
import { SelectResourceSetsVdi, SelectVdi as SelectAnyVdi } from './select-objects'

const vdiPredicate = vdi => !vdi.missing

@addSubscriptions({
  resourceSets: subscribeResourceSets,
})
@connectStore(() => {
  const getCdDrive = createFinder(
    createGetObjectsOfType('VBD').pick((_, { vm }) => vm.$VBDs),
    [vbd => vbd.is_cd_drive]
  )

  const getIsoSrs = createGetObjectsOfType('SR').filter(
    (_, { vm: { $pool } }) =>
      sr =>
        sr.$pool === $pool && sr.SR_type === 'iso'
  )

  const getMountedIso = createGetObject((state, props) => {
    const cdDrive = getCdDrive(state, props)
    if (cdDrive) {
      return cdDrive.VDI
    }
  })

  return {
    cdDrive: getCdDrive,
    isAdmin,
    isoSrs: getIsoSrs,
    mountedIso: getMountedIso,
  }
})
export default class IsoDevice extends Component {
  static propTypes = {
    vm: PropTypes.object.isRequired,
  }

  _getSrPredicate = createSelector(
    () => this.props.vm.$pool,
    () => this.props.vm.$container,
    (vmPool, vmContainer) => sr => {
      const vmRunning = vmContainer !== vmPool
      const sameHost = vmContainer === sr.$container
      const samePool = vmPool === sr.$pool

      return (
        samePool &&
        (vmRunning ? sr.shared || sameHost : true) &&
        (sr.SR_type === 'iso' || (sr.SR_type === 'udev' && sr.size))
      )
    }
  )

  _getResolvedResourceSet = createSelector(
    createFinder(
      () => this.props.resourceSets,
      createSelector(
        () => this.props.vm.resourceSet,
        id => resourceSet => resourceSet.id === id
      )
    ),
    resolveResourceSet
  )

  _handleInsert = iso => {
    const { vm } = this.props

    if (iso) {
      insertCd(vm, iso.id, true)
    } else {
      ejectCd(vm)
    }
  }

  _handleEject = () => ejectCd(this.props.vm)

  _rescanIsoSrs = () => rescanSrs(this.props.isoSrs)

  _showWarning = () => alert(_('cdDriveNotInstalled'), _('cdDriveInstallation'))

  render() {
    const { cdDrive, isAdmin, isoSrs, mountedIso } = this.props
    const resourceSet = this._getResolvedResourceSet()
    const useResourceSet = !(isAdmin || resourceSet === undefined)
    const SelectVdi = useResourceSet ? SelectResourceSetsVdi : SelectAnyVdi

    return (
      <div className='input-group'>
        <SelectVdi
          onChange={this._handleInsert}
          predicate={vdiPredicate}
          resourceSet={useResourceSet ? resourceSet : undefined}
          srPredicate={this._getSrPredicate()}
          value={mountedIso}
        />
        {!useResourceSet && (
          <span className='input-group-btn'>
            <ActionButton
              disabled={isEmpty(isoSrs)}
              handler={this._rescanIsoSrs}
              icon='refresh'
              tooltip={_('rescanIsoSrs')}
            />
          </span>
        )}
        <span className='input-group-btn'>
          <ActionButton disabled={!mountedIso} handler={this._handleEject} icon='vm-eject' />
        </span>
        {mountedIso && !cdDrive.device && (
          <Tooltip content={_('cdDriveNotInstalled')}>
            <a className='text-warning btn btn-link' onClick={this._showWarning}>
              <Icon icon='alarm' size='lg' />
            </a>
          </Tooltip>
        )}
      </div>
    )
  }
}
