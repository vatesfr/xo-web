import _, { messages } from 'intl'
import ActionButton from 'action-button'
import decorate from 'apply-decorators'
import Icon from 'icon'
import React from 'react'
import SortedTable from 'sorted-table'
import StateButton from 'state-button'
import Tooltip from 'tooltip'
import { addSubscriptions, formatSize, generateRandomId, noop } from 'utils'
import { alert } from 'modal'
import { format, parse } from 'xo-remote-parser'
import { groupBy, map, isEmpty } from 'lodash'
import { injectIntl } from 'react-intl'
import { injectState, provideState } from 'reaclette'
import { Number, Password, Text } from 'editable'

import {
  deleteRemote,
  deleteRemotes,
  disableRemote,
  editRemote,
  editRemoteSpeed,
  enableRemote,
  subscribeRemotes,
  subscribeRemotesInfo,
  testRemote,
} from 'xo'

import Remote from './remote'

const _changeUrlElement = (value, { remote, element }) =>
  editRemote(remote, {
    url: format({ ...remote, [element]: value === null ? undefined : value }),
  })
const _showError = remote => alert(_('remoteConnectionFailed'), remote.error)
const _editRemoteName = (name, { remote }) => editRemote(remote, { name })
const _editRemoteOptions = (options, { remote }) =>
  editRemote(remote, { options: options !== '' ? options : null })
const _editRemoteSpeed = ({ writeSpeed, readSpeed }, remote) => {
  editRemoteSpeed(remote, {
    speed: { write: writeSpeed, read: readSpeed },
  })
}

const COLUMN_NAME = {
  itemRenderer: (remote, { formatMessage }) => (
    <Text
      data-remote={remote}
      onChange={_editRemoteName}
      placeholder={formatMessage(messages.remoteMyNamePlaceHolder)}
      value={remote.name}
    />
  ),
  name: _('remoteName'),
  sortCriteria: 'name',
}
const COLUMN_STATE = {
  itemRenderer: remote => (
    <div>
      <StateButton
        disabledLabel={_('remoteDisabled')}
        disabledHandler={enableRemote}
        disabledTooltip={_('enableRemote')}
        enabledLabel={_('remoteEnabled')}
        enabledHandler={disableRemote}
        enabledTooltip={_('disableRemote')}
        handlerParam={remote}
        state={remote.enabled}
      />{' '}
      {remote.error && (
        <Tooltip content={_('remoteConnectionFailed')}>
          <a
            className='text-danger btn btn-link'
            onClick={() => _showError(remote)}
            style={{ padding: '0px' }}
          >
            <Icon icon='alarm' size='lg' />
          </a>
        </Tooltip>
      )}
    </div>
  ),
  name: _('remoteState'),
}
const COLUMN_DISK = {
  itemRenderer: remote =>
    remote.info !== undefined &&
    remote.info.used !== undefined &&
    remote.info.size !== undefined && (
      <span>
        {`${formatSize(remote.info.used)} / ${formatSize(remote.info.size)}`}
      </span>
    ),
  name: _('remoteDisk'),
}
const COLUMN_SPEED = {
  itemRenderer: remote => {
    return (
      remote.speed !== undefined &&
      remote.speed.write !== undefined &&
      remote.speed.read !== undefined && (
        <span>{`${formatSize(
          parseInt(remote.speed.write, 10)
        )}/s / ${formatSize(parseInt(remote.speed.read, 10))}/s`}</span>
      )
    )
  },
  name: _('remoteSpeed'),
}

const fixRemoteUrl = remote => editRemote(remote, { url: format(remote) })
const COLUMNS_LOCAL_REMOTE = [
  COLUMN_NAME,
  {
    itemRenderer: (remote, { formatMessage }) => (
      <Text
        data-element='path'
        data-remote={remote}
        onChange={_changeUrlElement}
        placeholder={formatMessage(messages.remoteLocalPlaceHolderPath)}
        value={remote.path}
      />
    ),
    name: _('remotePath'),
  },
  COLUMN_STATE,
  COLUMN_DISK,
  COLUMN_SPEED,
]
const COLUMNS_NFS_REMOTE = [
  COLUMN_NAME,
  {
    itemRenderer: (remote, { formatMessage }) => (
      <span>
        <strong className='text-info'>\\</strong>
        <Text
          data-element='host'
          data-remote={remote}
          onChange={_changeUrlElement}
          placeholder={formatMessage(messages.remoteNfsPlaceHolderHost)}
          value={remote.host}
        />
        :
        <Number
          data-element='port'
          data-remote={remote}
          nullable
          onChange={_changeUrlElement}
          placeholder={formatMessage(messages.remoteNfsPlaceHolderPort)}
          value={remote.port || ''}
        />
        :
        <Text
          data-element='path'
          data-remote={remote}
          onChange={_changeUrlElement}
          placeholder={formatMessage(messages.remoteNfsPlaceHolderPath)}
          value={remote.path}
        />{' '}
        {remote.invalidUrl && (
          <ActionButton
            btnStyle='danger'
            handler={fixRemoteUrl}
            handlerParam={remote}
            icon='alarm'
            size='small'
            tooltip={_('remoteErrorMessage', {
              url: remote.url,
              newUrl: format(remote),
            })}
          />
        )}
      </span>
    ),

    name: _('remoteDevice'),
  },
  {
    name: _('remoteOptions'),
    itemRenderer: remote => (
      <Text
        data-remote={remote}
        onChange={_editRemoteOptions}
        value={remote.options || ''}
      />
    ),
  },
  COLUMN_STATE,
  COLUMN_DISK,
  COLUMN_SPEED,
]
const COLUMNS_SMB_REMOTE = [
  COLUMN_NAME,
  {
    itemRenderer: (remote, { formatMessage }) => (
      <span>
        <strong className='text-info'>\\</strong>
        <Text
          data-element='host'
          data-remote={remote}
          onChange={_changeUrlElement}
          value={remote.host}
        />
        <strong className='text-info'>\</strong>
        <span>
          <Text
            data-element='path'
            data-remote={remote}
            onChange={_changeUrlElement}
            placeholder={formatMessage(messages.remoteSmbPlaceHolderRemotePath)}
            value={remote.path}
          />
        </span>
      </span>
    ),
    name: _('remoteShare'),
  },
  COLUMN_STATE,
  {
    itemRenderer: (remote, { formatMessage }) => (
      <span>
        <Text
          data-element='username'
          data-remote={remote}
          onChange={_changeUrlElement}
          value={remote.username}
        />
        :
        <Password
          data-element='password'
          data-remote={remote}
          onChange={_changeUrlElement}
          placeholder={formatMessage(messages.remotePlaceHolderPassword)}
          value=''
        />
        @
        <Text
          data-element='domain'
          data-remote={remote}
          onChange={_changeUrlElement}
          value={remote.domain}
        />
      </span>
    ),
    name: _('remoteAuth'),
  },
  COLUMN_SPEED,
]

const GROUPED_ACTIONS = [
  {
    handler: deleteRemotes,
    icon: 'delete',
    label: _('remoteDeleteSelected'),
    level: 'danger',
  },
]

const INDIVIDUAL_ACTIONS = [
  {
    disabled: remote => !remote.enabled,
    handler: remote =>
      testRemote(remote).then(answer => {
        _editRemoteSpeed(answer, remote)
        return (
          answer.success
            ? alert(
                <span>
                  <Icon icon='success' />{' '}
                  {_('remoteTestSuccess', { name: remote.name })}
                </span>,
                _('remoteTestSuccessMessage')
              )
            : alert(
                <span>
                  <Icon icon='error' />{' '}
                  {_('remoteTestFailure', { name: remote.name })}
                </span>,
                <p>
                  <dl className='dl-horizontal'>
                    <dt>{_('remoteTestError')}</dt>
                    <dd>{answer.error}</dd>
                    <dt>{_('remoteTestStep')}</dt>
                    <dd>{answer.step}</dd>
                  </dl>
                </p>
              ),
          noop
        )
      }),
    icon: 'diagnosis',
    label: _('remoteTestTip'),
    level: 'primary',
  },
  {
    handler: (remote, { editRemote }) => editRemote(remote),
    icon: 'edit',
    label: _('formEdit'),
    level: 'primary',
  },
  {
    handler: deleteRemote,
    icon: 'delete',
    label: _('remoteDeleteTip'),
    level: 'danger',
  },
]
const FILTERS = {
  filterRemotesOnlyConnected: 'enabled?',
  filterRemotesOnlyDisconnected: '!enabled?',
}

export default decorate([
  addSubscriptions({
    remotes: subscribeRemotes,
    remotesInfo: subscribeRemotesInfo,
  }),
  injectIntl,
  provideState({
    initialState: () => ({
      formKey: generateRandomId(),
      remote: undefined,
    }),
    effects: {
      reset: () => () => ({
        formKey: generateRandomId(),
        remote: undefined,
      }),
      editRemote: (_, remote) => () => ({
        remote,
      }),
    },
    computed: {
      remoteWithInfo: (_, { remotes, remotesInfo }) =>
        groupBy(
          map(remotes, remote => ({
            ...parse(remote.url),
            ...remote,
            info: remotesInfo !== undefined ? remotesInfo[remote.id] : {},
          })),
          'type'
        ),
    },
  }),
  injectState,
  ({ state, effects, remotes = {}, intl: { formatMessage } }) => (
    <div>
      {!isEmpty(state.remoteWithInfo.file) && (
        <div>
          <h2>{_('remoteTypeLocal')}</h2>
          <SortedTable
            collection={state.remoteWithInfo.file}
            columns={COLUMNS_LOCAL_REMOTE}
            data-editRemote={effects.editRemote}
            data-formatMessage={formatMessage}
            filters={FILTERS}
            groupedActions={GROUPED_ACTIONS}
            individualActions={INDIVIDUAL_ACTIONS}
            stateUrlParam='l'
          />
        </div>
      )}

      {!isEmpty(state.remoteWithInfo.nfs) && (
        <div>
          <h2>{_('remoteTypeNfs')}</h2>
          <SortedTable
            collection={state.remoteWithInfo.nfs}
            columns={COLUMNS_NFS_REMOTE}
            data-editRemote={effects.editRemote}
            data-formatMessage={formatMessage}
            filters={FILTERS}
            groupedActions={GROUPED_ACTIONS}
            individualActions={INDIVIDUAL_ACTIONS}
            stateUrlParam='nfs'
          />
        </div>
      )}

      {!isEmpty(state.remoteWithInfo.smb) && (
        <div>
          <h2>{_('remoteTypeSmb')}</h2>
          <SortedTable
            collection={state.remoteWithInfo.smb}
            columns={COLUMNS_SMB_REMOTE}
            data-editRemote={effects.editRemote}
            data-formatMessage={formatMessage}
            filters={FILTERS}
            groupedActions={GROUPED_ACTIONS}
            individualActions={INDIVIDUAL_ACTIONS}
            stateUrlParam='smb'
          />
        </div>
      )}
      <Remote formatMessage={formatMessage} key={state.formKey} />
    </div>
  ),
])
