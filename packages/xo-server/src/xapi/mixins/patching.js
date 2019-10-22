import createLogger from '@xen-orchestra/log'
import deferrable from 'golike-defer'
import unzip from 'julien-f-unzip'
import { filter, find, pickBy, some } from 'lodash'
import { listMissingPatchesFailed } from 'xo-common/api-errors'

import ensureArray from '../../_ensureArray'
import { debounce } from '../../decorators'
import { debounceWithKey } from '../../_pDebounceWithKey'
import { forEach, mapFilter, mapToArray, parseXml } from '../../utils'

import { extractOpaqueRef, useUpdateSystem } from '../utils'

// TOC -------------------------------------------------------------------------

// # HELPERS
//    _isXcp
//    _ejectToolsIsos
//    _getXenUpdates           Map of Objects
// # LIST
//    _listXcpUpdates          XCP available updates - Array of Objects
//    _listPatches             XS patches (installed or not) - Map of Objects
//    _listInstalledPatches    XS installed patches on the host - Map of Booleans
//    _listInstallablePatches  XS (host, requested patches) → sorted patches that are not installed and not conflicting - Array of Objects
//    listMissingPatches       HL: installable patches (XS) or updates (XCP) - Array of Objects
//    findPatches              HL: get XS patches IDs from names
// # INSTALL
//    _xcpUpdate               XCP yum update
//    _legacyUploadPatch       XS legacy upload
//    _uploadPatch             XS upload on a dedicated VDI
//    installPatches           HL: install patches (XS) or yum update (XCP) on hosts

// HELPERS ---------------------------------------------------------------------

const log = createLogger('xo:xapi')

const _isXcp = host => host.software_version.product_brand === 'XCP-ng'

const XCP_NG_DEBOUNCE_TIME_MS = 60000

// list all yum updates available for a XCP-ng host
// (hostObject) → { uuid: patchObject }
async function _listXcpUpdates(host) {
  const patches = JSON.parse(
    await this.call(
      'host.call_plugin',
      host.$ref,
      'updater.py',
      'check_update',
      {}
    )
  )

  if (patches.error !== undefined) {
    throw listMissingPatchesFailed({
      host: host.$id,
      reason: patches.error,
    })
  }

  return patches
}

const _listXcpUpdateDebounced = debounceWithKey(
  _listXcpUpdates,
  XCP_NG_DEBOUNCE_TIME_MS,
  host => host.$ref
)

// =============================================================================

export default {
  // raw { uuid: patch } map translated from updates.xensource.com/XenServer/updates.xml
  // FIXME: should be static
  @debounce(24 * 60 * 60 * 1000)
  async _getXenUpdates() {
    const response = await this.xo.httpRequest(
      'http://updates.xensource.com/XenServer/updates.xml'
    )

    if (response.statusCode !== 200) {
      throw new Error('cannot fetch patches list from Citrix')
    }

    const data = parseXml(await response.readAll()).patchdata

    const patches = { __proto__: null }
    forEach(data.patches.patch, patch => {
      patches[patch.uuid] = {
        date: patch.timestamp,
        description: patch['name-description'],
        documentationUrl: patch.url,
        guidance: patch['after-apply-guidance'],
        name: patch['name-label'],
        url: patch['patch-url'],
        id: patch.uuid,
        uuid: patch.uuid,
        conflicts: mapToArray(
          ensureArray(patch.conflictingpatches),
          patch => patch.conflictingpatch.uuid
        ),
        requirements: mapToArray(
          ensureArray(patch.requiredpatches),
          patch => patch.requiredpatch.uuid
        ),
        paid: patch['update-stream'] === 'premium',
        upgrade: /^XS\d{2,}$/.test(patch['name-label']),
        // TODO: what does it mean, should we handle it?
        // version: patch.version,
      }
      if (patches[patch.uuid].conflicts[0] === undefined) {
        patches[patch.uuid].conflicts.length = 0
      }
      if (patches[patch.uuid].requirements[0] === undefined) {
        patches[patch.uuid].requirements.length = 0
      }
    })

    const resolveVersionPatches = function(uuids) {
      const versionPatches = { __proto__: null }

      forEach(ensureArray(uuids), ({ uuid }) => {
        versionPatches[uuid] = patches[uuid]
      })

      return versionPatches
    }

    const versions = { __proto__: null }
    let latestVersion
    forEach(data.serverversions.version, version => {
      versions[version.value] = {
        date: version.timestamp,
        name: version.name,
        id: version.value,
        documentationUrl: version.url,
        patches: resolveVersionPatches(version.patch),
      }

      if (version.latest) {
        latestVersion = versions[version.value]
      }
    })

    return {
      patches,
      latestVersion,
      versions,
    }
  },

  // eject all ISOs from all the host's VMs when installing patches
  // if hostRef is not specified: eject ISOs on all the pool's VMs
  async _ejectToolsIsos(hostRef) {
    return Promise.all(
      mapFilter(this.objects.all, vm => {
        if (vm.$type !== 'vm' || (hostRef && vm.resident_on !== hostRef)) {
          return
        }

        const shouldEjectCd = some(vm.$VBDs, vbd => {
          const vdi = vbd.$VDI

          return vdi && vdi.is_tools_iso
        })

        if (shouldEjectCd) {
          return this.ejectCdFromVm(vm.$id)
        }
      })
    )
  },

  // LIST ----------------------------------------------------------------------

  _listXcpUpdates,
  _listXcpUpdateDebounced,

  // list all patches provided by Citrix for this host version regardless
  // of if they're installed or not
  // ignores upgrade patches
  // (hostObject) → { uuid: patchObject }
  async _listPatches(host) {
    const versions = (await this._getXenUpdates()).versions

    const hostVersions = host.software_version
    const version =
      versions[hostVersions.product_version] ||
      versions[hostVersions.product_version_text]

    return version ? pickBy(version.patches, patch => !patch.upgrade) : {}
  },

  // list patches installed on the host
  // (hostObject) → { uuid: boolean }
  _listInstalledPatches(host) {
    const installed = { __proto__: null }

    // Legacy XS patches
    if (!useUpdateSystem(host)) {
      forEach(host.$patches, hostPatch => {
        installed[hostPatch.$pool_patch.uuid] = true
      })
      return installed
    }
    // ----------

    forEach(host.$updates, update => {
      // ignore packs
      if (update.name_label.startsWith('XS')) {
        installed[update.uuid] = true
      }
    })

    return installed
  },

  // TODO: handle upgrade patches
  // (hostObject, [ patchId ]) → [ patchObject ]
  async _listInstallablePatches(host, requestedPatches) {
    const all = await this._listPatches(host)
    const installed = this._listInstalledPatches(host)

    let getAll = false
    if (requestedPatches === undefined) {
      getAll = true
      requestedPatches = Object.keys(all)
    }
    const freeHost = this.pool.$master.license_params.sku_type === 'free'
    // We assume:
    // - no conflict transitivity (If A conflicts with B and B with C, Citrix should tell us explicitly that A conflicts with C)
    // - no requirements transitivity (If A requires B and B requires C, Citrix should tell us explicitly that A requires C)
    // - sorted requirements (If A requires B and C, then C cannot require B)
    // For each requested patch:
    // - throw if not found
    // - throw if already installed
    // - ignore if already in installable (may have been added because of requirements)
    // - if paid patch on free host: either ignore (listing all the patches) or throw (patch is requested)
    // - throw if conflicting patches installed
    // - throw if conflicting patches in installable
    // - throw if one of the requirements is not found
    // - push its required patches in installable
    // - push it in installable
    const installable = []
    forEach(requestedPatches, id => {
      const patch = all[id]
      if (patch === undefined) {
        throw new Error(`patch not found: ${id}`)
      }

      if (installed[id] !== undefined) {
        if (getAll) {
          return
        }
        throw new Error(`patch already installed: ${patch.name} (${id})`)
      }

      if (find(installable, { id }) !== undefined) {
        return
      }

      if (patch.paid && freeHost) {
        if (getAll) {
          return
        }
        throw new Error(
          `requested patch ${patch.name} (${id}) requires a XenServer license`
        )
      }

      let conflictId
      if (
        (conflictId = find(
          patch.conflicts,
          conflictId => installed[conflictId] !== undefined
        )) !== undefined
      ) {
        if (getAll) {
          log.debug(
            `patch ${patch.name} (${id}) conflicts with installed patch ${conflictId}`
          )
          return
        }
        throw new Error(
          `patch ${patch.name} (${id}) conflicts with installed patch ${conflictId}`
        )
      }

      if (
        (conflictId = find(patch.conflicts, conflictId =>
          find(installable, { id: conflictId })
        )) !== undefined
      ) {
        if (getAll) {
          log.debug(`patches ${id} and ${conflictId} conflict with eachother`)
          return
        }
        throw new Error(
          `patches ${id} and ${conflictId} conflict with eachother`
        )
      }

      // add requirements
      forEach(patch.requirements, id => {
        const requiredPatch = all[id]
        if (requiredPatch === undefined) {
          throw new Error(`required patch ${id} not found`)
        }
        if (!installed[id] && find(installable, { id }) === undefined) {
          if (requiredPatch.paid && freeHost) {
            throw new Error(
              `required patch ${requiredPatch.name} (${id}) requires a XenServer license`
            )
          }
          installable.push(requiredPatch)
        }
      })

      // add itself
      installable.push(patch)
    })

    return installable
  },

  // high level
  listMissingPatches(hostId) {
    const host = this.getObject(hostId)
    return _isXcp(host)
      ? this._listXcpUpdateDebounced(host)
      : // TODO: list paid patches of free hosts as well so the UI can show them
        this._listInstallablePatches(host)
  },

  // convenient method to find which patches should be installed from a
  // list of patch names
  // e.g.: compare the installed patches of 2 hosts by their
  // names (XS..E...) then find the patches global ID
  // [ names ] → [ IDs ]
  async findPatches(names) {
    const all = await this._listPatches(this.pool.$master)
    return filter(all, patch => names.includes(patch.name)).map(
      patch => patch.id
    )
  },

  // INSTALL -------------------------------------------------------------------

  async _xcpUpdate(hosts) {
    if (hosts === undefined) {
      hosts = filter(this.objects.all, { $type: 'host' })
    } else {
      hosts = filter(
        this.objects.all,
        obj => obj.$type === 'host' && hosts.includes(obj.$id)
      )
    }

    // XCP-ng hosts need to be updated one at a time starting with the pool master
    // https://github.com/vatesfr/xen-orchestra/issues/4468
    hosts = hosts.sort(({ $ref }) => ($ref === this.pool.master ? -1 : 1))
    for (const host of hosts) {
      const update = await this.call(
        'host.call_plugin',
        host.$ref,
        'updater.py',
        'update',
        {}
      )

      if (JSON.parse(update).exit !== 0) {
        throw new Error('Update install failed')
      } else {
        await host.update_other_config(
          'rpm_patch_installation_time',
          String(Date.now() / 1000)
        )
      }
    }
  },

  // Legacy XS patches: upload a patch on a pool before installing it
  async _legacyUploadPatch(uuid) {
    // check if the patch has already been uploaded
    try {
      return this.getObjectByUuid(uuid)
    } catch (e) {}

    log.debug(`legacy downloading patch ${uuid}`)

    const patchInfo = (await this._getXenUpdates()).patches[uuid]
    if (!patchInfo) {
      throw new Error('no such patch ' + uuid)
    }

    let stream = await this.xo.httpRequest(patchInfo.url)
    stream = await new Promise((resolve, reject) => {
      const PATCH_RE = /\.xsupdate$/
      stream
        .pipe(unzip.Parse())
        .on('entry', entry => {
          if (PATCH_RE.test(entry.path)) {
            entry.length = entry.size
            resolve(entry)
          } else {
            entry.autodrain()
          }
        })
        .on('error', reject)
    })

    const patchRef = await this.putResource(stream, '/pool_patch_upload', {
      task: this.createTask('Patch upload', patchInfo.name),
    }).then(extractOpaqueRef)

    return this._getOrWaitObject(patchRef)
  },
  // ----------

  // upload patch on a VDI on a shared SR
  async _uploadPatch($defer, uuid) {
    log.debug(`downloading patch ${uuid}`)

    const patchInfo = (await this._getXenUpdates()).patches[uuid]
    if (!patchInfo) {
      throw new Error('no such patch ' + uuid)
    }

    let stream = await this.xo.httpRequest(patchInfo.url)
    stream = await new Promise((resolve, reject) => {
      stream
        .pipe(unzip.Parse())
        .on('entry', entry => {
          entry.length = entry.size
          resolve(entry)
        })
        .on('error', reject)
    })

    const sr = this.findAvailableSr(stream.length)
    if (sr === undefined) {
      return
    }

    const vdi = await this.createTemporaryVdiOnSr(
      stream,
      sr,
      '[XO] Patch ISO',
      'small temporary VDI to store a patch ISO'
    )
    $defer(() => this._deleteVdi(vdi.$ref))

    return vdi
  },

  _poolWideInstall: deferrable(async function($defer, patches) {
    // Legacy XS patches
    if (!useUpdateSystem(this.pool.$master)) {
      // for each patch: pool_patch.pool_apply
      for (const p of patches) {
        const [patch] = await Promise.all([
          this._legacyUploadPatch(p.uuid),
          this._ejectToolsIsos(this.pool.$master.$ref),
        ])

        await this.call('pool_patch.pool_apply', patch.$ref)
      }
      return
    }
    // ----------

    // for each patch: pool_update.introduce → pool_update.pool_apply
    for (const p of patches) {
      const [vdi] = await Promise.all([
        this._uploadPatch($defer, p.uuid),
        this._ejectToolsIsos(),
      ])
      if (vdi === undefined) {
        throw new Error('patch could not be uploaded')
      }

      log.debug(`installing patch ${p.uuid}`)
      await this.call(
        'pool_update.pool_apply',
        await this.call('pool_update.introduce', vdi.$ref)
      )
    }
  }),

  async _hostInstall(patches, host) {
    throw new Error('single host install not implemented')
    // Legacy XS patches
    // for each patch: pool_patch.apply
    // ----------
    // for each patch: pool_update.introduce → pool_update.apply
  },

  // high level
  // install specified patches on specified hosts
  //
  // no hosts specified: pool-wide install (only the pool master installed patches will be considered)
  // no patches specified: install either the pool master's missing patches (no hosts specified) or each host's missing patches
  //
  // patches will be ignored for XCP (always updates completely)
  // patches that are already installed will be ignored (XS only)
  //
  // XS pool-wide optimization only works when no hosts are specified
  // it may install more patches that specified if some of them require other patches
  async installPatches({ patches, hosts }) {
    // XCP
    if (_isXcp(this.pool.$master)) {
      return this._xcpUpdate(hosts)
    }

    // XS
    // TODO: assert consistent time
    const poolWide = hosts === undefined
    if (poolWide) {
      log.debug('patches that were requested to be installed', patches)
      const installablePatches = await this._listInstallablePatches(
        this.pool.$master,
        patches
      )

      log.debug(
        'patches that will actually be installed',
        installablePatches.map(patch => patch.uuid)
      )

      return this._poolWideInstall(installablePatches)
    }

    // for each host
    // get installable patches
    // filter patches that should be installed
    // sort patches
    // host-by-host install
    throw new Error('non pool-wide install not implemented')
  },
}
