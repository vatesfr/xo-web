import Cookies from 'js-cookie'
import React from 'react'
import styled from 'styled-components'
import { FormattedMessage, IntlProvider } from 'react-intl'
import { HashRouter as Router, Switch, Route } from 'react-router-dom'
import { withState } from 'reaclette'

import Button from '../components/Button'
import ListObjects from './ListObjects'
import messagesEn from '../lang/en.json'
import Signin from './Signin/index'
import StyleGuide from './StyleGuide/index'
import TabConsole from './TabConsole'
import XapiConnection, { ObjectsByType } from '../libs/xapi'

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
  height: 1000px;
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
      url: state => `${window.location.protocol}//${state.xapiHostname}`,
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
                    <ListObjects />
                  </LeftView>
                  <VerticalLine />
                  <RightView>
                    <Route path='/:id/console' render={({ match }) => <TabConsole vmId={match.params.id} />} />
                  </RightView>
                </Route>
              </Switch>
            </Router>
          </>
        )}
      </IntlProvider>
    )
  }
)

export default App
