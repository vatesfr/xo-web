import React, { Component } from 'react'
import { xoCall } from './utils'
const NB_VALUES = 118
const tabId = [
  '40fec8ff-e0cf-aa79-ad3a-985ef582f10c',
  '402b4559-217c-e9df-53b8-b548c2616e92',
  'ebd131c8-d8df-144a-5997-f1969da1f022',
]

import {
  VmCpuGraph,
  VmMemoryGraph,
  VmNetworkGraph,
  VmDiskGraph,
} from './miniStats'

export default class Visualization extends Component<any, any> {
  state: any = {
    vmIds: 0,
  }
  render() {
    return (
      <div>
        <div>
          <VmsDiskGraph vmIds={tabId} />
        </div>
        <div>
          <VmsNetworkGraph vmIds={tabId} />
        </div>
        <div>
          <VmsMemoryGraph vmIds={tabId} />
        </div>
        <div>
          <VmsCpuGraph vmIds={tabId} />
        </div>
      </div>
    )
  }
}

class VmsCpuGraph extends Component<any, any> {
  state: any = {
    vmId: 0,
  }
  render() {
    return this.props.vmIds.map((vmId: any) => (
      <div key={vmId}>
        <h3>CPU usage</h3>
        <div style={{ width: '200px', height: '100px' }}>
          <VmCpuGraph vmId={vmId} />
        </div>
      </div>
    ))
  }
}

class VmsMemoryGraph extends Component<any, any> {
  state: any = {
    vmId: 0,
  }

  render() {
    return this.props.vmIds.map((vmId: any) => (
      <div key={vmId}>
        <h3>Memory usage</h3>
        <div style={{ width: '200px', height: '100px' }}>
          <VmMemoryGraph vmId={vmId} />
        </div>
      </div>
    ))
  }
}

class VmsNetworkGraph extends Component<any, any> {
  state: any = {
    vmId: 0,
    max: 0,
    allData: [],
  }
  componentDidMount() {
    setInterval(this.fetchAll.bind(this), 5e3)
  }
  fetchAll() {
    Promise.all(this.props.vmIds.map((idVm: any) => this.fetchOne(idVm))).then(
      allData => {
        this.setState({ max: 0, allData: [] })
        allData.forEach((currentVm: any) => {
          this.updateData(
            currentVm.endTimestamp,
            currentVm.interval,
            currentVm.stats
          )
        })
      }
    )
  }

  fetchOne = (idVm: string) =>
    xoCall('vm.stats', {
      id: idVm,
      granularity: this.state.granularity,
    })

  computeMax(value: number) {
    return this.state.max < value ? value : this.state.max
  }

  updateData(endTimestamp: any, interval: any, stats: any) {
    const data: any = {}

    data.networksTransmissionVm = Object.keys(stats.vifs.tx)
    data.networksReceptionVm = Object.keys(stats.vifs.rx)

    let vmNetworkData: any[] = []
    for (var i = 0; i < NB_VALUES; i++) {
      let valuesNetwork: any = {}

      data.networksTransmissionVm.forEach((property: string | number) => {
        const networkValuesTransmission = stats.vifs.tx[property][i]
        if (
          data.maxNetworkT === undefined ||
          networkValuesTransmission > data.maxNetworkT
        ) {
          data.maxNetworkT = networkValuesTransmission
        }
        valuesNetwork[`vifs_${property}_(tx)`] = stats.vifs.tx[property][i]
      })

      data.networksReceptionVm.forEach((property: string | number) => {
        const networkValuesReception = stats.vifs.rx[property][i]
        if (
          data.maxNetworkR === undefined ||
          networkValuesReception > data.maxNetworkR
        ) {
          data.maxNetworkR = networkValuesReception
        }
        valuesNetwork[`vifs_${property}_(rx)`] = stats.vifs.rx[property][i]
      })
      valuesNetwork.time =
        (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
      vmNetworkData.push(valuesNetwork)
    }
    const maxNetwork = Math.max(data.maxNetworkR, data.maxNetworkT)
    data.values = vmNetworkData
    const tmpAllData: any[] = this.state.allData
    tmpAllData.push(data)
    this.setState({ allData: tmpAllData, max: this.computeMax(maxNetwork) })
  }

  render() {
    return this.state.allData.map((currentData: any) => (
      <div>
        <h3>Network throughput</h3>
        <div style={{ width: '200px', height: '100px' }}>
          <VmNetworkGraph max={this.state.max} data={currentData} />
        </div>
      </div>
    ))
  }
}

class VmsDiskGraph extends Component<any, any> {
  state: any = {
    vmId: 0,
    max: 0,
    allData: [],
  }

  componentDidMount() {
    setInterval(this.fetchAll.bind(this), 5e3)
  }

  fetchAll() {
    Promise.all(this.props.vmIds.map((idVm: any) => this.fetchOne(idVm))).then(
      allData => {
        this.setState({ max: 0, allData: [] })
        allData.forEach((currentVm: any) => {
          this.updateData(
            currentVm.endTimestamp,
            currentVm.interval,
            currentVm.stats
          )
        })
      }
    )
  }

  fetchOne = (idVm: string) =>
    xoCall('vm.stats', {
      id: idVm,
      granularity: this.state.granularity,
    })

  computeMax(value: number) {
    return this.state.max < value ? value : this.state.max
  }
  updateData(endTimestamp: any, interval: any, stats: any) {
    const data: any = {}
    data.disksWriting = Object.keys(stats.xvds.w)
    data.disksReading = Object.keys(stats.xvds.r)

    let diskDataVm: any[] = []

    for (var i = 0; i < NB_VALUES; i++) {
      let ValuesDisk: any = {}

      data.disksWriting.forEach((property: string | number) => {
        const diskValuesWriting = stats.xvds.w[property][i]

        if (data.maxDiskW === undefined || diskValuesWriting > data.maxDiskW) {
          data.maxDiskW = diskValuesWriting
        }
        ValuesDisk[`xvds_${property}_(w)`] = stats.xvds.w[property][i]
      })

      data.disksReading.forEach((property: string | number) => {
        const diskValuesReading = stats.xvds.r[property][i]
        if (data.maxDiskR === undefined || diskValuesReading > data.maxDiskR) {
          data.maxDiskR = diskValuesReading
        }

        ValuesDisk[`xvds_${property}_(r)`] = stats.xvds.r[property][i]
      })

      ValuesDisk.time = (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
      diskDataVm.push(ValuesDisk)
    }

    const maxDisk = Math.max(data.maxDiskW, data.maxDiskR)
    data.values = diskDataVm
    const tmpAllData: any[] = this.state.allData
    tmpAllData.push(data)
    this.setState({ allData: tmpAllData, max: this.computeMax(maxDisk) })
  }

  render() {
    return this.state.allData.map((currentData: any) => (
      <div>
        <h3>Disk throughput</h3>
        <div style={{ width: '200px', height: '100px' }}>
          <VmDiskGraph max={this.state.max} data={currentData} />
        </div>
      </div>
    ))
  }
}
