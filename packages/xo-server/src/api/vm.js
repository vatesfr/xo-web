import defer from 'golike-defer'
import { format, JsonRpcError } from 'json-rpc-peer'
import { ignoreErrors } from 'promise-toolbox'
import { assignWith, concat } from 'lodash'
import {
  forbiddenOperation,
  invalidParameters,
  noSuchObject,
  unauthorized,
} from 'xo-common/api-errors'

import { forEach, map, mapFilter, parseSize } from '../utils'

// ===================================================================

export function getHaValues() {
  return ['best-effort', 'restart', '']
}

function checkPermissionOnSrs(vm, permission = 'operate') {
  const permissions = []
  forEach(vm.$VBDs, vbdId => {
    const vbd = this.getObject(vbdId, 'VBD')
    const vdiId = vbd.VDI

    if (vbd.is_cd_drive || !vdiId) {
      return
    }
    return permissions.push([
      this.getObject(vdiId, ['VDI', 'VDI-snapshot']).$SR,
      permission,
    ])
  })

  return this.checkPermissions(this.session.get('user_id'), permissions)
}

// ===================================================================

const extract = (obj, prop) => {
  const value = obj[prop]
  delete obj[prop]
  return value
}

// TODO: Implement ACLs
export async function create(params) {
  const { user } = this
  const resourceSet = extract(params, 'resourceSet')
  const template = extract(params, 'template')
  if (resourceSet === undefined) {
    await this.checkPermissions(this.user.id, [
      [template.$pool, 'administrate'],
    ])
  }

  params.template = template._xapiId

  const xapi = this.getXapi(template)

  const objectIds = [template.id]
  const limits = {
    cpus: template.CPUs.number,
    disk: 0,
    memory: template.memory.dynamic[1],
    vms: 1,
  }
  const vdiSizesByDevice = {}
  let highestDevice = -1
  forEach(xapi.getObject(template._xapiId).$VBDs, vbd => {
    let vdi
    highestDevice = Math.max(highestDevice, vbd.userdevice)
    if (vbd.type === 'Disk' && (vdi = vbd.$VDI)) {
      vdiSizesByDevice[vbd.userdevice] = +vdi.virtual_size
    }
  })

  const vdis = extract(params, 'VDIs')
  params.vdis =
    vdis &&
    map(vdis, vdi => {
      const sr = this.getObject(vdi.SR)
      const size = parseSize(vdi.size)

      objectIds.push(sr.id)
      limits.disk += size

      return {
        ...vdi,
        device: ++highestDevice,
        size,
        SR: sr._xapiId,
        type: vdi.type,
      }
    })

  const existingVdis = extract(params, 'existingDisks')
  params.existingVdis =
    existingVdis &&
    map(existingVdis, (vdi, userdevice) => {
      let size, sr
      if (vdi.size != null) {
        size = parseSize(vdi.size)
        vdiSizesByDevice[userdevice] = size
      }

      if (vdi.$SR) {
        sr = this.getObject(vdi.$SR)
        objectIds.push(sr.id)
      }

      return {
        ...vdi,
        size,
        $SR: sr && sr._xapiId,
      }
    })

  forEach(vdiSizesByDevice, size => (limits.disk += size))

  const vifs = extract(params, 'VIFs')
  params.vifs =
    vifs &&
    map(vifs, vif => {
      const network = this.getObject(vif.network)

      objectIds.push(network.id)

      return {
        mac: vif.mac,
        network: network._xapiId,
        ipv4_allowed: vif.allowedIpv4Addresses,
        ipv6_allowed: vif.allowedIpv6Addresses,
      }
    })

  const installation = extract(params, 'installation')
  params.installRepository = installation && installation.repository

  let checkLimits

  if (resourceSet) {
    await this.checkResourceSetConstraints(resourceSet, user.id, objectIds)
    checkLimits = async limits2 => {
      await this.allocateLimitsInResourceSet(
        assignWith({}, limits, limits2, (l1 = 0, l2) => l1 + l2),
        resourceSet
      )
    }
  }

  const xapiVm = await xapi.createVm(template._xapiId, params, checkLimits)
  await xapiVm.update_other_config('owner', user.id)

  const vm = xapi.xo.addObject(xapiVm)

  if (resourceSet) {
    await Promise.all([
      params.share
        ? Promise.all(
            map((await this.getResourceSet(resourceSet)).subjects, subjectId =>
              this.addAcl(subjectId, vm.id, 'admin')
            )
          )
        : this.addAcl(user.id, vm.id, 'admin'),
      xapi.xo.setData(xapiVm.$id, 'resourceSet', resourceSet),
    ])
  }

  for (const vif of xapiVm.$VIFs) {
    xapi.xo.addObject(vif)
    await this.allocIpAddresses(
      vif.$id,
      concat(vif.ipv4_allowed, vif.ipv6_allowed)
    ).catch(() => xapi.deleteVif(vif))
  }

  if (params.bootAfterCreate) {
    ignoreErrors.call(xapi.startVm(vm._xapiId))
  }

  return vm.id
}

create.params = {
  affinityHost: { type: 'string', optional: true },

  bootAfterCreate: {
    type: 'boolean',
    optional: true,
  },

  cloudConfig: {
    type: 'string',
    optional: true,
  },

  networkConfig: {
    type: 'string',
    optional: true,
  },

  coreOs: {
    type: 'boolean',
    optional: true,
  },

  clone: {
    type: 'boolean',
    optional: true,
  },

  coresPerSocket: {
    type: ['string', 'number'],
    optional: true,
  },

  resourceSet: {
    type: 'string',
    optional: true,
  },

  installation: {
    type: 'object',
    optional: true,
    properties: {
      method: { type: 'string' },
      repository: { type: 'string' },
    },
  },

  vgpuType: {
    type: 'string',
    optional: true,
  },

  gpuGroup: {
    type: 'string',
    optional: true,
  },

  // Name/description of the new VM.
  name_label: { type: 'string' },
  name_description: { type: 'string', optional: true },

  // PV Args
  pv_args: { type: 'string', optional: true },

  share: {
    type: 'boolean',
    optional: true,
  },

  // TODO: add the install repository!
  // VBD.insert/eject
  // Also for the console!

  // UUID of the template the VM will be created from.
  template: { type: 'string' },

  // Virtual interfaces to create for the new VM.
  VIFs: {
    optional: true,
    type: 'array',
    items: {
      type: 'object',
      properties: {
        // UUID of the network to create the interface in.
        network: { type: 'string' },

        mac: {
          optional: true, // Auto-generated per default.
          type: 'string',
        },

        allowedIpv4Addresses: {
          optional: true,
          type: 'array',
          items: { type: 'string' },
        },

        allowedIpv6Addresses: {
          optional: true,
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },

  // Virtual disks to create for the new VM.
  VDIs: {
    optional: true, // If not defined, use the template parameters.
    type: 'array',
    items: {
      type: 'object',
      properties: {
        size: { type: ['integer', 'string'] },
        SR: { type: 'string' },
        type: { type: 'string' },
      },
    },
  },

  // TODO: rename to *existingVdis* or rename *VDIs* to *disks*.
  existingDisks: {
    optional: true,
    type: 'object',

    // Do not for a type object.
    items: {
      type: 'object',
      properties: {
        size: {
          type: ['integer', 'string'],
          optional: true,
        },
        $SR: {
          type: 'string',
          optional: true,
        },
      },
    },
  },

  hvmBootFirmware: { type: 'string', optional: true },

  // other params are passed to `editVm`
  '*': { type: 'any' },
}

create.resolve = {
  template: ['template', 'VM-template', ''],
  vgpuType: ['vgpuType', 'vgpuType', ''],
  gpuGroup: ['gpuGroup', 'gpuGroup', ''],
}

// -------------------------------------------------------------------

async function delete_({
  delete_disks, // eslint-disable-line camelcase
  force,
  forceDeleteDefaultTemplate,
  vm,

  deleteDisks = delete_disks,
}) {
  const xapi = this.getXapi(vm)

  this.getAllAcls().then(acls => {
    return Promise.all(
      mapFilter(acls, acl => {
        if (acl.object === vm.id) {
          return ignoreErrors.call(
            this.removeAcl(acl.subject, acl.object, acl.action)
          )
        }
      })
    )
  })

  // Update IP pools
  await Promise.all(
    map(vm.VIFs, vifId => {
      const vif = xapi.getObject(vifId)
      return ignoreErrors.call(
        this.allocIpAddresses(
          vifId,
          null,
          concat(vif.ipv4_allowed, vif.ipv6_allowed)
        )
      )
    })
  )

  // Update resource sets
  if (
    vm.type === 'VM' && // only regular VMs
    xapi.xo.getData(vm._xapiId, 'resourceSet') != null
  ) {
    this.setVmResourceSet(vm._xapiId, null)::ignoreErrors()
  }

  return xapi.deleteVm(
    vm._xapiId,
    deleteDisks,
    force,
    forceDeleteDefaultTemplate
  )
}

delete_.params = {
  id: { type: 'string' },

  deleteDisks: {
    optional: true,
    type: 'boolean',
  },

  force: {
    optional: true,
    type: 'boolean',
  },

  forceDeleteDefaultTemplate: {
    optional: true,
    type: 'boolean',
  },
}
delete_.resolve = {
  vm: ['id', ['VM', 'VM-snapshot', 'VM-template'], 'administrate'],
}

export { delete_ as delete }

// -------------------------------------------------------------------

export async function ejectCd({ vm }) {
  await this.getXapi(vm).ejectCdFromVm(vm._xapiId)
}

ejectCd.params = {
  id: { type: 'string' },
}

ejectCd.resolve = {
  vm: ['id', 'VM', 'operate'],
}

// -------------------------------------------------------------------

export async function insertCd({ vm, vdi, force = true }) {
  await this.getXapi(vm).insertCdIntoVm(vdi._xapiId, vm._xapiId, { force })
}

insertCd.params = {
  id: { type: 'string' },
  cd_id: { type: 'string' },
  force: { type: 'boolean', optional: true },
}

insertCd.resolve = {
  vm: ['id', 'VM', 'operate'],
  // Not compatible with resource sets.
  // FIXME: find a workaround.
  vdi: ['cd_id', 'VDI', ''],
}

// -------------------------------------------------------------------

export async function migrate({
  vm,
  host,
  sr,
  mapVdisSrs,
  mapVifsNetworks,
  migrationNetwork,
}) {
  let mapVdisSrsXapi, mapVifsNetworksXapi
  const permissions = []

  if (mapVdisSrs) {
    mapVdisSrsXapi = {}
    forEach(mapVdisSrs, (srId, vdiId) => {
      const vdiXapiId = this.getObject(vdiId, ['VDI', 'VDI-snapshot'])._xapiId
      mapVdisSrsXapi[vdiXapiId] = this.getObject(srId, 'SR')._xapiId
      return permissions.push([srId, 'administrate'])
    })
  }

  if (mapVifsNetworks) {
    mapVifsNetworksXapi = {}
    forEach(mapVifsNetworks, (networkId, vifId) => {
      const vifXapiId = this.getObject(vifId, 'VIF')._xapiId
      mapVifsNetworksXapi[vifXapiId] = this.getObject(
        networkId,
        'network'
      )._xapiId
      return permissions.push([networkId, 'administrate'])
    })
  }

  await this.checkPermissions(this.user.id, permissions)

  await this.getXapi(vm).migrateVm(
    vm._xapiId,
    this.getXapi(host),
    host._xapiId,
    {
      sr: sr && this.getObject(sr, 'SR')._xapiId,
      migrationNetworkId:
        migrationNetwork != null ? migrationNetwork._xapiId : undefined,
      mapVifsNetworks: mapVifsNetworksXapi,
      mapVdisSrs: mapVdisSrsXapi,
    }
  )
}

migrate.params = {
  // Identifier of the VM to migrate.
  vm: { type: 'string' },

  // Identifier of the host to migrate to.
  targetHost: { type: 'string' },

  // Identifier of the default SR to migrate to.
  sr: { type: 'string', optional: true },

  // Map VDIs IDs --> SRs IDs
  mapVdisSrs: { type: 'object', optional: true },

  // Map VIFs IDs --> Networks IDs
  mapVifsNetworks: { type: 'object', optional: true },

  // Identifier of the Network use for the migration
  migrationNetwork: { type: 'string', optional: true },
}

migrate.resolve = {
  vm: ['vm', 'VM', 'administrate'],
  host: ['targetHost', 'host', 'administrate'],
  migrationNetwork: ['migrationNetwork', 'network', 'administrate'],
}

// -------------------------------------------------------------------

export async function set(params) {
  const VM = extract(params, 'VM')
  const xapi = this.getXapi(VM)
  const vmId = VM._xapiId

  const resourceSetId = extract(params, 'resourceSet')
  if (resourceSetId !== undefined) {
    if (this.user.permission !== 'admin') {
      throw unauthorized()
    }

    await this.setVmResourceSet(vmId, resourceSetId)
  }

  const share = extract(params, 'share')
  if (share) {
    await this.shareVmResourceSet(vmId)
  }

  return xapi.editVm(vmId, params, async (limits, vm) => {
    const resourceSet = xapi.xo.getData(vm, 'resourceSet')

    if (resourceSet) {
      try {
        return await this.allocateLimitsInResourceSet(limits, resourceSet)
      } catch (error) {
        // if the resource set no longer exist, behave as if the VM is free
        if (!noSuchObject.is(error)) {
          throw error
        }
      }
    }

    if (limits.cpuWeight && this.user.permission !== 'admin') {
      throw unauthorized()
    }
  })
}

set.params = {
  // Identifier of the VM to update.
  id: { type: 'string' },

  auto_poweron: { type: 'boolean', optional: true },

  name_label: { type: 'string', optional: true },

  name_description: { type: 'string', optional: true },

  high_availability: {
    optional: true,
    pattern: new RegExp(`^(${getHaValues().join('|')})$`),
    type: 'string',
  },

  // Number of virtual CPUs to allocate.
  CPUs: { type: 'integer', optional: true },

  cpusMax: { type: ['integer', 'string'], optional: true },

  // Memory to allocate (in bytes).
  //
  // Note: static_min ≤ dynamic_min ≤ dynamic_max ≤ static_max
  memory: { type: ['integer', 'string'], optional: true },

  // Set dynamic_min
  memoryMin: { type: ['integer', 'string'], optional: true },

  // Set dynamic_max
  memoryMax: { type: ['integer', 'string'], optional: true },

  // Set static_max
  memoryStaticMax: { type: ['integer', 'string'], optional: true },

  // Kernel arguments for PV VM.
  PV_args: { type: 'string', optional: true },

  cpuMask: { type: 'array', optional: true },

  cpuWeight: { type: ['integer', 'null'], optional: true },

  cpuCap: { type: ['integer', 'null'], optional: true },

  affinityHost: { type: ['string', 'null'], optional: true },

  // Switch from Cirrus video adaptor to VGA adaptor
  vga: { type: 'string', optional: true },

  videoram: { type: 'number', optional: true },

  coresPerSocket: { type: ['string', 'number', 'null'], optional: true },

  // Emulate HVM C000 PCI device for Windows Update to fetch or update PV drivers
  hasVendorDevice: { type: 'boolean', optional: true },

  expNestedHvm: { type: 'boolean', optional: true },

  // Move the vm In to/Out of Self Service
  resourceSet: { type: ['string', 'null'], optional: true },

  share: { type: 'boolean', optional: true },

  startDelay: { type: 'integer', optional: true },

  // set the VM network interface controller
  nicType: { type: ['string', 'null'], optional: true },

  // set the VM boot firmware mode
  hvmBootFirmware: { type: ['string', 'null'], optional: true },

  virtualizationMode: { type: 'string', optional: true },
}

set.resolve = {
  VM: ['id', ['VM', 'VM-snapshot', 'VM-template'], 'administrate'],
}

// -------------------------------------------------------------------

export async function restart({ vm, force = false }) {
  return this.getXapi(vm).rebootVm(vm._xapiId, { hard: force })
}

restart.params = {
  id: { type: 'string' },
  force: { type: 'boolean', optional: true },
}

restart.resolve = {
  vm: ['id', 'VM', 'operate'],
}

// -------------------------------------------------------------------

export const clone = defer(async function(
  $defer,
  { vm, name, full_copy: fullCopy }
) {
  await checkPermissionOnSrs.call(this, vm)
  const xapi = this.getXapi(vm)

  const xapiVm = await xapi.cloneVm(vm._xapiRef, {
    nameLabel: name,
    fast: !fullCopy,
  })
  $defer.onFailure(() => xapi.deleteVm(xapiVm.$id))
  await xapiVm.update_other_config('owner', this.user.id)

  const isAdmin = this.user.permission === 'admin'
  if (!isAdmin) {
    await this.addAcl(this.user.id, xapiVm.$id, 'admin')
  }

  if (vm.resourceSet !== undefined) {
    await this.allocateLimitsInResourceSet(
      await this.computeVmResourcesUsage(vm),
      vm.resourceSet,
      isAdmin
    )
  }

  return xapiVm.$id
})

clone.params = {
  id: { type: 'string' },
  name: { type: 'string' },
  full_copy: { type: 'boolean' },
}

clone.resolve = {
  vm: ['id', ['VM', 'VM-snapshot'], 'administrate'],
}

// -------------------------------------------------------------------

// TODO: implement resource sets
export async function copy({ compress, name: nameLabel, sr, vm }) {
  if (vm.$pool === sr.$pool) {
    if (vm.power_state === 'Running') {
      await checkPermissionOnSrs.call(this, vm)
    }

    const xapiVm = await this.getXapi(vm).copyVm(vm._xapiId, sr._xapiId, {
      nameLabel,
    })
    await xapiVm.update_other_config('owner', this.user.id)

    return xapiVm.$id
  }

  const { vm: xapiVm } = await this.getXapi(vm).remoteCopyVm(
    vm._xapiId,
    this.getXapi(sr),
    sr._xapiId,
    {
      compress,
      nameLabel,
    }
  )
  await xapiVm.update_other_config('owner', this.user.id)

  return xapiVm.$id
}

copy.params = {
  compress: {
    type: ['boolean', 'string'],
    optional: true,
  },
  name: {
    type: 'string',
    optional: true,
  },
  vm: { type: 'string' },
  sr: { type: 'string' },
}

copy.resolve = {
  vm: ['vm', ['VM', 'VM-snapshot'], 'administrate'],
  sr: ['sr', 'SR', 'operate'],
}

// -------------------------------------------------------------------

export async function convertToTemplate({ vm }) {
  // Convert to a template requires pool admin permission.
  await this.checkPermissions(this.user.id, [[vm.$pool, 'administrate']])

  await this.getXapiObject(vm).set_is_a_template(true)
}

convertToTemplate.params = {
  id: { type: 'string' },
}

convertToTemplate.resolve = {
  vm: ['id', ['VM', 'VM-snapshot'], 'administrate'],
}

// TODO: remove when no longer used.
export { convertToTemplate as convert }

// -------------------------------------------------------------------

// TODO: implement resource sets
export const snapshot = defer(async function(
  $defer,
  {
    vm,
    name = `${vm.name_label}_${new Date().toISOString()}`,
    saveMemory = false,
    description,
  }
) {
  await checkPermissionOnSrs.call(this, vm)

  const xapi = this.getXapi(vm)
  const { $id: snapshotId } = await (saveMemory
    ? xapi.checkpointVm(vm._xapiRef, name)
    : xapi.snapshotVm(vm._xapiRef, name))
  $defer.onFailure(() => xapi.deleteVm(snapshotId))

  if (description !== undefined) {
    await xapi.editVm(snapshotId, { name_description: description })
  }

  const { user } = this
  if (user.permission !== 'admin') {
    await this.addAcl(user.id, snapshotId, 'admin')
  }
  return snapshotId
})

snapshot.params = {
  description: { type: 'string', optional: true },
  id: { type: 'string' },
  name: { type: 'string', optional: true },
  saveMemory: { type: 'boolean', optional: true },
}

snapshot.resolve = {
  vm: ['id', 'VM', 'operate'],
}

// -------------------------------------------------------------------

export function rollingDeltaBackup({
  vm,
  remote,
  tag,
  depth,
  retention = depth,
}) {
  return this.rollingDeltaVmBackup({
    vm,
    remoteId: remote,
    tag,
    retention,
  })
}

rollingDeltaBackup.params = {
  id: { type: 'string' },
  remote: { type: 'string' },
  tag: { type: 'string' },
  retention: { type: ['string', 'number'], optional: true },
  // This parameter is deprecated. It used to support the old saved backups jobs.
  depth: { type: ['string', 'number'], optional: true },
}

rollingDeltaBackup.resolve = {
  vm: ['id', ['VM', 'VM-snapshot'], 'administrate'],
}

rollingDeltaBackup.permission = 'admin'

// -------------------------------------------------------------------

export function importDeltaBackup({ sr, remote, filePath, mapVdisSrs }) {
  const mapVdisSrsXapi = {}

  forEach(mapVdisSrs, (srId, vdiId) => {
    mapVdisSrsXapi[vdiId] = this.getObject(srId, 'SR')._xapiId
  })

  return this.importDeltaVmBackup({
    sr,
    remoteId: remote,
    filePath,
    mapVdisSrs: mapVdisSrsXapi,
  }).then(_ => _.vm)
}

importDeltaBackup.params = {
  sr: { type: 'string' },
  remote: { type: 'string' },
  filePath: { type: 'string' },
  // Map VDIs UUIDs --> SRs IDs
  mapVdisSrs: { type: 'object', optional: true },
}

importDeltaBackup.resolve = {
  sr: ['sr', 'SR', 'operate'],
}

importDeltaBackup.permission = 'admin'

// -------------------------------------------------------------------

export function deltaCopy({ force, vm, retention, sr }) {
  return this.deltaCopyVm(vm, sr, force, retention)
}

deltaCopy.params = {
  force: { type: 'boolean', optional: true },
  id: { type: 'string' },
  retention: { type: 'number', optional: true },
  sr: { type: 'string' },
}

deltaCopy.resolve = {
  vm: ['id', 'VM', 'operate'],
  sr: ['sr', 'SR', 'operate'],
}

// -------------------------------------------------------------------

export async function rollingSnapshot({ vm, tag, depth, retention = depth }) {
  await checkPermissionOnSrs.call(this, vm)
  return this.rollingSnapshotVm(vm, tag, retention)
}

rollingSnapshot.params = {
  id: { type: 'string' },
  tag: { type: 'string' },
  retention: { type: 'number', optional: true },
  // This parameter is deprecated. It used to support the old saved backups jobs.
  depth: { type: 'number', optional: true },
}

rollingSnapshot.resolve = {
  vm: ['id', 'VM', 'administrate'],
}

rollingSnapshot.description =
  'Snapshots a VM with a tagged name, and removes the oldest snapshot with the same tag according to retention'

// -------------------------------------------------------------------

export function backup({ vm, remoteId, file, compress }) {
  return this.backupVm({ vm, remoteId, file, compress })
}

backup.permission = 'admin'

backup.params = {
  id: { type: 'string' },
  remoteId: { type: 'string' },
  file: { type: 'string' },
  compress: { type: 'boolean', optional: true },
}

backup.resolve = {
  vm: ['id', 'VM', 'administrate'],
}

backup.description = 'Exports a VM to the file system'

// -------------------------------------------------------------------

export function importBackup({ remote, file, sr }) {
  return this.importVmBackup(remote, file, sr)
}

importBackup.permission = 'admin'
importBackup.description =
  'Imports a VM into host, from a file found in the chosen remote'
importBackup.params = {
  remote: { type: 'string' },
  file: { type: 'string' },
  sr: { type: 'string' },
}

importBackup.resolve = {
  sr: ['sr', 'SR', 'operate'],
}

importBackup.permission = 'admin'

// -------------------------------------------------------------------

export function rollingBackup({
  vm,
  remoteId,
  tag,
  depth,
  retention = depth,
  compress,
}) {
  return this.rollingBackupVm({
    vm,
    remoteId,
    tag,
    retention,
    compress,
  })
}

rollingBackup.permission = 'admin'

rollingBackup.params = {
  id: { type: 'string' },
  remoteId: { type: 'string' },
  tag: { type: 'string' },
  retention: { type: 'number', optional: true },
  // This parameter is deprecated. It used to support the old saved backups jobs.
  depth: { type: 'number', optional: true },
  compress: { type: 'boolean', optional: true },
}

rollingBackup.resolve = {
  vm: ['id', ['VM', 'VM-snapshot'], 'administrate'],
}

rollingBackup.description =
  'Exports a VM to the file system with a tagged name, and removes the oldest backup with the same tag according to retention'

// -------------------------------------------------------------------

export function rollingDrCopy({
  vm,
  pool,
  sr,
  tag,
  depth,
  retention = depth,
  deleteOldBackupsFirst,
}) {
  if (sr === undefined) {
    if (pool === undefined) {
      throw invalidParameters('either pool or sr param should be specified')
    }

    if (vm.$pool === pool.id) {
      throw forbiddenOperation(
        'Disaster Recovery attempts to copy on the same pool'
      )
    }

    sr = this.getObject(pool.default_SR, 'SR')
  }

  return this.rollingDrCopyVm({
    vm,
    sr,
    tag,
    retention,
    deleteOldBackupsFirst,
  })
}

rollingDrCopy.params = {
  retention: { type: 'number', optional: true },
  // This parameter is deprecated. It used to support the old saved backups jobs.
  depth: { type: 'number', optional: true },
  id: { type: 'string' },
  pool: { type: 'string', optional: true },
  sr: { type: 'string', optional: true },
  tag: { type: 'string' },
  deleteOldBackupsFirst: { type: 'boolean', optional: true },
}

rollingDrCopy.resolve = {
  vm: ['id', ['VM', 'VM-snapshot'], 'administrate'],
  pool: ['pool', 'pool', 'administrate'],
  sr: ['sr', 'SR', 'administrate'],
}

rollingDrCopy.description =
  'Copies a VM to a different pool, with a tagged name, and removes the oldest VM with the same tag from this pool, according to retention'

// -------------------------------------------------------------------

export function start({ vm, force, host }) {
  return this.getXapi(vm).startVm(vm._xapiId, host?._xapiId, force)
}

start.params = {
  force: { type: 'boolean', optional: true },
  host: { type: 'string', optional: true },
  id: { type: 'string' },
}

start.resolve = {
  host: ['host', 'host', 'operate'],
  vm: ['id', 'VM', 'operate'],
}

// -------------------------------------------------------------------

// TODO: implements timeout.
// - if !force → clean shutdown
// - if force is true → hard shutdown
// - if force is integer → clean shutdown and after force seconds, hard shutdown.
export async function stop({ vm, force }) {
  const xapi = this.getXapi(vm)

  // Hard shutdown
  if (force) {
    return xapi.shutdownVm(vm._xapiRef, { hard: true })
  }

  // Clean shutdown
  try {
    await xapi.shutdownVm(vm._xapiRef)
  } catch (error) {
    const { code } = error
    if (
      code === 'VM_MISSING_PV_DRIVERS' ||
      code === 'VM_LACKS_FEATURE_SHUTDOWN'
    ) {
      throw invalidParameters('clean shutdown requires PV drivers')
    }

    throw error
  }
}

stop.params = {
  id: { type: 'string' },
  force: { type: 'boolean', optional: true },
}

stop.resolve = {
  vm: ['id', 'VM', 'operate'],
}

// -------------------------------------------------------------------

export async function suspend({ vm }) {
  await this.getXapi(vm).callAsync('VM.suspend', vm._xapiRef)
}

suspend.params = {
  id: { type: 'string' },
}

suspend.resolve = {
  vm: ['id', 'VM', 'operate'],
}

// -------------------------------------------------------------------

export async function pause({ vm }) {
  await this.getXapi(vm).callAsync('VM.pause', vm._xapiRef)
}

pause.params = {
  id: { type: 'string' },
}

pause.resolve = {
  vm: ['id', 'VM', 'operate'],
}

// -------------------------------------------------------------------

export function resume({ vm }) {
  return this.getXapi(vm).resumeVm(vm._xapiId)
}

resume.params = {
  id: { type: 'string' },
}

resume.resolve = {
  vm: ['id', 'VM', 'operate'],
}

// -------------------------------------------------------------------

export async function revert({ snapshot, snapshotBefore }) {
  await this.checkPermissions(this.user.id, [
    [snapshot.$snapshot_of, 'operate'],
  ])
  return this.getXapi(snapshot).revertVm(snapshot._xapiId, snapshotBefore)
}

revert.params = {
  snapshot: { type: 'string' },
  snapshotBefore: { type: 'boolean', optional: true },
}

revert.resolve = {
  snapshot: ['snapshot', 'VM-snapshot', 'view'],
}

// -------------------------------------------------------------------

async function handleExport(req, res, { xapi, id, compress }) {
  const stream = await xapi.exportVm(id, {
    compress,
  })
  res.on('close', () => stream.cancel())
  // Remove the filename as it is already part of the URL.
  stream.headers['content-disposition'] = 'attachment'

  res.writeHead(
    stream.statusCode,
    stream.statusMessage != null ? stream.statusMessage : '',
    stream.headers
  )
  stream.pipe(res)
}

// TODO: integrate in xapi.js
async function export_({ vm, compress }) {
  if (vm.power_state === 'Running') {
    await checkPermissionOnSrs.call(this, vm)
  }

  const data = {
    xapi: this.getXapi(vm),
    id: vm._xapiId,
    compress,
  }

  return {
    $getFrom: await this.registerHttpRequest(handleExport, data, {
      suffix: encodeURI(`/${vm.name_label}.xva`),
    }),
  }
}

export_.params = {
  vm: { type: 'string' },
  compress: { type: ['boolean', 'string'], optional: true },
}

export_.resolve = {
  vm: ['vm', ['VM', 'VM-snapshot'], 'administrate'],
}

export { export_ as export }

// -------------------------------------------------------------------

async function handleVmImport(req, res, { data, srId, type, xapi }) {
  // Timeout seems to be broken in Node 4.
  // See https://github.com/nodejs/node/issues/3319
  req.setTimeout(43200000) // 12 hours

  try {
    const vm = await xapi.importVm(req, { data, srId, type })
    res.end(format.response(0, vm.$id))
  } catch (e) {
    res.writeHead(500)
    res.end(format.error(0, new JsonRpcError(e.message)))
  }
}

// TODO: "sr_id" can be passed in URL to target a specific SR
async function import_({ data, sr, type }) {
  if (data && type === 'xva') {
    throw invalidParameters('unsupported field data for the file type xva')
  }

  return {
    $sendTo: await this.registerHttpRequest(handleVmImport, {
      data,
      srId: sr._xapiId,
      type,
      xapi: this.getXapi(sr),
    }),
  }
}

import_.params = {
  data: {
    type: 'object',
    optional: true,
    properties: {
      descriptionLabel: { type: 'string' },
      disks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            capacity: { type: 'integer' },
            descriptionLabel: { type: 'string' },
            nameLabel: { type: 'string' },
            path: { type: 'string' },
            position: { type: 'integer' },
          },
        },
        optional: true,
      },
      memory: { type: 'integer' },
      nameLabel: { type: 'string' },
      nCpus: { type: 'integer' },
      networks: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
      },
    },
  },
  type: { type: 'string', optional: true },
  sr: { type: 'string' },
}

import_.resolve = {
  sr: ['sr', 'SR', 'administrate'],
}

export { import_ as import }

// -------------------------------------------------------------------

// FIXME: if position is used, all other disks after this position
// should be shifted.
export async function attachDisk({ vm, vdi, position, mode, bootable }) {
  await this.getXapi(vm).createVbd({
    bootable,
    mode,
    userdevice: position,
    vdi: vdi._xapiId,
    vm: vm._xapiId,
  })
}

attachDisk.params = {
  bootable: {
    type: 'boolean',
    optional: true,
  },
  mode: { type: 'string', optional: true },
  position: { type: 'string', optional: true },
  vdi: { type: 'string' },
  vm: { type: 'string' },
}

attachDisk.resolve = {
  vm: ['vm', 'VM', 'administrate'],
  vdi: ['vdi', 'VDI', 'administrate'],
}

// -------------------------------------------------------------------

// TODO: implement resource sets
export async function createInterface({
  vm,
  network,
  position,
  mac,
  allowedIpv4Addresses,
  allowedIpv6Addresses,
}) {
  const { resourceSet } = vm
  if (resourceSet != null) {
    await this.checkResourceSetConstraints(resourceSet, this.user.id, [
      network.id,
    ])
  } else {
    await this.checkPermissions(this.user.id, [[network.id, 'view']])
  }

  let ipAddresses
  const vif = await this.getXapi(vm).createVif(vm._xapiId, network._xapiId, {
    mac,
    position,
    ipv4_allowed: allowedIpv4Addresses,
    ipv6_allowed: allowedIpv6Addresses,
  })

  const { push } = (ipAddresses = [])
  if (allowedIpv4Addresses) {
    push.apply(ipAddresses, allowedIpv4Addresses)
  }
  if (allowedIpv6Addresses) {
    push.apply(ipAddresses, allowedIpv6Addresses)
  }
  if (ipAddresses.length) {
    ignoreErrors.call(this.allocIpAddresses(vif.$id, ipAddresses))
  }

  return vif.$id
}

createInterface.params = {
  vm: { type: 'string' },
  network: { type: 'string' },
  position: { type: ['integer', 'string'], optional: true },
  mac: { type: 'string', optional: true },
  allowedIpv4Addresses: {
    type: 'array',
    items: {
      type: 'string',
    },
    optional: true,
  },
  allowedIpv6Addresses: {
    type: 'array',
    items: {
      type: 'string',
    },
    optional: true,
  },
}

createInterface.resolve = {
  // Not compatible with resource sets.
  // FIXME: find a workaround.
  network: ['network', 'network', ''],
  vm: ['vm', 'VM', 'administrate'],
}

// -------------------------------------------------------------------

export async function attachPci({ vm, pciId }) {
  await this.getXapiObject(vm).update_other_config('pci', pciId)
}

attachPci.params = {
  vm: { type: 'string' },
  pciId: { type: 'string' },
}

attachPci.resolve = {
  vm: ['vm', 'VM', 'administrate'],
}

// -------------------------------------------------------------------

export async function detachPci({ vm }) {
  await this.getXapiObject(vm).update_other_config('pci', null)
}

detachPci.params = {
  vm: { type: 'string' },
}

detachPci.resolve = {
  vm: ['vm', 'VM', 'administrate'],
}
// -------------------------------------------------------------------

export function stats({ vm, granularity }) {
  return this.getXapiVmStats(vm._xapiId, granularity)
}

stats.description = 'returns statistics about the VM'

stats.params = {
  id: { type: 'string' },
  granularity: {
    type: 'string',
    optional: true,
  },
}

stats.resolve = {
  vm: ['id', ['VM', 'VM-snapshot'], 'view'],
}

// -------------------------------------------------------------------

export async function setBootOrder({ vm, order }) {
  if (vm.virtualizationMode !== 'hvm') {
    throw invalidParameters('You can only set the boot order on a HVM guest')
  }

  await this.getXapiObject(vm).update_HVM_boot_params('order', order)
}

setBootOrder.params = {
  vm: { type: 'string' },
  order: { type: 'string' },
}

setBootOrder.resolve = {
  vm: ['vm', 'VM', 'operate'],
}

// -------------------------------------------------------------------

export function recoveryStart({ vm }) {
  return this.getXapi(vm).startVmOnCd(vm._xapiId)
}

recoveryStart.params = {
  id: { type: 'string' },
}

recoveryStart.resolve = {
  vm: ['id', 'VM', 'operate'],
}

// -------------------------------------------------------------------

export function getCloudInitConfig({ template }) {
  return this.getXapi(template).getCloudInitConfig(template._xapiId)
}

getCloudInitConfig.params = {
  template: { type: 'string' },
}

getCloudInitConfig.resolve = {
  template: ['template', 'VM-template', 'administrate'],
}

// -------------------------------------------------------------------

export async function createCloudInitConfigDrive({
  config,
  coreos,
  networkConfig,
  sr,
  vm,
}) {
  const xapi = this.getXapi(vm)
  if (coreos) {
    // CoreOS is a special CloudConfig drive created by XS plugin
    await xapi.createCoreOsCloudInitConfigDrive(vm._xapiId, sr._xapiId, config)
  } else {
    // use generic Cloud Init drive
    await xapi.createCloudInitConfigDrive(
      vm._xapiId,
      sr._xapiId,
      config,
      networkConfig
    )
  }
}

createCloudInitConfigDrive.params = {
  vm: { type: 'string' },
  sr: { type: 'string' },
  config: { type: 'string' },
  networkConfig: { type: 'string', optional: true },
}

createCloudInitConfigDrive.resolve = {
  vm: ['vm', 'VM', 'administrate'],

  // Not compatible with resource sets.
  // FIXME: find a workaround.
  sr: ['sr', 'SR', ''], // 'operate' ]
}

// -------------------------------------------------------------------

export async function createVgpu({ vm, gpuGroup, vgpuType }) {
  // TODO: properly handle device. Can a VM have 2 vGPUS?
  await this.getXapi(vm).createVgpu(
    vm._xapiId,
    gpuGroup._xapiId,
    vgpuType._xapiId
  )
}

createVgpu.params = {
  vm: { type: 'string' },
  gpuGroup: { type: 'string' },
  vgpuType: { type: 'string' },
}

createVgpu.resolve = {
  vm: ['vm', 'VM', 'administrate'],
  gpuGroup: ['gpuGroup', 'gpuGroup', ''],
  vgpuType: ['vgpuType', 'vgpuType', ''],
}

// -------------------------------------------------------------------

export async function deleteVgpu({ vgpu }) {
  await this.getXapi(vgpu).deleteVgpu(vgpu._xapiId)
}

deleteVgpu.params = {
  vgpu: { type: 'string' },
}

deleteVgpu.resolve = {
  vgpu: ['vgpu', 'vgpu', ''],
}
