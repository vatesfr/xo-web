import React, { Component } from 'react'
import { YAxis, AreaChart } from 'recharts'
import { getObject, xoCall } from './utils'
import { Area, ResponsiveContainer } from 'recharts'
import humanFormat from 'human-format'
const NB_VALUES = 118

export class VmCpuGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
    format: 'LTS',
    cpusVm: [],
    cpuDataVm: [],
  }
  componentDidMount() {
    setInterval(this.fetchCpuVmStats.bind(this), 5e3)
  }

  fetchCpuVmStats = () => {
    xoCall('vm.stats', {
      id: this.props.vmId,
      granularity: this.state.granularity,
    }).then(({ endTimestamp, stats: { cpus }, interval }) => {
      this.setState({ cpusVm: Object.keys(cpus) })
      let cpuDataVm: any[] = []
      const averageCpu: any[] = []
      for (var i = 0; i < NB_VALUES; i++) {
        averageCpu[i] = 0
        for (var j = 0; j < this.state.cpusVm.length; j++) {
          averageCpu[i] += cpus[j][i] / this.state.cpusVm.length
        }
      }
      for (var i = 0; i < NB_VALUES; i++) {
        let valuesCpus: any = {}
        valuesCpus.time = (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
        valuesCpus.cpu = averageCpu[i]

        cpuDataVm.push(valuesCpus)
      }

      this.setState({ cpuDataVm })
    })
  }

  render() {
    return (
      <ResponsiveContainer>
        <AreaChart data={this.state.cpuDataVm}>
          <YAxis
            domain={[0, 100]}
            tickFormatter={value => value + ' %'}
            hide={true}
          />
          <Area
            isAnimationActive={false}
            type='monotone'
            dataKey='cpu'
            stroke='#e6e600'
            fill='#e6e600'
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class VmMemoryGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
    format: 'LTS',
    maxMemory: 0,
    dataMemory: [],
  }
  componentDidMount() {
    setInterval(this.fetchStatsVm.bind(this), 5e3)
  }

  fetchStatsVm = () => {
    getObject(this.props.vmId).then((vm: any) => {
      this.setState({ maxMemory: vm.memory.dynamic[1] })
    })

    xoCall('vm.stats', {
      id: this.props.vmId,
      granularity: this.state.granularity,
    }).then(
      ({ endTimestamp, interval, stats: { memory, memoryFree = memory } }) => {
        let newDataMemory: any[] = []
        let dataMemory: any[] = []

        newDataMemory = memoryFree.map(
          (value: any, index: any) => memory[index] - value
        )

        for (var i = 0; i < NB_VALUES; i++) {
          const valuesMemory: any = {}
          valuesMemory.time =
            (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
          valuesMemory.memory = newDataMemory[i]
          dataMemory.push(valuesMemory)
        }
        this.setState({
          dataMemory,
        })
      }
    )
  }

  render() {
    return (
      <ResponsiveContainer>
        <AreaChart data={this.state.dataMemory}>
          <YAxis domain={[0, this.state.maxMemory]} hide={true} />
          <Area type='monotone' dataKey='memory' stroke='blue' fill='blue' />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class VmNetworkGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
  }

  render() {
    if (!this.props.data.values || !this.props.data.values[0]) {
      return null
    }
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data.values}>
          <YAxis domain={[0, Math.max(1024e2, this.props.max)]} hide={true} />
          {Object.keys(this.props.data.values[0])
            .filter(key => key !== 'time')
            .map((key: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke='#66ccff'
                fill='#66ccff'
                key={key}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class VmDiskGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
  }

  render() {
    if (!this.props.data.values || !this.props.data.values[0]) {
      return null
    }
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data.values}>
          <YAxis domain={[0, Math.max(1024e3, this.props.max)]} hide={true} />
          {Object.keys(this.props.data.values[0])
            .filter(key => key !== 'time')
            .map((key: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke='#006666'
                fill='#006666'
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class HostMemoryGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
    format: 'LTS',
    total: 0,
    dataMemory: [],
  }
  componentDidMount() {
    setInterval(this.fetchStatsHost.bind(this), 5e3)
  }

  fetchStatsHost = () => {
    getObject(this.props.hostId).then((host: any) => {
      this.setState({ total: host.memory.size })
    })
    xoCall('host.stats', {
      host: this.props.hostId,
      granularity: this.state.granularity,
    }).then(
      ({ endTimestamp, interval, stats: { memory, memoryFree = memory } }) => {
        let newDataMemory: any[] = []
        let dataMemory: any[] = []

        newDataMemory = memoryFree.map(
          (value: any, index: any) => memory[index] - value
        )

        for (var i = 0; i < NB_VALUES; i++) {
          const valuesMemory: any = {}
          valuesMemory.time =
            (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
          valuesMemory.memory = newDataMemory[i]
          dataMemory.push(valuesMemory)
        }
        this.setState({
          dataMemory,
        })
      }
    )
  }

  render() {
    return (
      <ResponsiveContainer>
        <AreaChart data={this.state.dataMemory}>
          <YAxis
            tickFormatter={value =>
              humanFormat(value, { scale: 'binary', unit: 'B' })
            }
            domain={[0, this.state.total]}
            hide={true}
          />
          <Area
            type='monotone'
            dataKey='memory'
            stroke='#006666'
            fill='#006666'
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class HostCpuGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
    cpusVm: [],
    cpuDataVm: [],
    dataCpu: [],
  }
  componentDidMount() {
    setInterval(this.fetchVmStats.bind(this), 5e3)
  }

  fetchVmStats = () => {
    xoCall('host.stats', {
      host: this.props.hostId,
      granularity: this.state.granularity,
    }).then(({ endTimestamp, stats: { cpus }, interval }) => {
      this.setState({ cpusVm: Object.keys(cpus) })
      let cpuDataVm: any[] = []
      const averageCpu: any[] = []
      for (var i = 0; i < NB_VALUES; i++) {
        averageCpu[i] = 0
        for (var j = 0; j < this.state.cpusVm.length; j++) {
          averageCpu[i] += cpus[j][i] / this.state.cpusVm.length
        }
      }

      for (var i = 0; i < NB_VALUES; i++) {
        let valuesCpus: any = {}
        valuesCpus.time = (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
        valuesCpus.cpu = averageCpu[i]
        cpuDataVm.push(valuesCpus)
      }

      this.setState({ cpuDataVm })
    })
  }
  render() {
    return (
      <ResponsiveContainer>
        <AreaChart data={this.state.cpuDataVm}>
          <YAxis
            domain={[0, 100]}
            tickFormatter={value => value + ' %'}
            hide={true}
          />
          <Area
            isAnimationActive={false}
            type='monotone'
            dataKey='cpu'
            stroke='#66ccff'
            fill='#66ccff'
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class HostNetworkGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
  }

  render() {
    if (!this.props.data.values || !this.props.data.values[0]) {
      return null
    }
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data.values}>
          <YAxis
            tickFormatter={value =>
              humanFormat(value, { scale: 'binary', unit: 'B' })
            }
            domain={[0, Math.max(1024e2, this.props.max)]}
            hide={true}
          />
          {Object.keys(this.props.data.values[0])
            .filter(key => key !== 'time')
            .map((key: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke='blue'
                fill='blue'
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class HostLoadGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
  }

  render() {
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data.values}>
          <YAxis domain={[0, Math.max(1, this.props.max)]} hide={true} />
          <Area
            isAnimationActive={false}
            type='monotone'
            dataKey='load'
            stroke='#e6e600'
            fill='#e6e600'
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class StorageThroughputGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
  }

  render() {
    if (!this.props.data.values || !this.props.data.values[0]) {
      return null
    }
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data.values}>
          <YAxis domain={[0, Math.max(1024e2, this.props.max)]} hide={true} />
          {Object.keys(this.props.data.values[0])
            .filter(key => key !== 'time')
            .map((key: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke='#e6e600'
                fill='#e6e600'
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class StorageIowaitGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
  }

  render() {
    if (!this.props.data.values || !this.props.data.values[0]) {
      return null
    }
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data.values}>
          <YAxis domain={[0, Math.max(5, this.props.max)]} hide={true} />
          {Object.keys(this.props.data.values[0])
            .filter(key => key !== 'time')
            .map((key: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke='blue'
                fill='blue'
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class StorageLatencyGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
  }

  render() {
    if (!this.props.data.values || !this.props.data.values[0]) {
      return null
    }
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data.values}>
          <YAxis domain={[0, Math.max(30, this.props.max)]} hide={true} />
          {Object.keys(this.props.data.values[0])
            .filter(key => key !== 'time')
            .map((key: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke='#66ccff'
                fill='#66ccff'
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class StorageIopsGraph extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
  }

  render() {
    if (!this.props.data.values || !this.props.data.values[0]) {
      return null
    }
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data.values}>
          <YAxis domain={[0, Math.max(40, this.props.max)]} hide={true} />
          {Object.keys(this.props.data.values[0])
            .filter(key => key !== 'time')
            .map((key: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke='#006666'
                fill='#006666'
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}
