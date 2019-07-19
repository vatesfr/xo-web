import _ from 'intl'
import Copiable from 'copiable'
import defined from '@xen-orchestra/defined'
import Icon from 'icon'
import isEmpty from 'lodash/isEmpty'
import map from 'lodash/map'
import React from 'react'
import HomeTags from 'home-tags'
import renderXoItem, { User } from 'render-xo-item'
import Tooltip from 'tooltip'
import { addTag, editVm, removeTag } from 'xo'
import { BlockLink } from 'link'
import { FormattedRelative, FormattedDate } from 'react-intl'
import { Container, Row, Col } from 'grid'
import { Number, Size } from 'editable'
import {
  createCollectionWrapper,
  createFinder,
  createGetObjectsOfType,
  createGetVmLastShutdownTime,
  createSelector,
  isAdmin,
} from 'selectors'
import {
  connectStore,
  formatSize,
  getVirtualizationModeLabel,
  osFamily,
} from 'utils'
import {
  CpuSparkLines,
  MemorySparkLines,
  NetworkSparkLines,
  XvdSparkLines,
} from 'xo-sparklines'

export default connectStore(() => {
  const getVgpus = createGetObjectsOfType('vgpu')
    .pick((_, { vm }) => vm.$VGPUs)
    .sort()

  const getAttachedVgpu = createFinder(getVgpus, vgpu => vgpu.currentlyAttached)

  const getVgpuTypes = createGetObjectsOfType('vgpuType').pick(
    createSelector(
      getVgpus,
      vgpus => map(vgpus, 'vgpuType')
    )
  )

  return {
    isAdmin,
    lastShutdownTime: createGetVmLastShutdownTime(),
    tasks: createGetObjectsOfType('task')
      .pick(
        createSelector(
          (_, { vm }) => vm.current_operations,
          createCollectionWrapper(Object.keys)
        )
      )
      .filter({ status: 'pending' })
      .sort(),
    vgpu: getAttachedVgpu,
    vgpuTypes: getVgpuTypes,
  }
})(
  ({
    isAdmin,
    lastShutdownTime,
    statsOverview,
    tasks,
    vgpu,
    vgpuTypes,
    vm,
    vmTotalDiskSpace,
  }) => {
    const {
      addresses,
      CPUs: cpus,
      id,
      installTime,
      memory,
      os_version: osVersion,
      other,
      power_state: powerState,
      startTime,
      tags,
      VIFs: vifs,
      xenTools,
    } = vm
    return (
      <Container>
        {/* TODO: use CSS style */}
        <br />
        <Row className='text-xs-center'>
          <Col mediumSize={3}>
            <h2>
              <Number
                value={cpus.number}
                onChange={vcpus => editVm(vm, { CPUs: vcpus })}
              />
              x <Icon icon='cpu' size='lg' />
            </h2>
            <BlockLink to={`/vms/${id}/stats`}>
              {statsOverview && <CpuSparkLines data={statsOverview} />}
            </BlockLink>
          </Col>
          <Col mediumSize={3}>
            <h2 className='form-inline'>
              <Size
                value={defined(memory.dynamic[1], null)}
                onChange={memory => editVm(vm, { memory })}
              />
              &nbsp;
              <span>
                <Icon icon='memory' size='lg' />
              </span>
            </h2>
            <BlockLink to={`/vms/${id}/stats`}>
              {statsOverview && <MemorySparkLines data={statsOverview} />}
            </BlockLink>
          </Col>
          <Col mediumSize={3}>
            <BlockLink to={`/vms/${id}/network`}>
              <h2>
                {vifs.length}x <Icon icon='network' size='lg' />
              </h2>
            </BlockLink>
            <BlockLink to={`/vms/${id}/stats`}>
              {statsOverview && <NetworkSparkLines data={statsOverview} />}
            </BlockLink>
          </Col>
          <Col mediumSize={3}>
            <BlockLink to={`/vms/${id}/disks`}>
              <h2>
                {formatSize(vmTotalDiskSpace)} <Icon icon='disk' size='lg' />
              </h2>
            </BlockLink>
            <BlockLink to={`/vms/${id}/stats`}>
              {statsOverview && <XvdSparkLines data={statsOverview} />}
            </BlockLink>
          </Col>
        </Row>
        {/* TODO: use CSS style */}
        <br />
        <Row className='text-xs-center'>
          <Col mediumSize={3}>
            {installTime !== null && (
              <div className='text-xs-center'>
                {_('created', {
                  date: (
                    <FormattedDate
                      day='2-digit'
                      month='long'
                      value={installTime * 1000}
                      year='numeric'
                    />
                  ),
                })}
              </div>
            )}
            {powerState === 'Running' || powerState === 'Paused' ? (
              <div>
                <p className='text-xs-center'>
                  {_('started', {
                    ago: <FormattedRelative value={startTime * 1000} />,
                  })}
                </p>
              </div>
            ) : (
              <p className='text-xs-center'>
                {lastShutdownTime
                  ? _('vmHaltedSince', {
                      ago: (
                        <FormattedRelative value={lastShutdownTime * 1000} />
                      ),
                    })
                  : _('vmNotRunning')}
              </p>
            )}
          </Col>
          <Col mediumSize={3}>
            <p>{_(getVirtualizationModeLabel(vm))}</p>
            {vgpu !== undefined && (
              <p>{renderXoItem(vgpuTypes[vgpu.vgpuType])}</p>
            )}
          </Col>
          <Col mediumSize={3}>
            <BlockLink to={`/vms/${id}/network`}>
              {addresses && addresses['0/ip'] ? (
                <Copiable tagName='p'>{addresses['0/ip']}</Copiable>
              ) : (
                <p>{_('noIpv4Record')}</p>
              )}
            </BlockLink>
          </Col>
          <Col mediumSize={3}>
            <BlockLink to={`/vms/${id}/advanced`}>
              <Tooltip
                content={osVersion ? osVersion.name : _('unknownOsName')}
              >
                <h1>
                  <Icon
                    className='text-info'
                    icon={
                      osVersion &&
                      osVersion.distro &&
                      osFamily(osVersion.distro)
                    }
                  />
                </h1>
              </Tooltip>
            </BlockLink>
          </Col>
        </Row>
        {isAdmin && other.owner !== undefined && (
          <Row className='text-xs-center'>
            <Col>
              {_('keyValue', {
                key: _('owner'),
                value: (
                  <User id={other.owner} link={process.env.XOA_PLAN > 2} />
                ),
              })}
            </Col>
          </Row>
        )}
        {!xenTools && powerState === 'Running' && (
          <Row className='text-xs-center'>
            <Col>
              <Icon icon='error' />
              <em> {_('noToolsDetected')}.</em>
            </Col>
          </Row>
        )}
        {/* TODO: use CSS style */}
        <br />
        <Row>
          <Col>
            <h2 className='text-xs-center'>
              <HomeTags
                type='VM'
                labels={tags}
                onDelete={tag => removeTag(id, tag)}
                onAdd={tag => addTag(id, tag)}
              />
            </h2>
          </Col>
        </Row>
        {isEmpty(tasks) ? null : (
          <Row className='text-xs-center'>
            <Col>
              <h4>{_('vmCurrentStatus')}</h4>
              {map(tasks, task => (
                <p>
                  <strong>{task.name_label}</strong>
                  {task.progress > 0 && (
                    <span>: {Math.round(task.progress * 100)}%</span>
                  )}
                </p>
              ))}
            </Col>
          </Row>
        )}
      </Container>
    )
  }
)
