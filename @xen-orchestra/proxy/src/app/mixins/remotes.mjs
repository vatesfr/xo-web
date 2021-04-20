import Disposable from 'promise-toolbox/Disposable.js'
import { compose } from '@vates/compose'
import { decorateWith } from '@vates/decorate-with'
import { deduped } from '@vates/disposable/deduped.js'
import { getHandler } from '@xen-orchestra/fs'

export default class Remotes {
  constructor(app) {
    this._app = app

    app.api.addMethods({
      remote: {
        getInfo: [
          ({ remote }) => Disposable.use(this.getHandler(remote), handler => handler.getInfo()),
          {
            params: {
              remote: { type: 'object' },
            },
          },
        ],

        test: [
          ({ remote }) =>
            Disposable.use(this.getHandler(remote), handler => handler.test()).catch(error => ({
              success: false,
              error: error.message ?? String(error),
            })),
          {
            params: {
              remote: { type: 'object' },
            },
          },
        ],
      },
    })
  }

  // FIXME: invalidate cache on remote option change
  @decorateWith(compose, function (resource) {
    return this._app.debounceResource(resource)
  })
  @decorateWith(deduped, remote => [remote.url])
  async getHandler(remote) {
    const { config } = this._app
    const handler = getHandler(remote, config.get('remoteOptions'))

    if (config.get('remotes.disableFileRemotes') && handler.type === 'file') {
      throw new Error('Local remotes are disabled in proxies')
    }

    await handler.sync()
    return new Disposable(() => handler.forget(), handler)
  }
}
