/* eslint-env jest */

import 'dotenv/config'
import asyncIteratorToStream from 'async-iterator-to-stream'
import { forOwn, random } from 'lodash'
import { tmpdir } from 'os'

import { getHandler } from './'

// https://gist.github.com/julien-f/3228c3f34fdac01ade09
const unsecureRandomBytes = n => {
  const bytes = Buffer.alloc(n)

  const odd = n & 1
  for (let i = 0, m = n - odd; i < m; i += 2) {
    bytes.writeUInt16BE((Math.random() * 65536) | 0, i)
  }

  if (odd) {
    bytes.writeUInt8((Math.random() * 256) | 0, n - 1)
  }

  return bytes
}

const TEST_DATA_LEN = 1024
const TEST_DATA = unsecureRandomBytes(TEST_DATA_LEN)
const createTestDataStream = asyncIteratorToStream(function* () {
  yield TEST_DATA
})

const rejectionOf = p =>
  p.then(
    value => {
      throw value
    },
    reason => reason
  )

const handlers = [`file://${tmpdir()}`]
if (process.env.xo_fs_nfs) handlers.push(process.env.xo_fs_nfs)
if (process.env.xo_fs_smb) handlers.push(process.env.xo_fs_smb)

handlers.forEach(url => {
  describe(url, () => {
    let handler

    const testWithFileDescriptor = (path, flags, fn) => {
      it('with path', () => fn({ file: path, flags }))
      it('with file descriptor', async () => {
        const file = await handler.openFile(path, flags)
        try {
          await fn({ file })
        } finally {
          await handler.closeFile(file)
        }
      })
    }

    beforeAll(async () => {
      handler = getHandler({ url }).addPrefix(`xo-fs-tests-${Date.now()}`)
      await handler.sync()
    })
    afterAll(async () => {
      await handler.forget()
      handler = undefined
    })

    beforeEach(async () => {
      // ensure test dir exists
      await handler.mkdir('.')
    })
    afterEach(async () => {
      await handler.rmtree('.')
    })

    describe('#type', () => {
      it('returns the type of the remote', () => {
        expect(typeof handler.type).toBe('string')
      })
    })

    describe('#outputStream()', () => {
      it('creates parent dir if missing', async () => {
        await handler.outputStream('dir/file', createTestDataStream())
        await expect(await handler.readFile('dir/file')).toEqual(TEST_DATA)
      })
    })

    describe('#getInfo()', () => {
      let info
      beforeAll(async () => {
        info = await handler.getInfo()
      })

      it('should return an object with info', async () => {
        expect(typeof info).toBe('object')
      })

      it('should return correct type of attribute', async () => {
        if (info.size !== undefined) {
          expect(typeof info.size).toBe('number')
        }
        if (info.used !== undefined) {
          expect(typeof info.used).toBe('number')
        }
      })
    })

    describe('#getSize()', () => {
      beforeEach(() => handler.outputFile('file', TEST_DATA))

      testWithFileDescriptor('file', 'r', async () => {
        expect(await handler.getSize('file')).toEqual(TEST_DATA_LEN)
      })
    })

    describe('#list()', () => {
      it(`should list the content of folder`, async () => {
        await handler.outputFile('file', TEST_DATA)
        await expect(await handler.list('.')).toEqual(['file'])
      })

      it('can prepend the directory to entries', async () => {
        await handler.outputFile('dir/file', '')
        expect(await handler.list('dir', { prependDir: true })).toEqual(['/dir/file'])
      })

      it('can prepend the directory to entries', async () => {
        await handler.outputFile('dir/file', '')
        expect(await handler.list('dir', { prependDir: true })).toEqual(['/dir/file'])
      })
    })

    describe('#mkdir()', () => {
      it('creates a directory', async () => {
        await handler.mkdir('dir')
        await expect(await handler.list('.')).toEqual(['dir'])
      })

      it('does not throw on existing directory', async () => {
        await handler.mkdir('dir')
        await handler.mkdir('dir')
      })

      it('throws ENOTDIR on existing file', async () => {
        await handler.outputFile('file', '')
        const error = await rejectionOf(handler.mkdir('file'))
        expect(error.code).toBe('ENOTDIR')
      })
    })

    describe('#mktree()', () => {
      it('creates a tree of directories', async () => {
        await handler.mktree('dir/dir')
        await expect(await handler.list('.')).toEqual(['dir'])
        await expect(await handler.list('dir')).toEqual(['dir'])
      })

      it('does not throw on existing directory', async () => {
        await handler.mktree('dir/dir')
        await handler.mktree('dir/dir')
      })

      it('throws ENOTDIR on existing file', async () => {
        await handler.outputFile('dir/file', '')
        const error = await rejectionOf(handler.mktree('dir/file'))
        expect(error.code).toBe('ENOTDIR')
      })

      it('throws ENOTDIR on existing file in path', async () => {
        await handler.outputFile('file', '')
        const error = await rejectionOf(handler.mktree('file/dir'))
        expect(error.code).toBe('ENOTDIR')
      })
    })

    describe('#outputFile()', () => {
      it('writes data to a file', async () => {
        await handler.outputFile('file', TEST_DATA)
        expect(await handler.readFile('file')).toEqual(TEST_DATA)
      })

      it('throws on existing files', async () => {
        await handler.outputFile('file', '')
        const error = await rejectionOf(handler.outputFile('file', ''))
        expect(error.code).toBe('EEXIST')
      })

      it("shouldn't timeout in case of the respect of the parallel execution restriction", async () => {
        const handler = getHandler({ url }, { maxParallelOperations: 1 })
        await handler.sync()
        await handler.outputFile(`xo-fs-tests-${Date.now()}/test`, '')
      }, 40)
    })

    describe('#read()', () => {
      beforeEach(() => handler.outputFile('file', TEST_DATA))

      const start = random(TEST_DATA_LEN)
      const size = random(TEST_DATA_LEN)

      testWithFileDescriptor('file', 'r', async ({ file }) => {
        const buffer = Buffer.alloc(size)
        const result = await handler.read(file, buffer, start)
        expect(result.buffer).toBe(buffer)
        expect(result).toEqual({
          buffer,
          bytesRead: Math.min(size, TEST_DATA_LEN - start),
        })
      })
    })

    describe('#readFile', () => {
      it('returns a buffer containing the contents of the file', async () => {
        await handler.outputFile('file', TEST_DATA)
        expect(await handler.readFile('file')).toEqual(TEST_DATA)
      })

      it('throws on missing file', async () => {
        const error = await rejectionOf(handler.readFile('file'))
        expect(error.code).toBe('ENOENT')
      })
    })

    describe('#rename()', () => {
      it(`should rename the file`, async () => {
        await handler.outputFile('file', TEST_DATA)
        await handler.rename('file', `file2`)

        expect(await handler.list('.')).toEqual(['file2'])
        expect(await handler.readFile(`file2`)).toEqual(TEST_DATA)
      })
    })

    describe('#rmdir()', () => {
      it('should remove an empty directory', async () => {
        await handler.mkdir('dir')
        await handler.rmdir('dir')
        expect(await handler.list('.')).toEqual([])
      })

      it(`should throw on non-empty directory`, async () => {
        await handler.outputFile('dir/file', '')

        const error = await rejectionOf(handler.rmdir('.'))
        await expect(error.code).toEqual('ENOTEMPTY')
      })

      it('does not throw on missing directory', async () => {
        await handler.rmdir('dir')
      })
    })

    describe('#rmtree', () => {
      it(`should remove a directory resursively`, async () => {
        await handler.outputFile('dir/file', '')
        await handler.rmtree('dir')

        expect(await handler.list('.')).toEqual([])
      })
    })

    describe('#test()', () => {
      it('tests the remote appears to be working', async () => {
        const answer = await handler.test()

        expect(answer.success).toBe(true)
        expect(typeof answer.writeRate).toBe('number')
        expect(typeof answer.readRate).toBe('number')
      })
    })

    describe('#unlink()', () => {
      it(`should remove the file`, async () => {
        await handler.outputFile('file', TEST_DATA)
        await handler.unlink('file')

        await expect(await handler.list('.')).toEqual([])
      })

      it('does not throw on missing file', async () => {
        await handler.unlink('file')
      })
    })

    describe('#write()', () => {
      beforeEach(() => handler.outputFile('file', TEST_DATA))

      const PATCH_DATA_LEN = Math.ceil(TEST_DATA_LEN / 2)
      const PATCH_DATA = unsecureRandomBytes(PATCH_DATA_LEN)

      forOwn(
        {
          'dont increase file size': (() => {
            const offset = random(0, TEST_DATA_LEN - PATCH_DATA_LEN)

            const expected = Buffer.from(TEST_DATA)
            PATCH_DATA.copy(expected, offset)

            return { offset, expected }
          })(),
          'increase file size': (() => {
            const offset = random(TEST_DATA_LEN - PATCH_DATA_LEN + 1, TEST_DATA_LEN)

            const expected = Buffer.alloc(offset + PATCH_DATA_LEN)
            TEST_DATA.copy(expected)
            PATCH_DATA.copy(expected, offset)

            return { offset, expected }
          })(),
        },
        ({ offset, expected }, title) => {
          describe(title, () => {
            testWithFileDescriptor('file', 'r+', async ({ file }) => {
              await handler.write(file, PATCH_DATA, offset)
              await expect(await handler.readFile('file')).toEqual(expected)
            })
          })
        }
      )
    })

    describe('#truncate()', () => {
      forOwn(
        {
          'shrinks file': (() => {
            const length = random(0, TEST_DATA_LEN)
            const expected = TEST_DATA.slice(0, length)
            return { length, expected }
          })(),
          'grows file': (() => {
            const length = random(TEST_DATA_LEN, TEST_DATA_LEN * 2)
            const expected = Buffer.alloc(length)
            TEST_DATA.copy(expected)
            return { length, expected }
          })(),
        },
        ({ length, expected }, title) => {
          it(title, async () => {
            await handler.outputFile('file', TEST_DATA)
            await handler.truncate('file', length)
            await expect(await handler.readFile('file')).toEqual(expected)
          })
        }
      )
    })
  })
})
