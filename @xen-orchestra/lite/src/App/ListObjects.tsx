import React from 'react'
import { Map, Collection } from 'immutable'
import { withState } from 'reaclette'

import Tree from '../components/Tree'
import TreeNode from '../components/TreeNode'
import { Vm, Host, Pool } from '../libs/xapi'

interface ParentState {}

interface State {}

interface Props {}

interface ParentEffects {}

interface Effects {}

interface Computed {
  hostsByPool?: Collection.Keyed<string, Collection<string, Host>>
  objectsFetched: boolean
  pools?: Map<string, Pool>
  vms?: Map<string, Vm>
  vmsByRef?: Collection.Keyed<string, Collection<string, Vm>>
  vmsByPool?: Collection.Keyed<string, Collection<string, Vm>>
}

const getIconColor = obj => {
  let powerState = obj.power_state
  if (obj.$type === 'host') {
    const { $metrics } = obj
    powerState = $metrics ? ($metrics.live ? 'Running' : 'Halted') : 'Unknown'
  }
  return powerState === 'Running' ? 'green' : powerState === 'Halted' ? 'red' : 'grey'
}

const ListObjects = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    computed: {
      hostsByPool: state => {
        const hosts = state.objectsFetched ? state.objectsByType?.get('host') : undefined
        return hosts?.groupBy(host => host.$pool.$id)
      },
      objectsFetched: state => state.objectsByType !== undefined,
      pools: state => (state.objectsFetched ? state.objectsByType?.get('pool') : undefined),
      vms: state =>
        state.objectsFetched
          ? state.objectsByType
              ?.get('VM')
              ?.filter((vm: Vm) => !vm.is_control_domain && !vm.is_a_snapshot && !vm.is_a_template)
          : undefined,
      vmsByPool: state => state.vms?.groupBy(vm => vm.$pool.$id),
      vmsByRef: state => state.vms?.groupBy(vm => vm.$ref),
    },
  },
  ({ state }) => {
    // TODO: send collection instead of JSX elements
    return (
      state.pools !== undefined && (
        <>
          <Tree>
            {state.pools.valueSeq().map((pool: Pool) => {
              let hosts, vms
              return (
                <TreeNode
                  data-icon='cloud'
                  data-iconColor='black'
                  data-id={pool.$id}
                  data-nameLabel={pool.name_label}
                  key={pool.$id}
                >
                  {state.hostsByPool !== undefined && (hosts = state.hostsByPool.get(pool.$id)) && hosts === undefined
                    ? null
                    : hosts.valueSeq().map(host => (
                        <TreeNode
                          data-icon='server'
                          data-iconColor={getIconColor(host)}
                          data-id={host.$id}
                          data-nameLabel={host.name_label}
                          key={host.$id}
                        >
                          {host.resident_VMs.map(vmRef => {
                            const vms = state.vmsByRef !== undefined ? state.vmsByRef.get(vmRef) : undefined
                            return (
                              vms !== undefined &&
                              vms
                                .valueSeq()
                                .map(vm => (
                                  <TreeNode
                                    data-icon='desktop'
                                    data-iconColor={getIconColor(vm)}
                                    data-id={vm.$id}
                                    data-nameLabel={vm.name_label}
                                    data-to={`/:${vm.$id}/console`}
                                    key={vm.$id}
                                    link
                                  />
                                ))
                            )
                          })}
                        </TreeNode>
                      ))}
                  {state.vmsByPool !== undefined &&
                    (vms = state.vmsByPool.get(pool.$id)) !== undefined &&
                    vms.valueSeq().map((vm: Vm) => {
                      return vm.power_state === 'Running' ? null : (
                        <TreeNode
                          data-icon='desktop'
                          data-iconColor={getIconColor(vm)}
                          data-id={vm.$id}
                          data-nameLabel={vm.name_label}
                          data-to={`/:${vm.$id}/console`}
                          key={vm.$id}
                          link
                        />
                      )
                    })}
                </TreeNode>
              )
            })}
          </Tree>
        </>
      )
    )
  }
)

export default ListObjects
