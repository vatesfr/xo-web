import React from 'react'
import { withState } from 'reaclette'
import { HashRouter as Router, Switch, Route, Link } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { Map } from 'immutable'

import messagesEn from '../lang/en.json'
import Signin from './Signin/index'
import StyleGuide from './StyleGuide/index'
import TabConsole from './TabConsole'

import Modal from '../components/Modal'
import XapiConnection, { ObjectsByType, Vm } from '../libs/xapi'

interface ParentState {
  objectsByType: ObjectsByType
  xapi: XapiConnection
}

interface State {
  connected: boolean
  xapiHostname: string
}

interface Props {}

interface ParentEffects {}

interface Effects {
  connectToXapi: (password: string) => void
}

interface Computed {
  objectsFetched: boolean
  vms?: Map<string, Vm>
}

const App = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    initialState: () => ({
      connected: false,
      objectsByType: undefined,
      xapiHostname: process.env.XAPI_HOST || window.location.host,
      xapi: undefined,
    }),
    effects: {
      connectToXapi: function (password) {
        const xapi = new XapiConnection()
        this.state.xapi = xapi

        xapi.onConnect(status => {
          this.state.connected = true
          console.log('Connected to XAPI!', status)
        })

        xapi.onObjects((objectsByType: ObjectsByType) => {
          this.state.objectsByType = objectsByType
        })

        xapi.connect({
          url: `${window.location.protocol}//${this.state.xapiHostname}`,
          user: 'root',
          password,
        })
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
    },
  },
  ({ state }) => (
    <IntlProvider messages={messagesEn} locale='en'>
      <Modal />
      {!state.connected || !state.objectsFetched ? (
        <Signin />
      ) : (
        <Router>
          <Switch>
            <Route exact path='/styleguide'><StyleGuide /></Route>
            <Route exact path='/'>
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
      )}
    </IntlProvider>
  )
)

export default App
