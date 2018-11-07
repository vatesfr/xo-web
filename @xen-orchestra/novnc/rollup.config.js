import resolve from 'rollup-plugin-node-resolve'

export default {
  input: 'src/rfb.js',
  output: {
    file: 'core/rfb.js',
    format: 'cjs',
  },
  plugins: [resolve()],
}
