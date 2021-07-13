import Cookies from 'js-cookie'
import { EventEmitter } from 'events'
import { Map } from 'immutable'
import { Xapi } from 'xen-api'

export interface XapiObject {
  $pool: Pool
  $ref: string
  $type: keyof types
  $id: string
}

// Dictionary of XAPI types and their corresponding TypeScript types
interface types {
  PIF: Pif
  pool: Pool
  VM: Vm
  host: Host
}

// XAPI types ---

export interface Pif extends XapiObject {
  device: string
  DNS: string
  gateway: string
  IP: string
  management: boolean
  network: string
}

export interface Pool extends XapiObject {
  name_label: string
}

export interface PoolUpdate {
  changelog: {
    author: string
    date: Date
    description: string
  }
  description: string
  license: string
  name: string
  release: string
  size: number
  url: string
  version: string
}

export interface Vm extends XapiObject {
  $consoles: Array<{ protocol: string; location: string }>
  is_a_snapshot: boolean
  is_a_template: boolean
  is_control_domain: boolean
  name_description: string
  name_label: string
  power_state: string
}

export interface Host extends XapiObject {
  name_label: string
}

// --------

export interface ObjectsByType extends Map<string, Map<string, XapiObject>> {
  get<NSV, T extends keyof types>(key: T, notSetValue: NSV): Map<string, types[T]> | NSV
  get<T extends keyof types>(key: T): Map<string, types[T]> | undefined
}

export default class XapiConnection extends EventEmitter {
  areObjectsFetched: Promise<void>
  connected: boolean
  objectsByType: ObjectsByType
  sessionId?: string

  _resolveObjectsFetched!: () => void

  _xapi?: {
    objects: EventEmitter & {
      all: { [id: string]: XapiObject }
    }
    connect(): Promise<void>
    disconnect(): Promise<void>
    call: (method: string, ...args: unknown[]) => Promise<unknown>
    _objectsFetched: Promise<void>
  }

  constructor() {
    super()

    this.objectsByType = Map() as ObjectsByType
    this.connected = false
    this.areObjectsFetched = new Promise(resolve => {
      this._resolveObjectsFetched = resolve
    })
  }

  async reattachSession(url: string): Promise<void> {
    const sessionId = Cookies.get('sessionId')
    if (sessionId === undefined) {
      return
    }

    return this.connect({ url, sessionId })
  }

  async connect({
    url,
    user = 'root',
    password,
    sessionId,
    rememberMe = Cookies.get('rememberMe') === 'true',
  }: {
    url: string
    user?: string
    password?: string
    sessionId?: string
    rememberMe?: boolean
  }): Promise<void> {
    const xapi = (this._xapi = new Xapi({
      auth: { user, password, sessionId },
      url,
      watchEvents: true,
      readonly: false,
    }))

    const updateObjects = (objects: { [id: string]: XapiObject }) => {
      try {
        this.objectsByType = this.objectsByType.withMutations(objectsByType => {
          Object.entries(objects).forEach(([id, object]) => {
            if (object === undefined) {
              // Remove
              objectsByType.forEach((objects, type) => {
                objectsByType.set(type, objects.remove(id))
              })
            } else {
              // Add or update
              const { $type } = object
              objectsByType.set($type, objectsByType.get($type, Map<string, XapiObject>()).set(id, object))
            }
          })
        })

        this.emit('objects', this.objectsByType)
      } catch (err) {
        console.error(err)
      }
    }

    xapi.on('connected', () => {
      this.sessionId = xapi.sessionId
      this.connected = true
      this.emit('connected')
    })

    xapi.on('disconnected', () => {
      Cookies.remove('sessionId')
      this.emit('disconnected')
    })

    xapi.on('sessionId', (sessionId: string) => {
      if (rememberMe) {
        Cookies.set('rememberMe', 'true', { expires: 7 })
      }
      Cookies.set('sessionId', sessionId, rememberMe ? { expires: 7 } : undefined)
    })

    await xapi.connect()
    await xapi._objectsFetched

    updateObjects(xapi.objects.all)
    this._resolveObjectsFetched()

    xapi.objects.on('add', updateObjects)
    xapi.objects.on('update', updateObjects)
    xapi.objects.on('remove', updateObjects)
  }

  disconnect(): Promise<void> | undefined {
    Cookies.remove('rememberMe')
    Cookies.remove('sessionId')
    const { _xapi } = this
    if (_xapi !== undefined) {
      return _xapi.disconnect()
    }
  }

  call(method: string, ...args: unknown[]): Promise<unknown> {
    const { _xapi, connected } = this
    if (!connected || _xapi === undefined) {
      throw new Error('Not connected to XAPI')
    }

    return _xapi.call(method, ...args)
  }
}
