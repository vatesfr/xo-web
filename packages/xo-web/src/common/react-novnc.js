import PropTypes from 'prop-types'
import React, { Component } from 'react'
import RFB from '@xen-orchestra/novnc/core/rfb'
import { createBackoff } from 'jsonrpc-websocket-client'
import {
  enable as enableShortcuts,
  disable as disableShortcuts,
} from 'shortcuts'

export default class NoVnc extends Component {
  static propTypes = {
    onClipboardChange: PropTypes.func,
    url: PropTypes.string.isRequired,
  }

  constructor (props) {
    super(props)
    this._rfb = null

    let retryGen = createBackoff(Infinity)
    let retryTimeout
    this._onConnected = () => {
      if (retryTimeout !== undefined) {
        clearTimeout(retryTimeout)
        retryTimeout = undefined
        retryGen = createBackoff(Infinity)
      }
    }
    this._onDisconnected = () => {
      if (this.refs.canvas != null) {
        clearTimeout(retryTimeout)
        retryTimeout = setTimeout(this._connect, retryGen.next().value)
      }
    }
  }

  sendCtrlAltDel () {
    const rfb = this._rfb
    if (rfb) {
      rfb.sendCtrlAltDel()
    }
  }

  setClipboard (text) {
    const rfb = this._rfb
    if (rfb) {
      rfb.clipboardPasteFrom(text)
    }
  }

  _clean () {
    const rfb = this._rfb
    if (rfb) {
      this._rfb = null
      rfb.disconnect()
    }
    enableShortcuts()
  }

  _connect = () => {
    this._clean()

    const { canvas } = this.refs
    if (!canvas) {
      return
    }

    const { onClipboardChange } = this.props
    const rfb = (this._rfb = new RFB(this.refs.canvas, this.props.url))

    if (onClipboardChange !== undefined) {
      rfb.addEventListener('clipboard', ({ text }) => {
        onClipboardChange(text)
      })
    }

    rfb.addEventListener('connect', this._onConnected)
    rfb.addEventListener('disconnect', this._onDisconnected)
    rfb.addEventListener('error', console.error.bind(console, 'error'))

    disableShortcuts()
  }

  componentDidMount () {
    this._connect()
  }

  componentWillUnmount () {
    this._clean()
  }

  componentWillReceiveProps (props) {
    const rfb = this._rfb
    if (rfb && this.props.scale !== props.scale) {
      rfb.get_display().set_scale(props.scale || 1)
      rfb.get_mouse().set_scale(props.scale || 1)
    }
  }

  _focus = () => {
    const rfb = this._rfb
    if (rfb) {
      const { activeElement } = document
      if (activeElement) {
        activeElement.blur()
      }

      rfb.focus()

      disableShortcuts()
    }
  }

  _unfocus = () => {
    const rfb = this._rfb
    if (rfb) {
      rfb.blur()

      enableShortcuts()
    }
  }

  render () {
    return (
      <canvas
        className='center-block'
        height='480'
        onMouseEnter={this._focus}
        onMouseLeave={this._unfocus}
        ref='canvas'
        width='640'
      />
    )
  }
}
