// @flow

// $FlowFixMe
import getStream from 'get-stream'

import asyncMap from '@xen-orchestra/async-map'
import limit from 'limit-concurrency-decorator'
import path from 'path'
import synchronized from 'decorator-synchronized'
import { fromCallback, fromEvent, ignoreErrors, timeout } from 'promise-toolbox'
import { parse } from 'xo-remote-parser'
import { pipeline } from 'readable-stream'
import { randomBytes } from 'crypto'
import { type Readable, type Writable } from 'stream'

import normalizePath from './_normalizePath'
import { createChecksumStream, validChecksumOfReadStream } from './checksum'

const { dirname } = path.posix

type Data = Buffer | string
type FileDescriptor = {| fd: mixed, path: string |}
type LaxReadable = Readable & Object
type LaxWritable = Writable & Object
type RemoteInfo = { used?: number, size?: number }

type File = FileDescriptor | string

const checksumFile = file => file + '.checksum'
const computeRate = (hrtime: number[], size: number) => {
  const seconds = hrtime[0] + hrtime[1] / 1e9
  return size / seconds
}

const DEFAULT_TIMEOUT = 6e5 // 10 min
const DEFAULT_MAX_PARALLEL_OPERATIONS = 10

const EMPTY_OBJECT = { __proto__: null }

const ignoreEnoent = error => {
  if (error == null || error.code !== 'ENOENT') {
    throw error
  }
}

class PrefixWrapper {
  constructor(handler, prefix) {
    this._prefix = prefix
    this._handler = handler
  }

  get type() {
    return this._handler.type
  }

  // necessary to remove the prefix from the path with `prependDir` option
  async list(dir, opts) {
    const entries = await this._handler.list(this._resolve(dir), opts)
    if (opts != null && opts.prependDir) {
      const n = this._prefix.length
      entries.forEach((entry, i, entries) => {
        entries[i] = entry.slice(n)
      })
    }
    return entries
  }

  rename(oldPath, newPath) {
    return this._handler.rename(this._resolve(oldPath), this._resolve(newPath))
  }

  _resolve(path) {
    return this._prefix + normalizePath(path)
  }
}

export default class RemoteHandlerAbstract {
  _remote: Object
  _timeout: number

  constructor(remote: any, options: Object = {}) {
    if (remote.url === 'test://') {
      this._remote = remote
    } else {
      this._remote = { ...remote, ...parse(remote.url) }
      if (this._remote.type !== this.type) {
        throw new Error('Incorrect remote type')
      }
    }
    ;({ timeout: this._timeout = DEFAULT_TIMEOUT } = options)

    const sharedLimit = limit(
      options.maxParallelOperations ?? DEFAULT_MAX_PARALLEL_OPERATIONS
    )
    this.closeFile = sharedLimit(this.closeFile)
    this.getInfo = sharedLimit(this.getInfo)
    this.getSize = sharedLimit(this.getSize)
    this.list = sharedLimit(this.list)
    this.mkdir = sharedLimit(this.mkdir)
    this.openFile = sharedLimit(this.openFile)
    this.outputFile = sharedLimit(this.outputFile)
    this.read = sharedLimit(this.read)
    this.readFile = sharedLimit(this.readFile)
    this.rename = sharedLimit(this.rename)
    this.rmdir = sharedLimit(this.rmdir)
    this.truncate = sharedLimit(this.truncate)
    this.unlink = sharedLimit(this.unlink)
    this.write = sharedLimit(this.write)
    this.writeFile = sharedLimit(this.writeFile)
  }

  // Public members

  get type(): string {
    throw new Error('Not implemented')
  }

  addPrefix(prefix: string) {
    prefix = normalizePath(prefix)
    return prefix === '/' ? this : new PrefixWrapper(this, prefix)
  }

  async closeFile(fd: FileDescriptor): Promise<void> {
    await timeout.call(this._closeFile(fd.fd), this._timeout)
  }

  async createOutputStream(
    file: File,
    { checksum = false, ...options }: Object = {}
  ): Promise<LaxWritable> {
    if (typeof file === 'string') {
      file = normalizePath(file)
    }
    const path = typeof file === 'string' ? file : file.path
    const streamP = timeout.call(
      this._createOutputStream(file, {
        flags: 'wx',
        ...options,
      }),
      this._timeout
    )

    if (!checksum) {
      return streamP
    }

    const checksumStream = createChecksumStream()
    const forwardError = error => {
      checksumStream.emit('error', error)
    }

    const stream = await streamP
    stream.on('error', forwardError)
    checksumStream.pipe(stream)

    // $FlowFixMe
    checksumStream.checksumWritten = checksumStream.checksum
      .then(value =>
        this._outputFile(checksumFile(path), value, { flags: 'wx' })
      )
      .catch(forwardError)

    return checksumStream
  }

  createReadStream(
    file: File,
    { checksum = false, ignoreMissingChecksum = false, ...options }: Object = {}
  ): Promise<LaxReadable> {
    if (typeof file === 'string') {
      file = normalizePath(file)
    }
    const path = typeof file === 'string' ? file : file.path
    const streamP = timeout
      .call(this._createReadStream(file, options), this._timeout)
      .then(stream => {
        // detect early errors
        let promise = fromEvent(stream, 'readable')

        // try to add the length prop if missing and not a range stream
        if (
          stream.length === undefined &&
          options.end === undefined &&
          options.start === undefined
        ) {
          promise = Promise.all([
            promise,
            ignoreErrors.call(
              this._getSize(file).then(size => {
                stream.length = size
              })
            ),
          ])
        }

        return promise.then(() => stream)
      })

    if (!checksum) {
      return streamP
    }

    // avoid a unhandled rejection warning
    ignoreErrors.call(streamP)

    return this._readFile(checksumFile(path), { flags: 'r' }).then(
      checksum =>
        streamP.then(stream => {
          const { length } = stream
          stream = (validChecksumOfReadStream(
            stream,
            String(checksum).trim()
          ): LaxReadable)
          stream.length = length

          return stream
        }),
      error => {
        if (ignoreMissingChecksum && error && error.code === 'ENOENT') {
          return streamP
        }
        throw error
      }
    )
  }

  createWriteStream(
    file: File,
    options: { end?: number, flags?: string, start?: number } = {}
  ): Promise<LaxWritable> {
    return timeout.call(
      this._createWriteStream(
        typeof file === 'string' ? normalizePath(file) : file,
        {
          flags: 'wx',
          ...options,
        }
      )
    )
  }

  // Free the resources possibly dedicated to put the remote at work, when it
  // is no more needed
  //
  // FIXME: Some handlers are implemented based on system-wide mecanisms (such
  // as mount), forgetting them might breaking other processes using the same
  // remote.
  @synchronized()
  async forget(): Promise<void> {
    await this._forget()
  }

  async getInfo(): Promise<RemoteInfo> {
    return timeout.call(this._getInfo(), this._timeout)
  }

  async getSize(file: File): Promise<number> {
    return timeout.call(
      this._getSize(typeof file === 'string' ? normalizePath(file) : file),
      this._timeout
    )
  }

  async list(
    dir: string,
    {
      filter,
      prependDir = false,
    }: { filter?: (name: string) => boolean, prependDir?: boolean } = {}
  ): Promise<string[]> {
    const virtualDir = normalizePath(dir)
    dir = normalizePath(dir)

    let entries = await timeout.call(this._list(dir), this._timeout)
    if (filter !== undefined) {
      entries = entries.filter(filter)
    }

    if (prependDir) {
      entries.forEach((entry, i) => {
        entries[i] = virtualDir + '/' + entry
      })
    }

    return entries
  }

  async mkdir(dir: string): Promise<void> {
    dir = normalizePath(dir)
    try {
      await this._mkdir(dir)
    } catch (error) {
      if (error == null || error.code !== 'EEXIST') {
        throw error
      }

      // this operation will throw if it's not already a directory
      await this._list(dir)
    }
  }

  async mktree(dir: string): Promise<void> {
    await this._mktree(normalizePath(dir))
  }

  async openFile(path: string, flags: string): Promise<FileDescriptor> {
    path = normalizePath(path)

    return {
      fd: await timeout.call(this._openFile(path, flags), this._timeout),
      path,
    }
  }

  async outputFile(
    file: string,
    data: Data,
    { flags = 'wx' }: { flags?: string } = {}
  ): Promise<void> {
    await this._outputFile(normalizePath(file), data, { flags })
  }

  async outputStream(
    file: File,
    stream: Readable,
    options: {
      checksum?: boolean,
      flags?: string,
      start?: number,
      unlinkOnError?: boolean,
    } = {}
  ): Promise<void> {
    const isString = typeof file === 'string'
    if (isString) {
      file = normalizePath(file)
    }
    try {
      return await this.writeStream(file, stream, options)
    } catch (error) {
      if (!(isString && error.code === 'ENOENT')) {
        throw error
      }
    }

    await this._mktree(dirname(file))
    return this.outputStream(file, stream, options)
  }

  async read(
    file: File,
    buffer: Buffer,
    position?: number
  ): Promise<{| bytesRead: number, buffer: Buffer |}> {
    return this._read(
      typeof file === 'string' ? normalizePath(file) : file,
      buffer,
      position
    )
  }

  async readFile(
    file: string,
    { flags = 'r' }: { flags?: string } = {}
  ): Promise<Buffer> {
    return this._readFile(normalizePath(file), { flags })
  }

  async refreshChecksum(path: string): Promise<void> {
    path = normalizePath(path)

    const stream = (await this._createReadStream(path, { flags: 'r' })).pipe(
      createChecksumStream()
    )
    stream.resume() // start reading the whole file
    await this._outputFile(checksumFile(path), await stream.checksum, {
      flags: 'wx',
    })
  }

  async rename(
    oldPath: string,
    newPath: string,
    { checksum = false }: Object = {}
  ) {
    oldPath = normalizePath(oldPath)
    newPath = normalizePath(newPath)

    let p = timeout.call(this._rename(oldPath, newPath), this._timeout)
    if (checksum) {
      p = Promise.all([
        p,
        this._rename(checksumFile(oldPath), checksumFile(newPath)),
      ])
    }
    return p
  }

  async rmdir(dir: string): Promise<void> {
    await timeout.call(
      this._rmdir(normalizePath(dir)).catch(ignoreEnoent),
      this._timeout
    )
  }

  async rmtree(dir: string): Promise<void> {
    await this._rmtree(normalizePath(dir))
  }

  // Asks the handler to sync the state of the effective remote with its'
  // metadata
  //
  // This method MUST ALWAYS be called before using the handler.
  @synchronized()
  async sync(): Promise<void> {
    await this._sync()
  }

  async test(): Promise<Object> {
    const SIZE = 1024 * 1024 * 10
    const testFileName = normalizePath(`${Date.now()}.test`)
    const data = await fromCallback(randomBytes, SIZE)
    let step = 'write'
    try {
      const writeStart = process.hrtime()
      await this._outputFile(testFileName, data, { flags: 'wx' })
      const writeDuration = process.hrtime(writeStart)

      step = 'read'
      const readStart = process.hrtime()
      const read = await this._readFile(testFileName, { flags: 'r' })
      const readDuration = process.hrtime(readStart)

      if (!data.equals(read)) {
        throw new Error('output and input did not match')
      }
      return {
        success: true,
        writeRate: computeRate(writeDuration, SIZE),
        readRate: computeRate(readDuration, SIZE),
      }
    } catch (error) {
      return {
        success: false,
        step,
        file: testFileName,
        error: error.message || String(error),
      }
    } finally {
      ignoreErrors.call(this._unlink(testFileName))
    }
  }

  async truncate(file: string, len: number): Promise<void> {
    await this._truncate(file, len)
  }

  async unlink(file: string, { checksum = true }: Object = {}): Promise<void> {
    file = normalizePath(file)

    if (checksum) {
      ignoreErrors.call(this._unlink(checksumFile(file)))
    }

    await this._unlink(file).catch(ignoreEnoent)
  }

  async write(
    file: File,
    buffer: Buffer,
    position: number
  ): Promise<{| bytesWritten: number, buffer: Buffer |}> {
    await this._write(
      typeof file === 'string' ? normalizePath(file) : file,
      buffer,
      position
    )
  }

  async writeFile(
    file: string,
    data: Data,
    { flags = 'wx' }: { flags?: string } = {}
  ): Promise<void> {
    await this._writeFile(normalizePath(file), data, { flags })
  }

  // Write a stream to a file, easier to use and more robust than using
  // `createOutputStream`
  //
  // TODO: temporary name support?
  async writeStream(
    file: File,
    stream: Readable,
    {
      checksum = false,
      flags = 'wx',
      start = 0,
      tmpPath = true,
      unlinkOnError = true,
    }: {
      checksum?: boolean,
      flags?: string,
      start?: number,
      unlinkOnError?: boolean,
    } = {}
  ): Promise<void> {
    let path
    if (typeof file === 'string') {
      path = file = normalizePath(file)
    } else {
      ;({ path } = file)
    }
    const outputStream = await this._createWriteStream(file, { flags, start })
    const args = [stream]
    let checksumStream
    if (checksum) {
      args.push((checksumStream = createChecksumStream()))
    }

    try {
      await fromCallback(cb => {
        args.push(outputStream, cb)
        pipeline.apply(undefined, args)
      })
    } catch (error) {
      await ignoreErrors.call(this._unlink(path))
      throw error
    }

    if (checksum) {
      await this._writeFile(
        checksumFile(path),
        await checksumStream.checksum,
        EMPTY_OBJECT
      )
    }
  }

  // Methods that can be implemented by inheriting classes

  async _closeFile(fd: mixed): Promise<void> {
    throw new Error('Not implemented')
  }

  async _createOutputStream(file: File, options: Object): Promise<LaxWritable> {
    try {
      return await this._createWriteStream(file, options)
    } catch (error) {
      if (typeof file !== 'string' || error.code !== 'ENOENT') {
        throw error
      }
    }

    await this._mktree(dirname(file))
    return this._createOutputStream(file, options)
  }

  async _createReadStream(file: File, options?: Object): Promise<LaxReadable> {
    throw new Error('Not implemented')
  }

  async _createWriteStream(file: File, options: Object): Promise<LaxWritable> {
    throw new Error('Not implemented')
  }

  // called to finalize the remote
  async _forget(): Promise<void> {}

  async _getInfo(): Promise<Object> {
    return {}
  }

  async _getSize(file: File): Promise<number> {
    throw new Error('Not implemented')
  }

  async _list(dir: string): Promise<string[]> {
    throw new Error('Not implemented')
  }

  async _mkdir(dir: string): Promise<void> {
    throw new Error('Not implemented')
  }

  async _mktree(dir: string): Promise<void> {
    try {
      return await this.mkdir(dir)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    await this._mktree(dirname(dir))
    return this._mktree(dir)
  }

  async _openFile(path: string, flags: string): Promise<mixed> {
    throw new Error('Not implemented')
  }

  async _outputFile(
    file: string,
    data: Data,
    options: { flags?: string }
  ): Promise<void> {
    try {
      return await this._writeFile(file, data, options)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    await this._mktree(dirname(file))
    return this._outputFile(file, data, options)
  }

  _read(
    file: File,
    buffer: Buffer,
    position?: number
  ): Promise<{| bytesRead: number, buffer: Buffer |}> {
    throw new Error('Not implemented')
  }

  _readFile(file: string, options?: Object): Promise<Buffer> {
    return this._createReadStream(file, options).then(getStream.buffer)
  }

  async _rename(oldPath: string, newPath: string) {
    throw new Error('Not implemented')
  }

  async _rmdir(dir: string) {
    throw new Error('Not implemented')
  }

  async _rmtree(dir: string) {
    try {
      return await this._rmdir(dir)
    } catch (error) {
      if (error.code !== 'ENOTEMPTY') {
        throw error
      }
    }

    const files = await this._list(dir)
    await asyncMap(files, file =>
      this._unlink(`${dir}/${file}`).catch(error => {
        if (error.code === 'EISDIR') {
          return this._rmtree(`${dir}/${file}`)
        }
        throw error
      })
    )
    return this._rmtree(dir)
  }

  // called to initialize the remote
  async _sync(): Promise<void> {}

  async _unlink(file: string): Promise<void> {
    throw new Error('Not implemented')
  }

  async _write(file: File, buffer: Buffer, position: number): Promise<void> {
    const isPath = typeof file === 'string'
    if (isPath) {
      file = await this.openFile(file, 'r+')
    }
    try {
      return await this._writeFd(file, buffer, position)
    } finally {
      if (isPath) {
        await this.closeFile(file)
      }
    }
  }

  async _writeFd(
    fd: FileDescriptor,
    buffer: Buffer,
    position: number
  ): Promise<void> {
    throw new Error('Not implemented')
  }

  async _writeFile(
    file: string,
    data: Data,
    options: { flags?: string }
  ): Promise<void> {
    throw new Error('Not implemented')
  }
}

function createPrefixWrapperMethods() {
  const pPw = PrefixWrapper.prototype
  const pRha = RemoteHandlerAbstract.prototype

  const {
    defineProperty,
    getOwnPropertyDescriptor,
    prototype: { hasOwnProperty },
  } = Object

  Object.getOwnPropertyNames(pRha).forEach(name => {
    let descriptor, value
    if (
      hasOwnProperty.call(pPw, name) ||
      name[0] === '_' ||
      typeof (value = (descriptor = getOwnPropertyDescriptor(pRha, name))
        .value) !== 'function'
    ) {
      return
    }

    descriptor.value = function() {
      let path
      if (arguments.length !== 0 && typeof (path = arguments[0]) === 'string') {
        arguments[0] = this._resolve(path)
      }
      return value.apply(this._handler, arguments)
    }

    defineProperty(pPw, name, descriptor)
  })
}
createPrefixWrapperMethods()
