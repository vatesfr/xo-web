import assert from 'assert'
import createLogger from '@xen-orchestra/log'
import ipaddr from 'ipaddr.js'
import openflow from '@xen-orchestra/openflow'
import parse from '@xen-orchestra/openflow/parse-socket'

import { coalesceCalls } from '@vates/coalesce-calls'
import { EventEmitter } from 'events'
import { fromEvent } from 'promise-toolbox'

// =============================================================================

const log = createLogger('xo:xo-server:sdn-controller:openflow-controller')

const version = openflow.versions.openFlow11
const ofProtocol = openflow.protocols[version]
const OPENFLOW_PORT = ofProtocol.sslPort

// -----------------------------------------------------------------------------

const parseIp = ipAddress => {
  if (ipAddress === '') {
    return
  }

  let addr, mask
  if (ipAddress.includes('/')) {
    const ip = ipaddr.parseCIDR(ipAddress)
    addr = ip[0].toString()
    const maskOctets = ipaddr.IPv4.subnetMaskFromPrefixLength(ip[1]).octets
    mask = ipaddr.fromByteArray(maskOctets.map(i => 255 - i)).toString() // Use wildcarded mask
  } else {
    // TODO: return ipAddress directly?
    const ip = ipaddr.parse(ipAddress)
    addr = ip.toString()
  }

  return { addr, mask }
}

const dlAndNwProtocolFromString = protocol => {
  switch (protocol) {
    case 'IP':
      return { dlType: ofProtocol.dlType.ip }
    case 'ICMP':
      return {
        dlType: ofProtocol.dlType.ip,
        nwProto: ofProtocol.nwProto.icmp,
      }
    case 'TCP':
      return {
        dlType: ofProtocol.dlType.ip,
        nwProto: ofProtocol.nwProto.tcp,
      }
    case 'UDP':
      return {
        dlType: ofProtocol.dlType.ip,
        nwProto: ofProtocol.nwProto.udp,
      }

    case 'ARP':
      return { dlType: ofProtocol.dlType.arp }
    default:
      return {} // TODO: Error?
  }
}

// =============================================================================

export class OpenFlowChannel extends EventEmitter {
  /*
  Create an SSL connection to an XCP-ng host.
  Interact with the host's OpenVSwitch (OVS) daemon to manage its flows with OpenFlow11.
  See:
  - OpenFlow11 spec: https://www.opennetworking.org/wp-content/uploads/2014/10/openflow-spec-v1.1.0.pdf
  */

  constructor(host, tlsHelper) {
    super()

    this.host = host
    this._tlsHelper = tlsHelper
    this._coalesceConnect = coalesceCalls(this._connect)
    this._socket = undefined

    log.debug('New OpenFlow channel', {
      host: this.host.name_label,
    })
  }

  // ---------------------------------------------------------------------------

  async addRule(vif, allow, protocol, port, ipRange, direction, ofport) {
    log.info('Adding OF rule', {
      allow,
      protocol,
      port,
      ipRange,
      direction,
      vif: vif.uuid,
    })
    const instructions = [
      {
        type: ofProtocol.instructionType.applyActions,
        actions: allow
          ? [
              {
                type: ofProtocol.actionType.output,
                port: ofProtocol.port.normal,
              },
            ]
          : [],
      },
    ]

    const ip = parseIp(ipRange)
    const { dlType, nwProto } = dlAndNwProtocolFromString(protocol)
    const mac = vif.MAC

    await this._coalesceConnect(vif.network)
    if (direction.includes('from')) {
      this._addFlow(
        {
          type: ofProtocol.matchType.standard,
          dl_type: dlType,
          dl_src: mac,
          nw_proto: nwProto,
          nw_dst: ip?.addr,
          nw_dst_mask: ip?.mask,
          tp_src: port,
          in_port: ofport,
        },
        instructions
      )

      if (nwProto !== undefined) {
        this._addFlow(
          {
            type: ofProtocol.matchType.standard,
            dl_type: dlType,
            dl_dst: mac,
            nw_proto: nwProto,
            nw_src: ip?.addr,
            nw_src_mask: ip?.mask,
            tp_dst: port,
          },
          instructions
        )
      }
    }
    if (direction.includes('to')) {
      if (nwProto !== undefined) {
        this._addFlow(
          {
            type: ofProtocol.matchType.standard,
            dl_type: dlType,
            dl_src: mac,
            nw_proto: nwProto,
            nw_dst: ip?.addr,
            nw_dst_mask: ip?.mask,
            tp_dst: port,
            in_port: ofport,
          },
          instructions
        )
      }
      this._addFlow(
        {
          type: ofProtocol.matchType.standard,
          dl_type: dlType,
          dl_dst: mac,
          nw_proto: nwProto,
          nw_src: ip?.addr,
          nw_src_mask: ip?.mask,
          tp_src: port,
        },
        instructions
      )
    }

    await this._tlsHelper.closeSocket(this._socket)
    delete this._socket
  }

  async deleteRule(vif, protocol, port, ipRange, direction, ofport) {
    log.info('Deleting OF rule', {
      protocol,
      port,
      ipRange,
      direction,
      vif: vif.uuid,
    })
    const ip = parseIp(ipRange)
    const { dlType, nwProto } = dlAndNwProtocolFromString(protocol)
    const mac = vif.MAC

    await this._coalesceConnect(vif.network)
    if (direction.includes('from')) {
      this._removeFlows({
        type: ofProtocol.matchType.standard,
        dl_type: dlType,
        dl_src: mac,
        nw_proto: nwProto,
        nw_dst: ip?.addr,
        nw_dst_mask: ip?.mask,
        tp_src: port,
      })
      if (nwProto !== undefined) {
        this._removeFlows({
          type: ofProtocol.matchType.standard,
          dl_type: dlType,
          dl_dst: mac,
          nw_proto: nwProto,
          nw_src: ip?.addr,
          nw_src_mask: ip?.mask,
          tp_dst: port,
        })
      }
    }
    if (direction.includes('to')) {
      if (nwProto !== undefined) {
        this._removeFlows({
          type: ofProtocol.matchType.standard,
          dl_type: dlType,
          dl_src: mac,
          nw_proto: nwProto,
          nw_dst: ip?.addr,
          nw_dst_mask: ip?.mask,
          tp_dst: port,
        })
      }
      this._removeFlows({
        type: ofProtocol.matchType.standard,
        dl_type: dlType,
        dl_dst: mac,
        nw_proto: nwProto,
        nw_src: ip?.addr,
        nw_src_mask: ip?.mask,
        tp_src: port,
      })
    }

    await this._tlsHelper.closeSocket(this._socket)
    delete this._socket
  }

  // ===========================================================================

  _processMessage(message) {
    if (message.header === undefined) {
      log.error('Failed to get header while processing message', {
        message,
      })
      return
    }

    const ofType = message.header.type
    switch (ofType) {
      case ofProtocol.type.hello:
        this._sendPacket(
          this._syncMessage(ofProtocol.type.hello, message.header.xid)
        )
        this._sendPacket(
          this._syncMessage(ofProtocol.type.featuresRequest, message.header.xid)
        )
        break
      case ofProtocol.type.error:
        {
          const { code, type } = message
          log.error('OpenFlow error', {
            code,
            type,
            // data: openflow.unpack(data),
          })
        }
        break
      case ofProtocol.type.echoRequest:
        this._sendPacket(
          this._syncMessage(ofProtocol.type.echoReply, message.header.xid)
        )
        break
      case ofProtocol.type.packetIn:
        log.debug('PACKET_IN')
        break
      case ofProtocol.type.featuresReply:
        {
          const { datapath_id: dpid, capabilities, ports } = message
          log.debug('FEATURES_REPLY', { dpid, capabilities, ports })
          this._sendPacket(
            this._syncMessage(
              ofProtocol.type.getConfigRequest,
              message.header.xid
            )
          )
        }
        break
      case ofProtocol.type.getConfigReply:
        {
          const { flags } = message
          log.debug('CONFIG_REPLY', { flags })
          this.emit('ofConnected')
        }
        break
      case ofProtocol.type.portStatus:
        log.debug('PORT_STATUS')
        break
      case ofProtocol.type.flowRemoved:
        log.debug('FLOW_REMOVED')
        break
      default:
        log.error('Unknown OpenFlow type', { ofType })
        break
    }
  }

  _addFlow(match, instructions) {
    const packet = this._flowModMessage(
      ofProtocol.flowModCommand.add,
      match,
      instructions
    )
    this._sendPacket(packet)
  }

  _removeFlows(match) {
    const packet = this._flowModMessage(ofProtocol.flowModCommand.delete, match)
    this._sendPacket(packet)
  }

  // ---------------------------------------------------------------------------

  _syncMessage(type, xid = 1) {
    return {
      header: {
        version,
        type,
        xid,
      },
    }
  }

  _flowModMessage(command, match, instructions = []) {
    // TODO: Do not use default priority?
    return {
      ...this._syncMessage(ofProtocol.type.flowMod),
      command,
      flags: ofProtocol.flowModFlags.sendFlowRem,
      match,
      instructions,
    }
  }

  // ---------------------------------------------------------------------------

  _sendPacket(packet) {
    const buf = openflow.pack(packet)
    try {
      this._socket.write(buf)
    } catch (error) {
      log.error('Error while writing into socket', {
        error,
        host: this.host.name_label,
      })
    }
  }

  // ---------------------------------------------------------------------------

  async _parseMessages() {
    for await (const msg of parse(this._socket)) {
      if (msg.header !== undefined) {
        this._processMessage(msg)
      } else {
        log.error('Error: Message is unparseable', { msg })
      }
    }
  }

  async _connect(networkUuid) {
    if (this._socket !== undefined) {
      return
    }

    const pif = this.host.$PIFs.find(pif => pif?.network === networkUuid)
    assert(pif !== undefined, 'No PIF available')

    this._socket = await this._tlsHelper.connect(pif.IP, OPENFLOW_PORT)

    const deleteSocket = () => {
      this._socket = undefined
    }
    this._socket.on('error', deleteSocket)
    this._socket.on('end', deleteSocket)

    this._parseMessages().catch(error => {
      log.error('Error while parsing OF messages', error)
    })

    await fromEvent(this, 'ofConnected')
  }
}
