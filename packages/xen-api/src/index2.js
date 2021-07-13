import assert from 'assert'
import cancelable from 'promise-toolbox/cancelable'
import Collection from 'xo-collection'
import fromEvents from 'promise-toolbox/fromEvents'
import httpRequest from 'http-request-plus'
import ignoreErrors from 'promise-toolbox/ignoreErrors'
import kindOf from 'kindof'
import map from 'lodash/map'
import ms from 'ms'
import omit from 'lodash/omit'
import pDefer from 'promise-toolbox/defer'
import pDelay from 'promise-toolbox/delay'
import pRetry from 'promise-toolbox/retry'
import pTimeout from 'promise-toolbox/timeout'

import autoTransport from './transports/auto'
import coalesceCalls from './_coalesceCalls'
import debug from './_debug'
import getTaskResult from './_getTaskResult'
import isGetAllRecordsMethod from './_isGetAllRecordsMethod'
import isOpaqueRef from './_isOpaqueRef'
import isReadOnlyCall from './_isReadOnlyCall'
import makeCallSetting from './_makeCallSetting'
import parseUrl from './_parseUrl'
import replaceSensitiveValues from './_replaceSensitiveValues'
import XapiError from './_XapiError'

const CONNECTED = 'connected'
const CONNECTING = 'connecting'
const DISCONNECTED = 'disconnected'

// in seconds!
const EVENT_TIMEOUT = 60

const { isArray } = Array
const { defineProperties, freeze, keys: getKeys } = Object
const noop = Function.propTypes

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

export class Xapi {
  constructor(opts) {
    this._callTimeout = makeCallSetting(opts.callTimeout, 0)
    this._httpInactivityTimeout = opts.httpInactivityTimeout ?? 5 * 60 * 1e3 // 5 mins
    this._eventPollDelay = opts.eventPollDelay ?? 60 * 1e3 // 1 min

    this._pool = undefined
    this._readOnly = Boolean(opts.readOnly)
    this._RecordsByType = { __proto__: null }

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

    this._debounce = opts.debounce ?? 200
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
      if (isArray(watchEvents)) {
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

      // Uses introspection to list available types.
      const types = (this._types = (await this._interruptOnDisconnect(
        this._call('system.listMethods')
      ))
        .filter(isGetAllRecordsMethod)
        .map(method => method.slice(0, method.indexOf('.'))))
      this._lcToTypes = { __proto__: null }
      types.forEach(type => {
        const lcType = type.toLowerCase()
        if (lcType !== type) {
          this._lcToTypes[lcType] = type
        }
      })

      this._pool = (await this.getAllRecords('pool'))[0]

      debug('%s: connected', this._humanId)
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

    const sessionId = this._sessionId
    if (sessionId !== undefined) {
      this._sessionId = undefined
      ignoreErrors.call(this._call('session.logout', [sessionId]))
    }

    debug('%s: disconnected', this._humanId)

    this._status = DISCONNECTED
    this._resolveDisconnected()
    this._resolveDisconnected = undefined
  }

  // ===========================================================================
  // RPC calls
  // ===========================================================================

  // this should be used for instantaneous calls, otherwise use `callAsync`
  call(method, ...args) {
    return this._readOnly && !isReadOnlyCall(method, args)
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

    const destroyTask = () =>
      ignoreErrors.call(this._sessionCall('task.destroy', [taskRef]))
    promise.then(destroyTask, destroyTask)

    return promise
  }

  // ===========================================================================
  // Objects handling helpers
  // ===========================================================================

  async getAllRecords(type) {
    return map(
      await this._sessionCall(`${type}.get_all_records`),
      (record, ref) => this._wrapRecord(type, ref, record)
    )
  }

  async getRecord(type, ref) {
    return this._wrapRecord(
      type,
      ref,
      await this._sessionCall(`${type}.get_record`, [ref])
    )
  }

  async getRecordByUuid(type, uuid) {
    return this.getRecord(
      type,
      await this._sessionCall(`${type}.get_by_uuid`, [uuid])
    )
  }

  getRecords(type, refs) {
    return Promise.all(refs.map(ref => this.getRecord(type, ref)))
  }

  getField(type, ref, field) {
    return this._sessionCall(`${type}.get_${field}`, [ref])
  }

  setField(type, ref, field, value) {
    return this.call(`${type}.set_${field}`, ref, value).then(noop)
  }

  setFieldEntries(type, ref, field, entries) {
    return Promise.all(
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
        hostname: this.getObject(host).address,
      },
      {
        pathname,
        query,
        rejectUnauthorized: !this._allowUnauthorized,

        // this is an inactivity timeout (unclear in Node doc)
        timeout: this._httpInactivityTimeout,
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
      console.warn(
        this._humanId,
        'Xapi#putResource',
        pathname,
        'missing length'
      )

      headers['content-length'] = '1125899906842624'
    }

    const doRequest = httpRequest.put.bind(
      undefined,
      $cancelToken,
      this._url,
      host !== undefined && {
        hostname: this.getObject(host).address,
      },
      {
        body,
        headers,
        pathname,
        query,
        rejectUnauthorized: !this._allowUnauthorized,

        // this is an inactivity timeout (unclear in Node doc)
        timeout: this._httpInactivityTimeout,
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

  // ensure we have received all events up to this call
  //
  // optionally returns the up to date object for the given ref
  async barrier(ref) {
    const eventWatchers = this._eventWatchers
    if (eventWatchers === undefined) {
      throw new Error('Xapi#barrier() requires events watching')
    }

    const key = `xo:barrier:${Math.random()
      .toString(36)
      .slice(2)}`
    const poolRef = this._pool.$ref

    const { promise, resolve } = pDefer()
    eventWatchers[key] = resolve

    await this._sessionCall('pool.add_to_other_config', [poolRef, key, ''])

    await promise

    ignoreErrors.call(
      this._sessionCall('pool.remove_from_other_config', [poolRef, key])
    )

    if (ref !== undefined) {
      return this.getObjectByRef(ref)
    }
  }

  // create a task and automatically destroy it when settled
  //
  //  allowed even in read-only mode because it does not have impact on the
  //  XenServer and it's necessary for getResource()
  async createTask(nameLabel, nameDescription = '') {
    const taskRef = await this._sessionCall('task.create', [
      nameLabel,
      nameDescription,
    ])

    const destroyTask = () =>
      ignoreErrors.call(this._sessionCall('task.destroy', [taskRef]))
    this.watchTask(taskRef).then(destroyTask, destroyTask)

    return taskRef
  }

  // Nice getter which returns the object for a given $id (internal to
  // this lib), UUID (unique identifier that some objects have) or
  // opaque reference (internal to XAPI).
  getObject(idOrUuidOrRef, defaultValue) {
    if (typeof idOrUuidOrRef === 'object') {
      idOrUuidOrRef = idOrUuidOrRef.$id
    }

    const object =
      this._objects.all[idOrUuidOrRef] || this._objectsByRef[idOrUuidOrRef]

    if (object !== undefined) return object

    if (arguments.length > 1) return defaultValue

    throw new Error('no object with UUID or opaque ref: ' + idOrUuidOrRef)
  }

  // Returns the object for a given opaque reference (internal to
  // XAPI).
  getObjectByRef(ref, defaultValue) {
    const object = this._objectsByRef[ref]

    if (object !== undefined) return object

    if (arguments.length > 1) return defaultValue

    throw new Error('no object with opaque ref: ' + ref)
  }

  // Returns the object for a given UUID (unique identifier that some
  // objects have).
  getObjectByUuid(uuid, defaultValue) {
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

      watcher = watchers[ref] = pDefer()
    }
    return watcher.promise
  }

  // ===========================================================================
  // Private
  // ===========================================================================

  async _call(method, args, timeout = this._callTimeout(method, args)) {
    const startTime = Date.now()
    try {
      const result = await pTimeout.call(this._transport(method, args), timeout)
      debug(
        '%s: %s(...) [%s] ==> %s',
        this._humanId,
        method,
        ms(Date.now() - startTime),
        kindOf(result)
      )
      return result
    } catch (e) {
      const error = e instanceof Error ? e : XapiError.wrap(e)

      // do not log the session ID
      //
      // TODO: should log at the session level to avoid logging sensitive
      // values?
      const params = args[0] === this._sessionId ? args.slice(1) : args

      error.call = {
        method,
        params: replaceSensitiveValues(params, '* obfuscated *'),
      }

      debug(
        '%s: %s(...) [%s] =!> %s',
        this._humanId,
        method,
        ms(Date.now() - startTime),
        error
      )

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
    return Promise.race([
      promise,
      this._disconnected.then(() => {
        throw new Error('disconnected')
      }),
    ])
  }

  async _sessionCall(method, args, timeout) {
    if (method.startsWith('session.')) {
      throw new Error('session.*() methods are disabled from this interface')
    }

    const sessionId = this._sessionId
    assert.notStrictEqual(sessionId, undefined)

    const newArgs = [sessionId]
    if (args !== undefined) {
      newArgs.push.apply(newArgs, args)
    }

    return pRetry(
      () => this._interruptOnDisconnect(this._call(method, newArgs, timeout)),
      {
        tries: 2,
        when: { code: 'SESSION_INVALID' },
        onRetry: () => this._sessionOpen(),
      }
    )
  }

  // FIXME: (probably rare) race condition leading to unnecessary login when:
  // 1. two calls using an invalid session start
  // 2. one fails with SESSION_INVALID and renew the session by calling
  //    `_sessionOpen`
  // 3. the session is renewed
  // 4. the second call fails with SESSION_INVALID which leads to a new
  //    unnecessary renewal
  _sessionOpen = coalesceCalls(this._sessionOpen)
  async _sessionOpen() {
    const { user, password } = this._auth
    const params = [user, password]
    this._sessionId = await pRetry(
      () =>
        this._interruptOnDisconnect(
          this._call('session.login_with_password', params)
        ),
      {
        tries: 2,
        when: { code: 'HOST_IS_SLAVE' },
        onRetry: error => {
          this._setUrl({ ...this._url, hostname: error.params[0] })
        },
      }
    )
  }

  _setUrl(url) {
    this._humanId = `${this._auth.user}@${url.hostname}`
    this._transport = autoTransport({
      allowUnauthorized: this._allowUnauthorized,
      url,
    })
    this._url = url
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  _addRecordToCache(type, ref, object) {
    object = this._wrapRecord(type, ref, object)

    // Finally freezes the object.
    freeze(object)

    const objects = this._objects
    const objectsByRef = this._objectsByRef

    // An object's UUID can change during its life.
    const prev = objectsByRef[ref]
    let prevUuid
    if (
      prev !== undefined &&
      (prevUuid = prev.uuid) !== undefined &&
      prevUuid !== object.uuid
    ) {
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
          const records = await this._sessionCall(`${type}.get_all_records`)
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
        fromToken = await this._sessionCall('event.inject', [
          'pool',
          this._pool.$ref,
        ])
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
      await this._refreshCachedRecords(types)
      this._resolveObjectsFetched()
      this._resolveObjectsFetched = undefined

      // event loop
      const debounce = this._debounce
      while (true) {
        await pDelay(debounce)

        await this._connected

        let result
        try {
          result = await this._sessionCall(
            'event.from',
            [
              types,
              fromToken,
              EVENT_TIMEOUT + 0.1, // must be float for XML-RPC transport
            ],
            EVENT_TIMEOUT * 1e3 * 1.1
          )
        } catch (error) {
          if (error?.code === 'EVENTS_LOST') {
            // eslint-disable-next-line no-labels
            continue mainLoop
          }

          console.warn('_watchEvents', error)
          await pDelay(this._eventPollDelay)
          continue
        }

        fromToken = result.token
        this._processEvents(result.events)

        // detect and fix disappearing tasks (e.g. when toolstack restarts)
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
          await this._sessionCall('event.next', undefined, EVENT_TIMEOUT * 1e3)
        )
      } catch (error) {
        if (error?.code === 'EVENTS_LOST') {
          await ignoreErrors.call(
            this._sessionCall('event.unregister', [types])
          )
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

      Record = function(ref, data) {
        defineProperties(this, {
          $id: { value: data.uuid ?? ref },
          $ref: { value: ref },
          $xapi: { value: xapi },
        })
        for (let i = 0; i < nFields; ++i) {
          const field = fields[i]
          this[field] = data[field]
        }
      }

      const getters = { $pool: getPool }
      const props = { $type: type }
      fields.forEach(field => {
        props[`set_${field}`] = function(value) {
          return xapi.setField(this.$type, this.$ref, field, value)
        }

        const $field = (field in RESERVED_FIELDS ? '$$' : '$') + field

        const value = data[field]
        if (isArray(value)) {
          if (value.length === 0 || isOpaqueRef(value[0])) {
            getters[$field] = function() {
              const value = this[field]
              return value.length === 0 ? value : value.map(getObjectByRef)
            }
          }

          props[`add_to_${field}`] = function(...values) {
            return xapi
              .call(`${type}.add_${field}`, this.$ref, values)
              .then(noop)
          }
        } else if (value !== null && typeof value === 'object') {
          getters[$field] = function() {
            const value = this[field]
            const result = {}
            getKeys(value).forEach(key => {
              result[key] = xapi._objectsByRef[value[key]]
            })
            return result
          }
          props[`update_${field}`] = function(entries, value) {
            return typeof entries === 'string'
              ? xapi.setFieldEntry(this.$type, this.$ref, field, entries, value)
              : xapi.setFieldEntries(this.$type, this.$ref, field, entries)
          }
        } else if (value === '' || isOpaqueRef(value)) {
          // 2019-02-07 - JFT: even if `value` should not be an empty string for
          // a ref property, an user had the case on XenServer 7.0 on the CD VBD
          // of a VM created by XenCenter
          getters[$field] = function() {
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

// backward compatibility
export const createClient = opts => new Xapi(opts)
