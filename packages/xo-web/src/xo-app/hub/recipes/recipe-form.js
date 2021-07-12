import * as FormGrid from 'form-grid'
import _, { messages } from 'intl'
import decorate from 'apply-decorators'
import React from 'react'
import { Card, CardBlock, CardHeader } from 'card'
import { Container } from 'grid'
import { get } from '@xen-orchestra/defined'
import { injectIntl } from 'react-intl'
import { injectState, provideState } from 'reaclette'
import { Input as DebounceInput } from 'debounce-input-decorator'
import { isSrWritable } from 'xo'
import { SelectPool, SelectNetwork, SelectSr } from 'select-objects'
import { SizeInput } from 'form'

export default decorate([
  injectIntl,
  provideState({
    effects: {
      onChangePool(__, pool) {
        const { onChange, value } = this.props
        onChange({
          ...value,
          pool,
        })
      },
      onChangeSr(__, sr) {
        const { onChange, value } = this.props
        onChange({
          ...value,
          sr,
        })
      },
      onChangeNetwork(__, network) {
        const { onChange, value } = this.props
        onChange({
          ...value,
          network,
        })
      },
      onChangeValue(__, ev) {
        const { name, value } = ev.target
        const { onChange, value: prevValue } = this.props
        onChange({
          ...prevValue,
          [name]: value,
        })
      },
      onChangeMemorySize(__, memorySize) {
        const { onChange, value } = this.props
        onChange({ ...value, memorySize })
      },
      onChangeDiskSize(__, diskSize) {
        const { onChange, value } = this.props
        onChange({ ...value, diskSize })
      },
    },
    computed: {
      networkPredicate:
        (_, { value: { pool } }) =>
        network =>
          pool.id === network.$pool,
      srPredicate:
        (_, { value }) =>
        sr =>
          sr.$pool === get(() => value.pool.id) && isSrWritable(sr),
    },
  }),
  injectState,
  ({ effects, install, intl: { formatMessage }, state, value }) => (
    <Container>
      <FormGrid.Row>
        <label>{_('vmImportToPool')}</label>
        <SelectPool className='mb-1' onChange={effects.onChangePool} required value={value.pool} />
      </FormGrid.Row>
      <FormGrid.Row>
        <label>{_('vmImportToSr')}</label>
        <SelectSr onChange={effects.onChangeSr} predicate={state.srPredicate} required value={value.sr} />
      </FormGrid.Row>
      <FormGrid.Row>
        <label>{_('network')}</label>
        <SelectNetwork
          className='mb-1'
          onChange={effects.onChangeNetwork}
          required
          value={value.network}
          predicate={state.networkPredicate}
        />
      </FormGrid.Row>
      <FormGrid.Row>
        <label>{_('recipeMasterNameLabel')}</label>
        <input
          className='form-control'
          name='masterName'
          onChange={effects.onChangeValue}
          placeholder={formatMessage(messages.recipeMasterNameLabel)}
          required
          type='text'
          value={value.masterName}
        />
      </FormGrid.Row>
      <FormGrid.Row>
        <label>{_('recipeMasterHostNameLabel')}</label>
        <input
          className='form-control'
          name='masterHostName'
          onChange={effects.onChangeValue}
          placeholder={formatMessage(messages.recipeMasterHostNameLabel)}
          required
          type='text'
          value={value.masterHostName}
        />
      </FormGrid.Row>
      {/* TODO:
      <Card>
        <CardHeader>
          <label>{_('recipeMasterIpConfigLabel')}</label>
        </CardHeader>
        <CardBlock>
          <FormGrid.Row>
            <label>{_('recipeMasterIpLabel')}</label>
            <div className='input-group'>
              <input
                className='form-control'
                name='masterIp'
                onChange={effects.onChangeValue}
                placeholder={formatMessage(messages.recipeMasterIpLabel)}
                type='text'
                value={value.masterIp}
              />
              <span className='input-group-addon'>/</span>
              <input
                className='form-control'
                max='32'
                min='0'
                name='masterIpPrefix'
                onChange={effects.onChangeValue}
                placeholder={formatMessage(messages.recipeMasterIpPrefixLabel)}
                type='number'
                value={value.masterIpPrefix}
              />
            </div>
          </FormGrid.Row>
          <FormGrid.Row>
            <label>{_('recipeMasterIpGatewayLabel')}</label>
            <input
              className='form-control'
              name='masterIpGateway'
              onChange={effects.onChangeValue}
              placeholder={formatMessage(messages.recipeMasterIpGatewayLabel)}
              type='text'
              value={value.masterIpGateway}
            />
          </FormGrid.Row>
          <FormGrid.Row>
            <label>{_('recipeMasterIpDnsLabel')}</label>
            <textarea
              className='form-control'
              name='masterIpDns'
              onChange={effects.onChangeValue}
              placeholder="DNS list separated by comma:','"
              rows={1}
              value={value.masterIpRange}
            />
          </FormGrid.Row>
        </CardBlock>
      </Card>
      */}
      <FormGrid.Row>
        <label>{_('recipeNodeNamePatternLabel')}</label>
        <input
          className='form-control'
          name='nodeNamePattern'
          onChange={effects.onChangeValue}
          placeholder={formatMessage(messages.recipeNodeNamePatternLabel)}
          required
          type='text'
          value={value.nodeNamePattern}
        />
      </FormGrid.Row>
      <FormGrid.Row>
        <label>{_('recipeNodeHostNamePatternLabel')}</label>
        <input
          className='form-control'
          name='nodeHostNamePattern'
          onChange={effects.onChangeValue}
          placeholder={formatMessage(messages.recipeNodeHostNamePatternLabel)}
          required
          type='text'
          value={value.nodeHostNamePattern}
        />
      </FormGrid.Row>
      <FormGrid.Row>
        <label>{_('recipeNumberOfNodesLabel')}</label>
        <input
          className='form-control'
          name='nbNodes'
          min='1'
          onChange={effects.onChangeValue}
          placeholder={formatMessage(messages.recipeNumberOfNodesLabel)}
          required
          type='number'
          value={value.nbNodes}
        />
      </FormGrid.Row>
      <FormGrid.Row>
        <label>{_('recipeSshKeyLabel')}</label>
        <input
          className='form-control'
          name='sshKey'
          onChange={effects.onChangeValue}
          placeholder={formatMessage(messages.recipeSshKeyLabel)}
          required
          type='text'
          value={value.sshKey}
        />
      </FormGrid.Row>
      <FormGrid.Row>
        <label>{_('recipeNetworkCidr')}</label>
        <div className='input-group'>
          <input
            className='form-control'
            name='cidrRange'
            onChange={effects.onChangeValue}
            placeholder='IP range'
            required
            type='text'
            value={value.cidrRange}
          />
          <span className='input-group-addon'>/</span>
          <input
            className='form-control'
            max='32'
            min='0'
            name='cidrPrefix'
            onChange={effects.onChangeValue}
            placeholder='CIDR prefix'
            required
            type='number'
            value={value.cidrPrefix}
          />
        </div>
      </FormGrid.Row>
      <Card>
        <CardHeader>
          <label>{_('recipeVmConfigLabel')}</label>
        </CardHeader>
        <CardBlock>
          <FormGrid.Row>
            <label>{_('newVmVcpusLabel')}</label>
            <DebounceInput
              className='form-control'
              min={1}
              name='cpus'
              onChange={effects.onChangeValue}
              placeholder={formatMessage(messages.newVmVcpusLabel)}
              type='number'
              value={value.cpus}
            />
          </FormGrid.Row>
          <FormGrid.Row>
            <label>{_('newVmRamLabel')}</label>
            <SizeInput
              className='form-control'
              name='memorySize'
              onChange={effects.onChangeMemorySize}
              placeholder={formatMessage(messages.newVmRamLabel)}
              value={value.memorySize}
            />
          </FormGrid.Row>
          <FormGrid.Row>
            <label>{_('recipeSizeLabel')}</label>
            <SizeInput
              className='form-control'
              name='memorySize'
              onChange={effects.onChangeDiskSize}
              placeholder={formatMessage(messages.recipeSizeLabel)}
              value={value.diskSize}
            />
          </FormGrid.Row>
        </CardBlock>
      </Card>
    </Container>
  ),
])
