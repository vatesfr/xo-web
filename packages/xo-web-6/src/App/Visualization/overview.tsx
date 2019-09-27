import React, { Component } from 'react'
import { getObject } from './utils'
import {
  HostRamUsageGraph,
  StorageUsageGraph,
  VmPowerStateGraph,
  VmHostCpuUsageGraph,
} from './dashboard'

const idHosts = [
  'b54bf91f-51d7-4af5-b1b3-f14dcf1146ee',
  'e90874ee-c3e9-407a-9507-dcb334dc8519',
  'e5f83a8e-ac73-4dbd-bc22-d9f2fb580341',
]

const idStorages = [
  'a5954951-3dfa-42b8-803f-4bc270b22a0b',
  '9a208896-fff9-caa0-d3ab-6ada542ae8ca',
  'ff33495d-68c4-0aa7-193a-229c261390b8',
]

const idVms = [
  '402b4559-217c-e9df-53b8-b548c2616e92',
  '1404803a-0fb8-9508-7684-b33575289fe4',
  'ebd131c8-d8df-144a-5997-f1969da1f022',
]

let hostVmCPUsUsage: any[] = []

export default class Visualization extends Component<any, any> {
  state: any = {
    hostRamUsageData: [],
    storageUsageData: [],
    vmPowerState: [],
    hostVmCPUsUsage: [],
  }

  componentDidMount() {
    setInterval(this.fetchHostUsageMemory.bind(this), 5e3)
    setInterval(this.fetchUsageStorage.bind(this), 5e3)
    setInterval(this.fetchVmPowerState.bind(this), 5e3)
    setInterval(this.fetchVmUsagevCPUs.bind(this), 5e3)
    setInterval(this.fetchHostCPUsTotal.bind(this), 5e3)
  }

  sumUsageHost(host: any) {
    let sizeHost = host.memory.size
    let usageHost = host.memory.usage
    let libreHost = sizeHost - usageHost
    return { usageHost, libreHost }
  }

  sumUsageStorages(sr: any) {
    let sizeSR = sr.size
    let physical_usage = sr.physical_usage
    let libreStorage = sizeSR - physical_usage
    return { physical_usage, libreStorage }
  }

  sumVmCpus(idVm: any) {
    let nbCpus = idVm.CPUs.number
    return { nbCpus }
  }

  fetchVmUsagevCPUs = () => {
    Promise.all(idVms.map((idVm: any) => getObject(idVm))).then(allData => {
      const CpuUsage = { name1: 'used vCPUs', UsedvCPUs: 0 }
      allData.forEach((currentVm: any) => {
        CpuUsage.UsedvCPUs =
          CpuUsage.UsedvCPUs + this.sumVmCpus(currentVm).nbCpus
      })
      hostVmCPUsUsage.push(CpuUsage)
    })
  }

  fetchHostCPUsTotal = () => {
    Promise.all(idHosts.map((idHost: any) => getObject(idHost))).then(
      allData => {
        const usageCpuHost = { name1: 'CPUs Total', CPUsTotal: 0 }
        allData.forEach((currentHost: any) => {
          usageCpuHost.CPUsTotal =
            this.sumHostCpus(currentHost).nbCpusHost + usageCpuHost.CPUsTotal
        })
        hostVmCPUsUsage.push(usageCpuHost)
        this.setState({ hostVmCPUsUsage })
      }
    )
  }

  sumHostCpus(idHost: any) {
    let nbCpusHost: any
    nbCpusHost = parseInt(idHost.CPUs.cpu_count)
    return { nbCpusHost }
  }

  fetchHostUsageMemory = () => {
    Promise.all(idHosts.map((idHost: any) => getObject(idHost))).then(
      allData => {
        const usage = { name: 'usage', value: 0 }
        const libre = { name: 'free', value: 0 }
        let hostRamUsageData: any[] = []
        allData.forEach((currentHost: any) => {
          usage.value = usage.value + this.sumUsageHost(currentHost).usageHost
          libre.value = libre.value + this.sumUsageHost(currentHost).libreHost
        })
        hostRamUsageData.push(usage)
        hostRamUsageData.push(libre)
        this.setState({ hostRamUsageData })
      }
    )
  }

  fetchUsageStorage = () => {
    Promise.all(idStorages.map((idSr: any) => getObject(idSr))).then(
      allData => {
        const usage = { name: 'usage', value: 0 }
        const libre = { name: 'free', value: 0 }
        let storageUsageData: any[] = []
        allData.forEach((currentSr: any) => {
          usage.value =
            usage.value + this.sumUsageStorages(currentSr).physical_usage
          libre.value =
            libre.value + this.sumUsageStorages(currentSr).libreStorage
        })
        storageUsageData.push(usage)
        storageUsageData.push(libre)
        this.setState({ storageUsageData })
      }
    )
  }

  sumPowerState(idVm: any) {
    let powerState = idVm.power_state
    let value1 = 0
    let value2 = 0
    if (powerState == 'Running') {
      value1 = value1 + 1
    } else if (powerState == 'Halted') {
      value2 = value2 + 1
    }
    return { value1, value2 }
  }

  fetchVmPowerState = () => {
    Promise.all(idVms.map((idVm: any) => getObject(idVm))).then(allData => {
      const running = { name: 'Running', value: 0 }
      const halted = { name: 'Halted', value: 0 }
      let vmPowerState: any[] = []
      allData.forEach((currentVm: any) => {
        running.value = running.value + this.sumPowerState(currentVm).value1
        halted.value = halted.value + this.sumPowerState(currentVm).value2
      })
      vmPowerState.push(running)
      vmPowerState.push(halted)
      this.setState({ vmPowerState })
    })
  }

  render() {
    return (
      <div>
        <h3>RAM usage</h3>
        <div style={{ width: '350px', height: '350px' }}>
          <HostRamUsageGraph data={this.state.hostRamUsageData} />
        </div>
        <br />
        <h3>Storage Usage</h3>
        <div style={{ width: '350px', height: '350px' }}>
          <StorageUsageGraph data={this.state.storageUsageData} />
        </div>
        <br />
        <h3>VMs Power state</h3>
        <div style={{ width: '350px', height: '350px' }}>
          <VmPowerStateGraph data={this.state.vmPowerState} />
        </div>
        <br />
        <h3>CPUs Usage</h3>
        <div style={{ width: '350px', height: '350px' }}>
          <VmHostCpuUsageGraph data={this.state.hostVmCPUsUsage} />
        </div>
      </div>
    )
  }
}
