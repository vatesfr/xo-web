import { format, parse, MethodNotFound } from 'json-rpc-protocol'
import * as errors from 'xo-common/api-errors.js'
import Ajv from 'ajv'
import asyncIteratorToStream from 'async-iterator-to-stream'
import compress from 'koa-compress'
import forOwn from 'lodash/forOwn.js'
import getStream from 'get-stream'
import helmet from 'koa-helmet'
import Koa from 'koa'
import once from 'lodash/once.js'
import Router from '@koa/router'
import Zone from 'node-zone'
import { createLogger } from '@xen-orchestra/log'

const { debug, warn } = createLogger('xo:proxy:api')

const ndJsonStream = asyncIteratorToStream(async function* (responseId, iterable) {
  yield format.response(responseId, { $responseType: 'ndjson' }) + '\n'
  for await (const data of iterable) {
    try {
      yield JSON.stringify(data) + '\n'
    } catch (error) {
      warn('ndJsonStream', { error })
    }
  }
})

export default class Api {
  constructor(app, { appVersion, httpServer }) {
    this._ajv = new Ajv({ allErrors: true })
    this._methods = { __proto__: null }

    const router = new Router({ prefix: '/api/v1' }).post('/', async ctx => {
      // Before Node 13.0 there was an inactivity timeout of 2 mins, which may
      // not be enough for the API.
      ctx.req.setTimeout(0)

      const profile = await app.authentication.findProfile({
        authenticationToken: ctx.cookies.get('authenticationToken'),
      })
      if (profile === undefined) {
        ctx.status = 401
        return
      }

      let body = await getStream(ctx.req)
      try {
        body = parse(body)
      } catch (error) {
        ctx.body = format.error(null, error)
        return
      }

      const zone = Zone.current.fork('POST /api')
      zone.data.profile = profile

      let result
      try {
        result = await zone.run(() => this._call(body.method, body.params))
      } catch (error) {
        const { method, params } = body
        warn('call error', { method, params, error })
        ctx.set('Content-Type', 'application/json')
        ctx.body = format.error(body.id, error)
        return
      }

      if (typeof result?.pipe === 'function') {
        ctx.body = result
        return
      }

      ctx.set('Content-Type', 'application/json')

      const isAsyncIterable =
        result !== null &&
        typeof result === 'object' &&
        (typeof result[Symbol.iterator] === 'function' || typeof result[Symbol.asyncIterator] === 'function')
      if (isAsyncIterable) {
        const stream = ndJsonStream(body.id, result)
        ctx.body = stream

        const keepAliveInterval = app.config.get('api.keepAliveInterval')
        if (keepAliveInterval !== 0) {
          // In the wild, long term HTTP requests with period of inactivity often
          // breaks, send some data every 10s to keep it opened.
          const stopTimer = clearInterval.bind(
            undefined,
            setInterval(() => stream.push(' '), keepAliveInterval)
          )
          stream.on('end', stopTimer).on('error', stopTimer)
        }
      } else {
        ctx.body = format.response(body.id, result !== undefined ? result : true)
      }
    })

    const koa = new Koa()
      .on('error', warn)
      .use(helmet())
      .use(compress())
      .use(router.routes())
      .use(router.allowedMethods())

    httpServer.on('request', koa.callback())

    this.addMethods({
      system: {
        getMethodsInfo: [
          function* () {
            const methods = this._methods
            for (const name in methods) {
              const { description, params = {} } = methods[name]
              yield { description, name, params }
            }
          }.bind(this),
          {
            description: 'returns the signatures of all available API methods',
          },
        ],
        getServerVersion: [
          () => appVersion,
          {
            description: 'returns the version of xo-server',
          },
        ],
        listMethods: [
          function* () {
            const methods = this._methods
            for (const name in methods) {
              yield name
            }
          }.bind(this),
          {
            description: 'returns the name of all available API methods',
          },
        ],
        methodSignature: [
          ({ method: name }) => {
            const method = this._methods[name]
            if (method === undefined) {
              throw errors.noSuchObject('method', name)
            }

            const { description, params = {} } = method
            return { description, name, params }
          },
          {
            description: 'returns the signature of an API method',
            params: {
              method: { type: 'string' },
            },
          },
        ],
      },
      test: {
        range: [
          function* ({ start = 0, stop, step }) {
            if (step === undefined) {
              step = start > stop ? -1 : 1
            }
            if (step > 0) {
              for (; start < stop; start += step) {
                yield start
              }
            } else {
              for (; start > stop; start += step) {
                yield start
              }
            }
          },
          {
            params: {
              start: { optional: true, type: 'number' },
              step: { optional: true, type: 'number' },
              stop: { type: 'number' },
            },
          },
        ],
      },
    })
  }

  addMethod(name, method, { description, params = {} } = {}) {
    const methods = this._methods

    if (name in methods) {
      throw new Error(`API method ${name} already exists`)
    }

    const ajv = this._ajv
    const validate = ajv.compile({
      // we want additional properties to be disabled by default
      additionalProperties: params['*'] || false,

      properties: params,

      // we want params to be required by default unless explicitly marked so
      // we use property `optional` instead of object `required`
      required: Object.keys(params).filter(name => {
        const param = params[name]
        const required = !param.optional
        delete param.optional
        return required
      }),

      type: 'object',
    })

    const m = params => {
      if (!validate(params)) {
        throw errors.invalidParameters(validate.errors)
      }
      return method(params)
    }
    m.description = description
    m.params = params

    methods[name] = m

    return once(() => {
      delete methods[name]
    })
  }

  addMethods(methods) {
    let base = ''
    const removes = []

    const addMethod = (method, name) => {
      name = base + name

      if (typeof method === 'function') {
        removes.push(this.addMethod(name, method))
        return
      } else if (Array.isArray(method)) {
        removes.push(this.addMethod(name, ...method))
        return
      }

      const oldBase = base
      base = name + '.'
      forOwn(method, addMethod)
      base = oldBase
    }

    try {
      forOwn(methods, addMethod)
    } catch (error) {
      // Remove all added methods.
      forOwn(removes, remove => remove())

      // Forward the error
      throw error
    }

    return once => forOwn(removes, remove => remove())
  }

  _call(method, params = {}) {
    debug(`call: ${method}()`, { method, params })
    const fn = this._methods[method]
    if (fn === undefined) {
      throw new MethodNotFound(method)
    }
    return fn(params)
  }
}
