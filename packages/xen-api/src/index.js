import assert from 'assert'
import dns from 'dns'
import httpRequest from 'http-request-plus'
import kindOf from 'kindof'
import ms from 'ms'
import pCatch from 'promise-toolbox/catch'
import { Collection } from 'xo-collection'
import { EventEmitter } from 'events'
import { map, noop, omit } from 'lodash'
import { limitConcurrency } from 'limit-concurrency-decorator'
import {
  cancelable,
  CancelToken,
  defer,
  fromCallback,
  fromEvents,
  ignoreErrors,
  pDelay,
  pRetry,
  pTimeout,
} from 'promise-toolbox'

import autoTransport from './transports/auto'
import coalesceCalls from './_coalesceCalls'
import debug from './_debug'
import getTaskResult from './_getTaskResult'
import isGetAllRecordsMethod from './_isGetAllRecordsMethod'
import isReadOnlyCall from './_isReadOnlyCall'
import makeCallSetting from './_makeCallSetting'
import parseUrl from './_parseUrl'
import Ref from './_Ref'
import replaceSensitiveValues from './_replaceSensitiveValues'

// ===================================================================

// in seconds!
const EVENT_TIMEOUT = 60

// ===================================================================

const { defineProperties, defineProperty, freeze, keys: getKeys } = Object

// -------------------------------------------------------------------

export { Ref }

// -------------------------------------------------------------------

const RESERVED_FIELDS = {
  id: true,
  pool: true,
  ref: true,
  type: true,
  xapi: true,
}

function getPool() {
  return this.$xapi.pool
}

// -------------------------------------------------------------------

const CONNECTED = 'connected'
const CONNECTING = 'connecting'
const DISCONNECTED = 'disconnected'

// -------------------------------------------------------------------

const identity = value => value

// save current stack trace and add it to any rejected error
//
// This is especially useful when the resolution is separate from the initial
// call, which is often the case with RPC libs.
//
// There is a perf impact and it should be avoided in production.
const addSyncStackTrace = async promise => {
  const stackContainer = new Error()
  try {
    return await promise
  } catch (error) {
    error.stack = stackContainer.stack
    throw error
  }
}

// -------------------------------------------------------------------

export class Xapi extends EventEmitter {
  constructor(opts) {
    super()

    this._addSyncStackTrace =
      opts.syncStackTraces ?? process.env.NODE_ENV === 'development' ? addSyncStackTrace : identity
    this._callTimeout = makeCallSetting(opts.callTimeout, 60 * 60 * 1e3) // 1 hour but will be reduced in the future
    this._httpInactivityTimeout = opts.httpInactivityTimeout ?? 5 * 60 * 1e3 // 5 mins
    this._eventPollDelay = opts.eventPollDelay ?? 60 * 1e3 // 1 min
    this._pool = null
    this._readOnly = Boolean(opts.readOnly)
    this._RecordsByType = { __proto__: null }
    this._reverseHostIpAddresses = opts.reverseHostIpAddresses ?? false

    this._call = limitConcurrency(opts.callConcurrency ?? 20)(this._call)

    this._roCallRetryOptions = {
      delay: 1e3,
      tries: 10,
      ...opts.roCallRetryOptions,
      when: { code: 'ECONNRESET' },
    }

    this._auth = opts.auth
    const url = parseUrl(opts.url)
    if (this._auth === undefined) {
      const user = url.username
      if (user === undefined) {
        throw new TypeError('missing credentials')
      }

      this._auth = {
        user,
        password: url.password,
      }
      delete url.username
      delete url.password
    }

    this._allowUnauthorized = opts.allowUnauthorized
    this._setUrl(url)

    this._connected = new Promise(resolve => {
      this._resolveConnected = resolve
    })
    this._disconnected = Promise.resolve()
    this._sessionId = undefined
    this._status = DISCONNECTED

    this._watchEventsError = undefined
    this._lastEventFetchedTimestamp = undefined

    this._debounce = opts.debounce ?? 200
    this._cacheAllRecords = opts.watchEvents !== 'lazy'
    this._objects = new Collection()
    this._objectsByRef = { __proto__: null }
    this._objectsFetched = new Promise(resolve => {
      this._resolveObjectsFetched = resolve
    })
    this._eventWatchers = { __proto__: null }
    this._taskWatchers = { __proto__: null }
    this._watchedTypes = undefined
    const { watchEvents } = opts
    if (watchEvents !== false) {
      if (Array.isArray(watchEvents)) {
        this._watchedTypes = watchEvents
      }
      this.watchEvents()
    }
  }

  get readOnly() {
    return this._readOnly
  }

  set readOnly(ro) {
    this._readOnly = Boolean(ro)
  }

  // ===========================================================================
  // Connection
  // ===========================================================================

  get connected() {
    return this._connected
  }

  get disconnected() {
    return this._disconnected
  }

  get pool() {
    return this._pool
  }

  get sessionId() {
    assert(this._status === CONNECTED)
    return this._sessionId
  }

  get status() {
    return this._status
  }

  connect = coalesceCalls(this.connect)
  async connect() {
    const status = this._status

    if (status === CONNECTED) {
      return
    }

    assert(status === DISCONNECTED)

    this._status = CONNECTING
    this._disconnected = new Promise(resolve => {
      this._resolveDisconnected = resolve
    })

    try {
      await this._sessionOpen()

      debug('%s: connected', this._humanId)
      this._status = CONNECTED
      this._resolveConnected()
      this._resolveConnected = undefined
      this.emit(CONNECTED)
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

    const sessionId = this._sessionId
    if (sessionId !== undefined) {
      this._sessionId = undefined
      ignoreErrors.call(this._call('session.logout', [sessionId]))
    }

    debug('%s: disconnected', this._humanId)

    this._status = DISCONNECTED
    this._resolveDisconnected()
    this._resolveDisconnected = undefined
    this.emit(DISCONNECTED)
  }

  // ===========================================================================
  // RPC calls
  // ===========================================================================

  // this should be used for instantaneous calls, otherwise use `callAsync`
  call(method, ...args) {
    return isReadOnlyCall(method, args)
      ? this._roCall(method, args)
      : this._readOnly
      ? Promise.reject(new Error(`cannot call ${method}() in read only mode`))
      : this._sessionCall(method, args)
  }

  @cancelable
  async callAsync($cancelToken, method, ...args) {
    if (this._readOnly && !isReadOnlyCall(method, args)) {
      throw new Error(`cannot call ${method}() in read only mode`)
    }

    const taskRef = await this._sessionCall(`Async.${method}`, args)
    $cancelToken.promise.then(() =>
      // TODO: do not trigger if the task is already over
      ignoreErrors.call(this._sessionCall('task.cancel', [taskRef]))
    )

    const promise = this.watchTask(taskRef)

    const destroyTask = () => ignoreErrors.call(this._sessionCall('task.destroy', [taskRef]))
    promise.then(destroyTask, destroyTask)

    return promise
  }

  // ===========================================================================
  // Objects handling helpers
  // ===========================================================================

  async getAllRecords(type) {
    return map(await this._roCall(`${type}.get_all_records`), (record, ref) => this._wrapRecord(type, ref, record))
  }

  async getRecord(type, ref) {
    const record = this._wrapRecord(type, ref, await this._roCall(`${type}.get_record`, [ref]))
    const records = this._objectsByRef
    if (records !== undefined) {
      records[ref] = record
      this._objects[record.$id] = record
    }
    return record
  }

  async getRecordByUuid(type, uuid) {
    return this.getRecord(type, await this._roCall(`${type}.get_by_uuid`, [uuid]))
  }

  getRecords(type, refs) {
    return Promise.all(refs.map(ref => this.getRecord(type, ref)))
  }

  getField(type, ref, field) {
    return this._roCall(`${type}.get_${field}`, [ref])
  }

  setField(type, ref, field, value) {
    return this.call(`${type}.set_${field}`, ref, value).then(noop)
  }

  setFields(type, ref, fields) {
    return Promise.all(
      // eslint-disable-next-line array-callback-return
      getKeys(fields).map(field => {
        const value = fields[field]
        if (value !== undefined) {
          return this.call(`${type}.set_${field}`, ref, value)
        }
      })
    ).then(noop)
  }

  setFieldEntries(type, ref, field, entries) {
    return Promise.all(
      // eslint-disable-next-line array-callback-return
      getKeys(entries).map(entry => {
        const value = entries[entry]
        if (value !== undefined) {
          return this.setFieldEntry(type, ref, field, entry, value)
        }
      })
    ).then(noop)
  }

  async setFieldEntry(type, ref, field, entry, value) {
    if (value === null) {
      return this.call(`${type}.remove_from_${field}`, ref, entry).then(noop)
    }
    while (true) {
      try {
        await this.call(`${type}.add_to_${field}`, ref, entry, value)
        return
      } catch (error) {
        if (error?.code !== 'MAP_DUPLICATE_KEY') {
          throw error
        }
      }
      await this.call(`${type}.remove_from_${field}`, ref, entry)
    }
  }

  // ===========================================================================
  // HTTP requests
  // ===========================================================================

  @cancelable
  async getResource($cancelToken, pathname, { host, query, task } = {}) {
    const taskRef = await this._autoTask(task, `Xapi#getResource ${pathname}`)

    query = { ...query, session_id: this.sessionId }

    let pTaskResult
    if (taskRef !== undefined) {
      query.task_id = taskRef
      pTaskResult = this.watchTask(taskRef)

      if (typeof $cancelToken.addHandler === 'function') {
        $cancelToken.addHandler(() => pTaskResult)
      }
    }

    const response = await httpRequest(
      $cancelToken,
      this._url,
      host !== undefined && {
        hostname: await this._getHostAddress(this.getObject(host)),
      },
      {
        pathname,
        query,
        rejectUnauthorized: !this._allowUnauthorized,

        // this is an inactivity timeout (unclear in Node doc)
        timeout: this._httpInactivityTimeout,

        // Support XS <= 6.5 with Node => 12
        minVersion: 'TLSv1',
      }
    )

    if (pTaskResult !== undefined) {
      response.task = pTaskResult
    }

    return response
  }

  @cancelable
  async putResource($cancelToken, body, pathname, { host, query, task } = {}) {
    if (this._readOnly) {
      throw new Error('cannot put resource in read only mode')
    }

    const taskRef = await this._autoTask(task, `Xapi#putResource ${pathname}`)

    query = { ...query, session_id: this.sessionId }

    let pTaskResult
    if (taskRef !== undefined) {
      query.task_id = taskRef
      pTaskResult = this.watchTask(taskRef)

      if (typeof $cancelToken.addHandler === 'function') {
        $cancelToken.addHandler(() => pTaskResult)
      }
    }

    const headers = {}

    // XAPI does not support chunk encoding so there is no proper way to send
    // data without knowing its length
    //
    // as a work-around, a huge content length (1PiB) is added (so that the
    // server won't prematurely cut the connection), and the connection will be
    // cut once all the data has been sent without waiting for a response
    const isStream = typeof body.pipe === 'function'
    const useHack = isStream && body.length === undefined
    if (useHack) {
      console.warn(this._humanId, 'Xapi#putResource', pathname, 'missing length')

      headers['content-length'] = '1125899906842624'
    }

    const doRequest = httpRequest.put.bind(
      undefined,
      $cancelToken,
      this._url,
      host !== undefined && {
        hostname: await this._getHostAddress(this.getObject(host)),
      },
      {
        body,
        headers,
        pathname,
        query,
        rejectUnauthorized: !this._allowUnauthorized,

        // this is an inactivity timeout (unclear in Node doc)
        timeout: this._httpInactivityTimeout,

        // Support XS <= 6.5 with Node => 12
        minVersion: 'TLSv1',
      }
    )

    // if body is a stream, sends a dummy request to probe for a redirection
    // before consuming body
    const response = await (isStream
      ? doRequest({
          body: '',

          // omit task_id because this request will fail on purpose
          query: 'task_id' in query ? omit(query, 'task_id') : query,

          maxRedirects: 0,
        }).then(
          response => {
            response.cancel()
            return doRequest()
          },
          error => {
            let response
            if (error != null && (response = error.response) != null) {
              response.cancel()

              const {
                headers: { location },
                statusCode,
              } = response
              if (statusCode === 302 && location !== undefined) {
                // ensure the original query is sent
                return doRequest(location, { query })
              }
            }

            throw error
          }
        )
      : doRequest())

    if (pTaskResult !== undefined) {
      pTaskResult = pTaskResult.catch(error => {
        error.url = response.url
        throw error
      })
    }

    if (!useHack) {
      // consume the response
      response.resume()

      return pTaskResult
    }

    const { req } = response
    if (!req.finished) {
      await fromEvents(req, ['close', 'finish'])
    }
    response.cancel()
    return pTaskResult
  }

  // ===========================================================================
  // Events & cached objects
  // ===========================================================================

  get objects() {
    return this._objects
  }

  get objectsFetched() {
    return this._objectsFetched
  }

  get lastEventFetchedTimestamp() {
    return this._lastEventFetchedTimestamp
  }

  get watchEventsError() {
    return this._watchEventsError
  }

  // ensure we have received all events up to this call
  //
  // optionally returns the up to date object for the given ref
  async barrier(ref) {
    const eventWatchers = this._eventWatchers
    if (eventWatchers === undefined) {
      throw new Error('Xapi#barrier() requires events watching')
    }

    const key = `xo:barrier:${Math.random().toString(36).slice(2)}`
    const poolRef = this._pool.$ref

    const { promise, resolve } = defer()
    eventWatchers[key] = resolve

    await this._sessionCall('pool.add_to_other_config', [
      poolRef,
      key,

      // use ms timestamp as values to enable identification of stale entries
      String(Date.now()),
    ])

    await this._addSyncStackTrace(promise)

    ignoreErrors.call(this._sessionCall('pool.remove_from_other_config', [poolRef, key]))

    if (ref !== undefined) {
      return this.getObjectByRef(ref)
    }
  }

  // create a task and automatically destroy it when settled
  //
  //  allowed even in read-only mode because it does not have impact on the
  //  XenServer and it's necessary for getResource()
  async createTask(nameLabel, nameDescription = '') {
    const taskRef = await this._sessionCall('task.create', [nameLabel, nameDescription])

    const destroyTask = () => ignoreErrors.call(this._sessionCall('task.destroy', [taskRef]))
    this.watchTask(taskRef).then(destroyTask, destroyTask)

    return taskRef
  }

  async getCachedRecord(type, ref) {
    const records = this._objectsByRef
    let record = records[ref]
    if (record !== undefined) {
      return record
    }

    this._watchType(type)

    record = await pCatch.call(this.getRecord(type, ref), { code: 'HANDLE_INVALID' }, noop)
    records[ref] = record

    return record
  }

  // Nice getter which returns the object for a given $id (internal to
  // this lib), UUID (unique identifier that some objects have) or
  // opaque reference (internal to XAPI).
  getObject(idOrUuidOrRef, defaultValue) {
    if (!this._cacheAllRecords) {
      throw new Error('disabled')
    }

    if (typeof idOrUuidOrRef === 'object') {
      idOrUuidOrRef = idOrUuidOrRef.$id
    }

    const object = this._objects.all[idOrUuidOrRef] || this._objectsByRef[idOrUuidOrRef]

    if (object !== undefined) return object

    if (arguments.length > 1) return defaultValue

    throw new Error('no object with UUID or opaque ref: ' + idOrUuidOrRef)
  }

  // Returns the object for a given opaque reference (internal to
  // XAPI).
  getObjectByRef(ref, defaultValue) {
    if (!this._cacheAllRecords) {
      throw new Error('disabled')
    }

    const object = this._objectsByRef[ref]

    if (object !== undefined) return object

    if (arguments.length > 1) return defaultValue

    throw new Error('no object with opaque ref: ' + ref)
  }

  // Returns the object for a given UUID (unique identifier that some
  // objects have).
  getObjectByUuid(uuid, defaultValue) {
    if (!this._cacheAllRecords) {
      throw new Error('disabled')
    }

    // Objects ids are already UUIDs if they have one.
    const object = this._objects.all[uuid]

    if (object !== undefined) return object

    if (arguments.length > 1) return defaultValue

    throw new Error('no object with UUID: ' + uuid)
  }

  // manually run events watching if set to `false` in constructor
  watchEvents() {
    ignoreErrors.call(this._watchEvents())
  }

  watchTask(ref) {
    const watchers = this._taskWatchers
    if (watchers === undefined) {
      throw new Error('Xapi#watchTask() requires events watching')
    }

    // allow task object to be passed
    if (ref.$ref !== undefined) ref = ref.$ref

    let watcher = watchers[ref]
    if (watcher === undefined) {
      // sync check if the task is already settled
      const task = this._objectsByRef[ref]
      if (task !== undefined) {
        const result = getTaskResult(task)
        if (result !== undefined) {
          return result
        }
      }

      watcher = watchers[ref] = defer()
    }
    return this._addSyncStackTrace(watcher.promise)
  }

  // ===========================================================================
  // Private
  // ===========================================================================

  async _call(method, args, { cancelToken = CancelToken.none, timeout = this._callTimeout(method, args) } = {}) {
    const startTime = Date.now()
    try {
      const result = await pTimeout.call(this._addSyncStackTrace(this._transport(method, args, cancelToken)), timeout)
      debug('%s: %s(...) [%s] ==> %s', this._humanId, method, ms(Date.now() - startTime), kindOf(result))
      return result
    } catch (error) {
      // do not log the session ID
      //
      // TODO: should log at the session level to avoid logging sensitive
      // values?
      const params = args[0] === this._sessionId ? args.slice(1) : args

      error.call = {
        method,
        params:
          // it pass server's credentials as param
          method === 'session.login_with_password'
            ? '* obfuscated *'
            : replaceSensitiveValues(params, '* obfuscated *'),
      }

      debug('%s: %s(...) [%s] =!> %s', this._humanId, method, ms(Date.now() - startTime), error)

      throw error
    }
  }

  // return a promise which resolves to a task ref or undefined
  _autoTask(task = this._taskWatchers !== undefined, name) {
    if (task === false) {
      return Promise.resolve()
    }

    if (task === true) {
      return this.createTask(name)
    }

    // either a reference or a promise to a reference
    return Promise.resolve(task)
  }

  _interruptOnDisconnect(promise) {
    let listener
    const pWrapper = new Promise((resolve, reject) => {
      promise.then(resolve, reject)
      this.on(
        DISCONNECTED,
        (listener = () => {
          reject(new Error('disconnected'))
        })
      )
    })
    const clean = () => {
      this.removeListener(DISCONNECTED, listener)
    }
    pWrapper.then(clean, clean)
    return pWrapper
  }

  _sessionCallRetryOptions = {
    tries: 2,
    when: error =>
      this._status !== DISCONNECTED && error?.code === 'SESSION_INVALID' && this._auth.password !== undefined,
    onRetry: () => this._sessionOpen(),
  }
  async _sessionCall(method, args, opts) {
    if (method.startsWith('session.')) {
      return Promise.reject(new Error('session.*() methods are disabled from this interface'))
    }

    try {
      return await pRetry(() => {
        const sessionId = this._sessionId
        assert.notStrictEqual(sessionId, undefined)

        const newArgs = [sessionId]
        if (args !== undefined) {
          newArgs.push.apply(newArgs, args)
        }

        return this._call(method, newArgs, opts)
      }, this._sessionCallRetryOptions)
    } catch (error) {
      if (error?.code === 'SESSION_INVALID') {
        await ignoreErrors.call(this.disconnect())
      }

      throw error
    }
  }

  // FIXME: (probably rare) race condition leading to unnecessary login when:
  // 1. two calls using an invalid session start
  // 2. one fails with SESSION_INVALID and renew the session by calling
  //    `_sessionOpen`
  // 3. the session is renewed
  // 4. the second call fails with SESSION_INVALID which leads to a new
  //    unnecessary renewal
  _sessionOpenRetryOptions = {
    tries: 2,
    when: { code: 'HOST_IS_SLAVE' },
    onRetry: error => {
      this._setUrl({ ...this._url, hostname: error.params[0] })
    },
  }
  _sessionOpen = coalesceCalls(this._sessionOpen)
  async _sessionOpen() {
    const { user, password, sessionId } = this._auth

    this._sessionId = sessionId

    if (sessionId === undefined) {
      const params = [user, password]
      this._sessionId = await pRetry(
        () => this._interruptOnDisconnect(this._call('session.login_with_password', params)),
        this._sessionOpenRetryOptions
      )
    }

    const oldPoolRef = this._pool?.$ref

    // Similar to `(await this.getAllRecords('pool'))[0]` but prevents a
    // deadlock in case of error due to a pRetry calling _sessionOpen again
    const pools = await pRetry(
      () => this._call('pool.get_all_records', [this._sessionId]),
      this._sessionOpenRetryOptions
    )
    const poolRef = Object.keys(pools)[0]
    this._pool = this._wrapRecord('pool', poolRef, pools[poolRef])

    this.emit('sessionId', this._sessionId)

    // if the pool ref has changed, it means that the XAPI has been restarted or
    // it's not the same XAPI, we need to refetch the available types and reset
    // the event loop in that case
    if (this._pool.$ref !== oldPoolRef) {
      // Uses introspection to list available types.
      const types = (this._types = (await this._interruptOnDisconnect(this._call('system.listMethods')))
        .filter(isGetAllRecordsMethod)
        .map(method => method.slice(0, method.indexOf('.'))))
      this._lcToTypes = { __proto__: null }
      types.forEach(type => {
        const lcType = type.toLowerCase()
        if (lcType !== type) {
          this._lcToTypes[lcType] = type
        }
      })
    }
  }

  async _getHostAddress({ address }) {
    if (this._reverseHostIpAddresses) {
      try {
        ;[address] = await fromCallback(dns.reverse, address)
      } catch (error) {
        console.warn('reversing host address', address, error)
      }
    }
    return address
  }

  _setUrl(url) {
    this._humanId = `${this._auth.user ?? 'unknown'}@${url.hostname}`
    this._transport = autoTransport({
      secureOptions: {
        minVersion: 'TLSv1',
        rejectUnauthorized: !this._allowUnauthorized,
      },
      url,
    })
    this._url = url
  }

  _addRecordToCache(type, ref, object) {
    object = this._wrapRecord(type, ref, object)

    // Finally freezes the object.
    freeze(object)

    const objects = this._objects
    const objectsByRef = this._objectsByRef

    // An object's UUID can change during its life.
    const prev = objectsByRef[ref]
    let prevUuid
    if (prev !== undefined && (prevUuid = prev.uuid) !== undefined && prevUuid !== object.uuid) {
      objects.remove(prevUuid)
    }

    this._objects.set(object.$id, object)
    objectsByRef[ref] = object

    if (type === 'pool') {
      this._pool = object

      const eventWatchers = this._eventWatchers
      getKeys(object.other_config).forEach(key => {
        const eventWatcher = eventWatchers[key]
        if (eventWatcher !== undefined) {
          delete eventWatchers[key]
          eventWatcher(object)
        }
      })
    } else if (type === 'task') {
      if (prev === undefined) {
        ++this._nTasks
      }

      const taskWatchers = this._taskWatchers
      const taskWatcher = taskWatchers[ref]
      if (taskWatcher !== undefined) {
        const result = getTaskResult(object)
        if (result !== undefined) {
          taskWatcher.resolve(result)
          delete taskWatchers[ref]
        }
      }
    }
  }

  _processEvents(events) {
    const flush = this._objects.bufferEvents()
    events.forEach(event => {
      let type = event.class
      const lcToTypes = this._lcToTypes
      if (type in lcToTypes) {
        type = lcToTypes[type]
      }
      const { ref } = event
      if (event.operation === 'del') {
        this._removeRecordFromCache(type, ref)
      } else {
        this._addRecordToCache(type, ref, event.snapshot)
      }
    })
    flush()
  }

  async _refreshCachedRecords(types) {
    const toRemoveByType = { __proto__: null }
    types.forEach(type => {
      toRemoveByType[type] = new Set()
    })
    const byRefs = this._objectsByRef
    getKeys(byRefs).forEach(ref => {
      const { $type } = byRefs[ref]
      const toRemove = toRemoveByType[$type]
      if (toRemove !== undefined) {
        toRemove.add(ref)
      }
    })

    const flush = this._objects.bufferEvents()
    await Promise.all(
      types.map(async type => {
        try {
          const toRemove = toRemoveByType[type]
          const records = await this._roCall(`${type}.get_all_records`)
          const refs = getKeys(records)
          refs.forEach(ref => {
            toRemove.delete(ref)

            // we can bypass _processEvents here because they are all *add*
            // event and all objects are of the same type
            this._addRecordToCache(type, ref, records[ref])
          })
          toRemove.forEach(ref => {
            this._removeRecordFromCache(type, ref)
          })

          if (type === 'task') {
            this._nTasks = refs.length
          }
        } catch (error) {
          // there is nothing ideal to do here, do not interrupt event
          // handling
          if (error?.code !== 'MESSAGE_REMOVED') {
            console.warn('_refreshCachedRecords', type, error)
          }
        }
      })
    )
    flush()
  }

  _removeRecordFromCache(type, ref) {
    const byRefs = this._objectsByRef
    const object = byRefs[ref]
    if (object !== undefined) {
      this._objects.unset(object.$id)
      delete byRefs[ref]

      if (type === 'task') {
        --this._nTasks
      }
    }

    const taskWatchers = this._taskWatchers
    const taskWatcher = taskWatchers[ref]
    if (taskWatcher !== undefined) {
      const error = new Error('task has been destroyed before completion')
      error.task = object
      error.taskRef = ref
      taskWatcher.reject(error)
      delete taskWatchers[ref]
    }
  }

  // read-only call, automatically retry in case of connection issues
  _roCall(...args) {
    return pRetry(() => this._sessionCall(...args), this._roCallRetryOptions)
  }

  _cancelEventCall = noop

  _watchType(type) {
    const watchedTypes = this._watchedTypes
    if (!watchedTypes.includes(type)) {
      watchedTypes.push(type)
      this._cancelEventCall()
    }
  }

  _watchEvents = coalesceCalls(this._watchEvents)
  async _watchEvents() {
    // eslint-disable-next-line no-labels
    mainLoop: while (true) {
      if (this._resolveObjectsFetched === undefined) {
        this._objectsFetched = new Promise(resolve => {
          this._resolveObjectsFetched = resolve
        })
      }

      await this._connected

      // compute the initial token for the event loop
      //
      // we need to do this before the initial fetch to avoid losing events
      let fromToken
      try {
        fromToken = await this._sessionCall('event.inject', ['pool', this._pool.$ref])
      } catch (error) {
        if (error?.code === 'MESSAGE_METHOD_UNKNOWN') {
          return this._watchEventsLegacy()
        }

        console.warn('_watchEvents', error)
        await pDelay(this._eventPollDelay)
        continue
      }

      const types = this._watchedTypes ?? this._types

      // initial fetch
      if (this._cacheAllRecords) {
        await this._refreshCachedRecords(types)
        this._resolveObjectsFetched()
        this._resolveObjectsFetched = undefined
      }

      // event loop
      const debounce = this._debounce
      while (true) {
        await pDelay(debounce)

        await this._connected

        let result
        try {
          // don't use _sessionCall because a session failure should break the
          // loop and trigger a complete refetch
          result = await pRetry(
            () => {
              const source = CancelToken.source()
              this._cancelEventCall = source.cancel

              return this._call(
                'event.from',
                [
                  this._sessionId,
                  types,
                  fromToken,
                  EVENT_TIMEOUT + 0.1, // must be float for XML-RPC transport
                ],
                {
                  cancelToken: source.token,
                  timeout: EVENT_TIMEOUT * 1e3 * 1.1,
                }
              )
            },
            { when: CancelToken.isCancelToken }
          )

          this._lastEventFetchedTimestamp = Date.now()
          this._watchEventsError = undefined
          this.emit('eventFetchingSuccess')
        } catch (error) {
          const code = error?.code
          if (code === 'EVENTS_LOST' || code === 'SESSION_INVALID') {
            // eslint-disable-next-line no-labels
            continue mainLoop
          }

          this.emit('eventFetchingError', error)
          this._watchEventsError = error
          console.warn('_watchEvents', error)
          await pDelay(this._eventPollDelay)
          continue
        }

        fromToken = result.token
        this._processEvents(result.events)

        // detect and fix disappearing tasks (e.g. when toolstack restarts)
        //
        // FIXME: only if 'task' in 'types
        if (result.valid_ref_counts.task !== this._nTasks) {
          await this._refreshCachedRecords(['task'])
        }
      }
    }
  }

  // This method watches events using the legacy `event.next` XAPI
  // methods.
  //
  // It also has to manually get all objects first.
  async _watchEventsLegacy() {
    if (this._resolveObjectsFetched === undefined) {
      this._objectsFetched = new Promise(resolve => {
        this._resolveObjectsFetched = resolve
      })
    }

    await this._connected

    const types = this._watchedTypes ?? this._types

    // initial fetch
    await this._refreshCachedRecords(types)
    this._resolveObjectsFetched()
    this._resolveObjectsFetched = undefined

    await this._sessionCall('event.register', [types])

    // event loop
    const debounce = this._debounce
    while (true) {
      await pDelay(debounce)

      try {
        await this._connected
        this._processEvents(
          await pRetry(
            () => {
              const source = CancelToken.source()
              this._cancelEventCall = source.cancel

              return this._roCall('event.next', undefined, { cancelToken: source.token, timeout: EVENT_TIMEOUT * 1e3 })
            },
            { when: CancelToken.isCancelToken }
          )
        )
      } catch (error) {
        if (error?.code === 'EVENTS_LOST') {
          await ignoreErrors.call(this._sessionCall('event.unregister', [types]))
          return this._watchEventsLegacy()
        }

        console.warn('_watchEventsLegacy', error)
        await pDelay(this._eventPollDelay)
      }
    }
  }

  _wrapRecord(type, ref, data) {
    const RecordsByType = this._RecordsByType
    let Record = RecordsByType[type]
    if (Record === undefined) {
      const fields = getKeys(data)
      const nFields = fields.length
      const xapi = this

      const getObjectByRef = ref => this._objectsByRef[ref]

      Record = defineProperty(
        function (ref, data) {
          defineProperties(this, {
            $id: { value: data.uuid ?? ref },
            $ref: { value: ref },
          })
          for (let i = 0; i < nFields; ++i) {
            const field = fields[i]
            this[field] = data[field]
          }
        },
        'name',
        {
          value: type,
        }
      )

      const getters = { $pool: getPool }
      const props = {
        $call: function (method, ...args) {
          return xapi.call(`${type}.${method}`, this.$ref, ...args)
        },
        $callAsync: function (method, ...args) {
          return xapi.callAsync(`${type}.${method}`, this.$ref, ...args)
        },
        $type: type,
        $xapi: xapi,
      }
      ;(function addMethods(object) {
        Object.getOwnPropertyNames(object).forEach(name => {
          // dont trigger getters (eg sessionId)
          const fn = Object.getOwnPropertyDescriptor(object, name).value
          if (typeof fn === 'function' && name.startsWith(type + '_')) {
            const key = '$' + name.slice(type.length + 1)
            assert.strictEqual(props[key], undefined)
            props[key] = function (...args) {
              return xapi[name](this.$ref, ...args)
            }
          }
        })
        const proto = Object.getPrototypeOf(object)
        if (proto !== null) {
          addMethods(proto)
        }
      })(xapi)
      const disabledGetter = this._cacheAllRecords
        ? undefined
        : () => {
            throw new Error('disabled')
          }
      fields.forEach(field => {
        props[`set_${field}`] =
          disabledGetter ||
          function (value) {
            return xapi.setField(this.$type, this.$ref, field, value)
          }

        const $field = (field in RESERVED_FIELDS ? '$$' : '$') + field

        const value = data[field]
        if (Array.isArray(value)) {
          if (value.length === 0 || Ref.is(value[0])) {
            getters[$field] =
              disabledGetter ||
              function () {
                const value = this[field]
                return value.length === 0 ? value : value.map(getObjectByRef)
              }
          }

          props[`add_${field}`] = function (value) {
            return xapi.call(`${type}.add_${field}`, this.$ref, value).then(noop)
          }
          props[`remove_${field}`] = function (value) {
            return xapi.call(`${type}.remove_${field}`, this.$ref, value).then(noop)
          }
        } else if (value !== null && typeof value === 'object') {
          getters[$field] =
            disabledGetter ||
            function () {
              const value = this[field]
              const result = {}
              getKeys(value).forEach(key => {
                result[key] = xapi._objectsByRef[value[key]]
              })
              return result
            }
          props[`update_${field}`] = function (entries, value) {
            return typeof entries === 'string'
              ? xapi.setFieldEntry(this.$type, this.$ref, field, entries, value)
              : xapi.setFieldEntries(this.$type, this.$ref, field, entries)
          }
        } else if (Ref.is(value)) {
          getters[$field] =
            disabledGetter ||
            function () {
              return xapi._objectsByRef[this[field]]
            }
        }
      })
      const descriptors = {}
      getKeys(getters).forEach(key => {
        descriptors[key] = {
          configurable: true,
          get: getters[key],
        }
      })
      getKeys(props).forEach(key => {
        descriptors[key] = {
          configurable: true,
          value: props[key],
          writable: true,
        }
      })
      defineProperties(Record.prototype, descriptors)

      RecordsByType[type] = Record
    }
    return new Record(ref, data)
  }
}

// ===================================================================

// The default value is a factory function.
export const createClient = opts => new Xapi(opts)
