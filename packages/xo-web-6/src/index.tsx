import 'regenerator-runtime/runtime'
import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom'

import App from './App'
import Connection from './libs/Connection'

ReactDOM.render(
  <StrictMode>
    <App connection={new Connection()} />
  </StrictMode>,
  document.getElementById('root')
)

if (module.hot) {
  module.hot.accept()
}
