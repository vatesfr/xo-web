import _ from 'intl'
import ActionButton from 'action-button'
import Component from 'base-component'
import React from 'react'
import SortedTable from 'sorted-table'
import { addSubscriptions, connectStore } from 'utils'
import { createSelector, createGetObjectsOfType, createFilter } from 'selectors'
import { subscribeLicenses, unlockXosan } from 'xo'
import { get } from 'xo-defined'
import { filter, forEach, includes, map } from 'lodash'
import { injectIntl } from 'react-intl'

@injectIntl
class SelectLicense extends Component {
  state = { license: 'none' }

  render () {
    return (
      <form className='form-inline'>
        <select className='form-control' onChange={this.linkState('license')}>
          {_('selectLicense', message => (
            <option key='none' value='none'>
              {message}
            </option>
          ))}
          {map(this.props.licenses, license =>
            _(
              'expiresOn',
              {
                date:
                  license.expires !== undefined
                    ? this.props.intl.formatTime(license.expires, {
                      day: 'numeric',
                      month: 'numeric',
                      year: 'numeric',
                    })
                    : '',
              },
              message => (
                <option key={license.id} value={license.id}>
                  {license.id.slice(-4)} {license.expires ? `(${message})` : ''}
                </option>
              )
            )
          )}
        </select>
        <ActionButton
          btnStyle='primary'
          className='ml-1'
          disabled={this.state.license === 'none'}
          handler={this.props.onChange}
          handlerParam={get(() => this.state.license)}
          icon='connect'
        >
          Bind license
        </ActionButton>
      </form>
    )
  }
}

const XOSAN_COLUMNS = [
  {
    name: _('xosanName'),
    itemRenderer: sr => sr.name_label,
    sortCriteria: 'name_label',
  },
  {
    name: _('xosanLicense'),
    itemRenderer: (sr, { availableLicenses, licensesByXosan }) => {
      const license = licensesByXosan[sr.id]
      return license !== undefined ? (
        license.id.slice(-4)
      ) : (
        <SelectLicense
          licenses={availableLicenses}
          onChange={licenseId => unlockXosan(licenseId, sr.id)}
        />
      )
    },
  },
]

const XOSAN_INDIVIDUAL_ACTIONS = [
  {
    label: _('productSupport'),
    icon: 'support',
    handler: () => window.open('https://xen-orchestra.com'),
  },
]

@connectStore({
  xosanSrs: createGetObjectsOfType('SR').filter([
    ({ SR_type }) => SR_type === 'xosan', // eslint-disable-line camelcase
  ]),
})
@addSubscriptions({
  xosanLicenses: cb => subscribeLicenses('xosan', cb),
  xosanTrialLicenses: cb => subscribeLicenses('xosan.trial', cb),
})
export default class Xosan extends Component {
  _getLicensesByXosan = createSelector(
    () => this.props.xosanLicenses,
    licenses => {
      const licensesByXosan = {}
      forEach(licenses, license => {
        let xosanId
        if ((xosanId = license.boundObjectId) === undefined) {
          return
        }
        // TODO: show that something is wrong if an SR is bound to multiple licenses
        if (licensesByXosan[xosanId] === undefined) {
          licensesByXosan[xosanId] = license
        }
      })

      return licensesByXosan
    }
  )

  _getAvailableLicenses = createFilter(() => this.props.xosanLicenses, [
    ({ boundObjectId, expires }) =>
      boundObjectId === undefined &&
      (expires === undefined || expires > Date.now()),
  ])

  _getKnownXosans = createSelector(
    createSelector(
      () => this.props.xosanLicenses,
      () => this.props.xosanTrialLicenses,
      (licenses = [], trialLicenses = []) =>
        filter(map(licenses.concat(trialLicenses), 'boundObjectId'))
    ),
    () => this.props.xosanSrs,
    (knownXosanIds, xosanSrs) =>
      filter(xosanSrs, ({ id }) => includes(knownXosanIds, id))
  )

  render () {
    return (
      <SortedTable
        collection={this._getKnownXosans()}
        columns={XOSAN_COLUMNS}
        individualActions={XOSAN_INDIVIDUAL_ACTIONS}
        userData={{
          availableLicenses: this._getAvailableLicenses(),
          licensesByXosan: this._getLicensesByXosan(),
          xosanSrs: this.props.xosanSrs,
        }}
      />
    )
  }
}
