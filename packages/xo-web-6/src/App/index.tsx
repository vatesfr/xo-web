import * as React from 'react'
import styled from '@emotion/styled'
import { HashRouter as Router, Route, Link } from 'react-router-dom'
import { Helmet, HelmetProvider } from 'react-helmet-async'
import { withStore } from 'reaclette'

const Bar = React.lazy(() => import('./Bar'))
const Foo = React.lazy(() => import('./Foo'))
const Visualization = React.lazy(() => import('./Visualization'))
const VisualizationHost = React.lazy(() => import('./Visualization/hostStats'))
const Visualization2 = React.lazy(() => import('./Visualization/miniStatsVm'))
const VisualizationMiniStatsHost = React.lazy(() => import('./Visualization/miniStatsHost'))
const VisualizationMiniStatsStorage = React.lazy(() => import('./Visualization/miniStatsStorage'))
const VisualizationSr = React.lazy(() => import('./Visualization/storageStats'))
const VisualizationOverview = React.lazy(() => import('./Visualization/overview'))
//import Visualization2 from './Visualization/mini-stats'


const Title = styled.h1`
  color: red;
  text-align: center;
`

export default withStore(
  {
    initialState: () => ({
      objects: new Map(),
      onNotification: undefined,
    }),
    effects: {
      initialize() {
        const onNotification = notification => {
          if (notification.message === 'objects') {
            // TODO: update `objects`
          }
        }
        this.props.connection.on('notification', onNotification)
        this.state.onNotification = onNotification
      },
      finalize() {
        this.props.connection.off('notification', this.state.onNotification)
        this.state.onNotification = undefined
      },
    },
  },
  (store, props) => (
    <Router>
      <HelmetProvider>
        <Helmet>
          <title>Xen Orchestra</title>
        </Helmet>

        <Title>Xen Orchestra</Title>

        <nav>
          <ul>
            <li>
              <Link to='/'>Bar</Link>
            </li>
            <li>
              <Link to='/foo/'>Foo</Link>
            </li>
          </ul>
        </nav>

        <React.Suspense fallback='loading'>
          <Route path='/' exact component={Bar} />
          <Route path='/foo' component={Foo} />
          <Route path='/vm' component={Visualization} />
          <Route path='/miniStatsVm' component={Visualization2} />
          <Route path='/host' component={VisualizationHost}/>
          <Route path='/storage' component={VisualizationSr}/>
          <Route path='/miniStatsHost' component={VisualizationMiniStatsHost}/>
          <Route path='/miniStatsStorage' component={VisualizationMiniStatsStorage}/>
          <Route path='/overview' component={VisualizationOverview}/>
        </React.Suspense>
      </HelmetProvider>
    </Router>
  )
)
