import { ReadableRawVHDStream } from '@xen-orchestra/vhd-lib'

import { VMDKDirectParser } from './vmdk-read'

async function convertFromVMDK (vmdkReadStream) {
  const parser = new VMDKDirectParser(vmdkReadStream)
  const header = await parser.readHeader()
  return new ReadableRawVHDStream(header.capacitySectors * 512, parser)
}

export { convertFromVMDK as default }
