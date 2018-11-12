import aclResolver from 'xo-acl-resolver'
import { forEach, includes, map } from 'lodash'

import { ModelAlreadyExists } from '../collection'
import { Acls } from '../models/acl'

// ===================================================================

export default class {
  constructor (xo) {
    this._xo = xo

    const aclsDb = (this._acls = new Acls({
      connection: xo._redis,
      prefix: 'xo:acl',
      indexes: ['subject', 'object'],
    }))

    xo.on('start', () => {
      xo.addConfigManager(
        'acls',
        () => aclsDb.get(),
        acls => aclsDb.update(acls),
        ['groups', 'users']
      )
    })

    xo.on('clean', async () => {
      const acls = await aclsDb.get()
      const toRemove = []
      forEach(acls, ({ subject, object, action, id }) => {
        if (!subject || !object || !action) {
          toRemove.push(id)
        }
      })
      await aclsDb.remove(toRemove)
      return aclsDb.rebuildIndexes()
    })
  }

  async _getAclsForUser (userId) {
    const user = await this._xo.getUser(userId)
    const { groups } = user

    const subjects = groups ? groups.concat(userId) : [userId]

    const acls = []
    const pushAcls = (push => entries => {
      push.apply(acls, entries)
    })(acls.push)

    await Promise.all(
      map(subjects, subject => this.getAclsForSubject(subject).then(pushAcls))
    )

    return acls
  }

  async addAcl (subjectId, objectId, action) {
    try {
      await this._acls.create(subjectId, objectId, action)
    } catch (error) {
      if (!(error instanceof ModelAlreadyExists)) {
        throw error
      }
    }
  }

  async removeAcl (subjectId, objectId, action) {
    await this._acls.delete(subjectId, objectId, action)
  }

  // TODO: remove when new collection.
  async getAllAcls () {
    return this._acls.get()
  }

  async getAclsForSubject (subjectId) {
    return this._acls.get({ subject: subjectId })
  }

  async getPermissionsForUser (userId) {
    const [acls, permissionsByRole] = await Promise.all([
      this._getAclsForUser(userId),
      this._getPermissionsByRole(),
    ])

    const permissions = { __proto__: null }
    for (const { action, object: objectId } of acls) {
      const current =
        permissions[objectId] || (permissions[objectId] = { __proto__: null })

      const permissionsForRole = permissionsByRole[action]
      if (permissionsForRole) {
        for (const permission of permissionsForRole) {
          current[permission] = 1
        }
      } else {
        current[action] = 1
      }
    }
    return permissions
  }

  async checkPermissions (userId, permissions) {
    const user = await this._xo.getUser(userId)

    // Special case for super XO administrators.
    if (user.permission === 'admin') {
      return true
    }

    aclResolver.assert(
      await this.getPermissionsForUser(userId),
      id => this._xo.getObject(id),
      permissions
    )
  }

  async hasPermissions (userId, permissions) {
    const user = await this._xo.getUser(userId)

    // Special case for super XO administrators.
    if (user.permission === 'admin') {
      return true
    }

    return aclResolver.check(
      await this.getPermissionsForUser(userId),
      id => this._xo.getObject(id),
      permissions
    )
  }

  async removeAclsForObject (objectId) {
    const acls = this._acls
    await acls.remove(map(await acls.get({ object: objectId }), 'id'))
  }

  // -----------------------------------------------------------------

  async _getPermissionsByRole () {
    const roles = await this.getRoles()

    const permissions = { __proto__: null }
    for (const role of roles) {
      permissions[role.id] = role.permissions
    }
    return permissions
  }

  // TODO: delete when merged with the new collection.
  async getRoles () {
    return [
      {
        id: 'viewer',
        name: 'Viewer',
        permissions: ['view'],
      },
      {
        id: 'operator',
        name: 'Operator',
        permissions: ['view', 'operate'],
      },
      {
        id: 'admin',
        name: 'Admin',
        permissions: ['view', 'operate', 'administrate'],
      },
    ]
  }

  // Returns an array of roles which have a given permission.
  async getRolesForPermission (permission) {
    const roles = []

    forEach(await this.getRoles(), role => {
      if (includes(role.permissions, permission)) {
        roles.push(role.id)
      }
    })

    return roles
  }
}
