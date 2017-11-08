import _ from 'intl'
import map from 'lodash/map'
import React, { Component } from 'react'
import SortedTable from 'sorted-table'
import { connectStore } from 'utils'
import { deleteMessage } from 'xo'
import { FormattedRelative, FormattedTime } from 'react-intl'
import {
  createGetObjectMessages
} from 'selectors'

const LOG_COLUMNS = [
  {
    itemRenderer: log => <span><FormattedTime value={log.time * 1000} minute='numeric' hour='numeric' day='numeric' month='long' year='numeric' /> (<FormattedRelative value={log.time * 1000} />)</span>,
    name: _('logDate'),
    sortCriteria: 'time',
    sortOrder: 'desc'
  },
  {
    itemRenderer: log => log.name,
    name: _('logName'),
    sortCriteria: 'name'
  },
  {
    itemRenderer: log => log.body,
    name: _('logContent'),
    sortCriteria: 'body'
  }
]

const INDIVIDUAL_ACTIONS = [
  {
    handler: deleteMessage,
    icon: 'delete',
    label: _('logDelete')
  }
]

const GROUPED_ACTIONS = [
  {
    handler: logs => Promise.all(map(logs, deleteMessage)),
    icon: 'delete',
    label: _('deleteSelectedLogs')
  }
]

@connectStore(() => {
  const logs = createGetObjectMessages(
    (_, props) => props.vm
  )

  return (state, props) => ({
    logs: logs(state, props)
  })
})
export default class TabLogs extends Component {
  render () {
    return <SortedTable
      collection={this.props.logs}
      columns={LOG_COLUMNS}
      groupedActions={GROUPED_ACTIONS}
      individualActions={INDIVIDUAL_ACTIONS}
      stateUrlParam='s'
    />
  }
}
