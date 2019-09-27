import React, { Component } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import humanFormat from 'human-format'

export class VmHostCpuUsageGraph extends Component<any, any> {
  render() {
    return (
      <ResponsiveContainer>
        <BarChart data={this.props.data}>
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis dataKey='name1' />
          <YAxis
            label={{
              value: 'number of CPUs',
              angle: -90,
              position: 'insideEnd',
              textAnchor: 'middle',
            }}
          />
          <Tooltip />
          <Legend />
          <Bar dataKey='UsedvCPUs' stackId='a' fill='#4a2e8a' />
          <Bar dataKey='CPUsTotal' stackId='a' fill='#7dc1df' />
        </BarChart>
      </ResponsiveContainer>
    )
  }
}

let renderLabel = function(entry: any) {
  const global = entry.name + ': ' + humanFormat(entry.value)
  return global
}

const COLORS = ['#4a2e8a', '#7dc1df']

export class VmPowerStateGraph extends Component<any, any> {
  render() {
    return (
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={this.props.data}
            cx={200}
            cy={200}
            labelLine={true}
            label={renderLabel}
            outerRadius={70}
            innerRadius={30}
            dataKey='value'
            nameKey='name'
          >
            <Cell key={`cell-${0}`} fill={COLORS[0]} />
            <Cell key={`cell-${1}`} fill={COLORS[1]} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    )
  }
}

export class HostRamUsageGraph extends Component<any, any> {
  render() {
    return (
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={this.props.data}
            cx={200}
            cy={200}
            outerRadius={70}
            innerRadius={30}
            dataKey='value'
            nameKey='name'
          >
            <Cell key={`cell-${0}`} fill={COLORS[0]} />
            <Cell key={`cell-${1}`} fill={COLORS[1]} />
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }
}

export class StorageUsageGraph extends Component<any, any> {
  render() {
    return (
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={this.props.data}
            cx={200}
            cy={200}
            outerRadius={70}
            innerRadius={30}
            dataKey='value'
            nameKey='name'
          >
            <Cell key={`cell-${0}`} fill={COLORS[0]} />
            <Cell key={`cell-${1}`} fill={COLORS[1]} />
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }
}
