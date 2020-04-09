import _ from 'intl'
import ActionButton from 'action-button'
import addSubscriptions from 'add-subscriptions'
import decorate from 'apply-decorators'
import defined from '@xen-orchestra/defined'
import Icon from 'icon'
import NoObjects from 'no-objects'
import React from 'react'
import SortedTable from 'sorted-table'
import { adminOnly } from 'utils'
import { provideState, injectState } from 'reaclette'
import { Text, XoSelect } from 'editable'
import { Vm } from 'render-xo-item'
import { withRouter } from 'react-router'
import {
  checkProxyHealth,
  destroyProxyAppliances,
  editProxyAppliance,
  forgetProxyAppliances,
  subscribeLicenses,
  subscribeProxies,
  upgradeProxyAppliance,
} from 'xo'

import Page from '../page'

import deployProxy from './deploy-proxy'

const _editProxy = (value, { name, proxy }) =>
  editProxyAppliance(proxy, { [name]: value })

const _editProxyAddress = (value, { proxy }) => {
  value = value.trim()
  return editProxyAppliance(proxy, {
    address: value !== '' ? value : null,
  })
}

const HEADER = (
  <h2>
    <Icon icon='proxy' /> {_('proxies')}
  </h2>
)

const ACTIONS = [
  {
    handler: forgetProxyAppliances,
    icon: 'forget',
    label: _('forgetProxies'),
    level: 'danger',
  },
  {
    handler: destroyProxyAppliances,
    icon: 'destroy',
    label: _('destroyProxies'),
    level: 'danger',
  },
]

const INDIVIDUAL_ACTIONS = [
  {
    handler: (proxy, { validLicensePerAppliance }) =>
      deployProxy({
        proxy,
        license: defined(
          validLicensePerAppliance[proxy.vmUuid],
          validLicensePerAppliance.none
        ),
      }),
    icon: 'refresh',
    label: _('redeployProxyAction'),
    level: 'warning',
  },
  {
    handler: checkProxyHealth,
    icon: 'diagnosis',
    label: _('checkProxyHealth'),
    level: 'primary',
  },
  {
    disabled: ({ vmUuid }) => vmUuid === undefined,
    handler: upgradeProxyAppliance,
    icon: 'vm',
    label: _('upgradeProxyAppliance'),
    level: 'primary',
  },
  {
    handler: ({ id }, { router }) =>
      router.push({
        pathname: '/settings/remotes',
        query: {
          l: `proxy:${id}`,
          nfs: `proxy:${id}`,
          smb: `proxy:${id}`,
        },
      }),
    icon: 'remote',
    label: _('proxyLinkedRemotes'),
  },
  {
    handler: ({ id }, { router }) =>
      router.push({
        pathname: '/backup/overview',
        query: {
          s: `proxy:${id}`,
        },
      }),
    icon: 'backup',
    label: _('proxyLinkedBackups'),
  },
]

const COLUMNS = [
  {
    default: true,
    itemRenderer: proxy => (
      <Text
        data-name='name'
        data-proxy={proxy}
        onChange={_editProxy}
        value={proxy.name}
      />
    ),
    name: _('name'),
    sortCriteria: 'name',
  },
  {
    itemRenderer: proxy => (
      <Text
        data-proxy={proxy}
        onChange={_editProxyAddress}
        value={defined(proxy.address, '')}
      />
    ),
    name: _('address'),
    sortCriteria: 'address',
  },
  {
    itemRenderer: proxy => (
      <XoSelect
        onChange={value => _editProxy(value, { name: 'vm', proxy })}
        value={proxy.vmUuid}
        xoType='VM'
      >
        {proxy.vmUuid !== undefined ? (
          <div>
            <Vm id={proxy.vmUuid} />{' '}
            <a
              role='button'
              onClick={() => _editProxy(null, { name: 'vm', proxy })}
            >
              <Icon icon='remove' />
            </a>
          </div>
        ) : (
          _('noValue')
        )}
      </XoSelect>
    ),
    name: _('vm'),
    sortCriteria: 'vm',
  },
]

export default decorate([
  adminOnly,
  withRouter,
  addSubscriptions({
    licenses: cb => subscribeLicenses('xoproxy', cb),
    proxies: subscribeProxies,
  }),
  provideState({
    computed: {
      validLicensePerAppliance: (state, { licenses = [] }) => {
        const result = {}
        licenses.forEach(license => {
          if (!(license.expires < Date.now())) {
            result[defined(license.boundObjectId, 'none')] = license
          }
        })
        return result
      },
    },
  }),
  injectState,
  ({ proxies, router, state }) => (
    <Page header={HEADER} title='proxies' formatTitle>
      <div>
        <div className='mt-1 mb-1'>
          <ActionButton
            btnStyle='success'
            data-license={state.validLicensePerAppliance.none}
            handler={deployProxy}
            icon='proxy'
            size='large'
          >
            {_('deployProxy')}
          </ActionButton>
        </div>
        <NoObjects
          actions={ACTIONS}
          collection={proxies}
          columns={COLUMNS}
          component={SortedTable}
          data-validLicensePerAppliance={state.validLicensePerAppliance}
          data-router={router}
          emptyMessage={
            <span className='text-muted'>
              <Icon icon='alarm' />
              &nbsp;
              {_('noProxiesAvailable')}
            </span>
          }
          individualActions={INDIVIDUAL_ACTIONS}
          stateUrlParam='s'
        />
      </div>
    </Page>
  ),
])
