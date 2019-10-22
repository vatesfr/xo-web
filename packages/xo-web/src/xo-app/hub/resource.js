import _ from 'intl'
import ActionButton from 'action-button'
import decorate from 'apply-decorators'
import defined from '@xen-orchestra/defined'
import Icon from 'icon'
import marked from 'marked'
import React from 'react'
import { Card, CardBlock, CardHeader } from 'card'
import { Col, Row } from 'grid'
import { alert, form } from 'modal'
import { connectStore, formatSize, getXoaPlan } from 'utils'
import { createGetObjectsOfType } from 'selectors'
import { downloadAndInstallResource, deleteTemplates } from 'xo'
import { error, success } from 'notification'
import { find, filter, isEmpty, map, omit, startCase } from 'lodash'
import { injectState, provideState } from 'reaclette'
import { withRouter } from 'react-router'

import ResourceForm from './resource-form'

const Li = props => <li {...props} className='list-group-item' />
const Ul = props => <ul {...props} className='list-group' />

// 'any' is a default hub metadata, please don't remove it from BANNED_FIELDS
const BANNED_FIELDS = ['any', 'description'] // These fields will not be displayed on description modal
const EXCLUSIVE_FIELDS = ['longDescription'] // These fields will not have a label
const MARKDOWN_FIELDS = ['longDescription', 'description']
const STATIC_FIELDS = [...EXCLUSIVE_FIELDS, ...BANNED_FIELDS] // These fields will not be displayed with dynamic fields

const subscribeAlert = () =>
  alert(
    _('hubResourceAlert'),
    <div>
      <p>
        {_('considerSubscribe', {
          link: 'https://xen-orchestra.com',
        })}
      </p>
    </div>
  )

export default decorate([
  withRouter,
  connectStore(() => {
    const getTemplates = createGetObjectsOfType('VM-template').sort()
    const getPools = createGetObjectsOfType('pool')
    return {
      templates: getTemplates,
      pools: getPools,
      hubInstallingResources: state => state.hubInstallingResources,
    }
  }),
  provideState({
    initialState: () => ({
      selectedInstallPools: [],
    }),
    effects: {
      async install() {
        const {
          id,
          name,
          namespace,
          markHubResourceAsInstalled,
          markHubResourceAsInstalling,
          templates,
          version,
        } = this.props
        const { isTemplateInstalled } = this.state
        if (getXoaPlan() === 'Community') {
          subscribeAlert()
          return
        }
        const resourceParams = await form({
          defaultValue: {
            mapPoolsSrs: {},
            pools: [],
          },
          render: props => (
            <ResourceForm
              install
              multi
              poolPredicate={isTemplateInstalled}
              {...props}
            />
          ),
          header: (
            <span>
              <Icon icon='add-vm' /> {name}
            </span>
          ),
          size: 'medium',
        })

        markHubResourceAsInstalling(id)
        try {
          await Promise.all(
            resourceParams.pools.map(pool =>
              downloadAndInstallResource({
                namespace,
                id,
                version,
                sr: defined(
                  resourceParams.mapPoolsSrs[pool.id],
                  pool.default_SR
                ),
              })
            )
          )
          success(_('hubImportNotificationTitle'), _('successfulInstall'))
          const installedTemplates = filter(templates, [
            'other.xo:resource:namespace',
            namespace,
          ])
          const olderTemplates = filter(installedTemplates, template =>
            find(resourceParams.pools, { $pool: template.$pool })
          )

          if (olderTemplates.length > 0) {
            await deleteTemplates(olderTemplates)
          }
        } catch (_error) {
          error(_('hubImportNotificationTitle'), _error.message)
        }
        markHubResourceAsInstalled(id)
      },
      async create() {
        const { isPoolCreated, installedTemplates } = this.state
        const { name } = this.props
        if (getXoaPlan() === 'Community') {
          subscribeAlert()
          return
        }
        const resourceParams = await form({
          defaultValue: {
            pool: undefined,
          },
          render: props => (
            <ResourceForm poolPredicate={isPoolCreated} {...props} />
          ),
          header: (
            <span>
              <Icon icon='add-vm' /> {name}
            </span>
          ),
          size: 'medium',
        })
        const { $pool } = resourceParams.pool
        const template = find(installedTemplates, { $pool })
        if (template !== undefined) {
          this.props.router.push(
            `/vms/new?pool=${$pool}&template=${template.id}`
          )
        } else {
          throw new Error(`can't find template for pool: ${$pool}`)
        }
      },
      async deleteTemplates(__, { name }) {
        const { isPoolCreated } = this.state
        const resourceParams = await form({
          defaultValue: {
            pools: [],
          },
          render: props => (
            <ResourceForm
              delete
              multi
              poolPredicate={isPoolCreated}
              {...props}
            />
          ),
          header: (
            <span>
              <Icon icon='vm-delete' /> {name}
            </span>
          ),
          size: 'medium',
        })
        const _templates = filter(this.state.installedTemplates, template =>
          find(resourceParams.pools, { $pool: template.$pool })
        )
        await deleteTemplates(_templates)
      },
      updateSelectedInstallPools(_, selectedInstallPools) {
        return {
          selectedInstallPools,
        }
      },
      updateSelectedCreatePool(_, selectedCreatePool) {
        return {
          selectedCreatePool,
        }
      },
      redirectToTaskPage() {
        this.props.router.push('/tasks')
      },
      showDescription() {
        const {
          data: { public: _public },
          name,
        } = this.props
        alert(
          name,
          <div>
            {isEmpty(omit(_public, BANNED_FIELDS)) ? (
              <p>{_('hubTemplateDescriptionNotAvailable')}</p>
            ) : (
              <div>
                <Ul>
                  {EXCLUSIVE_FIELDS.map(fieldKey => {
                    const field = _public[fieldKey]
                    if (field !== undefined) {
                      return (
                        <Li key={fieldKey}>
                          {MARKDOWN_FIELDS.includes(fieldKey) ? (
                            <div
                              dangerouslySetInnerHTML={{
                                __html: marked(field),
                              }}
                            />
                          ) : (
                            field
                          )}
                        </Li>
                      )
                    }
                    return null
                  })}
                </Ul>
                <br />
                <Ul>
                  {map(omit(_public, STATIC_FIELDS), (value, key) => (
                    <Li key={key}>
                      {startCase(key)}
                      <span className='pull-right'>
                        {typeof value === 'boolean' ? (
                          <Icon
                            color={value ? 'green' : 'red'}
                            icon={value ? 'true' : 'false'}
                          />
                        ) : key.toLowerCase().endsWith('size') ? (
                          <strong>{formatSize(value)}</strong>
                        ) : (
                          <strong>{value}</strong>
                        )}
                      </span>
                    </Li>
                  ))}
                </Ul>
              </div>
            )}
          </div>
        )
      },
    },
    computed: {
      description: (
        _,
        {
          data: {
            public: { description },
          },
          description: _description,
        }
      ) =>
        (description !== undefined || _description !== undefined) && (
          <div
            className='text-muted'
            dangerouslySetInnerHTML={{
              __html: marked(defined(description, _description)),
            }}
          />
        ),
      installedTemplates: (_, { id, templates }) =>
        filter(templates, ['other.xo:resource:xva:id', id]),
      isTemplateInstalledOnAllPools: ({ installedTemplates }, { pools }) =>
        installedTemplates.length > 0 &&
        pools.every(
          pool =>
            installedTemplates.find(template => template.$pool === pool.id) !==
            undefined
        ),
      isTemplateInstalled: ({ installedTemplates }) => pool =>
        installedTemplates.find(template => template.$pool === pool.id) ===
        undefined,
      isPoolCreated: ({ installedTemplates }) => pool =>
        installedTemplates.find(template => template.$pool === pool.id) !==
        undefined,
    },
  }),
  injectState,
  ({
    effects,
    hubInstallingResources,
    id,
    name,
    size,
    state,
    totalDiskSize,
  }) => (
    <Card shadow>
      <CardHeader>
        {name}
        <ActionButton
          className='pull-right'
          color='light'
          data-name={name}
          disabled={state.installedTemplates.length === 0}
          handler={effects.deleteTemplates}
          icon='delete'
          size='small'
          style={{ border: 'none' }}
          tooltip={_('remove')}
        />
        <br />
      </CardHeader>
      <CardBlock>
        {state.description}
        <ActionButton
          className='pull-right'
          color='light'
          handler={effects.showDescription}
          icon='info'
          size='small'
        >
          {_('moreDetails')}
        </ActionButton>
        <div>
          <span className='text-muted'>{_('size')}</span>
          {'  '}
          <strong>{formatSize(size)}</strong>
        </div>
        <div>
          <span className='text-muted'>{_('totalDiskSize')}</span>
          {'  '}
          <strong>{formatSize(totalDiskSize)}</strong>
        </div>
        <hr />
        <Row>
          <Col mediumSize={6}>
            <ActionButton
              block
              disabled={state.isTemplateInstalledOnAllPools}
              form={state.idInstallForm}
              handler={effects.install}
              icon='add'
              pending={hubInstallingResources[id]}
            >
              {_('install')}
            </ActionButton>
          </Col>
          <Col mediumSize={6}>
            <ActionButton
              block
              disabled={state.installedTemplates.length === 0}
              form={state.idCreateForm}
              handler={effects.create}
              icon='deploy'
            >
              {_('create')}
            </ActionButton>
          </Col>
        </Row>
      </CardBlock>
    </Card>
  ),
])
