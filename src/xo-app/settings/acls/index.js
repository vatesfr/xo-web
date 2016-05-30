import _ from 'messages'
import ActionButton from 'action-button'
import { connectStore } from 'utils'
import { createGetObjectsOfType, createSelector } from 'selectors'
import find from 'lodash/find'
import forEach from 'lodash/forEach'
import isEmpty from 'lodash/isEmpty'
import map from 'lodash/map'
import React, { Component } from 'react'
import { error } from 'notification'
import { GenericSelect, SelectSubject } from 'select-objects'
import assign from 'lodash/assign'
import keyBy from 'lodash/keyBy'
import ObjectName from 'object-name'
import orderBy from 'lodash/orderBy'

import {
  addAcl,
  removeAcl,
  subscribeAcls,
  subscribeGroups,
  subscribeRoles,
  subscribeUsers
} from 'xo'

@connectStore(() => {
  const getPools = createGetObjectsOfType('pool')
  const getHosts = createGetObjectsOfType('host')
  const getVms = createGetObjectsOfType('VM')
  const getSrs = createGetObjectsOfType('SR')
  const getNetworks = createGetObjectsOfType('network')

  const getHighLevelObjects = createSelector(
    getPools,
    getHosts,
    getVms,
    getSrs,
    getNetworks,
    (pools, hosts, vms, srs, networks) => assign(pools, hosts, vms, srs, networks)
  )

  return (state, props) => ({objects: getHighLevelObjects(state, props)})
})
class SelectObject extends GenericSelect {
  constructor (props) {
    super(props)
    this._placeholder = _('selectObjects')
  }

  _computeOptions (props) {
    return map(props.objects, object => ({
      value: object.id,
      label: object.name_label || object.name || object.id,
      type: object.type && object.type.toLowerCase()
    }))
  }
}

class SelectRole extends GenericSelect {
  constructor (props) {
    super(props)
    this._placeholder = _('selectRole')
    this.state = {roles: {}}
  }

  componentWillMount () {
    this.componentWillUnmount = subscribeRoles(roles => {
      console.log('roles', roles)
      return this.setState({
        roles,
        options: this._computeOptions(this.props, roles)
      })
    })
  }

  _computeOptions (props, roles) {
    return map(roles, role => ({value: role.id, label: role.name}))
  }

  get value () {
    const { roles, value } = this.state
    const id = value.value || value
    if (this.props.multi) {
      return map(value, value => find(roles, role => role.id === id))
    }
    return find(roles, role => role.id === id)
  }
}

class SubjectDisplay extends Component {
  constructor (props) {
    super(props)
    this.state = {
      groups: {},
      users: {}
    }
  }

  componentWillMount () {
    const unsubscribeUsers = subscribeUsers(users => {
      users = keyBy(users, 'id')
      this.setState({
        users
      })
    })

    const unsubscribeGroups = subscribeGroups(groups => {
      groups = keyBy(groups, 'id')
      this.setState({
        groups
      })
    })

    this.componentWillUnmount = () => {
      unsubscribeGroups()
      unsubscribeUsers()
    }
  }
  render () {
    const { id } = this.props
    const {
      groups,
      users
    } = this.state
    return <span>{id && (users[id] && users[id].email) || (groups[id] && groups[id].name)}</span>
  }
}

export default class Acls extends Component {
  constructor (props) {
    super(props)
    this.state = {
      subjects: [],
      objects: [],
      role: undefined
    }
  }

  componentWillMount () {
    const unsubscribeAcls = subscribeAcls(acls => this.setState({acls: orderBy(acls, ['subject', 'object'])}))

    this.componentWillUnmount = () => {
      unsubscribeAcls()
    }
  }

  _handleSelectSubject = subjects => this.setState({subjects})
  _handleSelectObjects = objects => this.setState({objects})
  _handleSelectRole = role => this.setState({role})

  _handleRoleChange = (role, subject, object, action) => removeAcl({subject, object, action}).then(() => addAcl({subject, object, action: role.id})).then(() => subscribeAcls.forceRefresh())

  _addAcl = async () => {
    const {
      subjects,
      objects,
      role
    } = this.state
    try {
      const promises = []
      forEach(subjects, subject => promises.push(...map(objects, object => addAcl({subject: subject.id, object: object.id, action: role.id}))))
      await Promise.all(promises).then(() => subscribeAcls.forceRefresh())
    } catch (err) {
      error('Add ACL(s)', err.message || String(err))
    }
  }

  _removeAcl = async ({subject, object, action}) => removeAcl({subject, object, action}).then(() => subscribeAcls.forceRefresh()).catch(err => error('Remove ACL', err.message || String(err)))

  render () {
    const {
      acls,
      objects,
      role,
      subjects
    } = this.state

    return <div>
      <form>
        <div className='form-group'>
          <SelectSubject multi onChange={this._handleSelectSubject} />
        </div>
        <div className='form-group'>
          <SelectObject multi onChange={this._handleSelectObjects} />
        </div>
        <div className='form-group'>
          <SelectRole onChange={this._handleSelectRole} />
        </div>
        <ActionButton icon='add' btnStyle='success' handler={this._addAcl} disabled={isEmpty(subjects) || !role || isEmpty(objects)}>Create</ActionButton>
      </form>
      <br />
      <table className='table'>
        <thead>
          <tr>
            <th>User/Group</th>
            <th>Object</th>
            <th>Role</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {map(acls, (acl, index) =>
            <tr key={index}>
              <td><SubjectDisplay id={acl.subject} /></td>
              <td><ObjectName id={acl.object} /></td>
              <td>{acl.action}</td>
              <td><SelectRole onChange={role => this._handleRoleChange(role, acl.subject, acl.object, acl.action)} /></td>
              <td><ActionButton icon='delete' btnStyle='danger' handler={this._removeAcl} handlerParam={{subject: acl.subject, object: acl.object, action: acl.action}} /></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  }
}
