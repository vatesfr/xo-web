/* eslint-env jest */

import { TimeoutError } from 'promise-toolbox'

import AbstractHandler from './abstract'

const TIMEOUT = 10e3

class TestHandler extends AbstractHandler {
  constructor(impl) {
    super({ url: 'test://' }, { timeout: TIMEOUT })

    Object.keys(impl).forEach(method => {
      this[`_${method}`] = impl[method]
    })
  }
}

jest.useFakeTimers()

describe('closeFile()', () => {
  it(`throws in case of timeout`, async () => {
    const testHandler = new TestHandler({
      closeFile: () => new Promise(() => {}),
    })

    const promise = testHandler.closeFile({ fd: undefined, path: '' })
    jest.advanceTimersByTime(TIMEOUT)
    await expect(promise).rejects.toThrowError(TimeoutError)
  })
})

describe('getInfo()', () => {
  it('throws in case of timeout', async () => {
    const testHandler = new TestHandler({
      getInfo: () => new Promise(() => {}),
    })

    const promise = testHandler.getInfo()
    jest.advanceTimersByTime(TIMEOUT)
    await expect(promise).rejects.toThrowError(TimeoutError)
  })
})

describe('getSize()', () => {
  it(`throws in case of timeout`, async () => {
    const testHandler = new TestHandler({
      getSize: () => new Promise(() => {}),
    })

    const promise = testHandler.getSize('')
    jest.advanceTimersByTime(TIMEOUT)
    await expect(promise).rejects.toThrowError(TimeoutError)
  })
})

describe('list()', () => {
  it(`throws in case of timeout`, async () => {
    const testHandler = new TestHandler({
      list: () => new Promise(() => {}),
    })

    const promise = testHandler.list('.')
    jest.advanceTimersByTime(TIMEOUT)
    await expect(promise).rejects.toThrowError(TimeoutError)
  })
})

describe('openFile()', () => {
  it(`throws in case of timeout`, async () => {
    const testHandler = new TestHandler({
      openFile: () => new Promise(() => {}),
    })

    const promise = testHandler.openFile('path')
    jest.advanceTimersByTime(TIMEOUT)
    await expect(promise).rejects.toThrowError(TimeoutError)
  })
})

describe('rename()', () => {
  it(`throws in case of timeout`, async () => {
    const testHandler = new TestHandler({
      rename: () => new Promise(() => {}),
    })

    const promise = testHandler.rename('oldPath', 'newPath')
    jest.advanceTimersByTime(TIMEOUT)
    await expect(promise).rejects.toThrowError(TimeoutError)
  })
})

describe('rmdir()', () => {
  it(`throws in case of timeout`, async () => {
    const testHandler = new TestHandler({
      rmdir: () => new Promise(() => {}),
    })

    const promise = testHandler.rmdir('dir')
    jest.advanceTimersByTime(TIMEOUT)
    await expect(promise).rejects.toThrowError(TimeoutError)
  })
})
