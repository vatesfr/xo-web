import React, { Component } from 'react'
import { xoCall } from './utils'
import {
  StorageThroughputGraph,
  StorageLatencyGraph,
  StorageIopsGraph,
  StorageIowaitGraph,
} from './miniStats'

const NB_VALUES = 118
const tabId = [
  'a5954951-3dfa-42b8-803f-4bc270b22a0b',
  '9a208896-fff9-caa0-d3ab-6ada542ae8ca',
  'ff33495d-68c4-0aa7-193a-229c261390b8',
]

export default class Visualization extends Component<any, any> {
  state: any = {
    srIds: 0,
  }

  render() {
    return (
      <div>
        <div>
          <StoragesIopsGraph srIds={tabId} />
        </div>
        <div>
          <StoragesLatencyGraph srIds={tabId} />
        </div>
        <div>
          <StoragesIowaitGraph srIds={tabId} />
        </div>
        <div>
          <StoragesThroughputGraph srIds={tabId} />
        </div>
      </div>
    )
  }
}

class StoragesIowaitGraph extends Component<any, any> {
  state: any = {
    srId: 0,
    max: 0,
    allData: [],
  }

  componentDidMount() {
    setInterval(this.fetchAll.bind(this), 5e3)
  }
  fetchAll() {
    Promise.all(this.props.srIds.map((idSr: any) => this.fetchOne(idSr))).then(
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

  fetchOne = (idSr: string) =>
    xoCall('sr.stats', {
      id: idSr,
      granularity: this.state.granularity,
    })

  computeMax(value: number) {
    return this.state.max < value ? value : this.state.max
  }
  updateData(endTimestamp: any, interval: any, stats: any) {
    const data: any = {}
    data.iowaitSr = Object.keys(stats.iowait)

    let dataSrIowait: any[] = []

    for (var i = 0; i < NB_VALUES; i++) {
      let valuesSrIowait: any = {}
      data.iowaitSr.forEach((property: string | number) => {
        //
        const iowaitValuesMax = stats.iowait[property][i]
        if (
          data.maxIowaitGlobal === undefined ||
          iowaitValuesMax > data.maxIowaitGlobal
        ) {
          data.maxIowaitGlobal = iowaitValuesMax
        }
        valuesSrIowait[`iowait_${property}`] = stats.iowait[property][i]
      })
      valuesSrIowait.time =
        (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
      dataSrIowait.push(valuesSrIowait)
    }
    data.values = dataSrIowait
    const maxIowait = data.maxIowaitGlobal
    const tmpAllData: any[] = this.state.allData
    tmpAllData.push(data)
    this.setState({ allData: tmpAllData, max: this.computeMax(maxIowait) })
  }
  render() {
    return this.state.allData.map((currentData: any) => (
      <div>
        <h3>IOwait</h3>
        <div style={{ width: '200px', height: '100px' }}>
          <StorageIowaitGraph max={this.state.max} data={currentData} />
        </div>
      </div>
    ))
  }
}

class StoragesIopsGraph extends Component<any, any> {
  state: any = {
    srId: 0,
    max: 0,
    allData: [],
  }

  componentDidMount() {
    setInterval(this.fetchAll.bind(this), 5e3)
  }

  fetchAll() {
    Promise.all(this.props.srIds.map((idSr: any) => this.fetchOne(idSr))).then(
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

  fetchOne = (idSr: string) =>
    xoCall('sr.stats', {
      id: idSr,
      granularity: this.state.granularity,
    })

  computeMax(value: number) {
    return this.state.max < value ? value : this.state.max
  }
  updateData(endTimestamp: any, interval: any, stats: any) {
    const data: any = {}
    data.iopsSr = Object.keys(stats.iops)
    const iopsData: any[] = []

    for (var i = 0; i < NB_VALUES; i++) {
      const valuesSrIops: any = {}

      valuesSrIops.time = (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000

      data.iopsSr.forEach((property: string | number) => {
        const iops = stats.iops[property][i]
        if (data.maxIOPS === undefined || iops > data.maxIOPS) {
          data.maxIOPS = iops
        }
        valuesSrIops[`iops_${property}`] = stats.iops[property][i]
      })
      iopsData.push(valuesSrIops)
    }
    const maxIopsGlobal = data.maxIOPS
    data.values = iopsData
    const tmpAllData: any[] = this.state.allData
    tmpAllData.push(data)
    this.setState({ allData: tmpAllData, max: this.computeMax(maxIopsGlobal) })
  }

  render() {
    return this.state.allData.map((currentData: any) => (
      <div>
        <h3>IOPS</h3>
        <div style={{ width: '200px', height: '100px' }}>
          <StorageIopsGraph max={this.state.max} data={currentData} />
        </div>
      </div>
    ))
  }
}

class StoragesLatencyGraph extends Component<any, any> {
  state: any = {
    srId: 0,
    max: 0,
    allData: [],
  }

  componentDidMount() {
    setInterval(this.fetchAll.bind(this), 5e3)
  }

  fetchAll() {
    Promise.all(this.props.srIds.map((idSr: any) => this.fetchOne(idSr))).then(
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

  fetchOne = (idSr: string) =>
    xoCall('sr.stats', {
      id: idSr,
      granularity: this.state.granularity,
    })

  computeMax(value: number) {
    return this.state.max < value ? value : this.state.max
  }

  updateData(endTimestamp: any, interval: any, stats: any) {
    const data: any = {}
    data.latencySr = Object.keys(stats.latency)
    const latencyData: any[] = []

    for (var i = 0; i < NB_VALUES; i++) {
      const valuesSrLatency: any = {}
      data.latencySr.forEach((property: string | number) => {
        valuesSrLatency[`latency_${property}`] = stats.latency[property][i]
      })

      valuesSrLatency.time =
        (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
      latencyData.push(valuesSrLatency)
    }

    data.latencySr.forEach((property: string | number) => {
      data.maxLatency = Math.max(...stats.latency[property])
    })
    data.values = latencyData
    const maxLatencyGlobal = data.maxLatency
    const tmpAllData: any[] = this.state.allData
    tmpAllData.push(data)
    this.setState({
      allData: tmpAllData,
      max: this.computeMax(maxLatencyGlobal),
    })
  }

  render() {
    return this.state.allData.map((currentData: any) => (
      <div>
        <h3> Latency </h3>
        <div style={{ width: '200px', height: '100px' }}>
          <StorageLatencyGraph max={this.state.max} data={currentData} />
        </div>
      </div>
    ))
  }
}

class StoragesThroughputGraph extends Component<any, any> {
  state: any = {
    srId: 0,
    max: 0,
    allData: [],
  }

  componentDidMount() {
    setInterval(this.fetchAll.bind(this), 5e3)
  }

  fetchAll() {
    Promise.all(this.props.srIds.map((idSr: any) => this.fetchOne(idSr))).then(
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
  fetchOne = (idSr: string) =>
    xoCall('sr.stats', {
      id: idSr,
      granularity: this.state.granularity,
    })

  computeMax(value: number) {
    return this.state.max < value ? value : this.state.max
  }

  updateData(endTimestamp: any, interval: any, stats: any) {
    const data: any = {}

    data.throSr = Object.keys(stats.ioThroughput)
    const throughputData: any[] = []
    for (var i = 0; i < NB_VALUES; i++) {
      const valuesSrThro: any = {}
      data.throSr.forEach((property: string | number) => {
        const throughputValuesMax = stats.ioThroughput[property][i]
        if (
          data.maxNetworkR === undefined ||
          throughputValuesMax > data.maxNetworkR
        ) {
          data.maxNetworkR = throughputValuesMax
        }
        valuesSrThro[`thr_${property}`] = stats.ioThroughput[property][i]
      })
      valuesSrThro.time = (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
      throughputData.push(valuesSrThro)
    }

    data.values = throughputData
    const maxThroughputGlobal = data.maxNetworkR
    const tmpAllData: any[] = this.state.allData
    tmpAllData.push(data)
    this.setState({
      allData: tmpAllData,
      max: this.computeMax(maxThroughputGlobal),
    })
  }

  render() {
    return this.state.allData.map((currentData: any) => (
      <div>
        <h3>IO throughput </h3>
        <div style={{ width: '200px', height: '100px' }}>
          <StorageThroughputGraph max={this.state.max} data={currentData} />
        </div>
      </div>
    ))
  }
}
