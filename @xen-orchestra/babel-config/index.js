'use strict'

const PLUGINS_RE = /^(?:@babel\/|babel-)plugin-.+$/
const PRESETS_RE = /^@babel\/preset-.+$/

const NODE_ENV = process.env.NODE_ENV || 'development'
const __PROD__ = NODE_ENV === 'production'
const __TEST__ = NODE_ENV === 'test'

const configs = {
  '@babel/plugin-proposal-decorators': {
    legacy: true,
  },
  '@babel/plugin-proposal-pipeline-operator': {
    proposal: 'minimal',
  },
  '@babel/preset-env': {
    debug: !__TEST__,

    // disabled until https://github.com/babel/babel/issues/8323 is resolved
    // loose: true,

    shippedProposals: true,
  },
}

const getConfig = (key, ...args) => {
  const config = configs[key]
  return config === undefined ? {} : typeof config === 'function' ? config(...args) : config
}

// some plugins must be used in a specific order
const pluginsOrder = ['@babel/plugin-proposal-decorators', '@babel/plugin-proposal-class-properties']

module.exports = function (pkg, configs = {}) {
  const plugins = {}
  const presets = {}

  Object.keys(pkg.devDependencies || {}).forEach(name => {
    if (!(name in presets) && PLUGINS_RE.test(name)) {
      plugins[name] = { ...getConfig(name, pkg), ...configs[name] }
    } else if (!(name in presets) && PRESETS_RE.test(name)) {
      presets[name] = { ...getConfig(name, pkg), ...configs[name] }
    }
  })

  return {
    comments: !__PROD__,
    ignore: __PROD__ ? [/\.spec\.js$/] : undefined,
    plugins: Object.keys(plugins)
      .map(plugin => [plugin, plugins[plugin]])
      .sort(([a], [b]) => {
        const oA = pluginsOrder.indexOf(a)
        const oB = pluginsOrder.indexOf(b)
        return oA !== -1 && oB !== -1 ? oA - oB : a < b ? -1 : 1
      }),
    presets: Object.keys(presets).map(preset => [preset, presets[preset]]),
    targets: (() => {
      let node = (pkg.engines || {}).node
      if (node !== undefined) {
        const trimChars = '^=>~'
        while (trimChars.includes(node[0])) {
          node = node.slice(1)
        }
      }
      return { browsers: pkg.browserslist, node }
    })(),
  }
}
