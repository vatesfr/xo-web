import Cookies from 'js-cookie'
import React from 'react'
import styled from 'styled-components'
import { FormattedMessage, IntlProvider } from 'react-intl'
import { HashRouter as Router, Switch, Route, Link } from 'react-router-dom'
import { Map, Collection } from 'immutable'
import { withState } from 'reaclette'

import Button from '../components/Button'
import messagesEn from '../lang/en.json'
import Signin from './Signin/index'
import StyleGuide from './StyleGuide/index'
import TabConsole from './TabConsole'
import TreeNode from '../components/TreeNode'
import Tree from '../components/Tree'
import XapiConnection, { ObjectsByType, Vm, Host, Pool } from '../libs/xapi'

interface ParentState {
  objectsByType: ObjectsByType
  xapi: XapiConnection
}

interface State {
  connected: boolean
  error: JSX.Element
  xapiHostname: string
}

interface Props {}

interface ParentEffects {}

interface Effects {
  connectToXapi: (password: string, rememberMe: boolean) => void
  disconnect: () => void
}

interface Computed {
  objectsFetched: boolean
  url: string
  vms?: Map<string, Vm>
  pools?: Map<string, Pool>
  hostsByPool?: Collection.Keyed<string, Collection<string, Host>>
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

const LeftView = styled.div`
  width: 24%;
  height: 100%;
  float: left;
`

const RightView = styled.div`
  width: 75%;
  background-color: green;
  height: 100%;
  float: left;
`
const VerticalLine = styled.div`
  margin: 0;
  padding: 0;
  border-left-width: thick;
  border-left: double;
  height: 50px;
  float: left;
`

const App = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    initialState: () => ({
      connected: Cookies.get('sessionId') !== undefined,
      error: '',
      objectsByType: undefined,
      xapi: undefined,
      xapiHostname: process.env.XAPI_HOST || window.location.host,
    }),
    effects: {
      initialize: async function () {
        const xapi = (this.state.xapi = new XapiConnection())

        xapi.on('connected', () => {
          this.state.connected = true
        })

        xapi.on('disconnected', () => {
          this.state.connected = false
        })

        xapi.on('objects', (objectsByType: ObjectsByType) => {
          this.state.objectsByType = objectsByType
        })

        try {
          await xapi.reattachSession(this.state.url)
        } catch (err) {
          if (err.code !== 'SESSION_INVALID') {
            throw err
          }

          console.log('Session ID is invalid. Asking for credentials.')
        }
      },
      connectToXapi: async function (password, rememberMe = false) {
        try {
          await this.state.xapi.connect({
            url: this.state.url,
            user: 'root',
            password,
            rememberMe,
          })
        } catch (err) {
          if (err.code !== 'SESSION_AUTHENTICATION_FAILED') {
            throw err
          }

          this.state.error = <FormattedMessage id='badCredentials' />
        }
      },
      disconnect: async function () {
        await this.state.xapi.disconnect()
        this.state.connected = false
      },
    },
    computed: {
      objectsFetched: state => state.objectsByType !== undefined,
      vms: state =>
        state.objectsFetched
          ? state.objectsByType
              ?.get('VM')
              ?.filter((vm: Vm) => !vm.is_control_domain && !vm.is_a_snapshot && !vm.is_a_template)
          : undefined,
      url: state => `${window.location.protocol}//${state.xapiHostname}`,
      pools: state => (state.objectsFetched ? state.objectsByType?.get('pool') : undefined),
      hostsByPool: state => {
        const hosts = state.objectsFetched ? state.objectsByType?.get('host') : undefined
        return hosts?.groupBy(host => host.$pool.$id)
      },
      vmsByPool: state => state.vms?.groupBy(vm => vm.$pool.$id),
      vmsByRef: state => state.vms?.groupBy(vm => vm.$ref),
    },
  },
  ({ effects, state }) => {
    return (
      <IntlProvider messages={messagesEn} locale='en'>
        {!state.connected ? (
          <Signin />
        ) : !state.objectsFetched ? (
          <FormattedMessage id='loading' />
        ) : (
          <>
            <Button onClick={() => effects.disconnect()}>
              <FormattedMessage id='disconnect' />
            </Button>
            <Router>
              <Switch>
                <Route exact path='/styleguide'>
                  <StyleGuide />
                </Route>
                <Route exact path='/'>
                  <LeftView>
                    <p>There are {state.objectsByType?.size || 0} types!</p>
                    {state.pools !== undefined && (
                      <>
                        <p>There are {state.pools.size} Pools!</p>
                        <Tree>
                          {state.pools.valueSeq().map((pool: Pool) => {
                            let hosts, vms
                            return (
                              <TreeNode
                                key={pool.$id}
                                data-icon='cloud'
                                data-iconColor='black'
                                data-id={pool.$id}
                                data-nameLabel={pool.name_label}
                              >
                                {state.hostsByPool !== undefined &&
                                (hosts = state.hostsByPool.get(pool.$id)) &&
                                hosts === undefined
                                  ? null
                                  : hosts.valueSeq().map(host => (
                                      <TreeNode
                                        key={host.$id}
                                        data-icon='server'
                                        data-iconColor={getIconColor(host)}
                                        data-id={host.$id}
                                        data-nameLabel={host.name_label}
                                      >
                                        {host.resident_VMs.map(vmRef => {
                                          const vms =
                                            state.vmsByRef !== undefined ? state.vmsByRef.get(vmRef) : undefined
                                          return (
                                            vms !== undefined &&
                                            vms
                                              .valueSeq()
                                              .map(vm => (
                                                <TreeNode
                                                  link
                                                  data-to={`/:${vm.$id}/console`}
                                                  data-icon='desktop'
                                                  data-iconColor={getIconColor(vm)}
                                                  data-id={vm.$id}
                                                  data-nameLabel={vm.name_label}
                                                  key={vm.$id}
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
                                        key={vm.$id}
                                        link
                                        data-to={`/:${vm.$id}/console`}
                                        data-iconColor={getIconColor(vm)}
                                        data-icon='desktop'
                                        data-id={vm.$id}
                                        data-nameLabel={vm.name_label}
                                      />
                                    )
                                  })}
                              </TreeNode>
                            )
                          })}
                        </Tree>
                      </>
                    )}
                  </LeftView>
                  <VerticalLine />
                </Route>
                <RightView>
                  <Route path='/:id/console' render={({ match }) => <TabConsole vmId={match.params.id} />} />
                </RightView>
              </Switch>
            </Router>
          </>
        )}
      </IntlProvider>
    )
  }
)

export default App
