// @flow

import defer from 'golike-defer'
import fs from 'fs'
import humanFormat from 'human-format'
import ms from 'ms'
import { type Remote, getHandler } from '@xen-orchestra/fs'
import { mergeVhd as mergeVhd_ } from 'vhd-lib'

// Use Bluebird for all promises as it provides better performance and
// less memory usage.
//
// $FlowFixMe
global.Promise = require('bluebird')

// $FlowFixMe
const config: Object = JSON.parse(process.env.XO_CONFIG)

export const mergeVhd = defer(async function(
  $defer: any,
  parentRemote: Remote,
  parentPath: string,
  childRemote: Remote,
  childPath: string
) {
  const parentHandler = getHandler(parentRemote, config.remoteOptions)
  const childHandler = getHandler(childRemote, config.remoteOptions)

  await parentHandler.sync()
  $defer.call(parentHandler, 'forget')

  await childHandler.sync()
  $defer.call(childHandler, 'forget')

  const start = new Date()
  const size = await mergeVhd_(
    parentHandler,
    parentPath,
    childHandler,
    childPath
  )
  const end = new Date()
  const duration = end - start
  fs.writeFile(
    '/tmp/vhd-merge.log',
    JSON.stringify(
      {
        child:
          childHandler._getRealPath !== undefined
            ? childHandler._getRealPath(childPath)
            : {
                remote: childRemote,
                path: childPath,
              },
        parent:
          parentHandler._getRealPath !== undefined
            ? parentHandler._getRealPath(parentPath)
            : {
                remote: parentRemote,
                path: parentPath,
              },
        start: start.toISOString(),
        end: end.toISOString(),
        duration: ms(duration),
        size: humanFormat(size, { scale: 'binary', unit: 'B' }),
        speed:
          duration !== 0
            ? humanFormat(size / duration, { scale: 'binary', unit: 'B/s' })
            : 0,
      },
      null,
      2
    ) + '\n',
    {
      flag: 'a',
    },
    Function.prototype
  )

  return size
})
