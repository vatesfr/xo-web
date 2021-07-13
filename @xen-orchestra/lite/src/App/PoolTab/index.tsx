import React from 'react'
import { withState } from 'reaclette'

import PoolNetworks from './PoolNetworks'
import PoolUpdates from './PoolUpdates'

import IntlMessage from '../../components/IntlMessage'
import { ObjectsByType, Pool } from '../../libs/xapi'

interface ParentState {
  objectsFetched: boolean
}

interface State {
  objectsByType: ObjectsByType
}

interface Props {}

interface ParentEffects {}

interface Effects {}

interface Computed {
  pool?: Pool
}

const PoolTab = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    computed: {
      pool: state => (state.objectsFetched ? state.objectsByType?.get('pool')?.first() : undefined),
    },
  },
  ({ state }) =>
    state.pool !== undefined ? (
      <>
        <PoolNetworks poolId={state.pool.$id} />
        <PoolUpdates poolId={state.pool.$id} />
      </>
    ) : (
      <IntlMessage id='loading' />
    )
)

export default PoolTab
