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

const req = (key, selfSigned, { days = 360 } = {}) => {
  const args = ['-batch', '-new', '-key', '-', '-days', String(days), '-nodes']
  if (selfSigned) {
    args.push('-x509')
  }
  return openssl('req', args, { input: key })
}

exports.genSelfSignedCert = async opts => {
  const key = await openssl('genrsa', ['2048'])
  return {
    cert: await req(key, true, opts),
    key,
  }
}

exports.genSignedCert = async (ca, { days = 360 } = {}) => {
  const key = await openssl('genrsa', ['2048'])
  const csr = await req(key, false)
  const input = [csr, key, ca.cert, ca.key].join('\n')
  console.log(input)
  return {
    cert: await openssl('x509', ['-in', '-', '-signkey', '-', '-CA', '-', '-CAkey', '-', '-days', String(days)], {
      input,
    }),
    key,
  }
}
