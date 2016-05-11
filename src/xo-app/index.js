import React, {
  Component
} from 'react'
import { IntlProvider } from 'messages'
import { Notification } from 'notification'
// import {
//   keyHandler
// } from 'react-key-handler'
import {
  connectStore,
  propTypes,
  routes
} from 'utils'

import About from './about'
import Backup from './backup'
import Dashboard from './dashboard'
import Home from './home'
import Host from './host'
import Menu from './menu'
import Modal from 'modal'
import New from './new'
import Settings from './settings'
import Vm from './vm'

@routes('home', {
  about: About,
  backup: Backup,
  dashboard: Dashboard,
  home: Home,
  'hosts/:id': Host,
  new: New,
  settings: Settings,
  'vms/:id': Vm
})
@connectStore([
  'user'
])
@propTypes({
  children: propTypes.node
})
export default class XoApp extends Component {
  componentDidMount () {
    this.refs.bodyWrapper.style.minHeight = this.refs.menu.getWrappedInstance().height + 'px'
  }
  render () {
    return <IntlProvider>
      <div className='xo-main'>
        <Modal />
        <Notification />
        <Menu ref='menu' />
        <div ref='bodyWrapper' style={{flex: '1', padding: '1em'}}>
          {this.props.children}
        </div>
      </div>
    </IntlProvider>
  }
}
