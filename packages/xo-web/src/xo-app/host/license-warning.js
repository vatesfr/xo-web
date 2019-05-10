import _ from 'intl'
import React from 'react'
import Icon from 'icon'
import Tooltip from 'tooltip'
import { alert } from 'modal'

const showInfo = () =>
  alert(
    _('licenseRestrictionsModalTitle'),
    <span>
      <a
        href='https://xcp-ng.com/pricing.html#xcpngvsxenserver'
        target='_blank'
      >
        {_('actionsRestricted')}
      </a>{' '}
      {_('counterRestrictionsOptions')}
      <ul>
        <li>
          <a
            href='https://github.com/xcp-ng/xcp/wiki/Upgrade-from-XenServer'
            target='_blank'
          >
            {_('counterRestrictionsOptionsXcp')}
          </a>
        </li>
        <li>{_('counterRestrictionsOptionsXsLicense')}</li>
      </ul>
    </span>
  )

const LicenseWarning = ({ iconSize = 'sm' }) => (
  <Tooltip content={_('licenseRestrictions')}>
    <a className='text-danger' style={{ cursor: 'pointer' }} onClick={showInfo}>
      <Icon icon='alarm' size={iconSize} />
    </a>
  </Tooltip>
)

export default LicenseWarning
