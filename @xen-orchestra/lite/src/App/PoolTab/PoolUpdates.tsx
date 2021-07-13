import React from 'react'
import { Map } from 'immutable'
import { withState } from 'reaclette'

import IntlMessage from '../../components/IntlMessage'
import XapiConnection, { Host, ObjectsByType, PoolUpdate } from '../../libs/xapi'
import Table, { Column } from '../../components/Table'
import { formatSize } from '../../helpers/format'

const COLUMN: Column<PoolUpdate>[] = [
  {
    header: <IntlMessage id='name' />,
    render: update => update.name,
  },
  {
    header: <IntlMessage id='description' />,
    render: update => update.description,
  },
  {
    header: <IntlMessage id='version' />,
    render: update => update.version,
  },
  {
    header: <IntlMessage id='release' />,
    render: update => update.release,
  },
  {
    header: <IntlMessage id='size' />,
    render: update => formatSize(update.size),
  },
]

interface ParentState {
  objectsByType: ObjectsByType
  objectsFetched: boolean
  xapi: XapiConnection
}

interface State {}

interface Props {
  poolId: string
}

interface ParentEffects {}

interface Effects {}

interface Computed {
  availableUpdates?: PoolUpdate[]
  hosts?: Map<string, Host>
}

const PoolUpdates = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    computed: {
      availableUpdates: async function (state) {
        const promises: Promise<unknown>[] = []
        state.hosts?.forEach(({ $ref }) =>
          promises.push(state.xapi.call('host.call_plugin', $ref, 'updater.py', 'check_update', {}))
        )

        let poolUpdates: Map<string, PoolUpdate> = Map()
        ;(await Promise.all(promises)).forEach(stringifiedPoolUpdates => {
          if (typeof stringifiedPoolUpdates !== 'string') return
          JSON.parse(stringifiedPoolUpdates).forEach((update: PoolUpdate | string) => {
            // update variable can be a string that contain: "The updater plugin is busy"
            if (typeof update !== 'string' && !poolUpdates.has(update.name)) {
              poolUpdates = poolUpdates.set(update.name, update)
            }
          })
        })
        return poolUpdates
          .map(update => ({ id: update.name, ...update }))
          .valueSeq()
          .toArray()
      },
      hosts: function (state) {
        return state.objectsByType.get('host')
      },
    },
  },
  ({ state: { availableUpdates } }) => (
    <>
      {availableUpdates !== undefined && availableUpdates.length !== 0 && (
        <IntlMessage id='availableUpdates' values={{ nUpdates: availableUpdates.length }} />
      )}
      <Table collection={availableUpdates} columns={COLUMN} placeholder={<IntlMessage id='noUpdatesAvailable' />} />
    </>
  )
)

export default PoolUpdates
