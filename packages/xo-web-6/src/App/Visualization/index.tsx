import React, { Component } from 'react'
import { getObject, xoCall } from './utils'
import moment from 'moment'
import { VmDiskGraph, VmNetworkGraph, VmMemoryGraph, VmCpuGraph } from './stats'

const NB_VALUES = 118

export default class Visualization extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
    format: 'LTS',
    // VM
    // Cpu
    vmCpuData: [],
    vmCpus: [],

    // Memory
    vmMemoryData: [],
    total: 0,

    // Network
    vmNetworkData: [],
    vmNetworkMax: 0,
    vmNetworkIntervalMin: 1024e2,

    // Disk
    vmDiskData: [],
    vmDiskMax: 0,
    vmDiskIntervalMin: 1024e3,
    syncId: '402b4559-217c-e9df-53b8-b548c2616e92',
  }

  componentDidMount() {
    setInterval(this.fetchVmStats.bind(this), 5e3)
  }

  fetchVmStats = () => {
    getObject('402b4559-217c-e9df-53b8-b548c2616e92').then((vm: any) => {
      this.setState({ total: vm.memory.dynamic[1] })
    })

    xoCall('vm.stats', {
      id: '402b4559-217c-e9df-53b8-b548c2616e92',
      granularity: this.state.granularity,
    }).then(
      ({
        endTimestamp,
        stats: { cpus },
        interval,
        stats: { memory, memoryFree = memory },
        stats: { vifs },
        stats: { xvds },
      }) => {
        let format: any
        if (interval === 5 || interval === 60) {
          format = 'LTS'
        } else if (interval === 86400 || interval === 3600) {
          format = 'l'
        }

        this.setState({
          vmCpus: Object.keys(cpus),
          vmNetworksTransmission: Object.keys(vifs.tx),
          vmNetworksReception: Object.keys(vifs.rx),
          vmDisksWriting: Object.keys(xvds.w),
          vmDisksReading: Object.keys(xvds.r),
        })

        let vmCpuData: any[] = []
        let vmMemoryData: any[] = []
        let vmNetworkData: any[] = []
        let vmDiskData: any[] = []
        let vmMemoryNewData: any[] = []

        vmMemoryNewData = memoryFree.map(
          (value: any, index: any) => memory[index] - value
        )

        for (var i = 0; i < NB_VALUES; i++) {
          let vmCpusValues: any = {}
          let vmMemoryValues: any = {}
          let vmNetworkValues: any = {}
          let vmDiskValues: any = {}

          vmCpusValues.time = moment(
            (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
          ).format(format)

          this.state.vmCpus.forEach((property: string | number) => {
            vmCpusValues[`cpu${property}`] = cpus[property][i]
          })

          this.state.vmNetworksTransmission.forEach(
            (property: string | number) => {
              vmNetworkValues[`vifs_${property}_(tx)`] = vifs.tx[property][i]
            }
          )

          this.state.vmNetworksReception.forEach(
            (property: string | number) => {
              vmNetworkValues[`vifs_${property}_(rx)`] = vifs.rx[property][i]
            }
          )

          this.state.vmDisksWriting.forEach((property: string | number) => {
            vmDiskValues[`xvds_${property}_(w)`] = xvds.w[property][i]
          })

          this.state.vmDisksReading.forEach((property: string | number) => {
            vmDiskValues[`xvds_${property}_(r)`] = xvds.r[property][i]
          })

          vmMemoryValues.memory = vmMemoryNewData[i]
          vmMemoryValues.time = vmCpusValues.time
          vmNetworkValues.time = vmCpusValues.time
          vmDiskValues.time = vmCpusValues.time
          vmDiskData.push(vmDiskValues)
          vmCpuData.push(vmCpusValues)
          vmNetworkData.push(vmNetworkValues)
          vmMemoryData.push(vmMemoryValues)
        }
        this.state.vmNetworksTransmission.forEach(
          (property: string | number) => {
            this.setState({ maxNetworkTx: Math.max(...vifs.tx[property]) })
          }
        )

        this.state.vmNetworksReception.forEach((property: string | number) => {
          this.setState({ maxNetworkRx: Math.max(...vifs.rx[property]) })
        })

        this.state.vmNetworkMax = Math.max(
          this.state.maxNetworkTx,
          this.state.maxNetworkRx
        )

        this.state.vmDisksWriting.forEach((property: string | number) => {
          this.setState({ maxDiskW: Math.max(...xvds.w[property]) })
        })

        this.state.vmDisksReading.forEach((property: string | number) => {
          this.setState({ maxDiskR: Math.max(...xvds.r[property]) })
        })

        this.state.vmDiskMax = Math.max(
          this.state.maxDiskW,
          this.state.maxDiskR
        )
        this.setState({ vmCpuData, vmMemoryData, vmNetworkData, vmDiskData })
      }
    )
  }

  setGranularity = (event: any) => {
    this.setState({ granularity: event.target.value }, () => {
      this.fetchVmStats()
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
          <VmCpuGraph data={this.state.vmCpuData} syncId={this.state.syncId} />
        </div>
        <br />
        <h3>Memory usage</h3>
        <div style={{ width: '500px', height: '300px' }}>
          <VmMemoryGraph
            data={this.state.vmMemoryData}
            total={this.state.total}
            syncId={this.state.syncId}
          />
        </div>
        <br />
        <h3>Network throughput</h3>
        <div style={{ width: '500px', height: '300px' }}>
          <VmNetworkGraph
            data={this.state.vmNetworkData}
            threshold={this.state.vmNetworkIntervalMin}
            syncId={this.state.syncId}
          />
        </div>
        <br />
        <h3>Disk throughput</h3>
        <div style={{ width: '500px', height: '300px' }}>
          <VmDiskGraph
            data={this.state.vmDiskData}
            threshold={this.state.vmDiskIntervalMin}
            syncId={this.state.syncId}
          />
        </div>
      </div>
    )
  }
}
