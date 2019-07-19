import _ from 'intl'
import CopyToClipboard from 'react-copy-to-clipboard'
import PropTypes from 'prop-types'
import React from 'react'
import { get } from '@xen-orchestra/defined'
import { find } from 'lodash'

import decorate from './apply-decorators'
import Icon from './icon'
import Link from './link'
import Tooltip from './tooltip'
import { addSubscriptions, connectStore, formatSize } from './utils'
import { createGetObject, createSelector } from './selectors'
import { FormattedDate } from 'react-intl'
import { isSrWritable, subscribeRemotes, subscribeUsers } from './xo'

// ===================================================================

const unknowItem = (uuid, type) => (
  <Tooltip content={_('copyUuid', { uuid })}>
    <CopyToClipboard text={uuid}>
      <span className='text-muted' style={{ cursor: 'pointer' }}>
        {_('errorUnknownItem', { type })}
      </span>
    </CopyToClipboard>
  </Tooltip>
)

const LinkWrapper = ({ children, link, to, newTab }) =>
  link ? (
    <Link to={to} target={newTab && '_blank'}>
      {children}
    </Link>
  ) : (
    <span>{children}</span>
  )

LinkWrapper.propTypes = {
  link: PropTypes.bool,
  newTab: PropTypes.bool,
  to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
}

// ===================================================================

export const Pool = decorate([
  connectStore(() => ({
    pool: createGetObject(),
  })),
  ({ id, pool, link, newTab }) => {
    if (pool === undefined) {
      return unknowItem(id, 'pool')
    }

    return (
      <LinkWrapper link={link} newTab={newTab} to={`/pools/${pool.id}`}>
        <Icon icon='pool' /> {pool.name_label}
      </LinkWrapper>
    )
  },
])

Pool.propTypes = {
  id: PropTypes.string.isRequired,
  link: PropTypes.bool,
  newTab: PropTypes.bool,
}

Pool.defaultProps = {
  link: false,
  newTab: false,
}

// ===================================================================

export const Host = decorate([
  connectStore(() => {
    const getHost = createGetObject()
    return {
      host: getHost,
      pool: createGetObject(
        createSelector(
          getHost,
          (_, props) => props.pool,
          (host, showPool) => showPool && get(() => host.$pool)
        )
      ),
    }
  }),
  ({ id, host, pool, link, newTab, memoryFree }) => {
    if (host === undefined) {
      return unknowItem(id, 'host')
    }

    return (
      <LinkWrapper link={link} newTab={newTab} to={`/hosts/${host.id}`}>
        <Icon icon='host' /> {host.name_label}
        {memoryFree && (
          <span>
            {' ('}
            {_('memoryFree', {
              memoryFree: formatSize(host.memory.size - host.memory.usage),
            })}
            {')'}
          </span>
        )}
        {pool !== undefined && <span>{` - ${pool.name_label}`}</span>}
      </LinkWrapper>
    )
  },
])

Host.propTypes = {
  id: PropTypes.string.isRequired,
  link: PropTypes.bool,
  memoryFree: PropTypes.bool,
  newTab: PropTypes.bool,
  pool: PropTypes.bool,
}

Host.defaultProps = {
  link: false,
  memoryFree: false,
  newTab: false,
  pool: true,
}

// ===================================================================

export const Vm = decorate([
  connectStore(() => {
    const getVm = createGetObject()
    return {
      vm: getVm,
      container: createGetObject(
        createSelector(
          getVm,
          vm => get(() => vm.$container)
        )
      ),
    }
  }),
  ({ id, vm, container, link, newTab }) => {
    if (vm === undefined) {
      return unknowItem(id, 'VM')
    }

    return (
      <LinkWrapper link={link} newTab={newTab} to={`/vms/${vm.id}`}>
        <Icon icon={`vm-${vm.power_state.toLowerCase()}`} /> {vm.name_label}
        {container !== undefined && ` (${container.name_label})`}
      </LinkWrapper>
    )
  },
])

Vm.propTypes = {
  id: PropTypes.string.isRequired,
  link: PropTypes.bool,
  newTab: PropTypes.bool,
}

Vm.defaultProps = {
  link: false,
  newTab: false,
}

// ===================================================================

export const VmTemplate = decorate([
  connectStore(() => {
    const getObject = createGetObject()
    const getPool = createGetObject(
      createSelector(
        getObject,
        vm => get(() => vm.$pool)
      )
    )
    return (state, props) => ({
      // FIXME: props.self ugly workaround to get object as a self user
      template: getObject(state, props, props.self),
      pool: getPool(state, props),
    })
  }),
  ({ id, template, pool }) => {
    if (template === undefined) {
      return unknowItem(id, 'template')
    }

    return (
      <span>
        <Icon icon='vm' /> {template.name_label}
        {pool !== undefined && (
          <span className='text-muted'>{` - ${pool.name_label}`}</span>
        )}
      </span>
    )
  },
])

VmTemplate.propTypes = {
  id: PropTypes.string.isRequired,
  self: PropTypes.bool,
}

VmTemplate.defaultProps = {
  link: false,
  newTab: false,
  self: false,
}

// ===================================================================

export const Sr = decorate([
  connectStore(() => {
    const getSr = createGetObject()
    const getContainer = createGetObject(
      createSelector(
        getSr,
        (_, props) => props.container,
        (sr, showContainer) => showContainer && get(() => sr.$container)
      )
    )
    return (state, props) => ({
      // FIXME: props.self ugly workaround to get object as a self user
      sr: getSr(state, props, props.self),
      container: getContainer(state, props),
    })
  }),
  ({ id, sr, container, link, newTab, spaceLeft, self }) => {
    if (sr === undefined) {
      return unknowItem(id, 'SR')
    }

    return (
      <LinkWrapper link={link} newTab={newTab} to={`/srs/${sr.id}`}>
        <Icon icon='sr' /> {sr.name_label}
        {!self && spaceLeft && isSrWritable(sr) && (
          <span className={!link && 'text-muted'}>{` (${formatSize(
            sr.size - sr.physical_usage
          )} free)`}</span>
        )}
        {!self && container !== undefined && (
          <span className={!link && 'text-muted'}>
            {' '}
            - {container.name_label}
          </span>
        )}
      </LinkWrapper>
    )
  },
])

Sr.propTypes = {
  container: PropTypes.bool,
  id: PropTypes.string.isRequired,
  link: PropTypes.bool,
  newTab: PropTypes.bool,
  self: PropTypes.bool,
  spaceLeft: PropTypes.bool,
}

Sr.defaultProps = {
  container: true,
  link: false,
  newTab: false,
  self: false,
  spaceLeft: true,
}

// ===================================================================

export const Vdi = decorate([
  connectStore(() => {
    const getObject = createGetObject()
    const getSr = createGetObject((state, props) => {
      const vdi = getObject(state, props, props.self)
      return vdi && vdi.$SR
    })
    // FIXME: props.self ugly workaround to get object as a self user
    return (state, props) => ({
      vdi: getObject(state, props, props.self),
      sr: getSr(state, props),
    })
  }),
  ({ id, showSize, showSr, sr, vdi }) => {
    if (vdi === undefined) {
      return unknowItem(id, 'VDI')
    }

    return (
      <span>
        <Icon icon='disk' /> {vdi.name_label}
        {sr !== undefined && showSr && (
          <span className='text-muted'> - {sr.name_label}</span>
        )}
        {showSize && (
          <span className='text-muted'> ({formatSize(vdi.size)})</span>
        )}
      </span>
    )
  },
])

Vdi.propTypes = {
  id: PropTypes.string.isRequired,
  self: PropTypes.bool,
  showSize: PropTypes.bool,
}

Vdi.defaultProps = {
  self: false,
  showSize: false,
  showSr: false,
}

// ===================================================================

export const Network = decorate([
  connectStore(() => {
    const getObject = createGetObject()
    // FIXME: props.self ugly workaround to get object as a self user
    return (state, props) => ({
      network: getObject(state, props, props.self),
    })
  }),
  ({ id, network }) => {
    if (network === undefined) {
      return unknowItem(id, 'network')
    }

    return (
      <span>
        <Icon icon='network' /> {network.name_label}
      </span>
    )
  },
])

Network.propTypes = {
  id: PropTypes.string.isRequired,
  self: PropTypes.bool,
}

Network.defaultProps = {
  self: false,
}

// ===================================================================

export const Remote = decorate([
  addSubscriptions(({ id }) => ({
    remote: cb => subscribeRemotes(remotes => cb(find(remotes, { id }))),
  })),
  ({ id, remote, link, newTab }) => {
    if (remote === undefined) {
      return unknowItem(id, 'remote') // TODO: handle remotes not fetched yet
    }

    return (
      <LinkWrapper link={link} newTab={newTab} to='/settings/remotes'>
        <Icon icon='remote' /> {remote.name}
      </LinkWrapper>
    )
  },
])

Remote.propTypes = {
  id: PropTypes.string.isRequired,
  link: PropTypes.bool,
  newTab: PropTypes.bool,
}

Remote.defaultProps = {
  link: false,
  newTab: false,
}

// ===================================================================

export const Vgpu = connectStore(() => ({
  vgpuType: createGetObject((_, props) => props.vgpu.vgpuType),
}))(({ vgpu, vgpuType }) => (
  <span>
    <Icon icon='vgpu' /> {vgpuType.modelName}
  </span>
))

Vgpu.propTypes = {
  vgpu: PropTypes.object.isRequired,
}

// ===================================================================

export const User = decorate([
  addSubscriptions(({ id }) => ({
    user: cb => subscribeUsers(users => cb(find(users, { id }))),
  })),
  ({ id, user, link, newTab }) => {
    if (user === undefined) {
      return unknowItem(id, 'user')
    }

    return (
      <LinkWrapper
        link={link}
        newTab={newTab}
        to={`/settings/acls?s=subject:id:${id}`}
      >
        <Icon icon='user' /> {user.email}
      </LinkWrapper>
    )
  },
])

User.propTypes = {
  id: PropTypes.string.isRequired,
  link: PropTypes.bool,
  newTab: PropTypes.bool,
}

User.defaultProps = {
  link: false,
  newTab: false,
}

// ===================================================================

const xoItemToRender = {
  // Subscription objects.
  cloudConfig: template => (
    <span>
      <Icon icon='template' /> {template.name}
    </span>
  ),
  group: group => (
    <span>
      <Icon icon='group' /> {group.name}
    </span>
  ),
  remote: ({ value: { id } }) => <Remote id={id} />,
  role: role => <span>{role.name}</span>,
  user: user => (
    <span>
      <Icon icon='user' /> {user.email}
    </span>
  ),
  resourceSet: resourceSet => (
    <span>
      <strong>
        <Icon icon='resource-set' /> {resourceSet.name}
      </strong>
    </span>
  ),
  sshKey: key => (
    <span>
      <Icon icon='ssh-key' /> {key.label}
    </span>
  ),
  ipPool: ipPool => (
    <span>
      <Icon icon='ip' /> {ipPool.name}
    </span>
  ),
  ipAddress: ({ label, used }) => {
    if (used) {
      return <strong className='text-warning'>{label}</strong>
    }
    return <span>{label}</span>
  },

  // XO objects.
  pool: ({ id }) => <Pool id={id} />,

  VDI: ({ id }) => <Vdi id={id} showSr />,
  'VDI-resourceSet': ({ id }) => <Vdi id={id} self showSr />,

  // Pool objects.
  'VM-template': ({ id }) => <VmTemplate id={id} />,
  'VM-template-resourceSet': ({ id }) => <VmTemplate id={id} self />,
  host: ({ id, memoryFree }) => <Host id={id} memoryFree={memoryFree} />,
  network: ({ id }) => <Network id={id} />,
  'network-resourceSet': ({ id }) => <Network id={id} self />,

  // SR.
  SR: ({ id }) => <Sr id={id} />,
  'SR-resourceSet': ({ id }) => <Sr id={id} self />,

  // VM.
  VM: ({ id }) => <Vm id={id} />,
  'VM-snapshot': ({ id }) => <Vm id={id} />,
  'VM-controller': ({ id }) => (
    <span>
      <Icon icon='host' /> <Vm id={id} />
    </span>
  ),

  // PIF.
  PIF: pif => (
    <span>
      <Icon
        icon='network'
        color={pif.carrier ? 'text-success' : 'text-danger'}
      />{' '}
      {pif.device} ({pif.deviceName})
    </span>
  ),

  // Tags.
  tag: tag => (
    <span>
      <Icon icon='tag' /> {tag.value}
    </span>
  ),

  // GPUs

  vgpu: vgpu => <Vgpu vgpu={vgpu} />,

  vgpuType: type => (
    <span>
      <Icon icon='gpu' /> {type.modelName} ({type.vendorName}){' '}
      {type.maxResolutionX}x{type.maxResolutionY}
    </span>
  ),

  gpuGroup: group => (
    <span>
      {group.name_label.startsWith('Group of ')
        ? group.name_label.slice(9)
        : group.name_label}
    </span>
  ),

  backup: backup => (
    <span>
      <span className='tag tag-info' style={{ textTransform: 'capitalize' }}>
        {backup.mode}
      </span>{' '}
      <span className='tag tag-warning'>{backup.remote.name}</span>{' '}
      {backup.size !== undefined && (
        <span className='tag tag-info'>{formatSize(backup.size)}</span>
      )}{' '}
      <FormattedDate
        value={new Date(backup.timestamp)}
        month='long'
        day='numeric'
        year='numeric'
        hour='2-digit'
        minute='2-digit'
        second='2-digit'
      />
    </span>
  ),
}

const renderXoItem = (item, { className, type: xoType, ...props } = {}) => {
  const { id, label } = item
  const type = xoType || item.type

  if (item.removed) {
    return (
      <span key={id} className='text-danger'>
        {' '}
        <Icon icon='alarm' /> {id}
      </span>
    )
  }

  if (!type) {
    if (process.env.NODE_ENV !== 'production' && !label) {
      throw new Error(`an item must have at least either a type or a label`)
    }
    return (
      <span key={id} className={className}>
        {label}
      </span>
    )
  }

  const Component = xoItemToRender[type]

  if (process.env.NODE_ENV !== 'production' && !Component) {
    throw new Error(`no available component for type ${type}`)
  }

  if (Component) {
    return (
      <span key={id} className={className}>
        <Component {...item} {...props} />
      </span>
    )
  }
}

export { renderXoItem as default }

export const getRenderXoItemOfType = type => (item, options = {}) =>
  renderXoItem(item, { ...options, type })

const GenericXoItem = connectStore(() => {
  const getObject = createGetObject()

  return (state, props) => ({
    xoItem: getObject(state, props),
  })
})(({ xoItem, ...props }) =>
  xoItem ? renderXoItem(xoItem, props) : renderXoUnknownItem()
)

export const renderXoItemFromId = (id, props) => (
  <GenericXoItem {...props} id={id} />
)

export const renderXoUnknownItem = () => (
  <span className='text-muted'>{_('errorNoSuchItem')}</span>
)
