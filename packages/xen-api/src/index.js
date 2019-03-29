import assert from 'assert'
import Collection from 'xo-collection'
import kindOf from 'kindof'
import ms from 'ms'
import httpRequest from 'http-request-plus'
import { EventEmitter } from 'events'
import { fibonacci } from 'iterable-backoff'
import {
  forEach,
  forOwn,
  isArray,
  map,
  noop,
  omit,
  reduce,
  startsWith,
} from 'lodash'
import {
  cancelable,
  defer,
  fromEvents,
  ignoreErrors,
  pCatch,
  pDelay,
  pTimeout,
  TimeoutError,
} from 'promise-toolbox'

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

// ===================================================================

// in seconds!
const EVENT_TIMEOUT = 60

// http://www.gnu.org/software/libc/manual/html_node/Error-Codes.html
const NETWORK_ERRORS = {
  // Connection has been closed outside of our control.
  ECONNRESET: true,

  // Connection has been aborted locally.
  ECONNABORTED: true,

  // Host is up but refuses connection (typically: no such service).
  ECONNREFUSED: true,

  // TODO: ??
  EINVAL: true,

  // Host is not reachable (does not respond).
  EHOSTUNREACH: true,

  // network is unreachable
  ENETUNREACH: true,

  // Connection configured timed out has been reach.
  ETIMEDOUT: true,
}

const isNetworkError = ({ code }) => NETWORK_ERRORS[code]

// -------------------------------------------------------------------

const XAPI_NETWORK_ERRORS = {
  HOST_STILL_BOOTING: true,
  HOST_HAS_NO_MANAGEMENT_IP: true,
}

const isXapiNetworkError = ({ code }) => XAPI_NETWORK_ERRORS[code]

// -------------------------------------------------------------------

const areEventsLost = ({ code }) => code === 'EVENTS_LOST'

const isHostSlave = ({ code }) => code === 'HOST_IS_SLAVE'

const isMethodUnknown = ({ code }) => code === 'MESSAGE_METHOD_UNKNOWN'

const isSessionInvalid = ({ code }) => code === 'SESSION_INVALID'

// ===================================================================

const { defineProperties, freeze, keys: getKeys } = Object

// -------------------------------------------------------------------

export const NULL_REF = 'OpaqueRef:NULL'

// -------------------------------------------------------------------

const getKey = o => o.$id

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

// timeout of XenAPI HTTP connections
const HTTP_TIMEOUT = 24 * 3600 * 1e3

// -------------------------------------------------------------------

export class Xapi extends EventEmitter {
  constructor(opts) {
    super()

    this._callTimeout = makeCallSetting(opts.callTimeout, 0)
    this._httpInactivityTimeout = opts.httpInactivityTimeout ?? 5 * 60 * 1e3 // 5 mins
    this._pool = null
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

    this._connecting = undefined
    this._connected = new Promise(resolve => {
      this._resolveConnected = resolve
    })
    this._disconnected = Promise.resolve()
    this._sessionId = undefined
    this._status = DISCONNECTED
    ;(this._objects = new Collection()).getKey = getKey
    this._debounce = opts.debounce == null ? 200 : opts.debounce
    this._watchedTypes = undefined
    this._watching = false

    this.on(DISCONNECTED, this._clearObjects)
    this._clearObjects()

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
    const id = this._sessionId

    if (id === undefined || id === CONNECTING) {
      throw new Error('sessionId is only available when connected')
    }

    return id
  }

  get status() {
    const id = this._sessionId

    return id === undefined
      ? DISCONNECTED
      : id === CONNECTING
      ? CONNECTING
      : CONNECTED
  }

  connect = coalesceCalls(this.connect)
  async connect() {
    const { status } = this

    if (status === CONNECTED) {
      return
    }

    assert(status === DISCONNECTED)

    const auth = this._auth

    this._sessionId = CONNECTING

    try {
      const [methods, sessionId] = await Promise.all([
        this._transportCall('system.listMethods', []),
        this._transportCall('session.login_with_password', [
          auth.user,
          auth.password,
        ]),
      ])

      // Uses introspection to list available types.
      const types = (this._types = methods
        .filter(isGetAllRecordsMethod)
        .map(method => method.slice(0, method.indexOf('.'))))
      this._lcToTypes = { __proto__: null }
      types.forEach(type => {
        const lcType = type.toLowerCase()
        if (lcType !== type) {
          this._lcToTypes[lcType] = type
        }
      })

      this._sessionId = sessionId
      this._pool = (await this.getAllRecords('pool'))[0]

      debug('%s: connected', this._humanId)
      this._disconnected = new Promise(resolve => {
        this._resolveDisconnected = resolve
      })
      this._resolveConnected()
      this._resolveConnected = undefined
      this.emit(CONNECTED)
    } catch (error) {
      ignoreErrors.call(this.disconnect())

      throw error
    }
  }

  async disconnect() {
    const { status } = this

    if (status === DISCONNECTED) {
      return
    }

    if (status === CONNECTED) {
      this._connected = new Promise(resolve => {
        this._resolveConnected = resolve
      })

      this._resolveDisconnected()
      this._resolveDisconnected = undefined
    } else {
      assert(status === CONNECTING)
    }

    const sessionId = this._sessionId
    if (sessionId !== undefined) {
      this._sessionId = undefined
      ignoreErrors.call(this._transportCall('session.logout', [sessionId]))
    }

    debug('%s: disconnected', this._humanId)

    this.emit(DISCONNECTED)
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

    const { promise, resolve } = defer()
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

    if (object) return object

    if (arguments.length > 1) return defaultValue

    throw new Error('no object with UUID: ' + uuid)
  }

  watchEvents() {
    this._eventWatchers = { __proto__: null }

    this._taskWatchers = { __proto__: null }

    if (this.status === CONNECTED) {
      this._watchEventsWrapper()
    }

    this.on('connected', this._watchEventsWrapper)
    this.on('disconnected', () => {
      this._objects.clear()
    })
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
    return watcher.promise
  }

  // ===========================================================================
  // Private
  // ===========================================================================

  _clearObjects() {
    ;(this._objectsByRef = { __proto__: null })[NULL_REF] = undefined
    this._nTasks = 0
    this._objects.clear()
    this.objectsFetched = new Promise(resolve => {
      this._resolveObjectsFetched = resolve
    })
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

  // Medium level call: handle session errors.
  _sessionCall(method, args, timeout = this._callTimeout(method, args)) {
    try {
      if (startsWith(method, 'session.')) {
        throw new Error('session.*() methods are disabled from this interface')
      }

      const newArgs = [this.sessionId]
      if (args !== undefined) {
        newArgs.push.apply(newArgs, args)
      }

      return pTimeout.call(
        pCatch.call(
          this._transportCall(method, newArgs),
          isSessionInvalid,
          () => {
            // XAPI is sometimes reinitialized and sessions are lost.
            // Try to login again.
            debug('%s: the session has been reinitialized', this._humanId)

            this._sessionId = undefined
            return this.connect().then(() => this._sessionCall(method, args))
          }
        ),
        timeout
      )
    } catch (error) {
      return Promise.reject(error)
    }
  }

  _setUrl(url) {
    this._humanId = `${this._auth.user}@${url.hostname}`
    this._call = autoTransport({
      allowUnauthorized: this._allowUnauthorized,
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
    if (prev && (prevUuid = prev.uuid) && prevUuid !== object.uuid) {
      objects.remove(prevUuid)
    }

    this._objects.set(object)
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

  // - prevent multiple watches
  // - swallow errors
  async _watchEventsWrapper() {
    if (!this._watching) {
      this._watching = true
      try {
        await this._watchEvents()
      } catch (error) {
        console.error('_watchEventsWrapper', error)
      }
      this._watching = false
    }
  }

  // TODO: cancelation
  async _watchEvents() {
    this._clearObjects()

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
      if (isMethodUnknown(error)) {
        return this._watchEventsLegacy()
      }
    }

    const types = this._watchedTypes || this._types

    // initial fetch
    const flush = this.objects.bufferEvents()
    try {
      await Promise.all(
        types.map(async type => {
          try {
            // FIXME: use _transportCall to avoid auto-reconnection
            forOwn(
              await this._sessionCall(`${type}.get_all_records`),
              (record, ref) => {
                // we can bypass _processEvents here because they are all *add*
                // event and all objects are of the same type
                this._addRecordToCache(type, ref, record)
              }
            )
          } catch (error) {
            // there is nothing ideal to do here, do not interrupt event
            // handling
            if (error != null && error.code !== 'MESSAGE_REMOVED') {
              console.warn('_watchEvents', 'initial fetch', type, error)
            }
          }
        })
      )
    } finally {
      flush()
    }
    this._resolveObjectsFetched()

    // event loop
    const debounce = this._debounce
    while (true) {
      if (debounce != null) {
        await pDelay(debounce)
      }

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
        if (error instanceof TimeoutError) {
          continue
        }
        if (areEventsLost(error)) {
          return this._watchEvents()
        }
        throw error
      }

      fromToken = result.token
      this._processEvents(result.events)

      // detect and fix disappearing tasks (e.g. when toolstack restarts)
      if (result.valid_ref_counts.task !== this._nTasks) {
        await ignoreErrors.call(
          this._sessionCall('task.get_all_records').then(tasks => {
            const toRemove = new Set()
            forOwn(this.objects.all, object => {
              if (object.$type === 'task') {
                toRemove.add(object.$ref)
              }
            })
            forOwn(tasks, (task, ref) => {
              toRemove.delete(ref)
              this._addRecordToCache('task', ref, task)
            })
            toRemove.forEach(ref => {
              this._removeRecordFromCache('task', ref)
            })
          })
        )
      }
    }
  }

  // This method watches events using the legacy `event.next` XAPI
  // methods.
  //
  // It also has to manually get all objects first.
  _watchEventsLegacy() {
    const getAllObjects = async () => {
      const flush = this.objects.bufferEvents()
      try {
        await Promise.all(
          this._types.map(type =>
            this._sessionCall(`${type}.get_all_records`).then(
              objects => {
                forEach(objects, (object, ref) => {
                  this._addRecordToCache(type, ref, object)
                })
              },
              error => {
                if (error.code !== 'MESSAGE_REMOVED') {
                  throw error
                }
              }
            )
          )
        )
      } finally {
        flush()
      }
      this._resolveObjectsFetched()
    }

    const watchEvents = () =>
      this._sessionCall('event.register', [['*']]).then(loop)

    const loop = () =>
      this.status === CONNECTED &&
      this._sessionCall('event.next').then(onSuccess, onFailure)

    const onSuccess = events => {
      this._processEvents(events)

      const debounce = this._debounce
      return debounce == null ? loop() : pDelay(debounce).then(loop)
    }

    const onFailure = error => {
      if (areEventsLost(error)) {
        return this._sessionCall('event.unregister', [['*']]).then(watchEvents)
      }

      throw error
    }

    return getAllObjects().then(watchEvents)
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

Xapi.prototype._transportCall = reduce(
  [
    function(method, args) {
      return pTimeout
        .call(this._call(method, args), HTTP_TIMEOUT)
        .catch(error => {
          if (!(error instanceof Error)) {
            error = XapiError.wrap(error)
          }

          // do not log the session ID
          //
          // TODO: should log at the session level to avoid logging sensitive
          // values?
          const params = args[0] === this._sessionId ? args.slice(1) : args

          error.call = {
            method,
            params: replaceSensitiveValues(params, '* obfuscated *'),
          }
          throw error
        })
    },
    call =>
      function() {
        let iterator // lazily created
        const loop = () =>
          pCatch.call(
            call.apply(this, arguments),
            isNetworkError,
            isXapiNetworkError,
            error => {
              if (iterator === undefined) {
                iterator = fibonacci()
                  .clamp(undefined, 60)
                  .take(10)
                  .toMs()
              }

              const cursor = iterator.next()
              if (!cursor.done) {
                // TODO: ability to cancel the connection
                // TODO: ability to force immediate reconnection

                const delay = cursor.value
                debug(
                  '%s: network error %s, next try in %s ms',
                  this._humanId,
                  error.code,
                  delay
                )
                return pDelay(delay).then(loop)
              }

              debug('%s: network error %s, aborting', this._humanId, error.code)

              // mark as disconnected
              pCatch.call(this.disconnect(), noop)

              throw error
            }
          )
        return loop()
      },
    call =>
      function loop() {
        return pCatch.call(
          call.apply(this, arguments),
          isHostSlave,
          ({ params: [master] }) => {
            debug(
              '%s: host is slave, attempting to connect at %s',
              this._humanId,
              master
            )

            const newUrl = {
              ...this._url,
              hostname: master,
            }
            this.emit('redirect', newUrl)
            this._url = newUrl

            return loop.apply(this, arguments)
          }
        )
      },
    call =>
      function(method) {
        const startTime = Date.now()
        return call.apply(this, arguments).then(
          result => {
            debug(
              '%s: %s(...) [%s] ==> %s',
              this._humanId,
              method,
              ms(Date.now() - startTime),
              kindOf(result)
            )
            return result
          },
          error => {
            debug(
              '%s: %s(...) [%s] =!> %s',
              this._humanId,
              method,
              ms(Date.now() - startTime),
              error
            )
            throw error
          }
        )
      },
  ],
  (call, decorator) => decorator(call)
)

// ===================================================================

// The default value is a factory function.
export const createClient = opts => new Xapi(opts)
