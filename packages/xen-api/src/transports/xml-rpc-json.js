import { createClient, createSecureClient } from 'xmlrpc'
import { promisify } from 'promise-toolbox'

import XapiError from '../_XapiError'

import prepareXmlRpcParams from './_prepareXmlRpcParams'
import UnsupportedTransport from './_UnsupportedTransport'

const logError = error => {
  if (error.res) {
    console.error('XML-RPC Error: %s (response status %s)', error.message, error.res.statusCode)
    console.error('%s', error.body)
  }

  throw error
}

const SPECIAL_CHARS = {
  '\r': '\\r',
  '\t': '\\t',
}
const SPECIAL_CHARS_RE = new RegExp(Object.keys(SPECIAL_CHARS).join('|'), 'g')

const parseResult = result => {
  const status = result.Status

  // Return the plain result if it does not have a valid XAPI
  // format.
  if (status === undefined) {
    return result
  }

  if (status !== 'Success') {
    throw XapiError.wrap(result.ErrorDescription)
  }

  const value = result.Value

  // XAPI returns an empty string (invalid JSON) for an empty
  // result.
  if (value === '') {
    return ''
  }

  try {
    return JSON.parse(value)
  } catch (error) {
    // XAPI JSON sometimes contains invalid characters.
    if (!(error instanceof SyntaxError)) {
      throw error
    }
  }

  let replaced = false
  const fixedValue = value.replace(SPECIAL_CHARS_RE, match => {
    replaced = true
    return SPECIAL_CHARS[match]
  })

  if (replaced) {
    try {
      return JSON.parse(fixedValue)
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error
      }
    }
  }

  throw new UnsupportedTransport()
}

export default ({ secureOptions, url: { hostname, port, protocol } }) => {
  const secure = protocol === 'https:'
  const client = (secure ? createSecureClient : createClient)({
    ...(secure ? secureOptions : undefined),
    host: hostname,
    path: '/json',
    port,
  })
  const call = promisify(client.methodCall, client)

  return (method, args, cancelToken) => call(method, prepareXmlRpcParams(args), cancelToken).then(parseResult, logError)
}
