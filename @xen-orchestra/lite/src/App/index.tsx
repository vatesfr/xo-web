import Cookies from 'js-cookie'
import React from 'react'
import { FormattedMessage, IntlProvider } from 'react-intl'
import { HashRouter as Router, Switch, Route, Link } from 'react-router-dom'
import { Map } from 'immutable'
import { withState } from 'reaclette'

import Button from '../components/Button'
import messagesEn from '../lang/en.json'
import Signin from './Signin/index'
import StyleGuide from './StyleGuide/index'
import TabConsole from './TabConsole'
import TreeItem from '../components/TreeItem'
import TreeView from '../components/TreeView'
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
  hosts?: Map<string, Host>
  vmsByContainer?: Map<string, Vm>
  hostsByPool?: Map<string, Host>
  vmsByRef?: Map<string, Vm>
  vmsByPool?: Map<string, Vm>
}

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
    },
  },
  ({ effects, state }) => (
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
                <p>There are {state.objectsByType?.size || 0} types!</p>
                {state.pools !== undefined && (
                  <>
                    <p>There are {state.pools.size} Pools!</p>
                    <TreeView>
                      {state.pools.valueSeq().map((pool: Pool) => {
                        let hosts
                        return (
                          <TreeItem key={pool.$id} id={pool.$id} label={pool.name_label}>
                            {state.hostsByPool !== undefined &&
                            (hosts = state.hostsByPool.get(pool.$id)) &&
                            hosts === undefined
                              ? null
                              : hosts.map(host => (
                                  <TreeItem key={host.$id} id={host.$id} label={host.name_label}>
                                    {host.resident_VMs.map(vmRef => {
                                      const vm = state.vmsByRef !== undefined ? state.vmsByRef.get(vmRef) : undefined
                                      return vm !== undefined ? (
                                        <TreeItem key={vm.$id} id={vm.$id} label={vm.name_label} />
                                      ) : null
                                    })}
                                  </TreeItem>
                                ))}
                            {state.vmsByPool !== undefined &&
                              state.vmsByPool.get(pool.$id) !== undefined &&
                              state.vmsByPool.get(pool.$id).map((vm: Vm) => {
                                return vm.power_state === 'Running' ? null : (
                                  <TreeItem key={vm.$id} id={vm.$id} label={vm.name_label} />
                                )
                              })}
                          </TreeItem>
                        )
                      })}
                    </TreeView>
                  </>
                )}
                <p>There are {state.objectsByType?.size || 0} types!</p>
                {state.vms !== undefined && (
                  <>
                    <p>There are {state.vms.size} VMs!</p>
                    <ul>
                      {state.vms.valueSeq().map((vm: Vm) => (
                        <li key={vm.$id}>
                          <Link to={vm.$id}>
                            {vm.name_label} - {vm.name_description} ({vm.power_state})
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Route>
              <Route path='/:id' render={({ match }) => <TabConsole vmId={match.params.id} />} />
            </Switch>
          </Router>
        </>
      )}
    </IntlProvider>
  )
)

export default App
