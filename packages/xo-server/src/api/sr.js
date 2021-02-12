import asyncMap from '@xen-orchestra/async-map'
import { some } from 'lodash'

import ensureArray from '../_ensureArray'
import { asInteger } from '../xapi/utils'
import { forEach, parseXml } from '../utils'

// ===================================================================

export async function set({
  sr,

  name_description: nameDescription,
  name_label: nameLabel,
}) {
  sr = this.getXapiObject(sr)

  await Promise.all([
    nameDescription !== undefined && sr.set_name_description(nameDescription),
    nameLabel !== undefined && sr.set_name_label(nameLabel),
  ])
}

set.params = {
  id: { type: 'string' },

  name_label: { type: 'string', optional: true },

  name_description: { type: 'string', optional: true },
}

set.resolve = {
  sr: ['id', 'SR', 'operate'],
}

// -------------------------------------------------------------------

export async function scan({ SR }) {
  await this.getXapi(SR).callAsync('SR.scan', SR._xapiRef)
}

scan.params = {
  id: { type: 'string' },
}

scan.resolve = {
  SR: ['id', 'SR', 'operate'],
}

// -------------------------------------------------------------------
const srIsBackingHa = sr => sr.$pool.ha_enabled && some(sr.$pool.$ha_statefiles, f => f.$SR === sr)

// TODO: find a way to call this "delete" and not destroy
export async function destroy({ sr }) {
  const xapi = this.getXapi(sr)
  if (sr.SR_type !== 'xosan') {
    await xapi.destroySr(sr._xapiId)
    return
  }
  const xapiSr = xapi.getObject(sr)
  if (srIsBackingHa(xapiSr)) {
    throw new Error('You tried to remove a SR the High Availability is relying on. Please disable HA first.')
  }
  const config = xapi.xo.getData(sr, 'xosan_config')
  // we simply forget because the hosted disks are being destroyed with the VMs
  await xapi.forgetSr(sr._xapiId)
  await asyncMap(config.nodes, node => xapi.deleteVm(node.vm.id))
  await xapi.deleteNetwork(config.network)
  if (sr.SR_type === 'xosan') {
    await this.unbindXosanLicense({ srId: sr.id })
  }
}

destroy.params = {
  id: { type: 'string' },
}

destroy.resolve = {
  sr: ['id', 'SR', 'administrate'],
}

// -------------------------------------------------------------------

export async function forget({ SR }) {
  await this.getXapi(SR).forgetSr(SR._xapiId)
}

forget.params = {
  id: { type: 'string' },
}

forget.resolve = {
  SR: ['id', 'SR', 'administrate'],
}

// -------------------------------------------------------------------

export async function connectAllPbds({ SR }) {
  await this.getXapi(SR).connectAllSrPbds(SR._xapiId)
}

connectAllPbds.params = {
  id: { type: 'string' },
}

connectAllPbds.resolve = {
  SR: ['id', 'SR', 'administrate'],
}

// -------------------------------------------------------------------

export async function disconnectAllPbds({ SR }) {
  await this.getXapi(SR).disconnectAllSrPbds(SR._xapiId)
}

disconnectAllPbds.params = {
  id: { type: 'string' },
}

disconnectAllPbds.resolve = {
  SR: ['id', 'SR', 'administrate'],
}

// -------------------------------------------------------------------

export async function createIso({ host, nameLabel, nameDescription, path, type, user, password, srUuid }) {
  const xapi = this.getXapi(host)

  const deviceConfig = {}
  if (type === 'local') {
    deviceConfig.legacy_mode = 'true'
  } else if (type === 'smb') {
    path = path.replace(/\\/g, '/')
    deviceConfig.type = 'cifs'
    deviceConfig.username = user
    deviceConfig.cifspassword = password
  }

  deviceConfig.location = path

  // Reattach
  if (srUuid !== undefined) {
    return xapi.reattachSr({
      uuid: srUuid,
      nameLabel,
      nameDescription,
      type,
      deviceConfig,
    })
  }

  const srRef = await xapi.call(
    'SR.create',
    host._xapiRef,
    deviceConfig,
    '0', // SR size 0 because ISO
    nameLabel,
    nameDescription,
    'iso', // SR type ISO
    'iso', // SR content type ISO
    type !== 'local',
    {}
  )

  const sr = await xapi.call('SR.get_record', srRef)
  return sr.uuid
}

createIso.params = {
  host: { type: 'string' },
  nameLabel: { type: 'string' },
  nameDescription: { type: 'string' },
  path: { type: 'string' },
  type: { type: 'string' },
  user: { type: 'string', optional: true },
  password: { type: 'string', optional: true },
  srUuid: { type: 'string', optional: true },
}

createIso.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// NFS SR

// This functions creates a NFS SR

export async function createNfs({
  host,
  nameLabel,
  nameDescription,
  server,
  serverPath,
  nfsVersion,
  nfsOptions,
  srUuid,
}) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    server,
    serverpath: serverPath,
  }

  //  if NFS version given
  if (nfsVersion) {
    deviceConfig.nfsversion = nfsVersion
  }

  //  if NFS options given
  if (nfsOptions) {
    deviceConfig.options = nfsOptions
  }

  // Reattach
  if (srUuid !== undefined) {
    return xapi.reattachSr({
      uuid: srUuid,
      nameLabel,
      nameDescription,
      type: 'nfs',
      deviceConfig,
    })
  }

  const srRef = await xapi.call(
    'SR.create',
    host._xapiRef,
    deviceConfig,
    '0',
    nameLabel,
    nameDescription,
    'nfs', // SR LVM over iSCSI
    'user', // recommended by Citrix
    true,
    {}
  )

  const sr = await xapi.call('SR.get_record', srRef)
  return sr.uuid
}

createNfs.params = {
  host: { type: 'string' },
  nameLabel: { type: 'string' },
  nameDescription: { type: 'string' },
  server: { type: 'string' },
  serverPath: { type: 'string' },
  nfsVersion: { type: 'string', optional: true },
  nfsOptions: { type: 'string', optional: true },
  srUuid: { type: 'string', optional: true },
}

createNfs.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// HBA SR

// This functions creates an HBA SR

export async function createHba({ host, nameLabel, nameDescription, scsiId, srUuid }) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    SCSIid: scsiId,
  }

  // Reattach
  if (srUuid !== undefined) {
    return xapi.reattachSr({
      uuid: srUuid,
      nameLabel,
      nameDescription,
      type: 'hba',
      deviceConfig,
    })
  }

  const srRef = await xapi.call(
    'SR.create',
    host._xapiRef,
    deviceConfig,
    '0',
    nameLabel,
    nameDescription,
    'lvmohba', // SR LVM over HBA
    'user', // recommended by Citrix
    true,
    {}
  )

  const sr = await xapi.call('SR.get_record', srRef)
  return sr.uuid
}

createHba.params = {
  host: { type: 'string' },
  nameLabel: { type: 'string' },
  nameDescription: { type: 'string' },
  scsiId: { type: 'string' },
  srUuid: { type: 'string', optional: true },
}

createHba.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// Local LVM SR

// This functions creates a local LVM SR

export async function createLvm({ host, nameLabel, nameDescription, device }) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    device,
  }

  const srRef = await xapi.call(
    'SR.create',
    host._xapiRef,
    deviceConfig,
    '0',
    nameLabel,
    nameDescription,
    'lvm', // SR LVM
    'user', // recommended by Citrix
    false,
    {}
  )

  const sr = await xapi.call('SR.get_record', srRef)
  return sr.uuid
}

createLvm.params = {
  host: { type: 'string' },
  nameLabel: { type: 'string' },
  nameDescription: { type: 'string' },
  device: { type: 'string' },
}

createLvm.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// Local ext SR

// This functions creates a local ext SR

export async function createExt({ host, nameLabel, nameDescription, device }) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    device,
  }

  const srRef = await xapi.call(
    'SR.create',
    host._xapiRef,
    deviceConfig,
    '0',
    nameLabel,
    nameDescription,
    'ext', // SR ext
    'user', // recommended by Citrix
    false,
    {}
  )

  const sr = await xapi.call('SR.get_record', srRef)
  return sr.uuid
}

createExt.params = {
  host: { type: 'string' },
  nameLabel: { type: 'string' },
  nameDescription: { type: 'string' },
  device: { type: 'string' },
}

createExt.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// This function helps to detect all ZFS pools
// Return a dict of pools with their parameters { <poolname>: {<paramdict>}}
// example output (the parameter mountpoint is of interest):
// {"tank":
// {
//    "setuid": "on", "relatime": "off", "referenced": "24K", "written": "24K", "zoned": "off", "primarycache": "all",
//    "logbias": "latency", "creation": "Mon May 27 17:24 2019", "sync": "standard", "snapdev": "hidden",
//    "dedup": "off", "sharenfs": "off", "usedbyrefreservation": "0B", "sharesmb": "off", "createtxg": "1",
//    "canmount": "on", "mountpoint": "/tank", "casesensitivity": "sensitive", "utf8only": "off", "xattr": "on",
//    "dnodesize": "legacy", "mlslabel": "none", "objsetid": "54", "defcontext": "none", "rootcontext": "none",
//    "mounted": "yes", "compression": "off", "overlay": "off", "logicalused": "47K", "usedbysnapshots": "0B",
//    "filesystem_count": "none", "copies": "1", "snapshot_limit": "none", "aclinherit": "restricted",
//    "compressratio": "1.00x", "readonly": "off", "version": "5", "normalization": "none", "filesystem_limit": "none",
//    "type": "filesystem", "secondarycache": "all", "refreservation": "none", "available": "17.4G", "used": "129K",
//    "exec": "on", "refquota": "none", "refcompressratio": "1.00x", "quota": "none", "keylocation": "none",
//    "snapshot_count": "none", "fscontext": "none", "vscan": "off", "reservation": "none", "atime": "on",
//    "recordsize": "128K", "usedbychildren": "105K", "usedbydataset": "24K", "guid": "656061077639704004",
//    "pbkdf2iters": "0", "checksum": "on", "special_small_blocks": "0", "redundant_metadata": "all",
//    "volmode": "default", "devices": "on", "keyformat": "none", "logicalreferenced": "12K", "acltype": "off",
//    "nbmand": "off", "context": "none", "encryption": "off", "snapdir": "hidden"}}
export async function probeZfs({ host }) {
  const xapi = this.getXapi(host)
  try {
    const result = await xapi.call('host.call_plugin', host._xapiRef, 'zfs.py', 'list_zfs_pools', {})
    return JSON.parse(result)
  } catch (error) {
    if (error.code === 'XENAPI_MISSING_PLUGIN' || error.code === 'UNKNOWN_XENAPI_PLUGIN_FUNCTION') {
      return {}
    } else {
      throw error
    }
  }
}

probeZfs.params = {
  host: { type: 'string' },
}

probeZfs.resolve = {
  host: ['host', 'host', 'administrate'],
}

export async function createZfs({ host, nameLabel, nameDescription, location }) {
  const xapi = this.getXapi(host)
  // only XCP-ng >=8.2 support the ZFS SR
  const types = await xapi.call('SR.get_supported_types')
  return xapi.createSr({
    hostRef: host._xapiRef,
    name_label: nameLabel,
    name_description: nameDescription,
    type: types.includes('zfs') ? 'zfs' : 'file',
    device_config: { location },
  })
}

createZfs.params = {
  host: { type: 'string' },
  nameLabel: { type: 'string' },
  nameDescription: { type: 'string' },
  location: { type: 'string' },
}

createZfs.resolve = {
  host: ['host', 'host', 'administrate'],
}
// -------------------------------------------------------------------
// This function helps to detect all NFS shares (exports) on a NFS server
// Return a table of exports with their paths and ACLs

export async function probeNfs({ host, server }) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    server,
  }

  let xml

  try {
    await xapi.call('SR.probe', host._xapiRef, deviceConfig, 'nfs', {})

    throw new Error('the call above should have thrown an error')
  } catch (error) {
    if (error.code !== 'SR_BACKEND_FAILURE_101') {
      throw error
    }

    xml = parseXml(error.params[2])
  }

  const nfsExports = []
  forEach(ensureArray(xml['nfs-exports'].Export), nfsExport => {
    nfsExports.push({
      path: nfsExport.Path.trim(),
      acl: nfsExport.Accesslist.trim(),
    })
  })

  return nfsExports
}

probeNfs.params = {
  host: { type: 'string' },
  server: { type: 'string' },
}

probeNfs.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// This function helps to detect all HBA devices on the host

export async function probeHba({ host }) {
  const xapi = this.getXapi(host)

  let xml

  try {
    await xapi.call('SR.probe', host._xapiRef, {}, 'lvmohba', {})

    throw new Error('the call above should have thrown an error')
  } catch (error) {
    if (error.code !== 'SR_BACKEND_FAILURE_107') {
      throw error
    }

    xml = parseXml(error.params[2])
  }

  const hbaDevices = []
  forEach(ensureArray(xml.Devlist.BlockDevice), hbaDevice => {
    hbaDevices.push({
      hba: hbaDevice.hba.trim(),
      id: hbaDevice.id.trim(),
      path: hbaDevice.path.trim(),
      scsiId: hbaDevice.SCSIid.trim(),
      serial: hbaDevice.serial.trim(),
      size: +hbaDevice.size.trim(),
      vendor: hbaDevice.vendor.trim(),
    })
  })

  return hbaDevices
}

probeHba.params = {
  host: { type: 'string' },
}

probeHba.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// ISCSI SR

// This functions creates a iSCSI SR

export async function createIscsi({
  host,
  nameLabel,
  nameDescription,
  size,
  target,
  port,
  targetIqn,
  scsiId,
  chapUser,
  chapPassword,
  srUuid,
}) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    target,
    targetIQN: targetIqn,
    SCSIid: scsiId,
  }

  // if we give user and password
  if (chapUser && chapPassword) {
    deviceConfig.chapuser = chapUser
    deviceConfig.chappassword = chapPassword
  }

  //  if we give another port than default iSCSI
  if (port) {
    deviceConfig.port = asInteger(port)
  }

  // Reattach
  if (srUuid !== undefined) {
    return xapi.reattachSr({
      uuid: srUuid,
      nameLabel,
      nameDescription,
      type: 'lvmoiscsi',
      deviceConfig,
    })
  }

  const srRef = await xapi.call(
    'SR.create',
    host._xapiRef,
    deviceConfig,
    '0',
    nameLabel,
    nameDescription,
    'lvmoiscsi', // SR LVM over iSCSI
    'user', // recommended by Citrix
    true,
    {}
  )

  const sr = await xapi.call('SR.get_record', srRef)
  return sr.uuid
}

createIscsi.params = {
  host: { type: 'string' },
  nameLabel: { type: 'string' },
  nameDescription: { type: 'string' },
  target: { type: 'string' },
  port: { type: 'integer', optional: true },
  targetIqn: { type: 'string' },
  scsiId: { type: 'string' },
  chapUser: { type: 'string', optional: true },
  chapPassword: { type: 'string', optional: true },
  srUuid: { type: 'string', optional: true },
}

createIscsi.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// This function helps to detect all iSCSI IQN on a Target (iSCSI "server")
// Return a table of IQN or empty table if no iSCSI connection to the target

export async function probeIscsiIqns({ host, target: targetIp, port, chapUser, chapPassword }) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    target: targetIp,
  }

  // if we give user and password
  if (chapUser && chapPassword) {
    deviceConfig.chapuser = chapUser
    deviceConfig.chappassword = chapPassword
  }

  //  if we give another port than default iSCSI
  if (port) {
    deviceConfig.port = asInteger(port)
  }

  let xml

  try {
    await xapi.call('SR.probe', host._xapiRef, deviceConfig, 'lvmoiscsi', {})

    throw new Error('the call above should have thrown an error')
  } catch (error) {
    if (error.code === 'SR_BACKEND_FAILURE_141') {
      return []
    }
    if (error.code !== 'SR_BACKEND_FAILURE_96') {
      throw error
    }

    xml = parseXml(error.params[2])
    console.log(error.params)
    console.log(xml)
  }

  const targets = []
  forEach(ensureArray(xml['iscsi-target-iqns'].TGT), target => {
    // if the target is on another IP adress, do not display it
    if (target.IPAddress.trim() === targetIp) {
      targets.push({
        iqn: target.TargetIQN.trim(),
        ip: target.IPAddress.trim(),
      })
    }
  })

  return targets
}

probeIscsiIqns.params = {
  host: { type: 'string' },
  target: { type: 'string' },
  port: { type: 'integer', optional: true },
  chapUser: { type: 'string', optional: true },
  chapPassword: { type: 'string', optional: true },
}
probeIscsiIqns.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// This function helps to detect all iSCSI ID and LUNs on a Target
//  It will return a LUN table

export async function probeIscsiLuns({ host, target: targetIp, port, targetIqn, chapUser, chapPassword }) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    target: targetIp,
    targetIQN: targetIqn,
  }

  // if we give user and password
  if (chapUser && chapPassword) {
    deviceConfig.chapuser = chapUser
    deviceConfig.chappassword = chapPassword
  }

  //  if we give another port than default iSCSI
  if (port) {
    deviceConfig.port = asInteger(port)
  }

  let xml

  try {
    await xapi.call('SR.probe', host._xapiRef, deviceConfig, 'lvmoiscsi', {})

    throw new Error('the call above should have thrown an error')
  } catch (error) {
    if (error.code !== 'SR_BACKEND_FAILURE_107') {
      throw error
    }

    xml = parseXml(error.params[2])

    console.log(error.params)
    console.log(xml)
  }

  const luns = []
  forEach(ensureArray(xml['iscsi-target'].LUN), lun => {
    luns.push({
      id: lun.LUNid.trim(),
      vendor: lun.vendor.trim(),
      serial: lun.serial.trim(),
      size: lun.size?.trim(),
      scsiId: lun.SCSIid.trim(),
    })
  })

  return luns
}

probeIscsiLuns.params = {
  host: { type: 'string' },
  target: { type: 'string' },
  port: { type: 'integer', optional: true },
  targetIqn: { type: 'string' },
  chapUser: { type: 'string', optional: true },
  chapPassword: { type: 'string', optional: true },
}

probeIscsiLuns.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// This function helps to detect if this target already exists in XAPI
// It returns a table of SR UUID, empty if no existing connections

export async function probeIscsiExists({ host, target: targetIp, port, targetIqn, scsiId, chapUser, chapPassword }) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    target: targetIp,
    targetIQN: targetIqn,
    SCSIid: scsiId,
  }

  // if we give user and password
  if (chapUser && chapPassword) {
    deviceConfig.chapuser = chapUser
    deviceConfig.chappassword = chapPassword
  }

  //  if we give another port than default iSCSI
  if (port) {
    deviceConfig.port = asInteger(port)
  }

  const xml = parseXml(await xapi.call('SR.probe', host._xapiRef, deviceConfig, 'lvmoiscsi', {}))

  const srs = []
  forEach(ensureArray(xml.SRlist.SR), sr => {
    // get the UUID of SR connected to this LUN
    srs.push({ uuid: sr.UUID.trim() })
  })

  return srs
}

probeIscsiExists.params = {
  host: { type: 'string' },
  target: { type: 'string' },
  port: { type: 'integer', optional: true },
  targetIqn: { type: 'string' },
  scsiId: { type: 'string' },
  chapUser: { type: 'string', optional: true },
  chapPassword: { type: 'string', optional: true },
}

probeIscsiExists.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// This function helps to detect if this HBA already exists in XAPI
// It returns a table of SR UUID, empty if no existing connections

export async function probeHbaExists({ host, scsiId }) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    SCSIid: scsiId,
  }

  const xml = parseXml(await xapi.call('SR.probe', host._xapiRef, deviceConfig, 'lvmohba', {}))

  // get the UUID of SR connected to this LUN
  return ensureArray(xml.SRlist.SR).map(sr => ({ uuid: sr.UUID.trim() }))
}

probeHbaExists.params = {
  host: { type: 'string' },
  scsiId: { type: 'string' },
}

probeHbaExists.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------
// This function helps to detect if this NFS SR already exists in XAPI
// It returns a table of SR UUID, empty if no existing connections

export async function probeNfsExists({ host, server, serverPath }) {
  const xapi = this.getXapi(host)

  const deviceConfig = {
    server,
    serverpath: serverPath,
  }

  const xml = parseXml(await xapi.call('SR.probe', host._xapiRef, deviceConfig, 'nfs', {}))

  const srs = []

  forEach(ensureArray(xml.SRlist.SR), sr => {
    // get the UUID of SR connected to this LUN
    srs.push({ uuid: sr.UUID.trim() })
  })

  return srs
}

probeNfsExists.params = {
  host: { type: 'string' },
  server: { type: 'string' },
  serverPath: { type: 'string' },
}

probeNfsExists.resolve = {
  host: ['host', 'host', 'administrate'],
}

// -------------------------------------------------------------------

export function getUnhealthyVdiChainsLength({ sr }) {
  return this.getXapi(sr).getUnhealthyVdiChainsLength(sr)
}

getUnhealthyVdiChainsLength.params = {
  id: { type: 'string' },
}

getUnhealthyVdiChainsLength.resolve = {
  sr: ['id', 'SR', 'operate'],
}

// -------------------------------------------------------------------

export function stats({ sr, granularity }) {
  return this.getXapiSrStats(sr._xapiId, granularity)
}

stats.description = 'returns statistic of the sr'

stats.params = {
  id: { type: 'string' },
  granularity: {
    type: 'string',
    optional: true,
  },
}

stats.resolve = {
  sr: ['id', 'SR', 'view'],
}
