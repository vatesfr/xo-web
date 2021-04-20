import fse from 'fs-extra'
import xdg from 'xdg-basedir'
import { createLogger } from '@xen-orchestra/log'
import { execFileSync } from 'child_process'

import { Profile } from '../_Profile.mjs'

const { warn } = createLogger('xo:proxy:authentication')

const isValidToken = t => typeof t === 'string' && t.length !== 0

export default class Authentication {
  constructor(_, { appName, config: { authenticationToken: token } }) {
    if (!isValidToken(token)) {
      token = JSON.parse(execFileSync('xenstore-read', ['vm-data/xo-proxy-authenticationToken']))

      if (!isValidToken(token)) {
        throw new Error('missing authenticationToken in configuration')
      }

      try {
        // save this token in the automatically handled conf file
        fse.outputFileSync(
          // this file must take precedence over normal user config
          `${xdg.config}/${appName}/config.z-auto.json`,
          JSON.stringify({ authenticationToken: token }),
          { mode: 0o600 }
        )
        execFileSync('xenstore-rm', ['vm-data/xo-proxy-authenticationToken'])
      } catch (error) {
        warn('failed to remove token from XenStore', { error })
      }
    }

    this._token = token
  }

  async findProfile(credentials) {
    if (credentials?.authenticationToken === this._token) {
      return new Profile()
    }
  }
}
