import _ from 'messages'
import Icon from 'icon'
import Page from '../page'
import React from 'react'
import { routes } from 'utils'
import { Container, Row, Col } from 'grid'
import { NavLink, NavTabs } from 'nav'

import Overview from './overview'
import Health from './health'

const HEADER = <Container>
  <Row>
    <Col mediumSize={4}>
      <h2><Icon icon='menu-dashboard' /> {_('dashboardPage')}</h2>
    </Col>
    <Col mediumSize={8}>
      <NavTabs>
        <NavLink to={'/dashboard/overview'}><Icon icon='menu-dashboard-overview' /> {_('overviewDashboardPage')}</NavLink>
        <NavLink to={'/dashboard/visualization'}><Icon icon='menu-dashboard-visualization' /> {_('overviewVisualizationDashboardPage')}</NavLink>
        <NavLink to={'/dashboard/stats'}><Icon icon='menu-dashboard-stats' /> {_('overviewStatsDashboardPage')}</NavLink>
        <NavLink to={'/dashboard/health'}><Icon icon='menu-dashboard-health' /> {_('overviewHealthDashboardPage')}</NavLink>
      </NavTabs>
    </Col>
  </Row>
</Container>

const Dashboard = routes('overview', {
  health: Health,
  overview: Overview
})(
  ({ children }) => <Page header={HEADER}>{children}</Page>
)

export default Dashboard
