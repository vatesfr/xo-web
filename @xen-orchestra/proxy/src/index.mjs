#!/usr/bin/env node

import forOwn from 'lodash/forOwn.js'
import fse from 'fs-extra'
import getopts from 'getopts'
import pRetry from 'promise-toolbox/retry.js'
import { catchGlobalErrors } from '@xen-orchestra/log/configure.js'
import { create as createServer } from 'http-server-plus'
import { createLogger } from '@xen-orchestra/log'
import { createSecureServer } from 'http2'
import { genSelfSignedCert } from '@xen-orchestra/self-signed'
import { load as loadConfig } from 'app-conf'

// -------------------------------------------------------------------

catchGlobalErrors(createLogger('xo:proxy'))

const { fatal, info, warn } = createLogger('xo:proxy:bootstrap')

const APP_DIR = new URL('..', import.meta.url).pathname
const APP_NAME = 'xo-proxy'
const APP_VERSION = JSON.parse(fse.readFileSync(new URL('../package.json', import.meta.url))).version

// -------------------------------------------------------------------

const main = async args => {
  const opts = getopts(args, {
    boolean: ['help', 'safe-mode'],
    alias: {
      help: ['h'],
    },
  })

  if (opts.help) {
    // eslint-disable-next-line no-console
    console.log(
      '%s',
      `
${APP_NAME} v${APP_VERSION}
`
    )
    return
  }

  info('starting')

  const config = await loadConfig(APP_NAME, {
    appDir: APP_DIR,
    ignoreUnknownFormats: true,
  })

  let httpServer = createServer({
    createSecureServer: opts => createSecureServer({ ...opts, allowHTTP1: true }),
  })

  forOwn(config.http.listen, async ({ autoCert, cert, key, ...opts }) => {
    try {
      const niceAddress = await pRetry(
        async () => {
          if (cert !== undefined && key !== undefined) {
            try {
              opts.cert = fse.readFileSync(cert)
              opts.key = fse.readFileSync(key)
            } catch (error) {
              if (!(autoCert && error.code === 'ENOENT')) {
                throw error
              }

              const pems = await genSelfSignedCert()
              fse.outputFileSync(cert, pems.cert, { flag: 'wx', mode: 0o400 })
              fse.outputFileSync(key, pems.key, { flag: 'wx', mode: 0o400 })
              info('new certificate generated', { cert, key })
              opts.cert = pems.cert
              opts.key = pems.key
            }
          }

          return httpServer.listen(opts)
        },
        {
          tries: 2,
          when: e => autoCert && e.code === 'ERR_SSL_EE_KEY_TOO_SMALL',
          onRetry: () => {
            warn('deleting invalid certificate')
            fse.unlinkSync(cert)
            fse.unlinkSync(key)
          },
        }
      )

      info(`Web server listening on ${niceAddress}`)
    } catch (error) {
      if (error.niceAddress !== undefined) {
        warn(`Web server could not listen on ${error.niceAddress}`)

        const { code } = error
        if (code === 'EACCES') {
          warn('  Access denied.')
          warn('  Ports < 1024 are often reserved to privileges users.')
        } else if (code === 'EADDRINUSE') {
          warn('  Address already in use.')
        }
      } else {
        warn('web server could not listen', { error })
      }
    }
  })

  const { group, user } = config
  group != null && process.setgid(group)
  user != null && process.setuid(user)

  try {
    // The default value of 10 appears to be too small for interesting traces in xo-proxy.
    Error.stackTraceLimit = 20

    await import('source-map-support/register.js')
  } catch (error) {
    warn(error)
  }

  httpServer = (await import('stoppable')).default(httpServer)

  const { default: App } = await import('./app/index.mjs')
  const app = new App({
    appDir: APP_DIR,
    appName: APP_NAME,
    appVersion: APP_VERSION,
    config,
    httpServer,
    safeMode: opts['--safe-mode'],
  })

  // dont delay require to stopping phase because deps may no longer be there (eg on uninstall)
  const { default: fromCallback } = await import('promise-toolbox/fromCallback.js')
  app.hooks.on('stop', () => fromCallback(cb => httpServer.stop(cb)))

  await app.hooks.start()

  // Gracefully shutdown on signals.
  let alreadyCalled = false
  ;['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      if (alreadyCalled) {
        warn('forced exit')
        process.exit(1)
      }
      alreadyCalled = true

      info(`${signal} caught, stopping…`)
      app.hooks.stop()
    })
  })

  return (await import('promise-toolbox/fromEvent.js')).default(app.hooks, 'stopped')
}
main(process.argv.slice(2)).then(
  () => {
    info('bye :-)')
  },
  error => {
    fatal(error)

    process.exit(1)
  }
)
