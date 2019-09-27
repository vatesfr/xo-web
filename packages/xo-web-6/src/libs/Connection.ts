import * as JsonRpc from 'json-rpc-protocol'
import assert from 'assert'

const CONNECTED = 'connected'
const CONNECTING = 'connecting'
const DISCONNECTED = 'disconnected'

function onMessage({ data }) {
  const message = JsonRpc.parse(data)
  const { type } = message
  if (type === 'notification') {
    this.emit('notification', message)
  } else if (type === 'request') {
    this.send(
      JsonRpc.format.error(
        message.id,
        new JsonRpc.MethodNotFound(message.method)
      )
    )
  } else {
    const { id } = message
    const deferred = this._deferreds[id]
    delete this._deferreds[id]

    if (type === 'response') {
      deferred(message.result)
    } else {
      assert.strictEqual(type, 'error')
      deferred(Promise.reject(message.error))
    }
  }
}

export default class Connection {
  constructor() {
    this._deferreds = { __proto__: null }
    this._onMessage = onMessage.bind(this)

    const url = new URL('/api', window.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    this._url = url.href

    this._connected = new Promise(resolve => {
      this._resolveConnected = resolve
    })
    this._disconnected = Promise.resolve()
    this._status = DISCONNECTED
  }

  get connected() {
    return this._connected
  }

  get disconnected() {
    return this._disconnected
  }

  get status() {
    return this._status
  }

  async connect() {
    const status = this._status
    if (status === CONNECTED) {
      return
    }
    assert.strictEqual(status, DISCONNECTED)

    this._status = CONNECTING

    try {
      ws = this._ws = new WebSocket(this._url)
      ws.addEventListener('message', this._onMessage)

      await fromEvent(ws, 'open')

      await this._call('session.signIn', { token: cookies.get('token') })

      this._status = CONNECTED
      this._resolveConnected()
      this._resolveConnected = undefined
    } catch (error) {
      ignoreErrors.call(this.disconnect())

      throw error
    }
  }

  async disconnect() {
    const status = this._status

    if (status === DISCONNECTED) {
      return
    }

    if (status === CONNECTED) {
      this._connected = new Promise(resolve => {
        this._resolveConnected = resolve
      })
    } else {
      assert(status === CONNECTING)
    }

    const ws = this._ws
    this._ws = undefined
    ws.close()

    this._status = DISCONNECTED
    this._resolveDisconnected()
    this._resolveDisconnected = undefined

    const deferreds = this._deferreds
    const ids = Object.keys(deferreds)
    if (ids.length !== undefined) {
      this._deferreds = { __proto__: null }

      const error = Promise.reject(new Error('disconnected'))
      ids.forEach(id => {
        deferreds[id](error)
      })
    }
  }

  call(method, args) {
    return method.startsWith('session.')
      ? Promise.reject(
          new Error('session.*() methods are disabled from this interface')
        )
      : this._call(method, args)
  }

  _call(method, args) {
    const id = Math.random()
      .toString(36)
      .slice(2)
    return new Promise(resolve => {
      this._ws.send(JsonRpc.format.request(id, method, args))
      this._deferreds[id] = resolve
    })
  }
}
