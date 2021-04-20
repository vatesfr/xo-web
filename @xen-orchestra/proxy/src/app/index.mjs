import Config from '@xen-orchestra/mixins/Config.js'
import Hooks from '@xen-orchestra/mixins/Hooks.js'
import mixin from '@xen-orchestra/mixin'
import { createDebounceResource } from '@vates/disposable/debounceResource.js'

import mixins from './mixins/index.mjs'

export default class App {
  constructor(opts) {
    mixin(this, { Config, Hooks, ...mixins }, [opts])

    const debounceResource = createDebounceResource()
    this.config.watchDuration('resourceCacheDelay', delay => {
      debounceResource.defaultDelay = delay
    })
    this.hooks.once('stop', debounceResource.flushAll)

    this.debounceResource = debounceResource
  }
}
