import Xo from 'xo-lib'

const xo = new Xo({ url: '/' })
xo.open().then(() => xo.signIn({ email: 'admin@admin.net', password: 'admin' }))
const signedIn = new Promise(resolve => xo.once('authenticated', resolve))

export const xoCall = (method: string, params: object) =>
  signedIn.then(() => xo.call(method, params))

export const getObject = (id: any) =>
  xoCall('xo.getAllObjects', { filter: { id } }).then(objects => objects[id])
