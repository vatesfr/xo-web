/* eslint-disable camelcase */
import concurrency from 'limit-concurrency-decorator'
import deferrable from 'golike-defer'
import fatfs from 'fatfs'
import synchronized from 'decorator-synchronized'
import tarStream from 'tar-stream'
import vmdkToVhd from 'xo-vmdk-to-vhd'
import {
  cancelable,
  catchPlus as pCatch,
  defer,
  fromEvent,
  ignoreErrors,
} from 'promise-toolbox'
import { PassThrough } from 'stream'
import { forbiddenOperation } from 'xo-common/api-errors'
import { Xapi as XapiBase } from 'xen-api'
import {
  every,
  find,
  filter,
  flatten,
  groupBy,
  includes,
  isEmpty,
  omit,
  startsWith,
  uniq,
} from 'lodash'
import { satisfies as versionSatisfies } from 'semver'

import createSizeStream from '../size-stream'
import fatfsBuffer, { init as fatfsBufferInit } from '../fatfs-buffer'
import { mixin } from '../decorators'
import {
  asyncMap,
  camelToSnakeCase,
  ensureArray,
  forEach,
  isFunction,
  map,
  mapToArray,
  pAll,
  parseSize,
  pDelay,
  pFinally,
  promisifyAll,
  pSettle,
} from '../utils'

import mixins from './mixins'
import OTHER_CONFIG_TEMPLATE from './other-config-template'
import { type DeltaVmExport } from './'
import {
  asBoolean,
  asInteger,
  debug,
  extractOpaqueRef,
  filterUndefineds,
  getNamespaceForType,
  getVmDisks,
  canSrHaveNewVdiOfSize,
  isVmHvm,
  isVmRunning,
  NULL_REF,
  optional,
  prepareXapiParam,
} from './utils'

// ===================================================================

const TAG_BASE_DELTA = 'xo:base_delta'
const TAG_COPY_SRC = 'xo:copy_of'

// ===================================================================

// FIXME: remove this work around when fixed, https://phabricator.babeljs.io/T2877
//  export * from './utils'
require('lodash/assign')(module.exports, require('./utils'))

// VDI formats. (Raw is not available for delta vdi.)
export const VDI_FORMAT_VHD = 'vhd'
export const VDI_FORMAT_RAW = 'raw'

export const IPV4_CONFIG_MODES = ['None', 'DHCP', 'Static']
export const IPV6_CONFIG_MODES = ['None', 'DHCP', 'Static', 'Autoconf']

// ===================================================================

@mixin(mapToArray(mixins))
export default class Xapi extends XapiBase {
  constructor (...args) {
    super(...args)

    // Patch getObject to resolve _xapiId property.
    this.getObject = (getObject => (...args) => {
      let tmp
      if ((tmp = args[0]) != null && (tmp = tmp._xapiId) != null) {
        args[0] = tmp
      }
      return getObject.apply(this, args)
    })(this.getObject)

    const genericWatchers = (this._genericWatchers = { __proto__: null })
    const objectsWatchers = (this._objectWatchers = { __proto__: null })

    const onAddOrUpdate = objects => {
      forEach(objects, object => {
        const { $id: id, $ref: ref } = object

        // Run generic watchers.
        for (const watcherId in genericWatchers) {
          genericWatchers[watcherId](object)
        }

        // Watched object.
        if (id in objectsWatchers) {
          objectsWatchers[id].resolve(object)
          delete objectsWatchers[id]
        }
        if (ref in objectsWatchers) {
          objectsWatchers[ref].resolve(object)
          delete objectsWatchers[ref]
        }
      })
    }
    this.objects.on('add', onAddOrUpdate)
    this.objects.on('update', onAddOrUpdate)
  }

  call (...args) {
    const fn = super.call

    const loop = () =>
      fn.apply(this, args)::pCatch(
        {
          code: 'TOO_MANY_PENDING_TASKS',
        },
        () => pDelay(5e3).then(loop)
      )

    return loop()
  }

  createTask (name = 'untitled task', description) {
    return super.createTask(`[XO] ${name}`, description)
  }

  // =================================================================

  _registerGenericWatcher (fn) {
    const watchers = this._genericWatchers
    const id = String(Math.random())

    watchers[id] = fn

    return () => {
      delete watchers[id]
    }
  }

  // Wait for an object to appear or to be updated.
  //
  // Predicate can be either an id, a UUID, an opaque reference or a
  // function.
  //
  // TODO: implements a timeout.
  _waitObject (predicate) {
    if (isFunction(predicate)) {
      const { promise, resolve } = defer()

      const unregister = this._registerGenericWatcher(obj => {
        if (predicate(obj)) {
          unregister()

          resolve(obj)
        }
      })

      return promise
    }

    let watcher = this._objectWatchers[predicate]
    if (!watcher) {
      const { promise, resolve } = defer()

      // Register the watcher.
      watcher = this._objectWatchers[predicate] = {
        promise,
        resolve,
      }
    }

    return watcher.promise
  }

  // Wait for an object to be in a given state.
  //
  // Faster than _waitObject() with a function.
  _waitObjectState (idOrUuidOrRef, predicate) {
    const object = this.getObject(idOrUuidOrRef, null)
    if (object && predicate(object)) {
      return object
    }

    const loop = () =>
      this._waitObject(idOrUuidOrRef).then(
        object => (predicate(object) ? object : loop())
      )

    return loop()
  }

  // Returns the objects if already presents or waits for it.
  async _getOrWaitObject (idOrUuidOrRef) {
    return (
      this.getObject(idOrUuidOrRef, null) || this._waitObject(idOrUuidOrRef)
    )
  }

  // =================================================================

  _setObjectProperty (object, name, value) {
    return this.call(
      `${getNamespaceForType(object.$type)}.set_${camelToSnakeCase(name)}`,
      object.$ref,
      prepareXapiParam(value)
    )
  }

  _setObjectProperties (object, props) {
    const { $ref: ref, $type: type } = object

    const namespace = getNamespaceForType(type)

    // TODO: the thrown error should contain the name of the
    // properties that failed to be set.
    return Promise.all(
      mapToArray(props, (value, name) => {
        if (value != null) {
          return this.call(
            `${namespace}.set_${camelToSnakeCase(name)}`,
            ref,
            prepareXapiParam(value)
          )
        }
      })
    )::ignoreErrors()
  }

  async _updateObjectMapProperty (object, prop, values) {
    const { $ref: ref, $type: type } = object

    prop = camelToSnakeCase(prop)

    const namespace = getNamespaceForType(type)
    const add = `${namespace}.add_to_${prop}`
    const remove = `${namespace}.remove_from_${prop}`

    await Promise.all(
      mapToArray(values, (value, name) => {
        if (value !== undefined) {
          name = camelToSnakeCase(name)
          const removal = this.call(remove, ref, name)

          return value === null
            ? removal
            : removal
                ::ignoreErrors()
                .then(() => this.call(add, ref, name, prepareXapiParam(value)))
        }
      })
    )
  }

  async setHostProperties (id, { nameLabel, nameDescription }) {
    await this._setObjectProperties(this.getObject(id), {
      nameLabel,
      nameDescription,
    })
  }

  async setPoolProperties ({ autoPoweron, nameLabel, nameDescription }) {
    const { pool } = this

    await Promise.all([
      this._setObjectProperties(pool, {
        nameLabel,
        nameDescription,
      }),
      autoPoweron != null &&
        this._updateObjectMapProperty(pool, 'other_config', {
          autoPoweron: autoPoweron ? 'true' : null,
        }),
    ])
  }

  async setSrProperties (id, { nameLabel, nameDescription }) {
    await this._setObjectProperties(this.getObject(id), {
      nameLabel,
      nameDescription,
    })
  }

  async setNetworkProperties (
    id,
    { nameLabel, nameDescription, defaultIsLocked }
  ) {
    let defaultLockingMode
    if (defaultIsLocked != null) {
      defaultLockingMode = defaultIsLocked ? 'disabled' : 'unlocked'
    }
    await this._setObjectProperties(this.getObject(id), {
      nameLabel,
      nameDescription,
      defaultLockingMode,
    })
  }

  // =================================================================

  async addTag (id, tag) {
    const { $ref: ref, $type: type } = this.getObject(id)

    const namespace = getNamespaceForType(type)
    await this.call(`${namespace}.add_tags`, ref, tag)
  }

  async removeTag (id, tag) {
    const { $ref: ref, $type: type } = this.getObject(id)

    const namespace = getNamespaceForType(type)
    await this.call(`${namespace}.remove_tags`, ref, tag)
  }

  // =================================================================

  async setDefaultSr (srId) {
    this._setObjectProperties(this.pool, {
      default_SR: this.getObject(srId).$ref,
    })
  }

  // =================================================================

  async setPoolMaster (hostId) {
    await this.call('pool.designate_new_master', this.getObject(hostId).$ref)
  }

  // =================================================================

  async joinPool (masterAddress, masterUsername, masterPassword, force = false) {
    await this.call(
      force ? 'pool.join_force' : 'pool.join',
      masterAddress,
      masterUsername,
      masterPassword
    )
  }

  // =================================================================

  async emergencyShutdownHost (hostId) {
    const host = this.getObject(hostId)
    const vms = host.$resident_VMs
    debug(`Emergency shutdown: ${host.name_label}`)
    await pSettle(
      mapToArray(vms, vm => {
        if (!vm.is_control_domain) {
          return this.call('VM.suspend', vm.$ref)
        }
      })
    )
    await this.call('host.disable', host.$ref)
    await this.call('host.shutdown', host.$ref)
  }

  // =================================================================

  // Disable the host and evacuate all its VMs.
  //
  // If `force` is false and the evacuation failed, the host is re-
  // enabled and the error is thrown.
  async _clearHost ({ $ref: ref }, force) {
    await this.call('host.disable', ref)

    try {
      await this.call('host.evacuate', ref)
    } catch (error) {
      if (!force) {
        await this.call('host.enable', ref)

        throw error
      }
    }
  }

  async disableHost (hostId) {
    await this.call('host.disable', this.getObject(hostId).$ref)
  }

  async forgetHost (hostId) {
    await this.call('host.destroy', this.getObject(hostId).$ref)
  }

  async ejectHostFromPool (hostId) {
    await this.call('pool.eject', this.getObject(hostId).$ref)
  }

  async enableHost (hostId) {
    await this.call('host.enable', this.getObject(hostId).$ref)
  }

  async powerOnHost (hostId) {
    await this.call('host.power_on', this.getObject(hostId).$ref)
  }

  async rebootHost (hostId, force = false) {
    const host = this.getObject(hostId)

    await this._clearHost(host, force)
    await this.call('host.reboot', host.$ref)
  }

  async restartHostAgent (hostId) {
    await this.call('host.restart_agent', this.getObject(hostId).$ref)
  }

  async shutdownHost (hostId, force = false) {
    const host = this.getObject(hostId)

    await this._clearHost(host, force)
    await this.call('host.shutdown', host.$ref)
  }

  // =================================================================

  // Clone a VM: make a fast copy by fast copying each of its VDIs
  // (using snapshots where possible) on the same SRs.
  _cloneVm (vm, nameLabel = vm.name_label) {
    debug(
      `Cloning VM ${vm.name_label}${
        nameLabel !== vm.name_label ? ` as ${nameLabel}` : ''
      }`
    )

    return this.call('VM.clone', vm.$ref, nameLabel)
  }

  // Copy a VM: make a normal copy of a VM and all its VDIs.
  //
  // If a SR is specified, it will contains the copies of the VDIs,
  // otherwise they will use the SRs they are on.
  async _copyVm (vm, nameLabel = vm.name_label, sr = undefined) {
    let snapshot
    if (isVmRunning(vm)) {
      snapshot = await this._snapshotVm(vm)
    }

    debug(
      `Copying VM ${vm.name_label}${
        nameLabel !== vm.name_label ? ` as ${nameLabel}` : ''
      }${sr ? ` on ${sr.name_label}` : ''}`
    )

    try {
      return await this.call(
        'VM.copy',
        snapshot ? snapshot.$ref : vm.$ref,
        nameLabel,
        sr ? sr.$ref : ''
      )
    } finally {
      if (snapshot) {
        await this._deleteVm(snapshot)
      }
    }
  }

  async cloneVm (vmId, { nameLabel = undefined, fast = true } = {}) {
    const vm = this.getObject(vmId)

    const cloneRef = await (fast
      ? this._cloneVm(vm, nameLabel)
      : this._copyVm(vm, nameLabel))

    return /* await */ this._getOrWaitObject(cloneRef)
  }

  async copyVm (vmId, srId, { nameLabel = undefined } = {}) {
    return /* await */ this._getOrWaitObject(
      await this._copyVm(this.getObject(vmId), nameLabel, this.getObject(srId))
    )
  }

  async remoteCopyVm (
    vmId,
    targetXapi,
    targetSrId,
    { compress = true, nameLabel = undefined } = {}
  ) {
    // Fall back on local copy if possible.
    if (targetXapi === this) {
      return {
        vm: await this.copyVm(vmId, targetSrId, { nameLabel }),
      }
    }

    const sr = targetXapi.getObject(targetSrId)
    let stream = await this.exportVm(vmId, {
      compress,
    })

    const sizeStream = createSizeStream()
    stream = stream.pipe(sizeStream)

    const onVmCreation =
      nameLabel !== undefined
        ? vm =>
            targetXapi._setObjectProperties(vm, {
              nameLabel,
            })
        : null

    const vm = await targetXapi._getOrWaitObject(
      await targetXapi._importVm(stream, sr, onVmCreation)
    )

    return {
      size: sizeStream.size,
      vm,
    }
  }

  // Low level create VM.
  _createVmRecord ({
    actions_after_crash,
    actions_after_reboot,
    actions_after_shutdown,
    affinity,
    // appliance,
    blocked_operations,
    generation_id,
    ha_always_run,
    ha_restart_priority,
    has_vendor_device = false, // Avoid issue with some Dundee builds.
    hardware_platform_version,
    HVM_boot_params,
    HVM_boot_policy,
    HVM_shadow_multiplier,
    is_a_template,
    memory_dynamic_max,
    memory_dynamic_min,
    memory_static_max,
    memory_static_min,
    name_description,
    name_label,
    order,
    other_config,
    PCI_bus,
    platform,
    protection_policy,
    PV_args,
    PV_bootloader,
    PV_bootloader_args,
    PV_kernel,
    PV_legacy_args,
    PV_ramdisk,
    recommendations,
    shutdown_delay,
    start_delay,
    // suspend_SR,
    tags,
    user_version,
    VCPUs_at_startup,
    VCPUs_max,
    VCPUs_params,
    version,
    xenstore_data,
  }) {
    debug(`Creating VM ${name_label}`)

    return this.call(
      'VM.create',
      filterUndefineds({
        actions_after_crash,
        actions_after_reboot,
        actions_after_shutdown,
        affinity: affinity == null ? NULL_REF : affinity,
        HVM_boot_params,
        HVM_boot_policy,
        is_a_template: asBoolean(is_a_template),
        memory_dynamic_max: asInteger(memory_dynamic_max),
        memory_dynamic_min: asInteger(memory_dynamic_min),
        memory_static_max: asInteger(memory_static_max),
        memory_static_min: asInteger(memory_static_min),
        other_config,
        PCI_bus,
        platform,
        PV_args,
        PV_bootloader,
        PV_bootloader_args,
        PV_kernel,
        PV_legacy_args,
        PV_ramdisk,
        recommendations,
        user_version: asInteger(user_version),
        VCPUs_at_startup: asInteger(VCPUs_at_startup),
        VCPUs_max: asInteger(VCPUs_max),
        VCPUs_params,

        // Optional fields.
        blocked_operations,
        generation_id,
        ha_always_run: asBoolean(ha_always_run),
        ha_restart_priority,
        has_vendor_device,
        hardware_platform_version: optional(
          hardware_platform_version,
          asInteger
        ),
        // HVM_shadow_multiplier: asFloat(HVM_shadow_multiplier), // FIXME: does not work FIELD_TYPE_ERROR(hVM_shadow_multiplier)
        name_description,
        name_label,
        order: optional(order, asInteger),
        protection_policy,
        shutdown_delay: asInteger(shutdown_delay),
        start_delay: asInteger(start_delay),
        tags,
        version: asInteger(version),
        xenstore_data,
      })
    )
  }

  async _deleteVm (
    vm,
    deleteDisks = true,
    force = false,
    forceDeleteDefaultTemplate = false
  ) {
    debug(`Deleting VM ${vm.name_label}`)

    const { $ref } = vm

    // It is necessary for suspended VMs to be shut down
    // to be able to delete their VDIs.
    if (vm.power_state !== 'Halted') {
      await this.call('VM.hard_shutdown', $ref)
    }

    if (force) {
      await this._updateObjectMapProperty(vm, 'blocked_operations', {
        destroy: null,
      })
    }

    // ensure the vm record is up-to-date
    vm = await this.barrier('VM', $ref)

    return Promise.all([
      forceDeleteDefaultTemplate &&
        this._updateObjectMapProperty(vm, 'other_config', {
          default_template: null,
        }),
      this.call('VM.destroy', $ref),

      asyncMap(vm.$snapshots, snapshot =>
        this._deleteVm(snapshot)
      )::ignoreErrors(),

      deleteDisks &&
        asyncMap(getVmDisks(vm), ({ $ref: vdiRef }) => {
          let onFailure = () => {
            onFailure = vdi => {
              console.error(
                `cannot delete VDI ${vdi.name_label} (from VM ${vm.name_label})`
              )
              forEach(vdi.$VBDs, vbd => {
                if (vbd.VM !== $ref) {
                  const vm = vbd.$VM
                  console.error('- %s (%s)', vm.name_label, vm.uuid)
                }
              })
            }

            // maybe the control domain has not yet unmounted the VDI,
            // check and retry after 5 seconds
            return pDelay(5e3).then(test)
          }
          const test = () => {
            const vdi = this.getObjectByRef(vdiRef)
            return (
              // Only remove VBDs not attached to other VMs.
              vdi.VBDs.length < 2 || every(vdi.$VBDs, vbd => vbd.VM === $ref)
                ? this._deleteVdi(vdi)
                : onFailure(vdi)
            )
          }
          return test()
        })::ignoreErrors(),
    ])
  }

  async deleteVm (vmId, deleteDisks, force, forceDeleteDefaultTemplate) {
    return /* await */ this._deleteVm(
      this.getObject(vmId),
      deleteDisks,
      force,
      forceDeleteDefaultTemplate
    )
  }

  getVmConsole (vmId) {
    const vm = this.getObject(vmId)

    const console = find(vm.$consoles, { protocol: 'rfb' })
    if (!console) {
      throw new Error('no RFB console found')
    }

    return console
  }

  // Returns a stream to the exported VM.
  @concurrency(2, stream => stream.then(stream => fromEvent(stream, 'end')))
  @cancelable
  async exportVm ($cancelToken, vmId, { compress = true } = {}) {
    const vm = this.getObject(vmId)

    let host
    let snapshotRef
    if (isVmRunning(vm)) {
      host = vm.$resident_on
      snapshotRef = (await this._snapshotVm(
        $cancelToken,
        vm,
        `[XO Export] ${vm.name_label}`
      )).$ref
    }

    const promise = this.getResource($cancelToken, '/export/', {
      host,
      query: {
        ref: snapshotRef || vm.$ref,
        use_compression: compress ? 'true' : 'false',
      },
      task: this.createTask('VM export', vm.name_label),
    })

    if (snapshotRef !== undefined) {
      promise.then(_ =>
        _.task::pFinally(() => this.deleteVm(snapshotRef)::ignoreErrors())
      )
    }

    return promise
  }

  _assertHealthyVdiChain (vdi, cache) {
    if (vdi == null) {
      return
    }

    if (!vdi.managed) {
      const { SR } = vdi
      let childrenMap = cache[SR]
      if (childrenMap === undefined) {
        childrenMap = cache[SR] = groupBy(
          vdi.$SR.$VDIs,
          _ => _.sm_config['vhd-parent']
        )
      }

      // an unmanaged VDI should not have exactly one child: they
      // should coalesce
      const children = childrenMap[vdi.uuid]
      if (
        children.length === 1 &&
        !children[0].managed // some SRs do not coalesce the leaf
      ) {
        throw new Error('unhealthy VDI chain')
      }
    }

    this._assertHealthyVdiChain(
      this.getObjectByUuid(vdi.sm_config['vhd-parent'], null),
      cache
    )
  }

  _assertHealthyVdiChains (vm) {
    const cache = { __proto__: null }
    forEach(vm.$VBDs, ({ $VDI }) => {
      this._assertHealthyVdiChain($VDI, cache)
    })
  }

  // Create a snapshot (if necessary) of the VM and returns a delta export
  // object.
  @cancelable
  @deferrable
  async exportDeltaVm (
    $defer,
    $cancelToken,
    vmId: string,
    baseVmId?: string,
    {
      bypassVdiChainsCheck = false,

      // Contains a vdi.$id set of vmId.
      fullVdisRequired = [],

      disableBaseTags = false,
      snapshotNameLabel = undefined,
    } = {}
  ): Promise<DeltaVmExport> {
    let vm = this.getObject(vmId)
    if (!bypassVdiChainsCheck) {
      this._assertHealthyVdiChains(vm)
    }
    // do not use the snapshot name in the delta export
    const exportedNameLabel = vm.name_label
    if (!vm.is_a_snapshot) {
      vm = await this._snapshotVm($cancelToken, vm, snapshotNameLabel)
      $defer.onFailure(() => this._deleteVm(vm))
    }

    const baseVm = baseVmId && this.getObject(baseVmId)

    // refs of VM's VDIs → base's VDIs.
    const baseVdis = {}
    baseVm &&
      forEach(baseVm.$VBDs, vbd => {
        let vdi, snapshotOf
        if (
          (vdi = vbd.$VDI) &&
          (snapshotOf = vdi.$snapshot_of) &&
          !find(fullVdisRequired, id => snapshotOf.$id === id)
        ) {
          baseVdis[vdi.snapshot_of] = vdi
        }
      })

    const streams = {}
    const vdis = {}
    const vbds = {}
    forEach(vm.$VBDs, vbd => {
      let vdi
      if (vbd.type !== 'Disk' || !(vdi = vbd.$VDI)) {
        // Ignore this VBD.
        return
      }

      // If the VDI name start with `[NOBAK]`, do not export it.
      if (startsWith(vdi.name_label, '[NOBAK]')) {
        // FIXME: find a way to not create the VDI snapshot in the
        // first time.
        //
        // The snapshot must not exist otherwise it could break the
        // next export.
        ;this._deleteVdi(vdi)::ignoreErrors()
        return
      }

      vbds[vbd.$ref] = vbd

      const vdiRef = vdi.$ref
      if (vdiRef in vdis) {
        // This VDI has already been managed.
        return
      }

      // Look for a snapshot of this vdi in the base VM.
      const baseVdi = baseVdis[vdi.snapshot_of]

      vdis[vdiRef] = {
        ...vdi,
        other_config: {
          ...vdi.other_config,
          [TAG_BASE_DELTA]:
            baseVdi && !disableBaseTags ? baseVdi.uuid : undefined,
        },
        $SR$uuid: vdi.$SR.uuid,
      }

      streams[`${vdiRef}.vhd`] = () =>
        this._exportVdi($cancelToken, vdi, baseVdi, VDI_FORMAT_VHD)
    })

    const vifs = {}
    forEach(vm.$VIFs, vif => {
      const network = vif.$network
      vifs[vif.$ref] = {
        ...vif,
        $network$uuid: network.uuid,
        $network$name_label: network.name_label,
        // https://github.com/babel/babel-eslint/issues/595
        // eslint-disable-next-line no-undef
        $network$VLAN: network.$PIFs[0]?.VLAN,
      }
    })

    return Object.defineProperty(
      {
        version: '1.1.0',
        vbds,
        vdis,
        vifs,
        vm: {
          ...vm,
          name_label: exportedNameLabel,
          other_config:
            baseVm && !disableBaseTags
              ? {
                  ...vm.other_config,
                  [TAG_BASE_DELTA]: baseVm.uuid,
                }
              : omit(vm.other_config, TAG_BASE_DELTA),
        },
      },
      'streams',
      {
        configurable: true,
        value: streams,
        writable: true,
      }
    )
  }

  @deferrable
  async importDeltaVm (
    $defer,
    delta: DeltaVmExport,
    {
      deleteBase = false,
      detectBase = true,
      mapVdisSrs = {},
      name_label = delta.vm.name_label,
      srId = this.pool.default_SR,
    } = {}
  ) {
    const { version } = delta

    if (!versionSatisfies(version, '^1')) {
      throw new Error(`Unsupported delta backup version: ${version}`)
    }

    let baseVm
    if (detectBase) {
      const remoteBaseVmUuid = delta.vm.other_config[TAG_BASE_DELTA]
      if (remoteBaseVmUuid) {
        baseVm = find(
          this.objects.all,
          obj =>
            (obj = obj.other_config) && obj[TAG_COPY_SRC] === remoteBaseVmUuid
        )

        if (!baseVm) {
          throw new Error('could not find the base VM')
        }
      }
    }

    const baseVdis = {}
    baseVm &&
      forEach(baseVm.$VBDs, vbd => {
        baseVdis[vbd.VDI] = vbd.$VDI
      })

    // 1. Create the VMs.
    const vm = await this._getOrWaitObject(
      await this._createVmRecord({
        ...delta.vm,
        affinity: null,
        is_a_template: false,
      })
    )
    $defer.onFailure(() => this._deleteVm(vm))

    await Promise.all([
      this._setObjectProperties(vm, {
        name_label: `[Importing…] ${name_label}`,
      }),
      this._updateObjectMapProperty(vm, 'blocked_operations', {
        start: 'Importing…',
      }),
      this._updateObjectMapProperty(vm, 'other_config', {
        [TAG_COPY_SRC]: delta.vm.uuid,
      }),
    ])

    // 2. Delete all VBDs which may have been created by the import.
    await asyncMap(vm.$VBDs, vbd => this._deleteVbd(vbd))::ignoreErrors()

    // 3. Create VDIs & VBDs.
    const vbds = groupBy(delta.vbds, 'VDI')
    const newVdis = await map(delta.vdis, async (vdi, vdiId) => {
      let newVdi

      const remoteBaseVdiUuid = detectBase && vdi.other_config[TAG_BASE_DELTA]
      if (remoteBaseVdiUuid) {
        const baseVdi = find(
          baseVdis,
          vdi => vdi.other_config[TAG_COPY_SRC] === remoteBaseVdiUuid
        )
        if (!baseVdi) {
          throw new Error(`missing base VDI (copy of ${remoteBaseVdiUuid})`)
        }

        newVdi = await this._getOrWaitObject(await this._cloneVdi(baseVdi))
        $defer.onFailure(() => this._deleteVdi(newVdi))

        await this._updateObjectMapProperty(newVdi, 'other_config', {
          [TAG_COPY_SRC]: vdi.uuid,
        })
      } else {
        newVdi = await this.createVdi({
          ...vdi,
          other_config: {
            ...vdi.other_config,
            [TAG_BASE_DELTA]: undefined,
            [TAG_COPY_SRC]: vdi.uuid,
          },
          sr: mapVdisSrs[vdi.uuid] || srId,
        })
        $defer.onFailure(() => this._deleteVdi(newVdi))
      }

      await asyncMap(vbds[vdiId], vbd =>
        this.createVbd({
          ...vbd,
          vdi: newVdi,
          vm,
        })
      )

      return newVdi
    })::pAll()

    const networksByNameLabelByVlan = {}
    let defaultNetwork
    forEach(this.objects.all, object => {
      if (object.$type === 'network') {
        const pif = object.$PIFs[0]
        if (pif === undefined) {
          // ignore network
          return
        }
        const vlan = pif.VLAN
        const networksByNameLabel =
          networksByNameLabelByVlan[vlan] ||
          (networksByNameLabelByVlan[vlan] = {})
        defaultNetwork = networksByNameLabel[object.name_label] = object
      }
    })

    const { streams } = delta
    let transferSize = 0

    await Promise.all([
      // Import VDI contents.
      asyncMap(newVdis, async (vdi, id) => {
        for (let stream of ensureArray(streams[`${id}.vhd`])) {
          if (typeof stream === 'function') {
            stream = await stream()
          }
          const sizeStream = stream
            .pipe(createSizeStream())
            .once('finish', () => {
              transferSize += sizeStream.size
            })
          stream.task = sizeStream.task
          await this._importVdiContent(vdi, sizeStream, VDI_FORMAT_VHD)
        }
      }),

      // Wait for VDI export tasks (if any) termination.
      asyncMap(streams, stream => stream.task),

      // Create VIFs.
      asyncMap(delta.vifs, vif => {
        let network =
          vif.$network$uuid && this.getObject(vif.$network$uuid, undefined)

        if (network === undefined) {
          const { $network$VLAN: vlan = -1 } = vif
          const networksByNameLabel = networksByNameLabelByVlan[vlan]
          if (networksByNameLabel !== undefined) {
            network = networksByNameLabel[vif.$network$name_label]
            if (network === undefined) {
              network = networksByNameLabel[Object.keys(networksByNameLabel)[0]]
            }
          } else {
            network = defaultNetwork
          }
        }

        if (network) {
          return this._createVif(vm, network, vif)
        }
      }),
    ])

    if (deleteBase && baseVm) {
      ;this._deleteVm(baseVm)::ignoreErrors()
    }

    await this._setObjectProperties(vm, { name_label })

    return { transferSize, vm }
  }

  async _migrateVmWithStorageMotion (
    vm,
    hostXapi,
    host,
    {
      migrationNetwork = find(host.$PIFs, pif => pif.management).$network, // TODO: handle not found
      sr,
      mapVdisSrs,
      mapVifsNetworks,
    }
  ) {
    // VDIs/SRs mapping
    const vdis = {}
    const defaultSr = host.$pool.$default_SR
    for (const vbd of vm.$VBDs) {
      const vdi = vbd.$VDI
      if (vbd.type === 'Disk') {
        vdis[vdi.$ref] =
          mapVdisSrs && mapVdisSrs[vdi.$id]
            ? hostXapi.getObject(mapVdisSrs[vdi.$id]).$ref
            : sr !== undefined ? hostXapi.getObject(sr).$ref : defaultSr.$ref // Will error if there are no default SR.
      }
    }

    // VIFs/Networks mapping
    const vifsMap = {}
    if (vm.$pool !== host.$pool) {
      const defaultNetworkRef = find(host.$PIFs, pif => pif.management).$network
        .$ref
      for (const vif of vm.$VIFs) {
        vifsMap[vif.$ref] =
          mapVifsNetworks && mapVifsNetworks[vif.$id]
            ? hostXapi.getObject(mapVifsNetworks[vif.$id]).$ref
            : defaultNetworkRef
      }
    }

    const token = await hostXapi.call(
      'host.migrate_receive',
      host.$ref,
      migrationNetwork.$ref,
      {}
    )

    const loop = () =>
      this.call(
        'VM.migrate_send',
        vm.$ref,
        token,
        true, // Live migration.
        vdis,
        vifsMap,
        {
          force: 'true',
        }
      )::pCatch({ code: 'TOO_MANY_STORAGE_MIGRATES' }, () =>
        pDelay(1e4).then(loop)
      )

    return loop()
  }

  @synchronized
  _callInstallationPlugin (hostRef, vdi) {
    return this.call(
      'host.call_plugin',
      hostRef,
      'install-supp-pack',
      'install',
      { vdi }
    ).catch(error => {
      if (error.code !== 'XENAPI_PLUGIN_FAILURE') {
        console.warn('_callInstallationPlugin', error)
        throw error
      }
    })
  }

  @deferrable
  async installSupplementalPack ($defer, stream, { hostId }) {
    if (!stream.length) {
      throw new Error('stream must have a length')
    }

    const vdi = await this.createTemporaryVdiOnHost(
      stream,
      hostId,
      '[XO] Supplemental pack ISO',
      'small temporary VDI to store a supplemental pack ISO'
    )
    $defer(() => this._deleteVdi(vdi))

    await this._callInstallationPlugin(this.getObject(hostId).$ref, vdi.uuid)
  }

  @deferrable
  async installSupplementalPackOnAllHosts ($defer, stream) {
    if (!stream.length) {
      throw new Error('stream must have a length')
    }

    const isSrAvailable = sr =>
      sr &&
      sr.content_type === 'user' &&
      sr.physical_size - sr.physical_utilisation >= stream.length

    const hosts = filter(this.objects.all, { $type: 'host' })

    const sr = this.findAvailableSharedSr(stream.length)

    // Shared SR available: create only 1 VDI for all the installations
    if (sr) {
      const vdi = await this.createTemporaryVdiOnSr(
        stream,
        sr,
        '[XO] Supplemental pack ISO',
        'small temporary VDI to store a supplemental pack ISO'
      )
      $defer(() => this._deleteVdi(vdi))

      // Install pack sequentially to prevent concurrent access to the unique VDI
      for (const host of hosts) {
        await this._callInstallationPlugin(host.$ref, vdi.uuid)
      }

      return
    }

    // No shared SR available: find an available local SR on each host
    return Promise.all(
      mapToArray(
        hosts,
        deferrable(async ($defer, host) => {
          // pipe stream synchronously to several PassThroughs to be able to pipe them asynchronously later
          const pt = stream.pipe(new PassThrough())
          pt.length = stream.length

          const sr = find(mapToArray(host.$PBDs, '$SR'), isSrAvailable)

          if (!sr) {
            throw new Error('no SR available to store installation file')
          }

          const vdi = await this.createTemporaryVdiOnSr(
            pt,
            sr,
            '[XO] Supplemental pack ISO',
            'small temporary VDI to store a supplemental pack ISO'
          )
          $defer(() => this._deleteVdi(vdi))

          await this._callInstallationPlugin(host.$ref, vdi.uuid)
        })
      )
    )
  }

  @cancelable
  async _importVm ($cancelToken, stream, sr, onVmCreation = undefined) {
    const taskRef = await this.createTask('VM import')
    const query = {}

    let host
    if (sr != null) {
      host = sr.$PBDs[0].$host
      query.sr_id = sr.$ref
    }

    if (onVmCreation != null) {
      ;this._waitObject(
        obj =>
          obj != null &&
          obj.current_operations != null &&
          taskRef in obj.current_operations
      )
        .then(onVmCreation)
        ::ignoreErrors()
    }

    const vmRef = await this.putResource($cancelToken, stream, '/import/', {
      host,
      query,
      task: taskRef,
    }).then(extractOpaqueRef)

    return vmRef
  }

  @deferrable
  async _importOvaVm (
    $defer,
    stream,
    { descriptionLabel, disks, memory, nameLabel, networks, nCpus, tables },
    sr
  ) {
    // 1. Create VM.
    const vm = await this._getOrWaitObject(
      await this._createVmRecord({
        ...OTHER_CONFIG_TEMPLATE,
        memory_dynamic_max: memory,
        memory_dynamic_min: memory,
        memory_static_max: memory,
        name_description: descriptionLabel,
        name_label: nameLabel,
        VCPUs_at_startup: nCpus,
        VCPUs_max: nCpus,
      })
    )
    $defer.onFailure(() => this._deleteVm(vm))
    // Disable start and change the VM name label during import.
    await Promise.all([
      this.addForbiddenOperationToVm(
        vm.$id,
        'start',
        'OVA import in progress...'
      ),
      this._setObjectProperties(vm, {
        name_label: `[Importing...] ${nameLabel}`,
      }),
    ])

    // 2. Create VDIs & Vifs.
    const vdis = {}
    const vifDevices = await this.call('VM.get_allowed_VIF_devices', vm.$ref)
    await Promise.all(
      map(disks, async disk => {
        const vdi = (vdis[disk.path] = await this.createVdi({
          name_description: disk.descriptionLabel,
          name_label: disk.nameLabel,
          size: disk.capacity,
          sr: sr.$ref,
        }))
        $defer.onFailure(() => this._deleteVdi(vdi))

        return this.createVbd({
          userdevice: disk.position,
          vdi,
          vm,
        })
      }).concat(
        map(networks, (networkId, i) =>
          this._createVif(vm, this.getObject(networkId), {
            device: vifDevices[i],
          })
        )
      )
    )

    // 3. Import VDIs contents.
    await new Promise((resolve, reject) => {
      const extract = tarStream.extract()

      stream.on('error', reject)

      extract.on('finish', resolve)
      extract.on('error', reject)
      extract.on('entry', async (entry, stream, cb) => {
        // Not a disk to import.
        const vdi = vdis[entry.name]
        if (!vdi) {
          stream.on('end', cb)
          stream.resume()
          return
        }

        const table = tables[entry.name]
        const vhdStream = await vmdkToVhd(stream, table)
        await this._importVdiContent(vdi, vhdStream, VDI_FORMAT_VHD)

        // See: https://github.com/mafintosh/tar-stream#extracting
        // No import parallelization.
        cb()
      })
      stream.pipe(extract)
    })

    // Enable start and restore the VM name label after import.
    await Promise.all([
      this.removeForbiddenOperationFromVm(vm.$id, 'start'),
      this._setObjectProperties(vm, { name_label: nameLabel }),
    ])
    return vm
  }

  // TODO: an XVA can contain multiple VMs
  async importVm (stream, { data, srId, type = 'xva' } = {}) {
    const sr = srId && this.getObject(srId)

    if (type === 'xva') {
      return /* await */ this._getOrWaitObject(await this._importVm(stream, sr))
    }

    if (type === 'ova') {
      return this._getOrWaitObject(await this._importOvaVm(stream, data, sr))
    }

    throw new Error(`unsupported type: '${type}'`)
  }

  async migrateVm (
    vmId,
    hostXapi,
    hostId,
    { sr, migrationNetworkId, mapVifsNetworks, mapVdisSrs } = {}
  ) {
    const vm = this.getObject(vmId)
    const host = hostXapi.getObject(hostId)

    const accrossPools = vm.$pool !== host.$pool
    const useStorageMotion =
      accrossPools ||
      sr !== undefined ||
      migrationNetworkId !== undefined ||
      !isEmpty(mapVifsNetworks) ||
      !isEmpty(mapVdisSrs)

    if (useStorageMotion) {
      await this._migrateVmWithStorageMotion(vm, hostXapi, host, {
        migrationNetwork:
          migrationNetworkId && hostXapi.getObject(migrationNetworkId),
        sr,
        mapVdisSrs,
        mapVifsNetworks,
      })
    } else {
      try {
        await this.call('VM.pool_migrate', vm.$ref, host.$ref, {
          force: 'true',
        })
      } catch (error) {
        if (error.code !== 'VM_REQUIRES_SR') {
          throw error
        }

        // Retry using motion storage.
        await this._migrateVmWithStorageMotion(vm, hostXapi, host, {})
      }
    }
  }

  @concurrency(2)
  @cancelable
  async _snapshotVm ($cancelToken, vm, nameLabel = vm.name_label) {
    debug(
      `Snapshotting VM ${vm.name_label}${
        nameLabel !== vm.name_label ? ` as ${nameLabel}` : ''
      }`
    )

    let ref
    try {
      ref = await this.callAsync(
        $cancelToken,
        'VM.snapshot_with_quiesce',
        vm.$ref,
        nameLabel
      ).then(extractOpaqueRef)
      this.addTag(ref, 'quiesce')::ignoreErrors()
    } catch (error) {
      const { code } = error
      if (
        code !== 'VM_SNAPSHOT_WITH_QUIESCE_NOT_SUPPORTED' &&
        // quiesce only work on a running VM
        code !== 'VM_BAD_POWER_STATE' &&
        // quiesce failed, fallback on standard snapshot
        // TODO: emit warning
        code !== 'VM_SNAPSHOT_WITH_QUIESCE_FAILED'
      ) {
        throw error
      }
      ref = await this.callAsync(
        $cancelToken,
        'VM.snapshot',
        vm.$ref,
        nameLabel
      ).then(extractOpaqueRef)
    }
    // Convert the template to a VM and wait to have receive the up-
    // to-date object.
    const [, snapshot] = await Promise.all([
      this.call('VM.set_is_a_template', ref, false),
      this.barrier(ref),
    ])

    return snapshot
  }

  async snapshotVm (vmId, nameLabel = undefined) {
    return /* await */ this._snapshotVm(this.getObject(vmId), nameLabel)
  }

  async setVcpuWeight (vmId, weight) {
    weight = weight || null // Take all falsy values as a removal (0 included)
    const vm = this.getObject(vmId)
    await this._updateObjectMapProperty(vm, 'VCPUs_params', { weight })
  }

  async _startVm (vm, force) {
    debug(`Starting VM ${vm.name_label}`)

    if (force) {
      await this._updateObjectMapProperty(vm, 'blocked_operations', {
        start: null,
      })
    }

    return this.call(
      'VM.start',
      vm.$ref,
      false, // Start paused?
      false // Skip pre-boot checks?
    )
  }

  async startVm (vmId, force) {
    try {
      await this._startVm(this.getObject(vmId), force)
    } catch (e) {
      if (e.code === 'OPERATION_BLOCKED') {
        throw forbiddenOperation('Start', e.params[1])
      }
      if (e.code === 'VM_BAD_POWER_STATE') {
        return this.resumeVm(vmId)
      }
      throw e
    }
  }

  async startVmOnCd (vmId) {
    const vm = this.getObject(vmId)

    if (isVmHvm(vm)) {
      const { order } = vm.HVM_boot_params

      await this._updateObjectMapProperty(vm, 'HVM_boot_params', {
        order: 'd',
      })

      try {
        await this._startVm(vm)
      } finally {
        await this._updateObjectMapProperty(vm, 'HVM_boot_params', {
          order,
        })
      }
    } else {
      // Find the original template by name (*sigh*).
      const templateNameLabel = vm.other_config['base_template_name']
      const template =
        templateNameLabel &&
        find(
          this.objects.all,
          obj =>
            obj.$type === 'vm' &&
            obj.is_a_template &&
            obj.name_label === templateNameLabel
        )

      const bootloader = vm.PV_bootloader
      const bootables = []
      try {
        const promises = []

        const cdDrive = this._getVmCdDrive(vm)
        forEach(vm.$VBDs, vbd => {
          promises.push(
            this._setObjectProperties(vbd, {
              bootable: vbd === cdDrive,
            })
          )

          bootables.push([vbd, Boolean(vbd.bootable)])
        })

        promises.push(
          this._setObjectProperties(vm, {
            PV_bootloader: 'eliloader',
          }),
          this._updateObjectMapProperty(vm, 'other_config', {
            'install-distro':
              template && template.other_config['install-distro'],
            'install-repository': 'cdrom',
          })
        )

        await Promise.all(promises)

        await this._startVm(vm)
      } finally {
        ;this._setObjectProperties(vm, {
          PV_bootloader: bootloader,
        })::ignoreErrors()

        forEach(bootables, ([vbd, bootable]) => {
          ;this._setObjectProperties(vbd, { bootable })::ignoreErrors()
        })
      }
    }
  }

  // vm_operations: http://xapi-project.github.io/xen-api/classes/vm.html
  async addForbiddenOperationToVm (vmId, operation, reason) {
    await this.call(
      'VM.add_to_blocked_operations',
      this.getObject(vmId).$ref,
      operation,
      `[XO] ${reason}`
    )
  }

  async removeForbiddenOperationFromVm (vmId, operation) {
    await this.call(
      'VM.remove_from_blocked_operations',
      this.getObject(vmId).$ref,
      operation
    )
  }

  // =================================================================

  async createVbd ({
    bootable = false,
    other_config = {},
    qos_algorithm_params = {},
    qos_algorithm_type = '',
    type = 'Disk',
    unpluggable = false,
    userdevice,
    VDI,
    VM,

    vdi = VDI,

    empty = vdi === undefined,
    mode = type === 'Disk' ? 'RW' : 'RO',
    vm = VM,
  }) {
    vdi = this.getObject(vdi)
    vm = this.getObject(vm)

    debug(`Creating VBD for VDI ${vdi.name_label} on VM ${vm.name_label}`)

    if (userdevice == null) {
      const allowed = await this.call('VM.get_allowed_VBD_devices', vm.$ref)
      const { length } = allowed
      if (length === 0) {
        throw new Error('no allowed VBD devices')
      }

      if (type === 'CD') {
        // Choose position 3 if allowed.
        userdevice = includes(allowed, '3') ? '3' : allowed[0]
      } else {
        userdevice = allowed[0]

        // Avoid userdevice 3 if possible.
        if (userdevice === '3' && length > 1) {
          userdevice = allowed[1]
        }
      }
    }

    // By default a VBD is unpluggable.
    const vbdRef = await this.call('VBD.create', {
      bootable: Boolean(bootable),
      empty: Boolean(empty),
      mode,
      other_config,
      qos_algorithm_params,
      qos_algorithm_type,
      type,
      unpluggable: Boolean(unpluggable),
      userdevice,
      VDI: vdi && vdi.$ref,
      VM: vm.$ref,
    })

    if (isVmRunning(vm)) {
      await this.call('VBD.plug', vbdRef)
    }
  }

  _cloneVdi (vdi) {
    debug(`Cloning VDI ${vdi.name_label}`)

    return this.call('VDI.clone', vdi.$ref)
  }

  async createVdi ({
    name_description,
    name_label,
    other_config = {},
    read_only = false,
    sharable = false,
    sm_config,
    SR,
    tags,
    type = 'user',
    virtual_size,
    xenstore_data,

    size,
    sr = SR !== undefined && SR !== NULL_REF ? SR : this.pool.default_SR,
  }) {
    sr = this.getObject(sr)
    debug(`Creating VDI ${name_label} on ${sr.name_label}`)

    return this._getOrWaitObject(
      await this.call('VDI.create', {
        name_description,
        name_label,
        other_config,
        read_only: Boolean(read_only),
        sharable: Boolean(sharable),
        sm_config,
        SR: sr.$ref,
        tags,
        type,
        virtual_size: size !== undefined ? parseSize(size) : virtual_size,
        xenstore_data,
      })
    )
  }

  async moveVdi (vdiId, srId) {
    const vdi = this.getObject(vdiId)
    const sr = this.getObject(srId)

    if (vdi.SR === sr.$ref) {
      return // nothing to do
    }

    debug(
      `Moving VDI ${vdi.name_label} from ${vdi.$SR.name_label} to ${
        sr.name_label
      }`
    )
    try {
      await this.call('VDI.pool_migrate', vdi.$ref, sr.$ref, {})
    } catch (error) {
      const { code } = error
      if (
        code !== 'LICENCE_RESTRICTION' &&
        code !== 'VDI_NEEDS_VM_FOR_MIGRATE'
      ) {
        throw error
      }
      const newVdi = await this.barrier(
        await this.call('VDI.copy', vdi.$ref, sr.$ref)
      )
      await asyncMap(vdi.$VBDs, vbd =>
        Promise.all([
          this.call('VBD.destroy', vbd.$ref),
          this.createVbd({
            ...vbd,
            vdi: newVdi,
          }),
        ])
      )
      await this._deleteVdi(vdi)
    }
  }

  // TODO: check whether the VDI is attached.
  async _deleteVdi (vdi) {
    debug(`Deleting VDI ${vdi.name_label}`)

    await this.call('VDI.destroy', vdi.$ref)
  }

  _resizeVdi (vdi, size) {
    debug(`Resizing VDI ${vdi.name_label} from ${vdi.virtual_size} to ${size}`)

    return this.call('VDI.resize', vdi.$ref, size)
  }

  _getVmCdDrive (vm) {
    for (const vbd of vm.$VBDs) {
      if (vbd.type === 'CD') {
        return vbd
      }
    }
  }

  async _ejectCdFromVm (vm) {
    const cdDrive = this._getVmCdDrive(vm)
    if (cdDrive) {
      await this.call('VBD.eject', cdDrive.$ref)
    }
  }

  async _insertCdIntoVm (cd, vm, { bootable = false, force = false } = {}) {
    const cdDrive = await this._getVmCdDrive(vm)
    if (cdDrive) {
      try {
        await this.call('VBD.insert', cdDrive.$ref, cd.$ref)
      } catch (error) {
        if (!force || error.code !== 'VBD_NOT_EMPTY') {
          throw error
        }

        await this.call('VBD.eject', cdDrive.$ref)::ignoreErrors()

        // Retry.
        await this.call('VBD.insert', cdDrive.$ref, cd.$ref)
      }

      if (bootable !== Boolean(cdDrive.bootable)) {
        await this._setObjectProperties(cdDrive, { bootable })
      }
    } else {
      await this.createVbd({
        bootable,
        type: 'CD',
        vdi: cd,
        vm,
      })
    }
  }

  async connectVbd (vbdId) {
    await this.call('VBD.plug', vbdId)
  }

  async _disconnectVbd (vbd) {
    // TODO: check if VBD is attached before
    try {
      await this.call('VBD.unplug_force', vbd.$ref)
    } catch (error) {
      if (error.code === 'VBD_NOT_UNPLUGGABLE') {
        await this.call('VBD.set_unpluggable', vbd.$ref, true)
        return this.call('VBD.unplug_force', vbd.$ref)
      }
    }
  }

  async disconnectVbd (vbdId) {
    await this._disconnectVbd(this.getObject(vbdId))
  }

  async _deleteVbd (vbd) {
    await this._disconnectVbd(vbd)::ignoreErrors()
    await this.call('VBD.destroy', vbd.$ref)
  }

  deleteVbd (vbdId) {
    return this._deleteVbd(this.getObject(vbdId))
  }

  // TODO: remove when no longer used.
  async destroyVbdsFromVm (vmId) {
    await Promise.all(
      mapToArray(this.getObject(vmId).$VBDs, async vbd => {
        await this.disconnectVbd(vbd.$ref)::ignoreErrors()
        return this.call('VBD.destroy', vbd.$ref)
      })
    )
  }

  async deleteVdi (vdiId) {
    await this._deleteVdi(this.getObject(vdiId))
  }

  async resizeVdi (vdiId, size) {
    await this._resizeVdi(this.getObject(vdiId), size)
  }

  async ejectCdFromVm (vmId) {
    await this._ejectCdFromVm(this.getObject(vmId))
  }

  async insertCdIntoVm (cdId, vmId, opts = undefined) {
    await this._insertCdIntoVm(this.getObject(cdId), this.getObject(vmId), opts)
  }

  // -----------------------------------------------------------------

  async snapshotVdi (vdiId, nameLabel) {
    const vdi = this.getObject(vdiId)

    const snap = await this._getOrWaitObject(
      await this.call('VDI.snapshot', vdi.$ref)
    )

    if (nameLabel) {
      await this.call('VDI.set_name_label', snap.$ref, nameLabel)
    }

    return snap
  }

  @concurrency(12, stream => stream.then(stream => fromEvent(stream, 'end')))
  @cancelable
  _exportVdi ($cancelToken, vdi, base, format = VDI_FORMAT_VHD) {
    const host = vdi.$SR.$PBDs[0].$host

    const query = {
      format,
      vdi: vdi.$ref,
    }
    if (base) {
      query.base = base.$ref
    }

    debug(
      `exporting VDI ${vdi.name_label}${
        base ? ` (from base ${vdi.name_label})` : ''
      }`
    )

    return this.getResource($cancelToken, '/export_raw_vdi/', {
      host,
      query,
      task: this.createTask('VDI Export', vdi.name_label),
    })
  }

  // -----------------------------------------------------------------

  async _importVdiContent (vdi, body, format = VDI_FORMAT_VHD) {
    const pbd = find(vdi.$SR.$PBDs, 'currently_attached')
    if (pbd === undefined) {
      throw new Error('no valid PBDs found')
    }

    await Promise.all([
      body.task,
      body.checksumVerified,
      this.putResource(body, '/import_raw_vdi/', {
        host: pbd.host,
        query: {
          format,
          vdi: vdi.$ref,
        },
        task: this.createTask('VDI Content Import', vdi.name_label),
      }),
    ])
  }

  importVdiContent (vdiId, body, { format } = {}) {
    return this._importVdiContent(this.getObject(vdiId), body, format)
  }

  // =================================================================

  async _createVif (
    vm,
    network,
    {
      mac = '',
      position = undefined,

      currently_attached = true,
      device = position != null ? String(position) : undefined,
      ipv4_allowed = undefined,
      ipv6_allowed = undefined,
      locking_mode = undefined,
      MAC = mac,
      other_config = {},
      qos_algorithm_params = {},
      qos_algorithm_type = '',
    } = {}
  ) {
    debug(
      `Creating VIF for VM ${vm.name_label} on network ${network.name_label}`
    )

    if (device == null) {
      device = (await this.call('VM.get_allowed_VIF_devices', vm.$ref))[0]
    }

    const vifRef = await this.call(
      'VIF.create',
      filterUndefineds({
        device,
        ipv4_allowed,
        ipv6_allowed,
        locking_mode,
        MAC,
        MTU: asInteger(network.MTU),
        network: network.$ref,
        other_config,
        qos_algorithm_params,
        qos_algorithm_type,
        VM: vm.$ref,
      })
    )

    if (currently_attached && isVmRunning(vm)) {
      await this.call('VIF.plug', vifRef)
    }

    return vifRef
  }

  async createVif (vmId, networkId, opts = undefined) {
    return /* await */ this._getOrWaitObject(
      await this._createVif(
        this.getObject(vmId),
        this.getObject(networkId),
        opts
      )
    )
  }
  @deferrable
  async createNetwork (
    $defer,
    { name, description = 'Created with Xen Orchestra', pifId, mtu, vlan }
  ) {
    const networkRef = await this.call('network.create', {
      name_label: name,
      name_description: description,
      MTU: asInteger(mtu),
      // Set automatic to false so XenCenter does not get confused
      // https://citrix.github.io/xenserver-sdk/#network
      other_config: { automatic: 'false' },
    })
    $defer.onFailure(() => this.call('network.destroy', networkRef))
    if (pifId) {
      await this.call(
        'pool.create_VLAN_from_PIF',
        this.getObject(pifId).$ref,
        networkRef,
        asInteger(vlan)
      )
    }

    return this._getOrWaitObject(networkRef)
  }

  async editPif (pifId, { vlan }) {
    const pif = this.getObject(pifId)
    const physPif = find(
      this.objects.all,
      obj =>
        obj.$type === 'pif' &&
        (obj.physical || !isEmpty(obj.bond_master_of)) &&
        obj.$pool === pif.$pool &&
        obj.device === pif.device
    )

    if (!physPif) {
      throw new Error('PIF not found')
    }

    const pifs = this.getObject(pif.network).$PIFs

    const wasAttached = {}
    forEach(pifs, pif => {
      wasAttached[pif.host] = pif.currently_attached
    })

    const vlans = uniq(mapToArray(pifs, pif => pif.VLAN_master_of))
    await Promise.all(
      mapToArray(
        vlans,
        vlan => vlan !== NULL_REF && this.call('VLAN.destroy', vlan)
      )
    )

    const newPifs = await this.call(
      'pool.create_VLAN_from_PIF',
      physPif.$ref,
      pif.network,
      asInteger(vlan)
    )
    await Promise.all(
      mapToArray(
        newPifs,
        pifRef =>
          !wasAttached[this.getObject(pifRef).host] &&
          this.call('PIF.unplug', pifRef)::ignoreErrors()
      )
    )
  }

  @deferrable
  async createBondedNetwork ($defer, { bondMode, mac = '', pifIds, ...params }) {
    const network = await this.createNetwork(params)
    $defer.onFailure(() => this.deleteNetwork(network))
    // TODO: test and confirm:
    // Bond.create is called here with PIFs from one host but XAPI should then replicate the
    // bond on each host in the same pool with the corresponding PIFs (ie same interface names?).
    await this.call(
      'Bond.create',
      network.$ref,
      map(pifIds, pifId => this.getObject(pifId).$ref),
      mac,
      bondMode
    )

    return network
  }

  async deleteNetwork (networkId) {
    const network = this.getObject(networkId)
    const pifs = network.$PIFs

    const vlans = uniq(mapToArray(pifs, pif => pif.VLAN_master_of))
    await Promise.all(
      mapToArray(
        vlans,
        vlan => vlan !== NULL_REF && this.call('VLAN.destroy', vlan)
      )
    )

    const bonds = uniq(flatten(mapToArray(pifs, pif => pif.bond_master_of)))
    await Promise.all(
      mapToArray(bonds, bond => this.call('Bond.destroy', bond))
    )

    await this.call('network.destroy', network.$ref)
  }

  // =================================================================

  async _doDockerAction (vmId, action, containerId) {
    const vm = this.getObject(vmId)
    const host = vm.$resident_on || this.pool.$master

    return /* await */ this.call(
      'host.call_plugin',
      host.$ref,
      'xscontainer',
      action,
      {
        vmuuid: vm.uuid,
        container: containerId,
      }
    )
  }

  async registerDockerContainer (vmId) {
    await this._doDockerAction(vmId, 'register')
  }

  async deregisterDockerContainer (vmId) {
    await this._doDockerAction(vmId, 'deregister')
  }

  async startDockerContainer (vmId, containerId) {
    await this._doDockerAction(vmId, 'start', containerId)
  }

  async stopDockerContainer (vmId, containerId) {
    await this._doDockerAction(vmId, 'stop', containerId)
  }

  async restartDockerContainer (vmId, containerId) {
    await this._doDockerAction(vmId, 'restart', containerId)
  }

  async pauseDockerContainer (vmId, containerId) {
    await this._doDockerAction(vmId, 'pause', containerId)
  }

  async unpauseDockerContainer (vmId, containerId) {
    await this._doDockerAction(vmId, 'unpause', containerId)
  }

  async getCloudInitConfig (templateId) {
    const template = this.getObject(templateId)
    const host = this.pool.$master

    const config = await this.call(
      'host.call_plugin',
      host.$ref,
      'xscontainer',
      'get_config_drive_default',
      {
        templateuuid: template.uuid,
      }
    )
    return config.slice(4) // FIXME remove the "True" string on the begining
  }

  // Specific CoreOS Config Drive
  async createCoreOsCloudInitConfigDrive (vmId, srId, config) {
    const vm = this.getObject(vmId)
    const host = this.pool.$master
    const sr = this.getObject(srId)

    await this.call(
      'host.call_plugin',
      host.$ref,
      'xscontainer',
      'create_config_drive',
      {
        vmuuid: vm.uuid,
        sruuid: sr.uuid,
        configuration: config,
      }
    )
    await this.registerDockerContainer(vmId)
  }

  // Generic Config Drive
  @deferrable
  async createCloudInitConfigDrive ($defer, vmId, srId, config) {
    const vm = this.getObject(vmId)
    const sr = this.getObject(srId)

    // First, create a small VDI (10MB) which will become the ConfigDrive
    const buffer = fatfsBufferInit()
    const vdi = await this.createVdi({
      name_label: 'XO CloudConfigDrive',
      size: buffer.length,
      sr: sr.$ref,
    })
    $defer.onFailure(() => this._deleteVdi(vdi))

    // Then, generate a FAT fs
    const fs = promisifyAll(fatfs.createFileSystem(fatfsBuffer(buffer)))

    await fs.mkdir('openstack')
    await fs.mkdir('openstack/latest')
    await Promise.all([
      fs.writeFile(
        'openstack/latest/meta_data.json',
        '{\n    "uuid": "' + vm.uuid + '"\n}\n'
      ),
      fs.writeFile('openstack/latest/user_data', config),
    ])

    // ignore errors, I (JFT) don't understand why they are emitted
    // because it works
    await this._importVdiContent(vdi, buffer, VDI_FORMAT_RAW).catch(
      console.warn
    )

    await this.createVbd({ vdi, vm })
  }

  @deferrable
  async createTemporaryVdiOnSr (
    $defer,
    stream,
    sr,
    name_label,
    name_description
  ) {
    const vdi = await this.createVdi({
      name_description,
      name_label,
      size: stream.length,
      sr: sr.$ref,
    })
    $defer.onFailure(() => this._deleteVdi(vdi))

    await this.importVdiContent(vdi.$id, stream, { format: VDI_FORMAT_RAW })

    return vdi
  }

  // Create VDI on an adequate local SR
  async createTemporaryVdiOnHost (stream, hostId, name_label, name_description) {
    const pbd = find(this.getObject(hostId).$PBDs, pbd =>
      canSrHaveNewVdiOfSize(pbd.$SR, stream.length)
    )

    if (pbd == null) {
      throw new Error('no SR available')
    }

    return this.createTemporaryVdiOnSr(
      stream,
      pbd.SR,
      name_label,
      name_description
    )
  }

  findAvailableSharedSr (minSize) {
    return find(
      this.objects.all,
      obj =>
        obj.$type === 'sr' && obj.shared && canSrHaveNewVdiOfSize(obj, minSize)
    )
  }

  // =================================================================
}
