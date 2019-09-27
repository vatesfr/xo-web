import React, { Component } from 'react'
import { xoCall } from './utils'
import {
  HostMemoryGraph,
  HostCpuGraph,
  HostNetworkGraph,
  HostLoadGraph,
} from './miniStats'

const NB_VALUES = 118
const tabId = [
  'b54bf91f-51d7-4af5-b1b3-f14dcf1146ee',
  'e90874ee-c3e9-407a-9507-dcb334dc8519',
  'e5f83a8e-ac73-4dbd-bc22-d9f2fb580341',
]

export default class Visualization extends Component<any, any> {
  state: any = {
    hostIds: 0,
  }
  render() {
    return (
      <div>
        <div>
          <HostsMemoryGraph hostIds={tabId} />
        </div>
        <div>
          <HostsCpuGraph hostIds={tabId} />
        </div>
        <div>
          <HostsNetworkGraph hostIds={tabId} />
        </div>
        <div>
          <HostsLoadGraph hostIds={tabId} />
        </div>
      </div>
    )
  }
}

class HostsMemoryGraph extends Component<any, any> {
  state: any = {
    hostId: 0,
  }
  render() {
    return this.props.hostIds.map((hostId: any) => (
      <div key={hostId}>
        <h3>Memory usage</h3>
        <div style={{ width: '200px', height: '100px' }}>
          <HostMemoryGraph hostId={hostId} />
        </div>
      </div>
    ))
  }
}

class HostsCpuGraph extends Component<any, any> {
  state: any = {
    hostId: 0,
  }
  render() {
    return this.props.hostIds.map((hostId: any) => (
      <div key={hostId}>
        <h3>CPU usage</h3>
        <div style={{ width: '200px', height: '100px' }}>
          <HostCpuGraph hostId={hostId} />
        </div>
      </div>
    ))
  }
}

class HostsNetworkGraph extends Component<any, any> {
  state: any = {
    hostId: 0,
    max: 0,
    allData: [],
  }

  componentDidMount() {
    setInterval(this.fetchAll.bind(this), 5e3)
  }
  fetchAll() {
    Promise.all(
      this.props.hostIds.map((idHost: any) => this.fetchOne(idHost))
    ).then(allData => {
      this.setState({ max: 0, allData: [] })
      allData.forEach((currentHost: any) => {
        this.updateData(
          currentHost.endTimestamp,
          currentHost.interval,
          currentHost.stats
        )
      })
    })
  }

  fetchOne = (idHost: string) =>
    xoCall('host.stats', {
      host: idHost,
      granularity: this.state.granularity,
    })

  computeMax(value: number) {
    return this.state.max < value ? value : this.state.max
  }
  updateData(endTimestamp: any, interval: any, stats: any) {
    const data: any = {}
    data.networksTransmissionVm = Object.keys(stats.pifs.tx)
    data.networksReceptionVm = Object.keys(stats.pifs.rx)

    let networkDataVm: any[] = []

    for (var i = 0; i < NB_VALUES; i++) {
      let valuesNetwork: any = {}

      data.networksTransmissionVm.forEach((property: string | number) => {
        const networkValuesTransmission = stats.pifs.tx[property][i]
        if (
          data.maxNetworkT === undefined ||
          networkValuesTransmission > data.maxNetworkT
        ) {
          data.maxNetworkT = networkValuesTransmission
        }
        valuesNetwork[`pifs_${property}_(tx)`] = stats.pifs.tx[property][i]
      })

      data.networksReceptionVm.forEach((property: string | number) => {
        const networkValuesReception = stats.pifs.rx[property][i]
        if (
          data.maxNetworkR === undefined ||
          networkValuesReception > data.maxNetworkR
        ) {
          data.maxNetworkR = networkValuesReception
        }
        valuesNetwork[`pifs_${property}_(rx)`] = stats.pifs.rx[property][i]
      })

      valuesNetwork.time =
        (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
      networkDataVm.push(valuesNetwork)
    }
    const maxNetwork = Math.max(data.maxNetworkR, data.maxNetworkT)
    data.values = networkDataVm
    const tmpAllData: any[] = this.state.allData
    tmpAllData.push(data)
    this.setState({ allData: tmpAllData, max: this.computeMax(maxNetwork) })
  }
  render() {
    return this.state.allData.map((currentData: any) => (
      <div>
        <h3>Network throughput</h3>
        <div style={{ width: '200px', height: '100px' }}>
          <HostNetworkGraph max={this.state.max} data={currentData} />
        </div>
      </div>
    ))
  }
}

class HostsLoadGraph extends Component<any, any> {
  state: any = {
    hostId: 0,
    max: 0,
    allData: [],
  }

  componentDidMount() {
    setInterval(this.fetchAll.bind(this), 5e3)
  }
  fetchAll() {
    Promise.all(
      this.props.hostIds.map((idHost: any) => this.fetchOne(idHost))
    ).then(allData => {
      this.setState({ max: 0, allData: [] })
      allData.forEach((currentHost: any) => {
        this.updateData(
          currentHost.endTimestamp,
          currentHost.interval,
          currentHost.stats
        )
      })
    })
  }

  fetchOne = (idHost: string) =>
    xoCall('host.stats', {
      host: idHost,
      granularity: this.state.granularity,
    })

  computeMax(value: number) {
    return this.state.max < value ? value : this.state.max
  }

  updateData(endTimestamp: any, interval: any, stats: any) {
    const data: any = {}
    let loadDataHost: any[] = []
    for (var i = 0; i < NB_VALUES; i++) {
      let valuesLoad: any = {}
      valuesLoad.load = stats.load[i]
      valuesLoad.time = (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
      loadDataHost.push(valuesLoad)
    }

    data.values = loadDataHost
    const maxLoad = Math.max(...stats.load)
    const tmpAllData: any[] = this.state.allData
    tmpAllData.push(data)
    this.setState({ allData: tmpAllData, max: this.computeMax(maxLoad) })
  }

  render() {
    return this.state.allData.map((currentData: any) => (
      <div>
        <h3>Load average </h3>
        <div style={{ width: '200px', height: '100px' }}>
          <HostLoadGraph max={this.state.max} data={currentData} />
        </div>
      </div>
    ))
  }
}
