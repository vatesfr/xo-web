const wrapCall = (fn, arg, thisArg) => {
  try {
    return Promise.resolve(fn.call(thisArg, arg))
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * Similar to Promise.all + Array#map but supports all iterables and does not trigger ESLint array-callback-return
 *
 * WARNING: Does not handle plain objects
 *
 * @template Item,This
 * @param {Iterable<Item>} iterable
 * @param {(this: This, item: Item) => (Item | PromiseLike<Item>)} mapFn
 * @param {This} [thisArg]
 * @returns {Promise<Item[]>}
 */
exports.asyncMap = function asyncMap(iterable, mapFn, thisArg = iterable) {
  let onError
  if (onError !== undefined) {
    const original = mapFn
    mapFn = async function () {
      try {
        return await original.apply(this, arguments)
      } catch (error) {
        return onError.call(this, error, ...arguments)
      }
    }
  }
  return Promise.all(Array.from(iterable, mapFn, thisArg))
}

/**
 * Like `asyncMap` but wait for all promises to settle before rejecting
 *
 * @template Item,This
 * @param {Iterable<Item>} iterable
 * @param {(this: This, item: Item) => (Item | PromiseLike<Item>)} mapFn
 * @param {This} [thisArg]
 * @returns {Promise<Item[]>}
 */
exports.asyncMapSettled = function asyncMapSettled(iterable, mapFn, thisArg = iterable) {
  return new Promise((resolve, reject) => {
    const onError = e => {
      if (result !== undefined) {
        error = e
        result = undefined
      }
      if (--n === 0) {
        reject(error)
      }
    }
    const onValue = (i, value) => {
      const hasError = result === undefined
      if (!hasError) {
        result[i] = value
      }
      if (--n === 0) {
        if (hasError) {
          reject(error)
        } else {
          resolve(result)
        }
      }
    }

    let n = 0
    for (const item of iterable) {
      const i = n++
      wrapCall(mapFn, item, thisArg).then(value => onValue(i, value), onError)
    }

    if (n === 0) {
      return resolve([])
    }

    let error
    let result = new Array(n)
  })
}
