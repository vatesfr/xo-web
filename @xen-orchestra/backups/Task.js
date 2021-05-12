const CancelToken = require('promise-toolbox/CancelToken.js')
const Zone = require('node-zone')

const logAfterEnd = function (log) {
  const error = new Error('task has already ended:' + this.id)
  error.result = log.result
  error.log = log
  throw error
}

const noop = Function.prototype

// Create a serializable object from an error.
//
// Otherwise some fields might be non-enumerable and missing from logs.
const serializeError = error =>
  error instanceof Error
    ? {
        ...error, // Copy enumerable properties.
        code: error.code,
        message: error.message,
        name: error.name,
        stack: error.stack,
      }
    : error

const $$task = Symbol('@xen-orchestra/backups/Task')

class Task {
  static get cancelToken() {
    const task = Zone.current.data[$$task]
    return task !== undefined ? task.#cancelToken : CancelToken.none
  }

  static run(opts, fn) {
    return new this(opts).run(fn, true)
  }

  static wrapFn(opts, fn) {
    // compatibility with @decorateWith
    if (typeof fn !== 'function') {
      ;[fn, opts] = [opts, fn]
    }

    return function () {
      return Task.run(typeof opts === 'function' ? opts.apply(this, arguments) : opts, () => fn.apply(this, arguments))
    }
  }

  get id() {
    return this.#id
  }

  #cancelToken
  #id = Math.random().toString(36).slice(2)
  #onLog
  #zone

  get id() {
    return this.#id
  }

  constructor({ name, data, onLog }) {
    let parentCancelToken, parentId
    if (onLog === undefined) {
      const parent = Zone.current.data[$$task]
      if (parent === undefined) {
        onLog = noop
      } else {
        onLog = log => parent.#onLog(log)
        parentCancelToken = parent.#cancelToken
        parentId = parent.#id
      }
    }

    const zone = Zone.current.fork('@xen-orchestra/backups/Task')
    zone.data[$$task] = this
    this.#zone = zone

    const { cancel, token } = CancelToken.source(parentCancelToken && [parentCancelToken])
    this.#cancelToken = token
    this.cancel = cancel

    this.#onLog = onLog

    this.#log('start', {
      data,
      message: name,
      parentId,
    })
  }

  failure(error) {
    this.#end('failure', serializeError(error))
  }

  info(message, data) {
    this.#log('info', { data, message })
  }

  /**
   * Run a function in the context of this task
   *
   * In case of error, the task will be failed.
   *
   * @typedef Result
   * @param {() => Result)} fn
   * @param {boolean} last - Whether the task should succeed if there is no error
   * @returns Result
   */
  run(fn, last = false) {
    return this.#zone.run(() => {
      try {
        this.#cancelToken.throwIfRequested()

        const result = fn()
        let then
        if (result != null && typeof (then = result.then) === 'function') {
          then.call(result, last && (value => this.success(value)), error => this.failure(error))
        } else if (last) {
          this.success(result)
        }
        return result
      } catch (error) {
        this.failure(error)
        throw error
      }
    })
  }

  success(value) {
    this.#end('success', value)
  }

  warning(message, data) {
    this.#log('warning', { data, message })
  }

  wrapFn(fn, last) {
    const task = this
    return function () {
      return task.run(() => fn.apply(this, arguments), last)
    }
  }

  #end(status, result) {
    this.#log('end', { result, status })
    this.#onLog = logAfterEnd
  }

  #log(event, props) {
    this.#onLog({
      ...props,
      event,
      taskId: this.#id,
      timestamp: Date.now(),
    })
  }
}
exports.Task = Task

for (const method of ['info', 'warning']) {
  Task[method] = (...args) => Zone.current.data[$$task]?.[method](...args)
}
