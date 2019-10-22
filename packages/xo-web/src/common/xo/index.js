import asap from 'asap'
import cookies from 'cookies-js'
import fpSortBy from 'lodash/fp/sortBy'
import pFinally from 'promise-toolbox/finally'
import React from 'react'
import reflect from 'promise-toolbox/reflect'
import tap from 'promise-toolbox/tap'
import updater from 'xoa-updater'
import URL from 'url-parse'
import Xo from 'xo-lib'
import { createBackoff } from 'jsonrpc-websocket-client'
import { SelectHost } from 'select-objects'
import {
  filter,
  forEach,
  get,
  includes,
  isEmpty,
  isEqual,
  map,
  once,
  size,
  sortBy,
  throttle,
} from 'lodash'
import {
  forbiddenOperation,
  noHostsAvailable,
  vmIsTemplate,
} from 'xo-common/api-errors'

import _ from '../intl'
import fetch, { post } from '../fetch'
import invoke from '../invoke'
import logError from '../log-error'
import renderXoItem, { renderXoItemFromId } from '../render-xo-item'
import store from 'store'
import { alert, chooseAction, confirm } from '../modal'
import { error, info, success } from '../notification'
import { getObject } from 'selectors'
import { noop, resolveId, resolveIds } from '../utils'
import {
  connected,
  disconnected,
  markObjectsFetched,
  signedIn,
  signedOut,
  updateObjects,
  updatePermissions,
} from '../store/actions'

import parseNdJson from './_parseNdJson'

// ===================================================================

export const XEN_DEFAULT_CPU_WEIGHT = 256
export const XEN_DEFAULT_CPU_CAP = 0

// ===================================================================

export const XEN_VIDEORAM_VALUES = [1, 2, 4, 8, 16]

// ===================================================================

export const isSrWritable = sr => sr && sr.content_type !== 'iso' && sr.size > 0
export const isSrShared = sr => sr && sr.shared
export const isVmRunning = vm => vm && vm.power_state === 'Running'

// ===================================================================

export const signOut = () => {
  // prevent automatic reconnection
  xo.removeListener('closed', connect)

  cookies.expire('token')
  window.location.reload(true)
}

export const connect = () => {
  xo.open(createBackoff()).catch(error => {
    logError(error, 'failed to connect to xo-server')
  })
}

const xo = invoke(() => {
  const token = cookies.get('token')
  if (!token) {
    signOut()
    throw new Error('no valid token')
  }

  const xo = new Xo({
    credentials: { token },
  })

  xo.on('authenticationFailure', signOut)
  xo.on('scheduledAttempt', ({ delay }) => {
    console.warn('next attempt in %s ms', delay)
  })

  xo.on('closed', connect)

  return xo
})
connect()

const _signIn = new Promise(resolve => xo.once('authenticated', resolve))

const _call = (method, params) => {
  let promise = _signIn.then(() => xo.call(method, params))

  if (process.env.NODE_ENV !== 'production') {
    promise = promise::tap(null, error => {
      console.error('XO error', {
        method,
        params,
        code: error.code,
        message: error.message,
        data: error.data,
      })
    })
  }

  return promise
}

// ===================================================================

export const connectStore = store => {
  let updates = {}
  const sendUpdates = throttle(() => {
    store.dispatch(updateObjects(updates))
    updates = {}
  }, 5e2)

  xo.on('open', () => store.dispatch(connected()))
  xo.on('closed', () => {
    store.dispatch(signedOut())
    store.dispatch(disconnected())
  })
  xo.on('authenticated', () => {
    store.dispatch(signedIn(xo.user))

    _call('xo.getAllObjects', { ndjson: true })
      .then(({ $getFrom }) => fetch('.' + $getFrom))
      .then(response => response.text())
      .then(data => {
        const objects = Object.create(null)
        parseNdJson(data, object => {
          objects[object.id] = object
        })
        store.dispatch(updateObjects(objects))
        store.dispatch(markObjectsFetched())
      })
  })
  xo.on('notification', notification => {
    if (notification.method !== 'all') {
      return
    }

    Object.assign(updates, notification.params.items)
    sendUpdates()
  })
  subscribePermissions(permissions =>
    store.dispatch(updatePermissions(permissions))
  )

  // work around to keep the user in Redux store up to date
  //
  // FIXME: store subscriptions data directly in Redux
  subscribeCurrentUser(user => {
    store.dispatch(signedIn(user))
  })
}

// -------------------------------------------------------------------

export const resolveUrl = invoke(
  xo._url, // FIXME: accessing private prop
  baseUrl => to => new URL(to, baseUrl).toString()
)

// -------------------------------------------------------------------

const createSubscription = cb => {
  const delay = 5e3 // 5s
  const clearCacheDelay = 6e5 // 10m

  const subscribers = Object.create(null)
  let cache
  let n = 0
  let nextId = 0
  let timeout

  let running = false

  const clearCache = () => {
    cache = undefined
  }

  const uninstall = () => {
    clearTimeout(timeout)
    timeout = setTimeout(clearCache, clearCacheDelay)
  }

  const loop = () => {
    clearTimeout(timeout)

    if (running) {
      return
    }

    running = true
    _signIn
      .then(() => cb())
      .then(
        result => {
          running = false

          if (n === 0) {
            return uninstall()
          }

          timeout = setTimeout(loop, delay)

          if (!isEqual(result, cache)) {
            cache = result

            forEach(subscribers, subscriber => {
              // A subscriber might have disappeared during iteration.
              //
              // E.g.: if a subscriber triggers the subscription of another.
              if (subscriber) {
                subscriber(result)
              }
            })
          }
        },
        error => {
          running = false

          if (n === 0) {
            return uninstall()
          }

          console.error(error)
        }
      )
  }

  const subscribe = cb => {
    const id = nextId++
    subscribers[id] = cb

    if (cache !== undefined) {
      asap(() => cb(cache))
    }

    if (n++ === 0) {
      loop()
    }

    return once(() => {
      delete subscribers[id]

      if (--n === 0) {
        uninstall()
      }
    })
  }

  subscribe.forceRefresh = () => {
    if (n) {
      loop()
    }
  }

  return subscribe
}

// Subscriptions -----------------------------------------------------

export const subscribeCurrentUser = createSubscription(() => xo.refreshUser())

export const subscribeAcls = createSubscription(() => _call('acl.get'))

export const subscribeJobs = createSubscription(() => _call('job.getAll'))

export const subscribeJobsLogs = createSubscription(() =>
  _call('log.get', { namespace: 'jobs' })
)

export const subscribeApiLogs = createSubscription(() =>
  _call('log.get', { namespace: 'api' })
)

export const subscribePermissions = createSubscription(() =>
  _call('acl.getCurrentPermissions')
)

export const subscribePlugins = createSubscription(() => _call('plugin.get'))

export const subscribeRemotes = createSubscription(() => _call('remote.getAll'))

export const subscribeRemotesInfo = createSubscription(() =>
  _call('remote.getAllInfo')
)

export const subscribeResourceSets = createSubscription(() =>
  _call('resourceSet.getAll')
)

export const subscribeSchedules = createSubscription(() =>
  _call('schedule.getAll')
)

export const subscribeServers = createSubscription(
  invoke(fpSortBy('host'), sort => () => _call('server.getAll').then(sort))
)

export const subscribeUsers = createSubscription(() =>
  _call('user.getAll').then(users => {
    forEach(users, user => {
      user.type = 'user'
    })

    return sortBy(users, 'email')
  })
)

export const subscribeGroups = createSubscription(() =>
  _call('group.getAll').then(groups => {
    forEach(groups, group => {
      group.type = 'group'
    })

    return sortBy(groups, 'name')
  })
)

export const subscribeRoles = createSubscription(
  invoke(sortBy('name'), sort => () => _call('role.getAll').then(sort))
)

export const subscribeIpPools = createSubscription(() => _call('ipPool.getAll'))

export const subscribeResourceCatalog = createSubscription(() =>
  _call('cloud.getResourceCatalog')
)

export const subscribeHubResourceCatalog = createSubscription(() =>
  _call('cloud.getResourceCatalog', { filters: { hub: true } })
)

const getNotificationCookie = () => {
  const notificationCookie = cookies.get(
    `notifications:${store.getState().user.id}`
  )
  return notificationCookie === undefined ? {} : JSON.parse(notificationCookie)
}

const setNotificationCookie = (id, changes) => {
  const notifications = getNotificationCookie()
  notifications[id] = { ...(notifications[id] || {}), ...changes }
  forEach(notifications[id], (value, key) => {
    if (value === null) {
      delete notifications[id][key]
    }
  })
  cookies.set(
    `notifications:${store.getState().user.id}`,
    JSON.stringify(notifications)
  )
}

export const dismissNotification = id => {
  setNotificationCookie(id, { read: true, date: Date.now() })
  subscribeNotifications.forceRefresh()
}

export const subscribeNotifications = createSubscription(async () => {
  const { user, xoaUpdaterState } = store.getState()
  if (
    +process.env.XOA_PLAN === 5 ||
    xoaUpdaterState === 'disconnected' ||
    xoaUpdaterState === 'error'
  ) {
    return []
  }

  let notifications
  try {
    notifications = await updater._call('getMessages')
  } catch (err) {
    return []
  }
  const notificationCookie = getNotificationCookie()
  return map(
    user != null && user.permission === 'admin'
      ? notifications
      : filter(notifications, { level: 'warning' }),
    notification => ({
      ...notification,
      read: !!get(notificationCookie, `${notification.id}.read`),
    })
  )
})

const checkSrCurrentStateSubscriptions = {}
export const subscribeCheckSrCurrentState = (pool, cb) => {
  const poolId = resolveId(pool)

  if (!checkSrCurrentStateSubscriptions[poolId]) {
    checkSrCurrentStateSubscriptions[poolId] = createSubscription(() =>
      _call('xosan.checkSrCurrentState', { poolId })
    )
  }

  return checkSrCurrentStateSubscriptions[poolId](cb)
}
subscribeCheckSrCurrentState.forceRefresh = pool => {
  if (pool === undefined) {
    forEach(checkSrCurrentStateSubscriptions, subscription =>
      subscription.forceRefresh()
    )
    return
  }

  const subscription = checkSrCurrentStateSubscriptions[resolveId(pool)]
  if (subscription !== undefined) {
    subscription.forceRefresh()
  }
}

const missingPatchesByHost = {}
export const subscribeHostMissingPatches = (host, cb) => {
  const hostId = resolveId(host)

  if (missingPatchesByHost[hostId] == null) {
    missingPatchesByHost[hostId] = createSubscription(() =>
      getHostMissingPatches(host)
    )
  }

  return missingPatchesByHost[hostId](cb)
}
subscribeHostMissingPatches.forceRefresh = host => {
  if (host === undefined) {
    forEach(missingPatchesByHost, subscription => subscription.forceRefresh())
    return
  }

  const subscription = missingPatchesByHost[resolveId(host)]
  if (subscription !== undefined) {
    subscription.forceRefresh()
  }
}

const volumeInfoBySr = {}
export const subscribeVolumeInfo = ({ sr, infoType }, cb) => {
  sr = resolveId(sr)

  if (volumeInfoBySr[sr] == null) {
    volumeInfoBySr[sr] = {}
  }

  if (volumeInfoBySr[sr][infoType] == null) {
    volumeInfoBySr[sr][infoType] = createSubscription(() =>
      _call('xosan.getVolumeInfo', { sr, infoType })
    )
  }

  return volumeInfoBySr[sr][infoType](cb)
}
subscribeVolumeInfo.forceRefresh = (() => {
  const refreshSrVolumeInfo = volumeInfo => {
    forEach(volumeInfo, subscription => subscription.forceRefresh())
  }

  return sr => {
    if (sr === undefined) {
      forEach(volumeInfoBySr, refreshSrVolumeInfo)
    } else {
      refreshSrVolumeInfo(volumeInfoBySr[sr])
    }
  }
})()

const unhealthyVdiChainsLengthSubscriptionsBySr = {}
export const createSrUnhealthyVdiChainsLengthSubscription = sr => {
  sr = resolveId(sr)
  let subscription = unhealthyVdiChainsLengthSubscriptionsBySr[sr]
  if (subscription === undefined) {
    subscription = createSubscription(() =>
      _call('sr.getUnhealthyVdiChainsLength', { sr })
    )
    unhealthyVdiChainsLengthSubscriptionsBySr[sr] = subscription
  }
  return subscription
}

// System ============================================================

export const apiMethods = _call('system.getMethodsInfo')

export const serverVersion = _call('system.getServerVersion')

export const getXoServerTimezone = _call('system.getServerTimezone')

// XO --------------------------------------------------------------------------

export const importConfig = config =>
  _call('xo.importConfig').then(({ $sendTo }) =>
    post($sendTo, config).then(response => {
      if (response.status !== 200) {
        throw new Error('config import failed')
      }
    })
  )

export const exportConfig = () =>
  _call('xo.exportConfig').then(({ $getFrom: url }) => {
    window.location = `.${url}`
  })

// Server ------------------------------------------------------------

export const addServer = (host, username, password, label, allowUnauthorized) =>
  _call('server.add', {
    allowUnauthorized,
    host,
    label,
    password,
    username,
  })::tap(subscribeServers.forceRefresh, () =>
    error(_('serverError'), _('serverAddFailed'))
  )

export const editServer = (server, props) =>
  _call('server.set', { ...props, id: resolveId(server) })::tap(
    subscribeServers.forceRefresh
  )

export const enableServer = server =>
  _call('server.enable', { id: resolveId(server) })::pFinally(
    subscribeServers.forceRefresh
  )

export const disableServer = server =>
  _call('server.disable', { id: resolveId(server) })::tap(
    subscribeServers.forceRefresh
  )

export const removeServer = server =>
  _call('server.remove', { id: resolveId(server) })::tap(
    subscribeServers.forceRefresh
  )

// Pool --------------------------------------------------------------

export const editPool = (pool, props) =>
  _call('pool.set', { id: resolveId(pool), ...props })

export const getPatchesDifference = (source, target) =>
  _call('pool.getPatchesDifference', {
    source: resolveId(source),
    target: resolveId(target),
  })

export const addHostToPool = (pool, host) => {
  if (host) {
    return confirm({
      icon: 'add',
      title: _('addHostModalTitle'),
      body: _('addHostModalMessage', {
        pool: pool.name_label,
        host: host.name_label,
      }),
    }).then(() =>
      _call('pool.mergeInto', {
        source: host.$pool,
        target: pool.id,
        force: true,
      })
    )
  }
}

import AddHostsModalBody from './add-hosts-modal' // eslint-disable-line import/first
export const addHostsToPool = pool =>
  confirm({
    icon: 'add',
    title: _('addHostsLabel'),
    body: <AddHostsModalBody pool={pool} />,
  }).then(params => {
    const { hosts } = params
    if (isEmpty(hosts)) {
      error(_('addHostNoHost'), _('addHostNoHostMessage'))
      return
    }

    return _call('pool.mergeInto', {
      sources: map(hosts, '$pool'),
      target: pool.id,
      force: true,
    }).catch(error => {
      if (error.code !== 'HOSTS_NOT_HOMOGENEOUS') {
        throw error
      }

      error(
        _('addHostsErrorTitle', { nHosts: hosts.length }),
        _('addHostNotHomogeneousErrorMessage')
      )
    })
  })

export const detachHost = host =>
  confirm({
    icon: 'host-eject',
    title: _('detachHostModalTitle'),
    body: _('detachHostModalMessage', {
      host: <strong>{host.name_label}</strong>,
    }),
  }).then(() => _call('host.detach', { host: host.id }))

export const forgetHost = host =>
  confirm({
    icon: 'host-forget',
    title: _('forgetHostModalTitle'),
    body: _('forgetHostModalMessage', {
      host: <strong>{host.name_label}</strong>,
    }),
  }).then(() => _call('host.forget', { host: resolveId(host) }))

export const setDefaultSr = sr =>
  _call('pool.setDefaultSr', { sr: resolveId(sr) })

export const setPoolMaster = host =>
  confirm({
    title: _('setPoolMasterModalTitle'),
    body: _('setPoolMasterModalMessage', {
      host: <strong>{host.name_label}</strong>,
    }),
  }).then(() => _call('pool.setPoolMaster', { host: resolveId(host) }), noop)

// Host --------------------------------------------------------------

export const editHost = (host, props) =>
  _call('host.set', { ...props, id: resolveId(host) })

import MultipathingModalBody from './multipathing-modal' // eslint-disable-line import/first
export const setHostsMultipathing = ({
  host,
  hosts = [host],
  multipathing,
}) => {
  const ids = resolveIds(hosts)
  return confirm({
    title: _(multipathing ? 'enableMultipathing' : 'disableMultipathing'),
    body: <MultipathingModalBody hostIds={ids} />,
  }).then(
    () => Promise.all(map(ids, id => editHost(id, { multipathing }))),
    noop
  )
}

export const fetchHostStats = (host, granularity) =>
  _call('host.stats', { host: resolveId(host), granularity })

export const setRemoteSyslogHost = (host, syslogDestination) =>
  _call('host.setRemoteSyslogHost', {
    id: resolveId(host),
    syslogDestination,
  })

export const setRemoteSyslogHosts = (hosts, syslogDestination) =>
  Promise.all(map(hosts, host => setRemoteSyslogHost(host, syslogDestination)))

export const restartHost = (host, force = false) =>
  confirm({
    title: _('restartHostModalTitle'),
    body: _('restartHostModalMessage'),
  }).then(
    () =>
      _call('host.restart', { id: resolveId(host), force }).catch(error => {
        if (noHostsAvailable.is(error)) {
          alert(
            _('noHostsAvailableErrorTitle'),
            _('noHostsAvailableErrorMessage')
          )
        }
      }),
    noop
  )

export const restartHosts = (hosts, force = false) => {
  const nHosts = size(hosts)
  return confirm({
    title: _('restartHostsModalTitle', { nHosts }),
    body: _('restartHostsModalMessage', { nHosts }),
  }).then(
    () =>
      Promise.all(
        map(hosts, host =>
          _call('host.restart', { id: resolveId(host), force })::reflect()
        )
      ).then(results => {
        const nbErrors = filter(results, result => !result.isFulfilled()).length
        if (nbErrors) {
          return alert(
            _('failHostBulkRestartTitle'),
            _('failHostBulkRestartMessage', {
              failedHosts: nbErrors,
              totalHosts: results.length,
            })
          )
        }
      }),
    noop
  )
}

export const restartHostAgent = host =>
  _call('host.restart_agent', { id: resolveId(host) })

export const restartHostsAgents = hosts => {
  const nHosts = size(hosts)
  return confirm({
    title: _('restartHostsAgentsModalTitle', { nHosts }),
    body: _('restartHostsAgentsModalMessage', { nHosts }),
  }).then(() => Promise.all(map(hosts, restartHostAgent)), noop)
}

export const startHost = host => _call('host.start', { id: resolveId(host) })

export const stopHost = host =>
  confirm({
    title: _('stopHostModalTitle'),
    body: _('stopHostModalMessage'),
  }).then(() => _call('host.stop', { id: resolveId(host) }), noop)

export const stopHosts = hosts => {
  const nHosts = size(hosts)
  return confirm({
    title: _('stopHostsModalTitle', { nHosts }),
    body: _('stopHostsModalMessage', { nHosts }),
  }).then(
    () =>
      Promise.all(
        map(hosts, host => _call('host.stop', { id: resolveId(host) }))
      ),
    noop
  )
}

export const enableHost = host => _call('host.enable', { id: resolveId(host) })

export const disableHost = host =>
  _call('host.disable', { id: resolveId(host) })

export const getHostMissingPatches = async host => {
  const hostId = resolveId(host)
  try {
    const patches = await _call('pool.listMissingPatches', { host: hostId })
    // Hide paid patches to XS-free users
    if (
      host.productBrand !== 'XCP-ng' &&
      host.license_params.sku_type !== 'free'
    ) {
      return filter(patches, { paid: false })
    }
    return patches
  } catch (_) {
    return null
  }
}

export const emergencyShutdownHost = host =>
  confirm({
    title: _('emergencyShutdownHostModalTitle'),
    body: _('emergencyShutdownHostModalMessage', {
      host: <strong>{host.name_label}</strong>,
    }),
  }).then(() => _call('host.emergencyShutdownHost', { host: resolveId(host) }))

export const emergencyShutdownHosts = hosts => {
  const nHosts = size(hosts)
  return confirm({
    title: _('emergencyShutdownHostsModalTitle', { nHosts }),
    body: _('emergencyShutdownHostsModalMessage', { nHosts }),
  }).then(
    () => Promise.all(map(hosts, host => emergencyShutdownHost(host))),
    noop
  )
}

export const isHostTimeConsistentWithXoaTime = host =>
  _call('host.isHostServerTimeConsistent', { host: resolveId(host) })

export const isHyperThreadingEnabledHost = host =>
  _call('host.isHyperThreadingEnabled', {
    id: resolveId(host),
  })

// for XCP-ng now
export const installAllPatchesOnHost = ({ host }) =>
  confirm({
    body: _('installAllPatchesOnHostContent'),
    title: _('installAllPatchesTitle'),
  }).then(() =>
    _call('pool.installPatches', { hosts: [resolveId(host)] })::tap(() =>
      subscribeHostMissingPatches.forceRefresh(host)
    )
  )

export const installPatches = (patches, pool) =>
  confirm({
    body: _('installPatchesContent', { nPatches: patches.length }),
    title: _('installPatchesTitle', { nPatches: patches.length }),
  }).then(() =>
    _call('pool.installPatches', {
      pool: resolveId(pool),
      patches: resolveIds(patches),
    })::tap(() => subscribeHostMissingPatches.forceRefresh())
  )

import InstallPoolPatchesModalBody from './install-pool-patches-modal' // eslint-disable-line import/first
export const installAllPatchesOnPool = ({ pool }) => {
  const poolId = resolveId(pool)
  return confirm({
    body: <InstallPoolPatchesModalBody pool={poolId} />,
    title: _('installPoolPatches'),
    icon: 'host-patch-update',
  }).then(
    () =>
      _call('pool.installPatches', { pool: poolId })::tap(() =>
        subscribeHostMissingPatches.forceRefresh()
      ),
    noop
  )
}

export const installSupplementalPack = (host, file) => {
  info(
    _('supplementalPackInstallStartedTitle'),
    _('supplementalPackInstallStartedMessage')
  )

  return _call('host.installSupplementalPack', { host: resolveId(host) }).then(
    ({ $sendTo }) =>
      post($sendTo, file)
        .then(res => {
          if (res.status !== 200) {
            throw new Error('installing supplemental pack failed')
          }

          success(
            _('supplementalPackInstallSuccessTitle'),
            _('supplementalPackInstallSuccessMessage')
          )
        })
        .catch(err => {
          error(
            _('supplementalPackInstallErrorTitle'),
            _('supplementalPackInstallErrorMessage')
          )
          throw err
        })
  )
}

export const installSupplementalPackOnAllHosts = (pool, file) => {
  info(
    _('supplementalPackInstallStartedTitle'),
    _('supplementalPackInstallStartedMessage')
  )

  return _call('pool.installSupplementalPack', { pool: resolveId(pool) }).then(
    ({ $sendTo }) =>
      post($sendTo, file)
        .then(res => {
          if (res.status !== 200) {
            throw new Error('installing supplemental pack failed')
          }

          success(
            _('supplementalPackInstallSuccessTitle'),
            _('supplementalPackInstallSuccessMessage')
          )
        })
        .catch(err => {
          error(
            _('supplementalPackInstallErrorTitle'),
            _('supplementalPackInstallErrorMessage')
          )
          throw err
        })
  )
}

// Containers --------------------------------------------------------

export const pauseContainer = (vm, container) =>
  _call('docker.pause', { vm: resolveId(vm), container })

export const restartContainer = (vm, container) =>
  _call('docker.restart', { vm: resolveId(vm), container })

export const startContainer = (vm, container) =>
  _call('docker.start', { vm: resolveId(vm), container })

export const stopContainer = (vm, container) =>
  _call('docker.stop', { vm: resolveId(vm), container })

export const unpauseContainer = (vm, container) =>
  _call('docker.unpause', { vm: resolveId(vm), container })

// VM ----------------------------------------------------------------

const chooseActionToUnblockForbiddenStartVm = props =>
  chooseAction({
    icon: 'alarm',
    buttons: [
      { label: _('cloneAndStartVM'), value: 'clone', btnStyle: 'success' },
      { label: _('forceStartVm'), value: 'force', btnStyle: 'danger' },
    ],
    ...props,
  })

const cloneAndStartVm = async (vm, host) =>
  _call('vm.start', { id: await cloneVm(vm), host: resolveId(host) })

export const startVm = async (vm, host) => {
  if (host === true) {
    host = await confirm({
      icon: 'vm-start',
      title: _('startVmOnLabel'),
      body: <SelectHost predicate={({ $pool }) => $pool === vm.$pool} />,
    })
    if (host === undefined) {
      error(_('startVmOnMissingHostTitle'), _('startVmOnMissingHostMessage'))
      return
    }
  }

  const id = resolveId(vm)
  const hostId = resolveId(host)
  return _call('vm.start', {
    id,
    host: hostId,
  }).catch(async reason => {
    if (!forbiddenOperation.is(reason)) {
      throw reason
    }

    const choice = await chooseActionToUnblockForbiddenStartVm({
      body: _('blockedStartVmModalMessage'),
      title: _('forceStartVmModalTitle'),
    })

    if (choice === 'clone') {
      return cloneAndStartVm(vm, host)
    }

    return _call('vm.start', {
      id,
      force: true,
      host: hostId,
    })
  })
}

export const startVms = vms =>
  confirm({
    title: _('startVmsModalTitle', { vms: vms.length }),
    body: _('startVmsModalMessage', { vms: vms.length }),
  }).then(async () => {
    const forbiddenStart = []
    let nErrors = 0

    await Promise.all(
      map(vms, id =>
        _call('vm.start', { id }).catch(reason => {
          if (forbiddenOperation.is(reason)) {
            forbiddenStart.push(id)
          } else {
            nErrors++
          }
        })
      )
    )

    if (forbiddenStart.length === 0) {
      if (nErrors === 0) {
        return
      }

      return error(
        _('failedVmsErrorTitle'),
        _('failedVmsErrorMessage', { nVms: nErrors })
      )
    }

    const choice = await chooseActionToUnblockForbiddenStartVm({
      body: _('blockedStartVmsModalMessage', { nVms: forbiddenStart.length }),
      title: _('forceStartVmModalTitle'),
    }).catch(noop)

    if (nErrors !== 0) {
      error(
        _('failedVmsErrorTitle'),
        _('failedVmsErrorMessage', { nVms: nErrors })
      )
    }

    if (choice === 'clone') {
      return Promise.all(
        map(forbiddenStart, async id =>
          cloneAndStartVm(getObject(store.getState(), id))
        )
      )
    }

    if (choice === 'force') {
      return Promise.all(
        map(forbiddenStart, id => _call('vm.start', { id, force: true }))
      )
    }
  }, noop)

export const stopVm = (vm, force = false) =>
  confirm({
    title: _('stopVmModalTitle'),
    body: _('stopVmModalMessage', { name: vm.name_label }),
  }).then(() => _call('vm.stop', { id: resolveId(vm), force }), noop)

export const stopVms = (vms, force = false) =>
  confirm({
    title: _('stopVmsModalTitle', { vms: vms.length }),
    body: _('stopVmsModalMessage', { vms: vms.length }),
  }).then(
    () =>
      Promise.all(
        map(vms, vm => _call('vm.stop', { id: resolveId(vm), force }))
      ),
    noop
  )

export const suspendVm = vm => _call('vm.suspend', { id: resolveId(vm) })

export const suspendVms = vms =>
  confirm({
    title: _('suspendVmsModalTitle', { vms: vms.length }),
    body: _('suspendVmsModalMessage', { vms: vms.length }),
  }).then(
    () =>
      Promise.all(map(vms, vm => _call('vm.suspend', { id: resolveId(vm) }))),
    noop
  )

export const pauseVm = vm => _call('vm.pause', { id: resolveId(vm) })

export const pauseVms = vms =>
  confirm({
    title: _('pauseVmsModalTitle', { vms: vms.length }),
    body: _('pauseVmsModalMessage', { vms: vms.length }),
  }).then(() => Promise.all(map(vms, pauseVm)), noop)

export const recoveryStartVm = vm =>
  _call('vm.recoveryStart', { id: resolveId(vm) })

export const restartVm = (vm, force = false) =>
  confirm({
    title: _('restartVmModalTitle'),
    body: _('restartVmModalMessage', { name: vm.name_label }),
  }).then(() => _call('vm.restart', { id: resolveId(vm), force }), noop)

export const restartVms = (vms, force = false) =>
  confirm({
    title: _('restartVmsModalTitle', { vms: vms.length }),
    body: _('restartVmsModalMessage', { vms: vms.length }),
  }).then(
    () =>
      Promise.all(
        map(vms, vmId => _call('vm.restart', { id: resolveId(vmId), force }))
      ),
    noop
  )

export const cloneVm = ({ id, name_label: nameLabel }, fullCopy = false) =>
  _call('vm.clone', {
    id,
    name: `${nameLabel}_clone`,
    full_copy: fullCopy,
  })::tap(subscribeResourceSets.forceRefresh)

const _copyVm = ({ vm, sr, name, compress }) =>
  _call('vm.copy', {
    vm: resolveId(vm),
    sr,
    name: name || vm.name_label + '_COPY',
    compress,
  })

import CopyVmModalBody from './copy-vm-modal' // eslint-disable-line import/first
export const copyVm = vm =>
  confirm({
    title: _('copyVm'),
    body: <CopyVmModalBody vm={vm} />,
  }).then(params => {
    if (params.copyMode === 'fullCopy') {
      if (!params.sr) {
        error(_('copyVmsNoTargetSr'), _('copyVmsNoTargetSrMessage'))
        return
      }
      return _copyVm({ vm, ...params })
    }
    return cloneVm({ id: vm.id, name_label: params.name })
  }, noop)

import CopyVmsModalBody from './copy-vms-modal' // eslint-disable-line import/first
export const copyVms = vms => {
  const _vms = resolveIds(vms)
  return confirm({
    title: _('copyVm'),
    body: <CopyVmsModalBody vms={_vms} />,
  }).then(({ compress, names, sr }) => {
    if (sr !== undefined) {
      return Promise.all(
        map(_vms, (vm, index) =>
          _call('vm.copy', { vm, sr, compress, name: names[index] })
        )
      )
    }
    error(_('copyVmsNoTargetSr'), _('copyVmsNoTargetSrMessage'))
  }, noop)
}

export const convertVmToTemplate = vm =>
  confirm({
    title: 'Convert to template',
    body: (
      <div>
        <p>Are you sure you want to convert this VM into a template?</p>
        <p>This operation is definitive.</p>
      </div>
    ),
  }).then(() => _call('vm.convert', { id: resolveId(vm) }), noop)

export const changeVirtualizationMode = vm =>
  confirm({
    title: _('vmVirtualizationModeModalTitle'),
    body: _('vmVirtualizationModeModalBody'),
  }).then(() =>
    editVm(vm, {
      virtualizationMode: vm.virtualizationMode === 'hvm' ? 'pv' : 'hvm',
    })
  )

export const deleteTemplates = templates =>
  confirm({
    title: _('templateDeleteModalTitle', { templates: templates.length }),
    body: _('templateDeleteModalBody', { templates: templates.length }),
  }).then(async () => {
    const defaultTemplates = []
    let nErrors = 0
    await Promise.all(
      map(resolveIds(templates), id =>
        _call('vm.delete', { id }).catch(reason => {
          if (vmIsTemplate.is(reason)) {
            defaultTemplates.push(id)
          } else {
            nErrors++
          }
        })
      )
    )

    const nDefaultTemplates = defaultTemplates.length
    if (nDefaultTemplates === 0 && nErrors === 0) {
      return
    }

    const showError = () =>
      error(
        _('failedToDeleteTemplatesTitle', { nTemplates: nErrors }),
        _('failedToDeleteTemplatesMessage', { nTemplates: nErrors })
      )

    return nDefaultTemplates === 0
      ? showError()
      : confirm({
          title: _('deleteDefaultTemplatesTitle', { nDefaultTemplates }),
          body: _('deleteDefaultTemplatesMessage', { nDefaultTemplates }),
        })
          .then(
            () =>
              Promise.all(
                map(defaultTemplates, id =>
                  _call('vm.delete', {
                    id,
                    forceDeleteDefaultTemplate: true,
                  }).catch(() => {
                    nErrors++
                  })
                )
              ),
            noop
          )
          .then(() => {
            if (nErrors !== 0) {
              showError()
            }
          }, noop)
  }, noop)

export const snapshotVm = (vm, name, saveMemory, description) =>
  _call('vm.snapshot', { id: resolveId(vm), name, description, saveMemory })

import SnapshotVmModalBody from './snapshot-vm-modal' // eslint-disable-line import/first
export const snapshotVms = vms =>
  confirm({
    icon: 'memory',
    title: _('snapshotVmsModalTitle', { vms: vms.length }),
    body: <SnapshotVmModalBody vms={vms} />,
  }).then(
    ({ names, saveMemory, descriptions }) =>
      Promise.all(
        map(vms, vm => snapshotVm(vm, names[vm], saveMemory, descriptions[vm]))
      ),
    noop
  )

export const deleteSnapshot = vm =>
  confirm({
    title: _('deleteSnapshotModalTitle'),
    body: _('deleteSnapshotModalMessage'),
  }).then(() => _call('vm.delete', { id: resolveId(vm) }), noop)

export const deleteSnapshots = vms =>
  confirm({
    title: _('deleteSnapshotsModalTitle', { nVms: vms.length }),
    body: _('deleteSnapshotsModalMessage', { nVms: vms.length }),
  }).then(
    () =>
      Promise.all(map(vms, vm => _call('vm.delete', { id: resolveId(vm) }))),
    noop
  )

import MigrateVmModalBody from './migrate-vm-modal' // eslint-disable-line import/first
export const migrateVm = (vm, host) =>
  confirm({
    title: _('migrateVmModalTitle'),
    body: <MigrateVmModalBody vm={vm} host={host} />,
  }).then(params => {
    if (!params.targetHost) {
      return error(
        _('migrateVmNoTargetHost'),
        _('migrateVmNoTargetHostMessage')
      )
    }
    return _call('vm.migrate', { vm: vm.id, ...params })
  }, noop)

import MigrateVmsModalBody from './migrate-vms-modal' // eslint-disable-line import/first
export const migrateVms = vms =>
  confirm({
    title: _('migrateVmModalTitle'),
    body: <MigrateVmsModalBody vms={resolveIds(vms)} />,
  }).then(params => {
    if (isEmpty(params.vms)) {
      return
    }
    if (!params.targetHost) {
      return error(
        _('migrateVmNoTargetHost'),
        _('migrateVmNoTargetHostMessage')
      )
    }

    const {
      mapVmsMapVdisSrs,
      mapVmsMapVifsNetworks,
      mapVmsMigrationNetwork,
      targetHost,
      vms,
    } = params
    Promise.all(
      map(vms, ({ id }) =>
        _call('vm.migrate', {
          mapVdisSrs: mapVmsMapVdisSrs[id],
          mapVifsNetworks: mapVmsMapVifsNetworks[id],
          migrationNetwork: mapVmsMigrationNetwork[id],
          targetHost,
          vm: id,
        })
      )
    )
  }, noop)

export const createVm = args => _call('vm.create', args)

export const createVms = (args, nameLabels, cloudConfigs) =>
  confirm({
    title: _('newVmCreateVms'),
    body: _('newVmCreateVmsConfirm', { nbVms: nameLabels.length }),
  }).then(() =>
    Promise.all(
      map(nameLabels, (
        name_label, // eslint-disable-line camelcase
        i
      ) =>
        _call('vm.create', {
          ...args,
          name_label,
          cloudConfig: get(cloudConfigs, i),
        })
      )
    )
  )

export const getCloudInitConfig = template =>
  _call('vm.getCloudInitConfig', { template })

export const deleteVm = (vm, retryWithForce = true) =>
  confirm({
    title: _('deleteVmModalTitle'),
    body: _('deleteVmModalMessage'),
  })
    .then(() => _call('vm.delete', { id: resolveId(vm) }), noop)
    .catch(error => {
      if (retryWithForce && forbiddenOperation.is(error)) {
        return confirm({
          title: _('deleteVmBlockedModalTitle'),
          body: _('deleteVmBlockedModalMessage'),
        }).then(
          () => _call('vm.delete', { id: resolveId(vm), force: true }),
          noop
        )
      }

      throw error
    })

export const deleteVms = vms =>
  confirm({
    title: _('deleteVmsModalTitle', { vms: vms.length }),
    body: _('deleteVmsModalMessage', { vms: vms.length }),
    strongConfirm: vms.length > 1 && {
      messageId: 'deleteVmsConfirmText',
      values: { nVms: vms.length },
    },
  }).then(
    () =>
      Promise.all(
        map(vms, vmId => _call('vm.delete', { id: resolveId(vmId) }))
      ),
    noop
  )

export const importBackup = ({ remote, file, sr }) =>
  _call('vm.importBackup', resolveIds({ remote, file, sr }))

export const importDeltaBackup = ({ remote, file, sr, mapVdisSrs }) =>
  _call(
    'vm.importDeltaBackup',
    resolveIds({
      remote,
      filePath: file,
      sr,
      mapVdisSrs: resolveIds(mapVdisSrs),
    })
  )

import RevertSnapshotModalBody from './revert-snapshot-modal' // eslint-disable-line import/first
export const revertSnapshot = snapshot =>
  confirm({
    title: _('revertVmModalTitle'),
    body: <RevertSnapshotModalBody />,
  }).then(
    snapshotBefore =>
      _call('vm.revert', {
        snapshotBefore,
        snapshot: resolveId(snapshot),
      }).then(() =>
        success(_('vmRevertSuccessfulTitle'), _('vmRevertSuccessfulMessage'))
      ),
    noop
  )

export const editVm = (vm, props) =>
  _call('vm.set', { ...props, id: resolveId(vm) }).catch(err => {
    error(
      _('setVmFailed', { vm: renderXoItemFromId(resolveId(vm)) }),
      err.message
    )
  })

export const fetchVmStats = (vm, granularity) =>
  _call('vm.stats', { id: resolveId(vm), granularity })

export const getVmsHaValues = () => _call('vm.getHaValues')

export const importVm = async (file, type = 'xva', data = undefined, sr) => {
  const { name } = file

  info(_('startVmImport'), name)
  if (data !== undefined && data.tables !== undefined) {
    for (const k in data.tables) {
      data.tables[k] = await data.tables[k]
    }
  }
  return _call('vm.import', { type, data, sr: resolveId(sr) }).then(
    ({ $sendTo }) =>
      post($sendTo, file)
        .then(res => {
          if (res.status !== 200) {
            throw res.status
          }
          success(_('vmImportSuccess'), name)
          return res.json().then(body => body.result)
        })
        .catch(err => {
          error(_('vmImportFailed'), name)
          throw err
        })
  )
}

import ImportVdiModalBody from './import-vdi-modal' // eslint-disable-line import/first
export const importVdi = async vdi => {
  const file = await confirm({
    body: <ImportVdiModalBody />,
    icon: 'import',
    title: _('importVdi'),
  })

  if (file === undefined) {
    error(_('importVdi'), _('importVdiNoFile'))
    return
  }

  const { name } = file
  info(_('startVdiImport'), name)

  return _call('disk.importContent', { id: resolveId(vdi) }).then(
    ({ $sendTo }) =>
      post($sendTo, file)
        .then(res => {
          if (res.status !== 200) {
            throw res.status
          }
          success(_('vdiImportSuccess'), name)
          return res.json().then(body => body.result)
        })
        .catch(err => {
          error(_('vdiImportFailed'), err)
        })
  )
}

export const importVms = (vms, sr) =>
  Promise.all(
    map(vms, ({ file, type, data }) =>
      importVm(file, type, data, sr).catch(error => {
        console.warn('importVms', file.name, error)
      })
    )
  ).then(ids => ids.filter(_ => _ !== undefined))

import ExportVmModalBody from './export-vm-modal' // eslint-disable-line import/first
export const exportVm = vm =>
  confirm({
    body: <ExportVmModalBody vm={vm} />,
    icon: 'export',
    title: _('exportVmLabel'),
  }).then(compress => {
    const id = resolveId(vm)
    info(_('startVmExport'), id)
    return _call('vm.export', { vm: id, compress }).then(
      ({ $getFrom: url }) => {
        window.location = `.${url}`
      }
    )
  })

export const exportVdi = vdi => {
  info(_('startVdiExport'), vdi.id)
  return _call('disk.exportContent', { id: resolveId(vdi) }).then(
    ({ $getFrom: url }) => {
      window.location = `.${url}`
    }
  )
}

export const insertCd = (vm, cd, force = false) =>
  _call('vm.insertCd', {
    id: resolveId(vm),
    cd_id: resolveId(cd),
    force,
  })

export const ejectCd = vm => _call('vm.ejectCd', { id: resolveId(vm) })

export const setVmBootOrder = (vm, order) =>
  _call('vm.setBootOrder', {
    vm: resolveId(vm),
    order,
  })

export const attachDiskToVm = (vdi, vm, { bootable, mode, position }) =>
  _call('vm.attachDisk', {
    bootable,
    mode,
    position: (position && String(position)) || undefined,
    vdi: resolveId(vdi),
    vm: resolveId(vm),
  })

export const createVgpu = (vm, { gpuGroup, vgpuType }) =>
  _call('vm.createVgpu', resolveIds({ vm, gpuGroup, vgpuType }))

export const deleteVgpu = vgpu => _call('vm.deleteVgpu', resolveIds({ vgpu }))

export const shareVm = async (vm, resourceSet) =>
  confirm({
    title: _('shareVmInResourceSetModalTitle'),
    body: _('shareVmInResourceSetModalMessage', {
      self: renderXoItem({
        ...(await getResourceSet(resourceSet)),
        type: 'resourceSet',
      }),
    }),
  }).then(() => editVm(vm, { share: true }), noop)

// DISK ---------------------------------------------------------------

export const createDisk = (name, size, sr, { vm, bootable, mode, position }) =>
  _call('disk.create', {
    bootable,
    mode,
    name,
    position,
    size,
    sr: resolveId(sr),
    vm: resolveId(vm),
  })

// VDI ---------------------------------------------------------------

export const editVdi = (vdi, props) =>
  _call('vdi.set', { ...props, id: resolveId(vdi) })

export const deleteVdi = vdi =>
  confirm({
    title: _('deleteVdiModalTitle'),
    body: _('deleteVdiModalMessage'),
  }).then(() => _call('vdi.delete', { id: resolveId(vdi) }), noop)

export const deleteVdis = vdis =>
  confirm({
    title: _('deleteVdisModalTitle', { nVdis: vdis.length }),
    body: _('deleteVdisModalMessage', { nVdis: vdis.length }),
  }).then(
    () =>
      Promise.all(
        map(vdis, vdi => _call('vdi.delete', { id: resolveId(vdi) }))
      ),
    noop
  )

export const deleteOrphanedVdis = vdis =>
  confirm({
    title: _('deleteOrphanedVdisModalTitle'),
    body: (
      <div>
        <p>{_('deleteOrphanedVdisModalMessage', { nVdis: vdis.length })}</p>
        <p>{_('definitiveMessageModal')}</p>
      </div>
    ),
  }).then(
    () => Promise.all(map(resolveIds(vdis), id => _call('vdi.delete', { id }))),
    noop
  )

export const migrateVdi = (vdi, sr) =>
  _call('vdi.migrate', { id: resolveId(vdi), sr_id: resolveId(sr) })

// VBD ---------------------------------------------------------------

export const connectVbd = vbd => _call('vbd.connect', { id: resolveId(vbd) })

export const disconnectVbd = vbd =>
  _call('vbd.disconnect', { id: resolveId(vbd) })

export const disconnectVbds = vbds =>
  confirm({
    title: _('disconnectVbdsModalTitle', { nVbds: vbds.length }),
    body: _('disconnectVbdsModalMessage', { nVbds: vbds.length }),
  }).then(
    () =>
      Promise.all(
        map(vbds, vbd => _call('vbd.disconnect', { id: resolveId(vbd) }))
      ),
    noop
  )

export const deleteVbd = vbd => _call('vbd.delete', { id: resolveId(vbd) })

export const deleteVbds = vbds =>
  confirm({
    title: _('deleteVbdsModalTitle', { nVbds: vbds.length }),
    body: _('deleteVbdsModalMessage', { nVbds: vbds.length }),
  }).then(
    () =>
      Promise.all(
        map(vbds, vbd => _call('vbd.delete', { id: resolveId(vbd) }))
      ),
    noop
  )

export const editVbd = (vbd, props) =>
  _call('vbd.set', { ...props, id: resolveId(vbd) })

export const setBootableVbd = (vbd, bootable) =>
  _call('vbd.setBootable', { vbd: resolveId(vbd), bootable })

// VIF ---------------------------------------------------------------

export const createVmInterface = (vm, network, mac) =>
  _call('vm.createInterface', resolveIds({ vm, network, mac }))

export const connectVif = vif => _call('vif.connect', { id: resolveId(vif) })

export const disconnectVif = vif =>
  _call('vif.disconnect', { id: resolveId(vif) })

export const deleteVif = vif => _call('vif.delete', { id: resolveId(vif) })

export const deleteVifs = vifs =>
  confirm({
    title: _('deleteVifsModalTitle', { nVifs: vifs.length }),
    body: _('deleteVifsModalMessage', { nVifs: vifs.length }),
  }).then(
    () =>
      Promise.all(
        map(vifs, vif => _call('vif.delete', { id: resolveId(vif) }))
      ),
    noop
  )

export const setVif = (
  vif,
  { allowedIpv4Addresses, allowedIpv6Addresses, mac, network, rateLimit }
) =>
  _call('vif.set', {
    allowedIpv4Addresses,
    allowedIpv6Addresses,
    id: resolveId(vif),
    mac,
    network: resolveId(network),
    rateLimit,
  })

// Network -----------------------------------------------------------

export const editNetwork = (network, props) =>
  _call('network.set', { ...props, id: resolveId(network) })

export const getBondModes = () => _call('network.getBondModes')
export const createNetwork = params => _call('network.create', params)
export const createBondedNetwork = params =>
  _call('network.createBonded', params)
export const createPrivateNetwork = params =>
  _call('sdnController.createPrivateNetwork', params)

export const deleteNetwork = network =>
  confirm({
    title: _('deleteNetwork'),
    body: _('deleteNetworkConfirm'),
  }).then(() => _call('network.delete', { network: resolveId(network) }), noop)

// PIF ---------------------------------------------------------------

export const connectPif = pif =>
  confirm({
    title: _('connectPif'),
    body: _('connectPifConfirm'),
  }).then(() => _call('pif.connect', { pif: resolveId(pif) }), noop)

export const disconnectPif = pif =>
  confirm({
    title: _('disconnectPif'),
    body: _('disconnectPifConfirm'),
  }).then(() => _call('pif.disconnect', { pif: resolveId(pif) }), noop)

export const deletePif = pif =>
  confirm({
    title: _('deletePif'),
    body: _('deletePifConfirm'),
  }).then(() => _call('pif.delete', { pif: resolveId(pif) }), noop)

export const deletePifs = pifs =>
  confirm({
    title: _('deletePifs'),
    body: _('deletePifsConfirm', { nPifs: pifs.length }),
  }).then(
    () =>
      Promise.all(
        map(pifs, pif => _call('pif.delete', { pif: resolveId(pif) }))
      ),
    noop
  )

export const reconfigurePifIp = (pif, { mode, ip, netmask, gateway, dns }) =>
  _call('pif.reconfigureIp', {
    pif: resolveId(pif),
    mode,
    ip,
    netmask,
    gateway,
    dns,
  })

export const getIpv4ConfigModes = () => _call('pif.getIpv4ConfigurationModes')

export const editPif = (pif, { vlan }) =>
  _call('pif.editPif', { pif: resolveId(pif), vlan })

// SR ----------------------------------------------------------------

export const deleteSr = sr =>
  confirm({
    title: 'Delete SR',
    body: (
      <div>
        <p>Are you sure you want to remove this SR?</p>
        <p>This operation is definitive, and ALL DISKS WILL BE LOST FOREVER.</p>
      </div>
    ),
  }).then(() => _call('sr.destroy', { id: resolveId(sr) }), noop)

export const fetchSrStats = (sr, granularity) =>
  _call('sr.stats', { id: resolveId(sr), granularity })

export const forgetSr = sr =>
  confirm({
    title: _('srForgetModalTitle'),
    body: _('srForgetModalMessage'),
  }).then(() => _call('sr.forget', { id: resolveId(sr) }), noop)
export const forgetSrs = srs =>
  confirm({
    title: _('srsForgetModalTitle'),
    body: _('srsForgetModalMessage'),
  }).then(
    () => Promise.all(map(resolveIds(srs), id => _call('sr.forget', { id }))),
    noop
  )

export const reconnectAllHostsSr = sr =>
  confirm({
    title: _('srReconnectAllModalTitle'),
    body: _('srReconnectAllModalMessage'),
  }).then(() => _call('sr.connectAllPbds', { id: resolveId(sr) }), noop)
export const reconnectAllHostsSrs = srs =>
  confirm({
    title: _('srReconnectAllModalTitle'),
    body: _('srReconnectAllModalMessage'),
  }).then(
    () =>
      Promise.all(resolveIds(srs), id => _call('sr.connectAllPbds', { id })),
    noop
  )

export const disconnectAllHostsSr = sr =>
  confirm({
    title: _('srDisconnectAllModalTitle'),
    body: _('srDisconnectAllModalMessage'),
  }).then(() => _call('sr.disconnectAllPbds', { id: resolveId(sr) }), noop)
export const disconnectAllHostsSrs = srs =>
  confirm({
    title: _('srDisconnectAllModalTitle'),
    body: _('srsDisconnectAllModalMessage'),
  }).then(
    () =>
      Promise.all(resolveIds(srs), id => _call('sr.disconnectAllPbds', { id })),
    noop
  )

export const editSr = (sr, { nameDescription, nameLabel }) =>
  _call('sr.set', {
    id: resolveId(sr),
    name_description: nameDescription,
    name_label: nameLabel,
  })

export const rescanSr = sr => _call('sr.scan', { id: resolveId(sr) })
export const rescanSrs = srs =>
  Promise.all(map(resolveIds(srs), id => _call('sr.scan', { id })))

// PBDs --------------------------------------------------------------

export const connectPbd = pbd => _call('pbd.connect', { id: resolveId(pbd) })

export const disconnectPbd = pbd =>
  _call('pbd.disconnect', { id: resolveId(pbd) })

export const deletePbd = pbd => _call('pbd.delete', { id: resolveId(pbd) })

export const deletePbds = pbds => Promise.all(map(pbds, deletePbd))

// Messages ----------------------------------------------------------

export const deleteMessage = message =>
  _call('message.delete', { id: resolveId(message) })

export const deleteMessages = logs =>
  confirm({
    title: _('logDeleteMultiple', { nLogs: logs.length }),
    body: _('logDeleteMultipleMessage', { nLogs: logs.length }),
  }).then(() => Promise.all(map(logs, deleteMessage)), noop)

// Tags --------------------------------------------------------------

export const addTag = (object, tag) =>
  _call('tag.add', { id: resolveId(object), tag })

export const removeTag = (object, tag) =>
  _call('tag.remove', { id: resolveId(object), tag })

// Tasks --------------------------------------------------------------

export const cancelTask = task => _call('task.cancel', { id: resolveId(task) })

export const cancelTasks = tasks =>
  confirm({
    title: _('cancelTasksModalTitle', { nTasks: tasks.length }),
    body: _('cancelTasksModalMessage', { nTasks: tasks.length }),
  }).then(
    () =>
      Promise.all(
        map(tasks, task => _call('task.cancel', { id: resolveId(task) }))
      ),
    noop
  )

export const destroyTask = task =>
  _call('task.destroy', { id: resolveId(task) })

export const destroyTasks = tasks =>
  confirm({
    title: _('destroyTasksModalTitle', { nTasks: tasks.length }),
    body: _('destroyTasksModalMessage', { nTasks: tasks.length }),
  }).then(
    () =>
      Promise.all(
        map(tasks, task => _call('task.destroy', { id: resolveId(task) }))
      ),
    noop
  )

// Jobs -------------------------------------------------------------

export const createJob = job =>
  _call('job.create', { job })::tap(subscribeJobs.forceRefresh)

export const deleteJob = job =>
  _call('job.delete', { id: resolveId(job) })::tap(subscribeJobs.forceRefresh)

export const deleteJobs = jobs =>
  confirm({
    title: _('deleteJobsModalTitle', { nJobs: jobs.length }),
    body: _('deleteJobsModalMessage', { nJobs: jobs.length }),
  }).then(
    () =>
      Promise.all(
        map(jobs, job => _call('job.delete', { id: resolveId(job) }))
      )::tap(subscribeJobs.forceRefresh),
    noop
  )

export const editJob = job =>
  _call('job.set', { job })::tap(subscribeJobs.forceRefresh)

export const getJob = id => _call('job.get', { id })

export const runJob = job => {
  info(_('runJob'), _('runJobVerbose'))
  return _call('job.runSequence', { idSequence: [resolveId(job)] })
}

export const cancelJob = ({ id, name, runId }) =>
  confirm({
    title: _('cancelJob'),
    body: _('cancelJobConfirm', {
      id: id.slice(0, 5),
      name: <strong>{name}</strong>,
    }),
  }).then(() => _call('job.cancel', { runId }))

// Backup/Schedule ---------------------------------------------------------

export const createSchedule = (
  jobId,
  { cron, enabled, name = undefined, timezone = undefined }
) =>
  _call('schedule.create', { jobId, cron, enabled, name, timezone })::tap(
    subscribeSchedules.forceRefresh
  )

export const deleteBackupSchedule = async schedule => {
  await confirm({
    title: _('deleteBackupSchedule'),
    body: _('deleteBackupScheduleQuestion'),
  })
  await _call('schedule.delete', { id: schedule.id })
  await _call('job.delete', { id: schedule.jobId })

  subscribeSchedules.forceRefresh()
  subscribeJobs.forceRefresh()
}

export const migrateBackupSchedule = id =>
  confirm({
    title: _('migrateBackupSchedule'),
    body: _('migrateBackupScheduleMessage'),
  }).then(() => _call('backupNg.migrateLegacyJob', { id: resolveId(id) }))

export const deleteSchedule = schedule =>
  _call('schedule.delete', { id: resolveId(schedule) })::tap(
    subscribeSchedules.forceRefresh
  )

export const deleteSchedules = schedules =>
  confirm({
    title: _('deleteSchedulesModalTitle', { nSchedules: schedules.length }),
    body: _('deleteSchedulesModalMessage', { nSchedules: schedules.length }),
  }).then(() =>
    Promise.all(
      map(schedules, schedule =>
        _call('schedule.delete', { id: resolveId(schedule) })::tap(
          subscribeSchedules.forceRefresh
        )
      )
    )
  )

export const disableSchedule = id => editSchedule({ id, enabled: false })

export const editSchedule = ({ id, jobId, cron, enabled, name, timezone }) =>
  _call('schedule.set', { id, jobId, cron, enabled, name, timezone })::tap(
    subscribeSchedules.forceRefresh
  )

export const enableSchedule = id => editSchedule({ id, enabled: true })

export const getSchedule = id => _call('schedule.get', { id })

// Backup NG ---------------------------------------------------------

export const subscribeBackupNgJobs = createSubscription(() =>
  _call('backupNg.getAllJobs')
)

export const subscribeBackupNgLogs = createSubscription(async () => {
  const { $getFrom } = await _call('backupNg.getAllLogs', { ndjson: true })
  const response = await fetch(`.${$getFrom}`)
  const data = await response.text()

  const logs = { __proto__: null }
  parseNdJson(data, log => {
    logs[log.id] = log
  })
  return logs
})

export const subscribeMetadataBackupJobs = createSubscription(() =>
  _call('metadataBackup.getAllJobs')
)

export const createBackupNgJob = props =>
  _call('backupNg.createJob', props)::tap(subscribeBackupNgJobs.forceRefresh)

export const deleteBackupJobs = async ({
  backupIds = [],
  metadataBackupIds = [],
}) => {
  const nJobs = backupIds.length + metadataBackupIds.length
  if (nJobs === 0) {
    return
  }
  const vars = { nJobs }
  try {
    await confirm({
      title: _('confirmDeleteBackupJobsTitle', vars),
      body: <p>{_('confirmDeleteBackupJobsBody', vars)}</p>,
    })
  } catch (_) {
    return
  }

  const promises = []
  if (backupIds.length !== 0) {
    promises.push(
      Promise.all(
        backupIds.map(id => _call('backupNg.deleteJob', { id: resolveId(id) }))
      )::tap(subscribeBackupNgJobs.forceRefresh)
    )
  }
  if (metadataBackupIds.length !== 0) {
    promises.push(
      Promise.all(
        metadataBackupIds.map(id =>
          _call('metadataBackup.deleteJob', { id: resolveId(id) })
        )
      )::tap(subscribeMetadataBackupJobs.forceRefresh)
    )
  }

  return Promise.all(promises)::tap(subscribeSchedules.forceRefresh)
}

export const editBackupNgJob = props =>
  _call('backupNg.editJob', props)::tap(subscribeBackupNgJobs.forceRefresh)

export const getBackupNgJob = id => _call('backupNg.getJob', { id })

export const runBackupNgJob = ({ force, ...params }) => {
  if (force) {
    params.settings = {
      '': {
        bypassVdiChainsCheck: true,
      },
    }
  }
  return _call('backupNg.runJob', params)
}

export const listVmBackups = remotes =>
  _call('backupNg.listVmBackups', { remotes: resolveIds(remotes) })

export const restoreBackup = (backup, sr, startOnRestore) => {
  const promise = _call('backupNg.importVmBackup', {
    id: resolveId(backup),
    sr: resolveId(sr),
  })

  if (startOnRestore) {
    return promise.then(startVm)
  }

  return promise
}

export const deleteBackup = backup =>
  _call('backupNg.deleteVmBackup', { id: resolveId(backup) })

export const deleteBackups = async backups => {
  // delete sequentially from newest to oldest
  backups = backups.slice().sort((b1, b2) => b2.timestamp - b1.timestamp)
  for (let i = 0, n = backups.length; i < n; ++i) {
    await deleteBackup(backups[i])
  }
}

export const createMetadataBackupJob = props =>
  _call('metadataBackup.createJob', props)
    ::tap(subscribeMetadataBackupJobs.forceRefresh)
    ::tap(subscribeSchedules.forceRefresh)

export const editMetadataBackupJob = props =>
  _call('metadataBackup.editJob', props)
    ::tap(subscribeMetadataBackupJobs.forceRefresh)
    ::tap(subscribeSchedules.forceRefresh)

export const runMetadataBackupJob = params =>
  _call('metadataBackup.runJob', params)

export const listMetadataBackups = remotes =>
  _call('metadataBackup.list', { remotes: resolveIds(remotes) })

export const restoreMetadataBackup = backup =>
  _call('metadataBackup.restore', {
    id: resolveId(backup),
  })::tap(subscribeBackupNgLogs.forceRefresh)

export const deleteMetadataBackup = backup =>
  _call('metadataBackup.delete', {
    id: resolveId(backup),
  })

export const deleteMetadataBackups = async (backups = []) => {
  // delete sequentially from newest to oldest
  backups = backups.slice().sort((b1, b2) => b2.timestamp - b1.timestamp)
  for (let i = 0, n = backups.length; i < n; ++i) {
    await deleteMetadataBackup(backups[i])
  }
}

// Plugins -----------------------------------------------------------

export const loadPlugin = async id =>
  _call('plugin.load', { id })::tap(subscribePlugins.forceRefresh, err =>
    error(_('pluginError'), (err && err.message) || _('unknownPluginError'))
  )

export const unloadPlugin = id =>
  _call('plugin.unload', { id })::tap(subscribePlugins.forceRefresh, err =>
    error(_('pluginError'), (err && err.message) || _('unknownPluginError'))
  )

export const enablePluginAutoload = id =>
  _call('plugin.enableAutoload', { id })::tap(subscribePlugins.forceRefresh)

export const disablePluginAutoload = id =>
  _call('plugin.disableAutoload', { id })::tap(subscribePlugins.forceRefresh)

export const configurePlugin = (id, configuration) =>
  _call('plugin.configure', { id, configuration })::tap(
    () => {
      info(_('pluginConfigurationSuccess'), _('pluginConfigurationChanges'))
      subscribePlugins.forceRefresh()
    },
    err =>
      error(
        _('pluginError'),
        JSON.stringify(err.data) || _('unknownPluginError')
      )
  )

export const purgePluginConfiguration = async id => {
  await confirm({
    title: _('purgePluginConfiguration'),
    body: _('purgePluginConfigurationQuestion'),
  })
  await _call('plugin.purgeConfiguration', { id })

  subscribePlugins.forceRefresh()
}

export const testPlugin = (id, data) => _call('plugin.test', { id, data })

export const sendUsageReport = () => _call('plugin.usageReport.send')

// Resource set ------------------------------------------------------

export const createResourceSet = (name, { subjects, objects, limits } = {}) =>
  _call('resourceSet.create', { name, subjects, objects, limits })::tap(
    subscribeResourceSets.forceRefresh
  )

export const editResourceSet = (
  id,
  { name, subjects, objects, limits, ipPools } = {}
) =>
  _call('resourceSet.set', {
    id,
    name,
    subjects,
    objects,
    limits,
    ipPools,
  })::tap(subscribeResourceSets.forceRefresh)

export const deleteResourceSet = async id => {
  await confirm({
    title: _('deleteResourceSetWarning'),
    body: _('deleteResourceSetQuestion'),
  })
  await _call('resourceSet.delete', { id: resolveId(id) })

  subscribeResourceSets.forceRefresh()
}

export const recomputeResourceSetsLimits = () =>
  _call('resourceSet.recomputeAllLimits')

export const getResourceSet = id =>
  _call('resourceSet.get', { id: resolveId(id) })

// Remote ------------------------------------------------------------

export const getRemote = remote =>
  _call('remote.get', resolveIds({ id: remote }))::tap(null, err =>
    error(_('getRemote'), err.message || String(err))
  )

export const createRemote = (name, url, options) =>
  _call('remote.create', { name, url, options })::tap(remote => {
    testRemote(remote).catch(noop)
  })

export const deleteRemote = remote =>
  _call('remote.delete', { id: resolveId(remote) })::tap(
    subscribeRemotes.forceRefresh
  )

export const deleteRemotes = remotes =>
  confirm({
    title: _('deleteRemotesModalTitle', { nRemotes: remotes.length }),
    body: _('deleteRemotesModalMessage', { nRemotes: remotes.length }),
  }).then(
    () =>
      Promise.all(
        map(remotes, remote =>
          _call('remote.delete', { id: resolveId(remote) })
        )
      )::tap(subscribeRemotes.forceRefresh),
    noop
  )

export const enableRemote = remote =>
  _call('remote.set', { id: resolveId(remote), enabled: true })::tap(() =>
    testRemote(remote).catch(noop)
  )

export const disableRemote = remote =>
  _call('remote.set', { id: resolveId(remote), enabled: false })::tap(
    subscribeRemotes.forceRefresh
  )

export const editRemote = (remote, { name, url, options }) =>
  _call('remote.set', resolveIds({ remote, name, url, options }))::tap(() => {
    testRemote(remote).catch(noop)
  })

export const listRemote = remote =>
  _call('remote.list', resolveIds({ id: remote }))::tap(
    subscribeRemotes.forceRefresh,
    err => error(_('listRemote'), err.message || String(err))
  )

export const listRemoteBackups = remote =>
  _call('backup.list', resolveIds({ remote }))::tap(null, err =>
    error(_('listRemote'), err.message || String(err))
  )

export const testRemote = remote =>
  _call('remote.test', resolveIds({ id: remote }))
    ::tap(null, err => error(_('testRemote'), err.message || String(err)))
    ::pFinally(subscribeRemotes.forceRefresh)

// File restore  ----------------------------------------------------

export const scanDisk = (remote, disk) =>
  _call('backup.scanDisk', resolveIds({ remote, disk }))

export const scanFiles = (remote, disk, path, partition) =>
  _call('backup.scanFiles', resolveIds({ remote, disk, path, partition }))

export const fetchFiles = (remote, disk, partition, paths, format) =>
  _call(
    'backup.fetchFiles',
    resolveIds({ remote, disk, partition, paths, format })
  ).then(({ $getFrom: url }) => {
    window.location = `.${url}`
  })

// File restore NG  ----------------------------------------------------

export const listPartitions = (remote, disk) =>
  _call('backupNg.listPartitions', resolveIds({ remote, disk }))

export const listFiles = (remote, disk, path, partition) =>
  _call('backupNg.listFiles', resolveIds({ remote, disk, path, partition }))

export const fetchFilesNg = (remote, disk, partition, paths) =>
  _call(
    'backupNg.fetchFiles',
    resolveIds({ remote, disk, partition, paths })
  ).then(({ $getFrom: url }) => {
    window.location = `.${url}`
  })

// -------------------------------------------------------------------

export const probeSrNfs = (host, server) =>
  _call('sr.probeNfs', { host, server })

export const probeSrNfsExists = (host, server, serverPath) =>
  _call('sr.probeNfsExists', { host, server, serverPath })

export const probeSrIscsiIqns = (
  host,
  target,
  port = undefined,
  chapUser = undefined,
  chapPassword
) => {
  const params = { host, target }
  port && (params.port = port)
  chapUser && (params.chapUser = chapUser)
  chapPassword && (params.chapPassword = chapPassword)
  return _call('sr.probeIscsiIqns', params)
}

export const probeSrIscsiLuns = (
  host,
  target,
  targetIqn,
  chapUser = undefined,
  chapPassword
) => {
  const params = { host, target, targetIqn }
  chapUser && (params.chapUser = chapUser)
  chapPassword && (params.chapPassword = chapPassword)
  return _call('sr.probeIscsiLuns', params)
}

export const probeSrIscsiExists = (
  host,
  target,
  targetIqn,
  scsiId,
  port = undefined,
  chapUser = undefined,
  chapPassword
) => {
  const params = { host, target, targetIqn, scsiId }
  port && (params.port = port)
  chapUser && (params.chapUser = chapUser)
  chapPassword && (params.chapPassword = chapPassword)
  return _call('sr.probeIscsiExists', params)
}

export const probeSrHba = host => _call('sr.probeHba', { host })

export const probeSrHbaExists = (host, scsiId) =>
  _call('sr.probeHbaExists', { host, scsiId })

export const probeZfs = host => _call('sr.probeZfs', { host: resolveId(host) })

export const reattachSr = (host, uuid, nameLabel, nameDescription, type) =>
  _call('sr.reattach', { host, uuid, nameLabel, nameDescription, type })

export const reattachSrIso = (host, uuid, nameLabel, nameDescription, type) =>
  _call('sr.reattachIso', { host, uuid, nameLabel, nameDescription, type })

export const createSrNfs = (
  host,
  nameLabel,
  nameDescription,
  server,
  serverPath,
  nfsVersion = undefined,
  nfsOptions
) => {
  const params = { host, nameLabel, nameDescription, server, serverPath }
  nfsVersion && (params.nfsVersion = nfsVersion)
  nfsOptions && (params.nfsOptions = nfsOptions)
  return _call('sr.createNfs', params)
}

export const createSrIscsi = (
  host,
  nameLabel,
  nameDescription,
  target,
  targetIqn,
  scsiId,
  port = undefined,
  chapUser = undefined,
  chapPassword = undefined
) => {
  const params = { host, nameLabel, nameDescription, target, targetIqn, scsiId }
  port && (params.port = port)
  chapUser && (params.chapUser = chapUser)
  chapPassword && (params.chapPassword = chapPassword)
  return _call('sr.createIscsi', params)
}

export const createSrHba = (host, nameLabel, nameDescription, scsiId) =>
  _call('sr.createHba', { host, nameLabel, nameDescription, scsiId })

export const createSrIso = (
  host,
  nameLabel,
  nameDescription,
  path,
  type,
  user = undefined,
  password = undefined
) => {
  const params = { host, nameLabel, nameDescription, path, type }
  user && (params.user = user)
  password && (params.password = password)
  return _call('sr.createIso', params)
}

export const createSrLvm = (host, nameLabel, nameDescription, device) =>
  _call('sr.createLvm', { host, nameLabel, nameDescription, device })

export const createSrExt = (host, nameLabel, nameDescription, device) =>
  _call('sr.createExt', { host, nameLabel, nameDescription, device })

export const createSrZfs = (host, nameLabel, nameDescription, location) =>
  _call('sr.createFile', {
    host: resolveId(host),
    nameDescription,
    nameLabel,
    location,
  })

// Job logs ----------------------------------------------------------

export const deleteJobsLogs = async ids => {
  const { length } = ids
  if (length === 0) {
    return
  }
  if (length !== 1) {
    const vars = { nLogs: length }
    try {
      await confirm({
        title: _('logDeleteMultiple', vars),
        body: <p>{_('logDeleteMultipleMessage', vars)}</p>,
      })
    } catch (_) {
      return
    }
  }

  return _call('log.delete', {
    namespace: 'jobs',
    id: ids.map(resolveId),
  })::tap(subscribeJobsLogs.forceRefresh)
}

// Logs

export const deleteApiLog = log =>
  _call('log.delete', { namespace: 'api', id: resolveId(log) })::tap(
    subscribeApiLogs.forceRefresh
  )

export const deleteApiLogs = logs =>
  confirm({
    title: _('logDeleteMultiple', { nLogs: logs.length }),
    body: _('logDeleteMultipleMessage', { nLogs: logs.length }),
  }).then(() => Promise.all(map(logs, deleteApiLog)), noop)

// Acls, users, groups ----------------------------------------------------------

export const addAcl = ({ subject, object, action }) =>
  _call('acl.add', resolveIds({ subject, object, action }))::tap(
    subscribeAcls.forceRefresh,
    err => error('Add ACL', err.message || String(err))
  )

export const removeAcl = ({ subject, object, action }) =>
  _call('acl.remove', resolveIds({ subject, object, action }))::tap(
    subscribeAcls.forceRefresh,
    err => error('Remove ACL', err.message || String(err))
  )

export const removeAcls = acls =>
  confirm({
    title: _('deleteAclsModalTitle', { nAcls: acls.length }),
    body: <p>{_('deleteAclsModalMessage', { nAcls: acls.length })}</p>,
  }).then(
    () =>
      Promise.all(
        map(acls, ({ subject, object, action }) =>
          _call('acl.remove', resolveIds({ subject, object, action }))
        )
      )::tap(subscribeAcls.forceRefresh, err =>
        error('Remove ACLs', err.message || String(err))
      ),
    noop
  )

export const editAcl = (
  { subject, object, action },
  {
    subject: newSubject = subject,
    object: newObject = object,
    action: newAction = action,
  }
) =>
  _call('acl.remove', resolveIds({ subject, object, action }))
    .then(() =>
      _call(
        'acl.add',
        resolveIds({
          subject: newSubject,
          object: newObject,
          action: newAction,
        })
      )
    )
    ::tap(subscribeAcls.forceRefresh, err =>
      error('Edit ACL', err.message || String(err))
    )

export const createGroup = name =>
  _call('group.create', { name })::tap(subscribeGroups.forceRefresh, err =>
    error(_('createGroup'), err.message || String(err))
  )

export const setGroupName = (group, name) =>
  _call('group.set', resolveIds({ group, name }))::tap(
    subscribeGroups.forceRefresh
  )

export const deleteGroup = group =>
  confirm({
    title: _('deleteGroup'),
    body: <p>{_('deleteGroupConfirm')}</p>,
  }).then(
    () =>
      _call('group.delete', resolveIds({ id: group }))::tap(
        subscribeGroups.forceRefresh,
        err => error(_('deleteGroup'), err.message || String(err))
      ),
    noop
  )

export const removeUserFromGroup = (user, group) =>
  _call('group.removeUser', resolveIds({ id: group, userId: user }))::tap(
    subscribeGroups.forceRefresh,
    err => error(_('removeUserFromGroup'), err.message || String(err))
  )

export const addUserToGroup = (user, group) =>
  _call('group.addUser', resolveIds({ id: group, userId: user }))::tap(
    subscribeGroups.forceRefresh,
    err => error('Add User', err.message || String(err))
  )

export const createUser = (email, password, permission) =>
  _call('user.create', { email, password, permission })::tap(
    subscribeUsers.forceRefresh,
    err => error('Create user', err.message || String(err))
  )

export const deleteUser = user =>
  confirm({
    title: _('deleteUser'),
    body: <p>{_('deleteUserConfirm')}</p>,
  }).then(() =>
    _call('user.delete', { id: resolveId(user) })::tap(
      subscribeUsers.forceRefresh,
      err => error(_('deleteUser'), err.message || String(err))
    )
  )

export const deleteUsers = users =>
  confirm({
    title: _('deleteUsersModalTitle', { nUsers: users.length }),
    body: <p>{_('deleteUsersModalMessage', { nUsers: users.length })}</p>,
  }).then(
    () =>
      Promise.all(
        map(resolveIds(users), id => _call('user.delete', { id }))
      )::tap(subscribeUsers.forceRefresh, err =>
        error(_('deleteUser'), err.message || String(err))
      ),
    noop
  )

export const editUser = (user, { email, password, permission }) =>
  _call('user.set', { id: resolveId(user), email, password, permission })::tap(
    subscribeUsers.forceRefresh
  )

const _signOutFromEverywhereElse = () =>
  _call('token.deleteAll', { except: cookies.get('token') })

export const signOutFromEverywhereElse = () =>
  _signOutFromEverywhereElse().then(
    () => success(_('forgetTokens'), _('forgetTokensSuccess')),
    () => error(_('forgetTokens'), _('forgetTokensError'))
  )

export const changePassword = (oldPassword, newPassword) =>
  _call('user.changePassword', {
    oldPassword,
    newPassword,
  })
    .then(_signOutFromEverywhereElse)
    .then(
      () => success(_('pwdChangeSuccess'), _('pwdChangeSuccessBody')),
      () => error(_('pwdChangeError'), _('pwdChangeErrorBody'))
    )

const _setUserPreferences = preferences =>
  _call('user.set', {
    id: xo.user.id,
    preferences,
  })::tap(subscribeCurrentUser.forceRefresh)

import NewSshKeyModalBody from './new-ssh-key-modal' // eslint-disable-line import/first
export const addSshKey = key => {
  const { preferences } = xo.user
  const otherKeys = (preferences && preferences.sshKeys) || []
  if (key) {
    return _setUserPreferences({
      sshKeys: [...otherKeys, key],
    })
  }
  return confirm({
    icon: 'ssh-key',
    title: _('newSshKeyModalTitle'),
    body: <NewSshKeyModalBody />,
  }).then(newKey => {
    if (!newKey.title || !newKey.key) {
      error(_('sshKeyErrorTitle'), _('sshKeyErrorMessage'))
      return
    }
    return _setUserPreferences({
      sshKeys: [...otherKeys, newKey],
    })
  }, noop)
}

export const deleteSshKey = key =>
  confirm({
    title: _('deleteSshKeyConfirm'),
    body: _('deleteSshKeyConfirmMessage', {
      title: <strong>{key.title}</strong>,
    }),
  }).then(() => {
    const { preferences } = xo.user
    return _setUserPreferences({
      sshKeys: filter(
        preferences && preferences.sshKeys,
        k => k.key !== resolveId(key)
      ),
    })
  }, noop)

export const addOtp = secret =>
  confirm({
    title: _('addOtpConfirm'),
    body: _('addOtpConfirmMessage'),
  }).then(
    () =>
      _setUserPreferences({
        otp: secret,
      }),
    noop
  )

export const removeOtp = () =>
  confirm({
    title: _('removeOtpConfirm'),
    body: _('removeOtpConfirmMessage'),
  }).then(
    () =>
      _setUserPreferences({
        otp: null,
      }),
    noop
  )

export const deleteSshKeys = keys =>
  confirm({
    title: _('deleteSshKeysConfirm', { nKeys: keys.length }),
    body: _('deleteSshKeysConfirmMessage', {
      nKeys: keys.length,
    }),
  }).then(() => {
    const { preferences } = xo.user
    const keyIds = resolveIds(keys)
    return _setUserPreferences({
      sshKeys: filter(
        preferences && preferences.sshKeys,
        sshKey => !includes(keyIds, sshKey.key)
      ),
    })
  }, noop)

// User filters --------------------------------------------------

import AddUserFilterModalBody from './add-user-filter-modal' // eslint-disable-line import/first
export const addCustomFilter = (type, value) => {
  const { user } = xo
  return confirm({
    title: _('saveNewFilterTitle'),
    body: <AddUserFilterModalBody user={user} type={type} value={value} />,
  }).then(name => {
    if (name.length === 0) {
      return error(
        _('saveNewUserFilterErrorTitle'),
        _('saveNewUserFilterErrorBody')
      )
    }

    const { preferences } = user
    const filters = (preferences && preferences.filters) || {}

    return _setUserPreferences({
      filters: {
        ...filters,
        [type]: {
          ...filters[type],
          [name]: value,
        },
      },
    })
  })
}

export const removeCustomFilter = (type, name) =>
  confirm({
    title: _('removeUserFilterTitle'),
    body: <p>{_('removeUserFilterBody')}</p>,
  }).then(() => {
    const { user } = xo
    const { filters } = user.preferences

    return _setUserPreferences({
      filters: {
        ...filters,
        [type]: {
          ...filters[type],
          [name]: undefined,
        },
      },
    })
  })

export const editCustomFilter = (type, name, { newName = name, newValue }) => {
  const { filters } = xo.user.preferences
  return _setUserPreferences({
    filters: {
      ...filters,
      [type]: {
        ...filters[type],
        [name]: undefined,
        [newName]: newValue || filters[type][name],
      },
    },
  })
}

export const setDefaultHomeFilter = (type, name) => {
  const { user } = xo
  const { preferences } = user
  const defaultFilters = (preferences && preferences.defaultHomeFilters) || {}

  return _setUserPreferences({
    defaultHomeFilters: {
      ...defaultFilters,
      [type]: name,
    },
  })
}

// IP pools --------------------------------------------------------------------

export const createIpPool = ({ name, ips, networks }) => {
  const addresses = {}
  forEach(ips, ip => {
    addresses[ip] = {}
  })
  return _call('ipPool.create', {
    name,
    addresses,
    networks: resolveIds(networks),
  })::tap(subscribeIpPools.forceRefresh)
}

export const deleteIpPool = ipPool =>
  _call('ipPool.delete', { id: resolveId(ipPool) })::tap(
    subscribeIpPools.forceRefresh
  )

export const setIpPool = (ipPool, { name, addresses, networks }) =>
  _call('ipPool.set', {
    id: resolveId(ipPool),
    name,
    addresses,
    networks: resolveIds(networks),
  })::tap(subscribeIpPools.forceRefresh)

// Cloud configs --------------------------------------------------------------------

export const subscribeCloudConfigs = createSubscription(() =>
  _call('cloudConfig.getAll')
)

export const createCloudConfig = props =>
  _call('cloudConfig.create', props)::tap(subscribeCloudConfigs.forceRefresh)

export const deleteCloudConfigs = ids => {
  const { length } = ids
  if (length === 0) {
    return
  }

  const vars = { nCloudConfigs: length }
  return confirm({
    title: _('confirmDeleteCloudConfigsTitle', vars),
    body: <p>{_('confirmDeleteCloudConfigsBody', vars)}</p>,
  }).then(
    () =>
      Promise.all(
        ids.map(id => _call('cloudConfig.delete', { id: resolveId(id) }))
      )::tap(subscribeCloudConfigs.forceRefresh),
    noop
  )
}

export const editCloudConfig = (cloudConfig, props) =>
  _call('cloudConfig.update', { ...props, id: resolveId(cloudConfig) })::tap(
    subscribeCloudConfigs.forceRefresh
  )

// XO SAN ----------------------------------------------------------------------

export const getVolumeInfo = (xosanSr, infoType) =>
  _call('xosan.getVolumeInfo', { sr: xosanSr, infoType })

export const createXosanSR = ({
  template,
  pif,
  vlan,
  srs,
  glusterType,
  redundancy,
  brickSize,
  memorySize,
  ipRange,
}) => {
  const promise = _call('xosan.createSR', {
    template,
    pif: pif.id,
    vlan: String(vlan),
    srs: resolveIds(srs),
    glusterType,
    redundancy: Number.parseInt(redundancy),
    brickSize,
    memorySize,
    ipRange,
  })

  // Force refresh in parallel to get the creation progress sooner
  subscribeCheckSrCurrentState.forceRefresh()

  return promise
}

export const addXosanBricks = (xosansr, lvmsrs, brickSize) =>
  _call('xosan.addBricks', { xosansr, lvmsrs, brickSize })

export const replaceXosanBrick = (
  xosansr,
  previousBrick,
  newLvmSr,
  brickSize,
  onSameVM = false
) =>
  _call(
    'xosan.replaceBrick',
    resolveIds({ xosansr, previousBrick, newLvmSr, brickSize, onSameVM })
  )

export const removeXosanBricks = (xosansr, bricks) =>
  _call('xosan.removeBricks', { xosansr, bricks })

export const computeXosanPossibleOptions = (lvmSrs, brickSize) =>
  _call('xosan.computeXosanPossibleOptions', { lvmSrs, brickSize })

export const registerXosan = () =>
  _call('cloud.registerResource', { namespace: 'xosan' })::tap(
    subscribeResourceCatalog.forceRefresh
  )

export const fixHostNotInXosanNetwork = (xosanSr, host) =>
  _call('xosan.fixHostNotInNetwork', { xosanSr, host })

// XOSAN packs -----------------------------------------------------------------

export const getResourceCatalog = ({ filters } = {}) =>
  _call('cloud.getResourceCatalog', { filters })

export const getAllResourceCatalog = () => _call('cloud.getAllResourceCatalog')

const downloadAndInstallXosanPack = (pack, pool, { version }) =>
  _call('xosan.downloadAndInstallXosanPack', {
    id: resolveId(pack),
    version,
    pool: resolveId(pool),
  })

export const downloadAndInstallResource = ({ namespace, id, version, sr }) =>
  _call('cloud.downloadAndInstallResource', {
    namespace,
    id,
    version,
    sr: resolveId(sr),
  })

import UpdateXosanPacksModal from './update-xosan-packs-modal' // eslint-disable-line import/first
export const updateXosanPacks = pool =>
  confirm({
    title: _('xosanUpdatePacks'),
    icon: 'host-patch-update',
    body: <UpdateXosanPacksModal pool={pool} />,
  }).then(pack => {
    if (pack === undefined) {
      return
    }

    return downloadAndInstallXosanPack(pack, pool, { version: pack.version })
  })

// Licenses --------------------------------------------------------------------

export const getLicenses = productId => _call('xoa.getLicenses', { productId })

export const getLicense = (productId, boundObjectId) =>
  _call('xoa.getLicense', { productId, boundObjectId })

export const unlockXosan = (licenseId, srId) =>
  _call('xosan.unlock', { licenseId, sr: srId })

// Support --------------------------------------------------------------------

export const checkXoa = () => _call('xoa.check')
