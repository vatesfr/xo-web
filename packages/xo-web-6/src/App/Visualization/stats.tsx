import React, { Component } from 'react'
import {
  XAxis,
  YAxis,
  AreaChart,
  Tooltip,
  Legend,
  Area,
  Brush,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'

import allColors from './_colors'
import humanFormat from 'human-format'

const AXIS_STYLE = { fontSize: '0.7em' }

export class HostCpuGraph extends Component<any, any> {
  state = {
    hostCpuStartIndex: 0,
    hostCpuEndIndex: 0,
  }

  handleHostCpuZoomChange = (res: any) => {
    this.setState({
      hostCpuStartIndex: res.startIndex,
      hostCpuEndIndex: res.endIndex,
    })
  }

  render() {
    if (!this.props.data || !this.props.data[0]) {
      return null
    }
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            domain={[0, 100]}
            tick={AXIS_STYLE}
            tickFormatter={value => value + '%'}
          />
          <Tooltip />
          <Brush
            onChange={this.handleHostCpuZoomChange}
            startIndex={this.state.hostCpuStartIndex}
            endIndex={this.state.hostCpuEndIndex}
          >
            <AreaChart data={this.props.data}>
              {Object.keys(this.props.data[0])
                .filter(key => key !== 'time')
                .map((key: any, index: any) => (
                  <Area
                    isAnimationActive={false}
                    type='monotone'
                    dataKey={key}
                    stroke={allColors[index]}
                    fill={allColors[index]}
                    key={key}
                  />
                ))}
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          {Object.keys(this.props.data[0])
            .filter(key => key !== 'time')
            .map((key: any, index: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke={allColors[index]}
                fill={allColors[index]}
                key={key}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class HostLoadGraph extends Component<any, any> {
  state = {
    startIndexLoadHost: 0,
    endIndexLoadHost: 0,
  }

  static defaultProps = {
    threshold: 1,
  }

  handleHostLoadZoomChange = (res: any) => {
    this.setState({
      startIndexLoadHost: res.startIndex,
      endIndexLoadHost: res.endIndex,
    })
  }

  render() {
    const loadValues = this.props.data.map((data: any) => {
      const dataKeys = Object.keys(data)
      const key: any = dataKeys.find(key => key.startsWith('load'))
      return data[key]
    })
    const maxLoadValues = Math.max(...loadValues)
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            tick={AXIS_STYLE}
            domain={[0, Math.max(this.props.threshold, maxLoadValues)]}
          />
          <Tooltip />
          <Brush
            onChange={this.handleHostLoadZoomChange}
            startIndex={this.state.startIndexLoadHost}
            endIndex={this.state.endIndexLoadHost}
          >
            <AreaChart data={this.props.data}>
              <Area
                type='monotone'
                dataKey='load'
                stroke='#493BD8'
                fill='#493BD8'
              />
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          <Area
            type='monotone'
            dataKey='load'
            stroke='#493BD8'
            fill='#493BD8'
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class HostMemoryGraph extends Component<any, any> {
  state = {
    startIndexMemoryHost: 0,
    endIndexMemoryHost: 0,
  }

  handleHostMemoryZoomChange = (res: any) => {
    this.setState({
      startIndexMemoryHost: res.startIndex,
      endIndexMemoryHost: res.endIndex,
    })
  }

  render() {
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            tick={AXIS_STYLE}
            tickFormatter={value =>
              humanFormat(value, { scale: 'binary', unit: 'B' })
            }
            domain={[0, this.props.total]}
          />
          <Tooltip />
          <Brush
            onChange={this.handleHostMemoryZoomChange}
            startIndex={this.state.startIndexMemoryHost}
            endIndex={this.state.endIndexMemoryHost}
          >
            <AreaChart data={this.props.data}>
              <Area
                type='monotone'
                dataKey='memory'
                stroke='#493BD8'
                fill='#493BD8'
              />
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          <Area
            type='monotone'
            dataKey='memory'
            stroke='#493BD8'
            fill='#493BD8'
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class HostNetworkGraph extends Component<any, any> {
  state = {
    startIndexNetworkHost: 0,
    endIndexNetworkHost: 0,
  }

  static defaultProps = {
    threshold: 1024e2,
  }

  handleHostNetworkZoomChange = (res: any) => {
    this.setState({
      startIndexNetworkHost: res.startIndex,
      endIndexNetworkHost: res.endIndex,
    })
  }

  render() {
    if (!this.props.data || !this.props.data[0]) {
      return null
    }

    const networkValues = this.props.data.map((data: any) => {
      const dataKeys = Object.keys(data)
      const key: any = dataKeys.find(key => key.startsWith('pifs'))
      return data[key]
    })
    const maxNetworkValues = Math.max(...networkValues)

    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            tick={AXIS_STYLE}
            tickFormatter={value =>
              humanFormat(value, { scale: 'binary', unit: 'B' })
            }
            domain={[0, Math.max(this.props.threshold, maxNetworkValues)]}
          />
          <Tooltip />
          <Brush
            onChange={this.handleHostNetworkZoomChange}
            startIndex={this.state.startIndexNetworkHost}
            endIndex={this.state.endIndexNetworkHost}
          >
            <AreaChart data={this.props.data}>
              {Object.keys(this.props.data[0])
                .filter(key => key !== 'time')
                .map((key: any, index: any) => (
                  <Area
                    isAnimationActive={false}
                    type='monotone'
                    dataKey={key}
                    stroke={allColors[index]}
                    fill={allColors[index]}
                    key={key}
                  />
                ))}
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          {Object.keys(this.props.data[0])
            .filter(key => key !== 'time')
            .map((key: any, index: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke={allColors[index]}
                fill={allColors[index]}
                key={key}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class SrIopsGraph extends Component<any, any> {
  state: any = {
    startIndexIopsSR: 0,
    endIndexIopsSR: 0,
  }

  static defaultProps = {
    threshold: 40,
  }

  handleSrIopsZoomChange = (res: any) => {
    this.setState({
      startIndexIopsSR: res.startIndex,
      endIndexIopsSR: res.endIndex,
    })
  }

  render() {
    if (!this.props.data || !this.props.data[0]) {
      return null
    }
    const iopsValues = this.props.data.map((data: any) => {
      const dataKeys = Object.keys(data)
      const key: any = dataKeys.find(key => key.startsWith('iops'))
      return data[key]
    })
    const maxIopsValues = Math.max(...iopsValues)
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            tick={AXIS_STYLE}
            tickFormatter={value => value + ' IOPS'}
            domain={[0, Math.max(this.props.threshold, maxIopsValues)]}
          />
          <Tooltip />
          <Brush
            onChange={this.handleSrIopsZoomChange}
            startIndex={this.state.startIndexIopsSR}
            endIndex={this.state.endIndexIopsSR}
          >
            <AreaChart data={this.props.data}>
              {Object.keys(this.props.data[0])
                .filter(key => key !== 'time')
                .map((key: any, index: any) => (
                  <Area
                    isAnimationActive={false}
                    type='monotone'
                    dataKey={key}
                    stroke={allColors[index]}
                    fill={allColors[index]}
                    key={key}
                  />
                ))}
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          {Object.keys(this.props.data[0])
            .filter(key => key !== 'time')
            .map((key: any, index: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke={allColors[index]}
                fill={allColors[index]}
                key={key}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class SrIoThroughputGraph extends Component<any, any> {
  state: any = {
    startIndexIOSR: 0,
    endIndexIOSR: 0,
  }

  static defaultProps = {
    threshold: 1024e2,
  }

  handleSrIOZoomChange = (res: any) => {
    this.setState({
      startIndexIOSR: res.startIndex,
      endIndexIOSR: res.endIndex,
    })
  }

  render() {
    if (!this.props.data || !this.props.data[0]) {
      return null
    }

    const ioThroughputValues = this.props.data.map((data: any) => {
      const dataKeys = Object.keys(data)
      const key: any = dataKeys.find(key => key.startsWith('thr'))
      return data[key]
    })
    const maxIoThroughputValues = Math.max(...ioThroughputValues)

    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            tick={AXIS_STYLE}
            tickFormatter={value =>
              humanFormat(value, { scale: 'binary', unit: 'B' })
            }
            domain={[0, Math.max(this.props.threshold, maxIoThroughputValues)]}
          />
          <Tooltip />
          <Brush
            onChange={this.handleSrIOZoomChange}
            startIndex={this.state.startIndexIOSR}
            endIndex={this.state.endIndexIOSR}
          >
            <AreaChart data={this.props.data}>
              {Object.keys(this.props.data[0])
                .filter(key => key !== 'time')
                .map((key: any, index: any) => (
                  <Area
                    isAnimationActive={false}
                    type='monotone'
                    dataKey={key}
                    stroke={allColors[index]}
                    fill={allColors[index]}
                    key={key}
                  />
                ))}
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          {Object.keys(this.props.data[0])
            .filter(key => key !== 'time')
            .map((key: any, index: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke={allColors[index]}
                fill={allColors[index]}
                key={key}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class SrLatencyGraph extends Component<any, any> {
  state: any = {
    startIndexLatencySR: 0,
    endIndexLatencySR: 0,
  }

  static defaultProps = {
    threshold: 50,
  }
  handleSrLatencyZoomChange = (res: any) => {
    this.setState({
      startIndexLatencySR: res.startIndex,
      endIndexLatencySR: res.endIndex,
    })
  }

  render() {
    if (!this.props.data || !this.props.data[0]) {
      return null
    }
    const latencyValues = this.props.data.map((data: any) => {
      const dataKeys = Object.keys(data)
      const key: any = dataKeys.find(key => key.startsWith('latency'))
      return data[key]
    })
    const maxLatencyValues = Math.max(...latencyValues)

    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            tick={AXIS_STYLE}
            tickFormatter={value => value + ' ms'}
            domain={[0, Math.max(this.props.threshold, maxLatencyValues)]}
          />
          <Tooltip />
          <Brush
            onChange={this.handleSrLatencyZoomChange}
            startIndex={this.state.startIndexLatencySR}
            endIndex={this.state.endIndexLatencySR}
          >
            <AreaChart data={this.props.data}>
              {Object.keys(this.props.data[0])
                .filter(key => key !== 'time')
                .map((key: any, index: any) => (
                  <Area
                    isAnimationActive={false}
                    type='monotone'
                    dataKey={key}
                    stroke={allColors[index]}
                    fill={allColors[index]}
                    key={key}
                  />
                ))}
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          {Object.keys(this.props.data[0])
            .filter(key => key !== 'time')
            .map((key: any, index: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke={allColors[index]}
                fill={allColors[index]}
                key={key}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class SrIoWaitGraph extends Component<any, any> {
  state: any = {
    startIndexIOwaitSR: 0,
    endIndexIOwaitSR: 0,
  }

  handleSrIowaitZoomChange = (res: any) => {
    this.setState({
      startIndexIOwaitSR: res.startIndex,
      endIndexIOwaitSR: res.endIndex,
    })
  }
  static defaultProps = {
    threshold: 5,
  }
  render() {
    if (!this.props.data || !this.props.data[0]) {
      return null
    }

    const ioWaitValues = this.props.data.map((data: any) => {
      const dataKeys = Object.keys(data)
      const key: any = dataKeys.find(key => key.startsWith('iowait'))
      return data[key]
    })
    const maxIoWaitValues = Math.max(...ioWaitValues)
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            tick={AXIS_STYLE}
            tickFormatter={value => value + ' %'}
            domain={[0, Math.max(this.props.threshold, maxIoWaitValues)]}
          />
          <Tooltip />
          <Brush
            onChange={this.handleSrIowaitZoomChange}
            startIndex={this.state.startIndexIOwaitSR}
            endIndex={this.state.endIndexIOwaitSR}
          >
            <AreaChart data={this.props.data}>
              {Object.keys(this.props.data[0])
                .filter(key => key !== 'time')
                .map((key: any, index: any) => (
                  <Area
                    isAnimationActive={false}
                    type='monotone'
                    dataKey={key}
                    stroke={allColors[index]}
                    fill={allColors[index]}
                    key={key}
                  />
                ))}
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          {Object.keys(this.props.data[0])
            .filter(key => key !== 'time')
            .map((key: any, index: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke={allColors[index]}
                fill={allColors[index]}
                key={key}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class VmCpuGraph extends Component<any, any> {
  state: any = {
    vmCpuStartIndex: 0,
    vmCpuEndIndex: 0,
  }

  handleVmCpuZoomChange = (res: any) => {
    this.setState({
      vmCpuStartIndex: res.startIndex,
      vmCpuEndIndex: res.endIndex,
    })
  }

  render() {
    if (!this.props.data || !this.props.data[0]) {
      return null
    }
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            domain={[0, 100]}
            tick={AXIS_STYLE}
            tickFormatter={value => value + ' %'}
          />
          <Tooltip />
          <Brush
            onChange={this.handleVmCpuZoomChange}
            startIndex={this.state.vmCpuStartIndex}
            endIndex={this.state.vmCpuEndIndex}
          >
            <AreaChart data={this.props.data}>
              {Object.keys(this.props.data[0])
                .filter(key => key !== 'time')
                .map((key: string, index: any) => (
                  <Area
                    isAnimationActive={false}
                    type='monotone'
                    dataKey={key}
                    stroke={allColors[index]}
                    fill={allColors[index]}
                    key={key}
                  />
                ))}
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          {Object.keys(this.props.data[0])
            .filter(key => key !== 'time')
            .map((key: any, index: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke={allColors[index]}
                fill={allColors[index]}
                key={key}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class VmMemoryGraph extends Component<any, any> {
  state: any = {
    startIndexMemoryVm: 0,
    endIndexMemoryVm: 0,
  }

  handleVmMemoryZoomChange = (res: any) => {
    this.setState({
      startIndexMemoryVm: res.startIndex,
      endIndexMemoryVm: res.endIndex,
    })
  }

  render() {
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            tick={AXIS_STYLE}
            tickFormatter={value =>
              humanFormat(value, { scale: 'binary', unit: 'B' })
            }
            domain={[0, this.props.total]}
          />
          <Tooltip />
          <Brush
            onChange={this.handleVmMemoryZoomChange}
            startIndex={this.state.startIndexMemoryVm}
            endIndex={this.state.endIndexMemoryVm}
          >
            <AreaChart data={this.props.data}>
              <Area
                type='monotone'
                dataKey='memory'
                stroke='#493BD8'
                fill='#493BD8'
              />
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          <Area
            type='monotone'
            dataKey='memory'
            stroke='#493BD8'
            fill='#493BD8'
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}

export class VmNetworkGraph extends Component<any, any> {
  state: any = {
    startIndexNetworkVm: 0,
    endIndexNetworkVm: 0,
  }
  static defaultProps = {
    threshold: 1024e2,
  }
  handleVmNetworkZoomChange = (res: any) => {
    this.setState({
      startIndexNetworkVm: res.startIndex,
      endIndexNetworkVm: res.endIndex,
    })
  }

  render() {
    if (!this.props.data || !this.props.data[0]) {
      return null
    }

    const networkValues = this.props.data.map((data: any) => {
      const dataKeys = Object.keys(data)
      const key: any = dataKeys.find(key => key.startsWith('vifs'))
      return data[key]
    })
    const maxNetwork = Math.max(...networkValues)
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            tick={AXIS_STYLE}
            tickFormatter={value =>
              humanFormat(value, { scale: 'binary', unit: 'B' })
            }
            domain={[0, Math.max(this.props.threshold, maxNetwork)]}
          />
          <Tooltip />
          <Brush
            onChange={this.handleVmNetworkZoomChange}
            startIndex={this.state.startIndexNetworkVm}
            endIndex={this.state.endIndexNetworkVm}
          >
            <AreaChart data={this.props.data}>
              {Object.keys(this.props.data[0])
                .filter(key => key !== 'time')
                .map((key: any, index: any) => (
                  <Area
                    isAnimationActive={false}
                    type='monotone'
                    dataKey={key}
                    stroke={allColors[index]}
                    fill={allColors[index]}
                    key={key}
                  />
                ))}
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          {Object.keys(this.props.data[0])
            .filter(key => key !== 'time')
            .map((key: any, index: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke={allColors[index]}
                fill={allColors[index]}
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
    startIndexDiskVm: 0,
    endIndexDiskVm: 0,
  }

  static defaultProps = {
    threshold: 1024e3,
  }

  handleVMDiskZoomChange = (res: any) => {
    this.setState({
      startIndexDiskVm: res.startIndex,
      endIndexDiskVm: res.endIndex,
    })
  }

  render() {
    if (!this.props.data || !this.props.data[0]) {
      return null
    }
    const diskValues = this.props.data.map((data: any) => {
      const dataKeys = Object.keys(data)
      const key: any = dataKeys.find(key => key.startsWith('xvds'))
      return data[key]
    })
    const maxDiskValues = Math.max(...diskValues)
    return (
      <ResponsiveContainer>
        <AreaChart data={this.props.data} syncId={this.props.syncId}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='time' tick={AXIS_STYLE} />
          <YAxis
            tick={AXIS_STYLE}
            tickFormatter={value =>
              humanFormat(value, { scale: 'binary', unit: 'B' })
            }
            domain={[0, Math.max(this.props.threshold, maxDiskValues)]}
          />
          <Tooltip />
          <Brush
            onChange={this.handleVMDiskZoomChange}
            startIndex={this.state.startIndexDiskVm}
            endIndex={this.state.endIndexDiskVm}
          >
            <AreaChart data={this.props.data}>
              {Object.keys(this.props.data[0])
                .filter(key => key !== 'time')
                .map((key: any, index: any) => (
                  <Area
                    isAnimationActive={false}
                    type='monotone'
                    dataKey={key}
                    stroke={allColors[index]}
                    fill={allColors[index]}
                    key={key}
                  />
                ))}
            </AreaChart>
          </Brush>
          <Legend iconType='rect' iconSize={18} />
          {Object.keys(this.props.data[0])
            .filter(key => key !== 'time')
            .map((key: any, index: any) => (
              <Area
                isAnimationActive={false}
                type='monotone'
                dataKey={key}
                stroke={allColors[index]}
                fill={allColors[index]}
                key={key}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }
}
