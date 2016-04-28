import DevTools from 'dev-tools'
import hashHistory from 'react-router/lib/hashHistory'
import React from 'react'
import Router from 'react-router/lib/Router'
import store from 'store'
import xoaUpdater from 'xoa-updater'
import { Provider } from 'react-redux'
import { render } from 'react-dom'

import XoApp from './xo-app'
import { connect, updaterDidToto } from './store/actions'

if (
  typeof window !== 'undefined' &&
  typeof window.addEventListener === 'function'
) {
  window.addEventListener('unhandledRejection', reason => {
    console.error(reason)
  })
}

store.dispatch(connect())

xoaUpdater.on('toto', (payload) => {
  store.dispatch(updaterDidToto(payload))
})

render(
  <Provider store={store}>
    <div>
      <Router history={hashHistory} routes={{
        ...XoApp.route,
        component: XoApp,
        path: '/'
      }} />
      {DevTools && <DevTools />}
    </div>
  </Provider>,
  document.getElementById('xo-app')
)
