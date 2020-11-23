import fromEvent from 'promise-toolbox/fromEvent'
import createLogger from '@xen-orchestra/log'
import { connect } from 'tls'

// =============================================================================

const log = createLogger('xo:xo-server:sdn-controller:tls-connect')

// =============================================================================

export class TlsHelper {
  updateCertificates(clientKey, clientCert, caCert) {
    this._clientKey = clientKey
    this._clientCert = clientCert
    this._caCert = caCert
    log.debug('Certificates have been updated')
  }

  // ---------------------------------------------------------------------------

  async connect(address, port) {
    const options = {
      ca: this._caCert,
      cert: this._clientCert,
      ciphers: 'DEFAULT:!DH',
      host: address,
      key: this._clientKey,
      port,
      rejectUnauthorized: false,
      requestCert: false,
    }
    const socket = connect(options)
    try {
      await fromEvent(socket, 'secureConnect')
    } catch (error) {
      log.error('TLS connection failed', {
        error,
        address,
        port,
      })
      throw error
    }

    socket.on('error', error => {
      log.error('Socket error', {
        error,
        address,
        port,
      })
    })

    return socket
  }

  async closeSocket(socket) {
    socket.end()
    try {
      await fromEvent(socket, 'finish')
    } catch (error) {
      log.error('TLS socket closure failed', {
        error,
        socket,
      })
    }

    log.debug('TLS socket closed')
  }
}
