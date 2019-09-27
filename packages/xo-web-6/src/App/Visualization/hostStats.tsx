import React, { Component } from 'react'
import moment from 'moment'
import { getObject, xoCall } from './utils'
import {
  HostCpuGraph,
  HostLoadGraph,
  HostNetworkGraph,
  HostMemoryGraph,
} from './stats'

const NB_VALUES = 118

export default class Visualization extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
    format: 'LTS',

    //  Host
    //  cpu
    hostCpuData: [],
    hostCpus: [],

    // Memory
    hostMemoryData: [],
    total: 0,

    //  Network
    hostNetworkData: [],
    hostNetworksReception: [],
    hostNetworksTransmission: [],
    hostNetworksMax: [],
    hostNetworkIntervalMin: 1024e2,

    //  Load
    hostLoadData: [],
    hostLoadMax: 0,
    hostLoadIntervalMin: 1,
    syncId: 'b54bf91f-51d7-4af5-b1b3-f14dcf1146ee',
  }

  componentDidMount() {
    setInterval(this.fetchHostStats.bind(this), 5e3)
  }

  fetchHostStats = () => {
    getObject('b54bf91f-51d7-4af5-b1b3-f14dcf1146ee').then((host: any) => {
      this.setState({ total: host.memory.size })
    })

    xoCall('host.stats', {
      host: 'b54bf91f-51d7-4af5-b1b3-f14dcf1146ee',
      granularity: this.state.granularity,
    }).then(
      ({
        endTimestamp,
        stats: { cpus },
        interval,
        stats: { load },
        stats: { memory, memoryFree = memory },
        stats: { pifs },
      }) => {
        let format: any
        if (interval === 5 || interval === 60) {
          format = 'LTS'
        } else if (interval === 86400 || interval === 3600) {
          format = 'l'
        }

        this.setState({
          hostCpus: Object.keys(cpus),
          hostNetworksReception: Object.keys(pifs.rx),
          hostNetworksTransmission: Object.keys(pifs.tx),
        })
        let hostCpuData: any[] = []
        let hostMemoryData: any[] = []
        let hostNetworkData: any[] = []
        let hostLoadData: any[] = []
        let hostMemoryNewData: any = []

        hostMemoryNewData = memoryFree.map(
          (value: any, index: any) => memory[index] - value
        )

        for (var i = 0; i < NB_VALUES; i++) {
          let hostCpusValues: any = {}
          let hostMemoryValues: any = {}
          let hostNetworkValues: any = {}
          let hostLoadValues: any = {}

          hostCpusValues.time = moment(
            (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
          ).format(format)

          this.state.hostCpus.forEach((property: string | number) => {
            hostCpusValues[`cpu${property}`] = cpus[property][i]
          })

          this.state.hostNetworksReception.forEach(
            (property: string | number) => {
              hostNetworkValues[`pifs_${property}_(rx)`] = pifs.rx[property][i]
            }
          )

          this.state.hostNetworksTransmission.forEach(
            (property: string | number) => {
              hostNetworkValues[`pifs_${property}_(tx)`] = pifs.tx[property][i]
            }
          )

          hostLoadValues.load = load[i]
          hostMemoryValues.memory = hostMemoryNewData[i]
          hostMemoryValues.time = hostCpusValues.time
          hostNetworkValues.time = hostCpusValues.time
          hostLoadValues.time = hostCpusValues.time
          hostCpuData.push(hostCpusValues)
          hostNetworkData.push(hostNetworkValues)
          hostLoadData.push(hostLoadValues)
          hostMemoryData.push(hostMemoryValues)
        }
        this.setState({ hostLoadMax: Math.max(...load) })
        this.state.hostNetworksTransmission.forEach(
          (property: string | number) => {
            this.setState({ maxNetworkTx: Math.max(...pifs.tx[property]) })
          }
        )

        this.state.hostNetworksReception.forEach(
          (property: string | number) => {
            this.setState({ maxNetworkRx: Math.max(...pifs.rx[property]) })
          }
        )

        this.setState({
          hostNetworksMax: Math.max(
            this.state.maxNetworkTx,
            this.state.maxNetworkRx
          ),
        })

        this.setState({
          hostCpuData,
          hostMemoryData,
          hostNetworkData,
          hostLoadData,
        })
      }
    )
  }

  setGranularity = (event: any) => {
    this.setState({ granularity: event.target.value }, () => {
      this.fetchHostStats()
    })
  }

  render() {
    return (
      <div>
        <div>
          <form>
            <select
              onChange={this.setGranularity}
              value={this.state.granularity}
            >
              <option value='seconds'>Last 10 minutes</option>
              <option value='minutes'>Last 2 hours</option>
              <option value='hours'>Last week</option>
              <option value='days'>Last year</option>
            </select>
          </form>
        </div>
        <h3>CPU usage</h3>
        <div style={{ width: '500px', height: '300px' }}>
          <HostCpuGraph
            data={this.state.hostCpuData}
            syncId={this.state.syncId}
          />
        </div>
        <br />
        <div style={{ width: '500px', height: '300px' }}>
          <h3>Memory usage </h3>
          <HostMemoryGraph
            data={this.state.hostMemoryData}
            total={this.state.total}
            syncId={this.state.syncId}
          />
        </div>
        <br />
        <h3>Network throughput </h3>
        <div style={{ width: '500px', height: '300px' }}>
          <HostNetworkGraph
            data={this.state.hostNetworkData}
            threshold={this.state.hostNetworkIntervalMin}
            syncId={this.state.syncId}
          />
        </div>
        <br />
        <h3>Load average </h3>
        <div style={{ width: '500px', height: '300px' }}>
          <HostLoadGraph
            data={this.state.hostLoadData}
            threshold={this.state.hostLoadIntervalMin}
            syncId={this.state.syncId}
          />
        </div>
      </div>
    )
  }
}
