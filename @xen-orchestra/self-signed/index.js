const { execFile } = require('child_process')

const openssl = (cmd, args, { input, ...opts } = {}) =>
  new Promise((resolve, reject) => {
    const child = execFile('openssl', [cmd, ...args], opts, (error, stdout) =>
      error != null ? reject(error) : resolve(stdout)
    )
    if (input !== undefined) {
      child.stdin.end(input)
    }
  })

exports.genSelfSignedCert = async ({ days = 360 } = {}) => {
  // See https://letsencrypt.org/docs/integration-guide/#supported-key-algorithms
  const key = await openssl('ecparam', ['-name', 'secp384r1', '-genkey', '-noout'])
  return {
    cert: await openssl('req', ['-batch', '-new', '-key', '-', '-x509', '-days', String(days), '-nodes'], {
      input: key,
    }),
    key,
  }
}
