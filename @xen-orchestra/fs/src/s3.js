import aws from '@sullux/aws-sdk'
import assert from 'assert'
import http from 'http'
import { parse } from 'xo-remote-parser'

import RemoteHandlerAbstract from './abstract'
import { createChecksumStream } from './checksum'
import CancelToken from 'promise-toolbox/CancelToken'

// endpoints https://docs.aws.amazon.com/general/latest/gr/s3.html

// limits: https://docs.aws.amazon.com/AmazonS3/latest/dev/qfacts.html
const MIN_PART_SIZE = 1024 * 1024 * 5 // 5MB
const MAX_PART_SIZE = 1024 * 1024 * 1024 * 5 // 5GB
const MAX_PARTS_COUNT = 10000
const MAX_OBJECT_SIZE = 1024 * 1024 * 1024 * 1024 * 5 // 5TB
const IDEAL_FRAGMENT_SIZE = Math.ceil(MAX_OBJECT_SIZE / MAX_PARTS_COUNT) // the smallest fragment size that still allows a 5TB upload in 10000 fragments, about 524MB

const USE_SSL = true
export default class S3Handler extends RemoteHandlerAbstract {
  constructor(remote, _opts) {
    super(remote)
    const { host, path, username, password } = parse(remote.url)
    // https://www.zenko.io/blog/first-things-first-getting-started-scality-s3-server/
    const params = {
      accessKeyId: username,
      apiVersion: '2006-03-01',
      endpoint: host,
      s3ForcePathStyle: true,
      secretAccessKey: password,
      signatureVersion: 'v4',
      httpOptions: {
        timeout: 600000,
      },
    }
    if (!USE_SSL) {
      params.httpOptions.agent = new http.Agent()
      params.sslEnabled = false
    }
    this._s3 = aws(params).s3

    const splitPath = path.split('/').filter(s => s.length)
    this._bucket = splitPath.shift()
    this._dir = splitPath.join('/')
  }

  get type() {
    return 's3'
  }

  _createParams(file) {
    return { Bucket: this._bucket, Key: this._dir + file }
  }

  async _outputStream(input, path, { checksum, cancelToken = CancelToken.none }) {
    cancelToken.promise.then(reason => {
      input.destroy(reason)
    })
    let inputStream = input
    if (checksum) {
      const checksumStream = createChecksumStream()
      const forwardError = error => {
        checksumStream.emit('error', error)
      }
      input.pipe(checksumStream)
      input.on('error', forwardError)
      inputStream = checksumStream
    }
    await this._s3.upload(
      {
        ...this._createParams(path),
        Body: inputStream,
      },
      { partSize: IDEAL_FRAGMENT_SIZE, queueSize: 1 }
    )
    if (checksum) {
      const checksum = await inputStream.checksum
      const params = {
        ...this._createParams(path + '.checksum'),
        Body: checksum,
      }
      await this._s3.upload(params)
    }
    await input.task
  }

  async _writeFile(file, data, options) {
    return this._s3.putObject({ ...this._createParams(file), Body: data })
  }

  async _createReadStream(file, options) {
    // https://github.com/Sullux/aws-sdk/issues/11
    return this._s3.getObject.raw(this._createParams(file)).createReadStream()
  }

  async _unlink(file) {
    return this._s3.deleteObject(this._createParams(file))
  }

  async _list(dir) {
    function splitPath(path) {
      return path.split('/').filter(d => d.length)
    }

    const prefix = [this._dir, dir].join('/')
    const splitPrefix = splitPath(prefix)
    const result = await this._s3.listObjectsV2({
      Bucket: this._bucket,
      Prefix: splitPrefix.join('/'),
    })
    const uniq = new Set()
    for (const entry of result.Contents) {
      const line = splitPath(entry.Key)
      if (line.length > splitPrefix.length) {
        uniq.add(line[splitPrefix.length])
      }
    }
    return [...uniq]
  }

  async _rename(oldPath, newPath) {
    const size = await this._getSize(oldPath)
    const multipartParams = await this._s3.createMultipartUpload({ ...this._createParams(newPath) })
    const param2 = { ...multipartParams, CopySource: `/${this._bucket}/${this._dir}${oldPath}` }
    try {
      const parts = []
      let start = 0
      while (start < size) {
        const range = `bytes=${start}-${Math.min(start + MAX_PART_SIZE, size) - 1}`
        const partParams = { ...param2, PartNumber: parts.length + 1, CopySourceRange: range }
        const upload = await this._s3.uploadPartCopy(partParams)
        parts.push({ ETag: upload.CopyPartResult.ETag, PartNumber: partParams.PartNumber })
        start += MAX_PART_SIZE
      }
      await this._s3.completeMultipartUpload({ ...multipartParams, MultipartUpload: { Parts: parts } })
    } catch (e) {
      await this._s3.abortMultipartUpload(multipartParams)
      throw e
    }
    await this._s3.deleteObject(this._createParams(oldPath))
  }

  async _getSize(file) {
    if (typeof file !== 'string') {
      file = file.fd
    }
    const result = await this._s3.headObject(this._createParams(file))
    return +result.ContentLength
  }

  async _read(file, buffer, position = 0) {
    if (typeof file !== 'string') {
      file = file.fd
    }
    const params = this._createParams(file)
    params.Range = `bytes=${position}-${position + buffer.length - 1}`
    const result = await this._s3.getObject(params)
    result.Body.copy(buffer)
    return { bytesRead: result.Body.length, buffer }
  }

  async _write(file, buffer, position) {
    if (typeof file !== 'string') {
      file = file.fd
    }
    const uploadParams = this._createParams(file)
    let fileSize
    try {
      fileSize = +(await this._s3.headObject(uploadParams)).ContentLength
    } catch (e) {
      if (e.code === 'NotFound') {
        fileSize = 0
      } else {
        throw e
      }
    }
    if (fileSize < MIN_PART_SIZE) {
      const resultBuffer = Buffer.alloc(Math.max(fileSize, position + buffer.length))
      const fileContent = fileSize !== 0 ? (await this._s3.getObject(uploadParams)).Body : Buffer.alloc(0)
      fileContent.copy(resultBuffer)
      buffer.copy(resultBuffer, position)
      await this._s3.putObject({ ...uploadParams, Body: resultBuffer })
      return { buffer, bytesWritten: buffer.length }
    } else {
      // using this trick: https://stackoverflow.com/a/38089437/72637
      // multipart fragments have a minimum size of 5Mo and a max of 5Go unless they are last
      // splitting the file in 3 parts: [prefix, edit, suffix]
      // if `prefix` is bigger than 5Mo, it will be sourced from uploadPartCopy()
      // otherwise otherwise it will be downloaded, concatenated to `edit`
      // `edit` will always be an upload part
      // `suffix` will always be sourced from uploadPartCopy()
      // Then everything will be sliced in 5Gb parts before getting uploaded
      const multipartParams = await this._s3.createMultipartUpload(uploadParams)
      const copyMultipartParams = {
        ...multipartParams,
        CopySource: `/${this._bucket}/${this._dir + file}`,
      }
      try {
        const parts = []
        const prefixSize = position
        let suffixOffset = prefixSize + buffer.length
        let suffixSize = Math.max(0, fileSize - suffixOffset)
        let hasSuffix = suffixSize > 0
        let editBuffer = buffer
        let editBufferOffset = position
        let partNumber = 1
        let prefixPosition = 0
        // use floor() so that last fragment is handled in the if bellow
        let fragmentsCount = Math.floor(prefixSize / MAX_PART_SIZE)
        const prefixFragmentSize = MAX_PART_SIZE
        let prefixLastFragmentSize = prefixSize - prefixFragmentSize * fragmentsCount
        if (prefixLastFragmentSize >= MIN_PART_SIZE) {
          // the last fragment of the prefix is smaller than MAX_PART_SIZE, but bigger than the minimum
          // so we can copy it too
          fragmentsCount++
          prefixLastFragmentSize = 0
        }
        for (let i = 0; i < fragmentsCount; i++) {
          const fragmentEnd = Math.min(prefixPosition + prefixFragmentSize, prefixSize)
          assert.strictEqual(fragmentEnd - prefixPosition <= MAX_PART_SIZE, true)
          const range = `bytes=${prefixPosition}-${fragmentEnd - 1}`
          const copyPrefixParams = { ...copyMultipartParams, PartNumber: partNumber++, CopySourceRange: range }
          const part = await this._s3.uploadPartCopy(copyPrefixParams)
          parts.push({ ETag: part.CopyPartResult.ETag, PartNumber: copyPrefixParams.PartNumber })
          prefixPosition += prefixFragmentSize
        }
        if (prefixLastFragmentSize) {
          // grab everything from the prefix that was too small to be copied, download and merge to the edit buffer.
          const downloadParams = { ...uploadParams, Range: `bytes=${prefixPosition}-${prefixSize - 1}` }
          const prefixBuffer = prefixSize > 0 ? (await this._s3.getObject(downloadParams)).Body : Buffer.alloc(0)
          editBuffer = Buffer.concat([prefixBuffer, buffer])
          editBufferOffset -= prefixLastFragmentSize
        }
        if (hasSuffix && editBuffer.length < MIN_PART_SIZE) {
          // the edit fragment is too short and is not the last fragment
          // let's steal from the suffix fragment to reach the minimum size
          // the suffix might be too short and itself entirely absorbed in the edit fragment, making it the last one.
          const complementSize = Math.min(MIN_PART_SIZE - editBuffer.length, suffixSize)
          const complementOffset = editBufferOffset + editBuffer.length
          suffixOffset += complementSize
          suffixSize -= complementSize
          hasSuffix = suffixSize > 0
          const prefixRange = `bytes=${complementOffset}-${complementOffset + complementSize - 1}`
          const downloadParams = { ...uploadParams, Range: prefixRange }
          const complementBuffer = (await this._s3.getObject(downloadParams)).Body
          editBuffer = Buffer.concat([editBuffer, complementBuffer])
        }
        const editParams = { ...multipartParams, Body: editBuffer, PartNumber: partNumber++ }
        const editPart = await this._s3.uploadPart(editParams)
        parts.push({ ETag: editPart.ETag, PartNumber: editParams.PartNumber })
        if (hasSuffix) {
          // use ceil because the last fragment can be arbitrarily small.
          const suffixFragments = Math.ceil(suffixSize / MAX_PART_SIZE)
          let suffixFragmentOffset = suffixOffset
          for (let i = 0; i < suffixFragments; i++) {
            const fragmentEnd = suffixFragmentOffset + MAX_PART_SIZE
            assert.strictEqual(Math.min(fileSize, fragmentEnd) - suffixFragmentOffset <= MAX_PART_SIZE, true)
            const suffixRange = `bytes=${suffixFragmentOffset}-${Math.min(fileSize, fragmentEnd) - 1}`
            const copySuffixParams = { ...copyMultipartParams, PartNumber: partNumber++, CopySourceRange: suffixRange }
            const suffixPart = (await this._s3.uploadPartCopy(copySuffixParams)).CopyPartResult
            parts.push({ ETag: suffixPart.ETag, PartNumber: copySuffixParams.PartNumber })
            suffixFragmentOffset = fragmentEnd
          }
        }
        await this._s3.completeMultipartUpload({
          ...multipartParams,
          MultipartUpload: { Parts: parts },
        })
      } catch (e) {
        await this._s3.abortMultipartUpload(multipartParams)
        throw e
      }
    }
  }

  async _openFile(path, flags) {
    return path
  }

  async _closeFile(fd) {}

  // https://stackoverflow.com/a/48955582/72637
  async _rmtree(dir) {
    const listParams = {
      Bucket: this._bucket,
      Prefix: this._dir + dir,
    }
    let listedObjects = {}
    do {
      listedObjects = await this._s3.listObjectsV2({
        ...listParams,
        ContinuationToken: listedObjects.NextContinuationToken,
      })
      if (listedObjects.Contents.length === 0) {
        return
      }
      await this._s3.deleteObjects({
        Bucket: this._bucket,
        Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) },
      })
    } while (listedObjects.IsTruncated)
  }
}
