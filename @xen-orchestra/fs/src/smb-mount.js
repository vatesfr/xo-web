import { parse } from 'xo-remote-parser'

import MountHandler from './_mount'
import normalizePath from './_normalizePath'
import { fromEvent } from 'promise-toolbox'

export default class SmbMountHandler extends MountHandler {
  constructor(remote, opts) {
    const { domain = 'WORKGROUP', host, password, path, username } = parse(remote.url)
    super(remote, opts, {
      type: 'cifs',
      device: '//' + host + normalizePath(path),
      options: `domain=${domain}`,
      env: {
        USER: username,
        PASSWD: password,
      },
    })
  }

  get type() {
    return 'smb'
  }

  // nraynaud: in some circumstances, renaming the file triggers a bug where we can't re-open it afterwards in SMB2
  // SMB linux client Linux xoa 4.19.0-12-amd64 #1 SMP Debian 4.19.152-1 (2020-10-18) x86_64 GNU/Linux
  // server Windows 10 Family Edition 1909 (v18363.1139)
  async _outputStream(input, path, { checksum }) {
    const output = await this.createOutputStream(path, { checksum })
    try {
      input.pipe(output)
      await fromEvent(output, 'finish')
      await output.checksumWritten
      // $FlowFixMe
      await input.task
    } catch (error) {
      await this.unlink(path, { checksum })
      throw error
    }
  }
}
