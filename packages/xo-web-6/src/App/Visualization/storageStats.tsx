import React, { Component } from 'react'
import { xoCall } from './utils'
import moment from 'moment'
import {
  SrIoWaitGraph,
  SrLatencyGraph,
  SrIoThroughputGraph,
  SrIopsGraph,
} from './stats'

const NB_VALUES = 118

export default class Visualization extends Component<any, any> {
  state: any = {
    granularity: 'seconds',
    format: 'LTS',

    //  SR
    //  IOPS
    srIopsData: [],
    srIopsIntervalMin: 40,
    srIops: [],
    srIopsMax: 0,

    //  IO Throughput
    srIoThroughputData: [],
    srIoThroughputs: [],
    srIoThroughputMax: 0,
    srIoIntervalMin: 1024e2,

    //  Latency
    srLatencyData: [],
    srLatency: [],
    srLatencyMax: 0,
    srLatencyIntervalMin: 30,

    //  IOwait
    srIowaitData: [],
    srIowait: [],
    srIowaitMax: 0,
    srIowaitIntervalMin: 5,
    syncId: 'a5954951-3dfa-42b8-803f-4bc270b22a0b',
  }

  componentDidMount() {
    setInterval(this.fetchSrStats.bind(this), 5e3)
  }

  fetchSrStats = () => {
    xoCall('sr.stats', {
      id: 'a5954951-3dfa-42b8-803f-4bc270b22a0b',
      granularity: this.state.granularity,
    }).then(
      ({
        endTimestamp,
        stats: { iops },
        interval,
        stats: { latency },
        stats: { iowait },
        stats: { ioThroughput },
      }) => {
        let format: any
        if (interval === 5 || interval === 60) {
          format = 'LTS'
        } else if (interval === 86400 || interval === 3600) {
          format = 'l'
        }

        this.setState({
          srIops: Object.keys(iops),
          srIoThroughputs: Object.keys(ioThroughput),
          srLatency: Object.keys(latency),
          srIowait: Object.keys(iowait),
        })

        const srIopsData: any[] = []
        const srIoThroughputData: any[] = []
        const srLatencyData: any[] = []
        const srIowaitData: any[] = []

        for (var i = 0; i < NB_VALUES; i++) {
          const srIopsValues: any = {}
          const srThroValues: any = {}
          const srLatencyValues: any = {}
          const srIowaitValues: any = {}

          srIopsValues.time = moment(
            (endTimestamp - (NB_VALUES - i - 1) * interval) * 1000
          ).format(format)

          this.state.srIops.forEach((property: string | number) => {
            srIopsValues[`iops_${property}`] = iops[property][i]
          })

          this.state.srIoThroughputs.forEach((property: string | number) => {
            srThroValues[`thr_${property}`] = ioThroughput[property][i]
          })

          this.state.srLatency.forEach((property: string | number) => {
            srLatencyValues[`latency_${property}`] = latency[property][i]
          })

          this.state.srIowait.forEach((property: string | number) => {
            srIowaitValues[`iowait_${property}`] = iowait[property][i]
          })

          srLatencyValues.time = srIopsValues.time
          srThroValues.time = srIopsValues.time
          srIowaitValues.time = srIopsValues.time

          srIopsData.push(srIopsValues)
          srIoThroughputData.push(srThroValues)
          srLatencyData.push(srLatencyValues)
          srIowaitData.push(srIowaitValues)
        }

        this.state.srLatency.forEach((property: string | number) => {
          this.setState({ srLatencyMax: Math.max(...latency[property]) })
        })

        this.state.srIops.forEach((property: string | number) => {
          this.setState({ srIopsMax: Math.max(...iops[property]) })
        })

        this.state.srIowait.forEach((property: string | number) => {
          this.setState({ srIowaitMax: Math.max(...iowait[property]) })
        })

        this.state.srIoThroughputs.forEach((property: string | number) => {
          this.setState({
            srIoThroughputMax: Math.max(...ioThroughput[property]),
          })
        })
        this.setState({
          srIopsData,
          srIoThroughputData,
          srLatencyData,
          srIowaitData,
        })
      }
    )
  }

  setGranularity = (event: any) => {
    this.setState({ granularity: event.target.value }, () => {
      this.fetchSrStats()
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
        <h3>IOPS</h3>
        <div style={{ width: '500px', height: '300px' }}>
          <SrIopsGraph
            data={this.state.srIopsData}
            threshold={this.state.srIopsIntervalMin}
            syncId={this.state.syncId}
          />
        </div>
        <br />
        <h3>IO throughput </h3>
        <div style={{ width: '500px', height: '300px' }}>
          <SrIoThroughputGraph
            data={this.state.srIoThroughputData}
            threshold={this.state.srIoIntervalMin}
            syncId={this.state.syncId}
          />
        </div>
        <br />
        <h3> Latency </h3>
        <div style={{ width: '500px', height: '300px' }}>
          <SrLatencyGraph
            data={this.state.srLatencyData}
            threshold={this.state.srLatencyIntervalMin}
            syncId={this.state.syncId}
          />
        </div>
        <br />
        <h3>IOwait</h3>
        <div style={{ width: '500px', height: '300px' }}>
          <SrIoWaitGraph
            data={this.state.srIowaitData}
            threshold={this.state.srIowaitIntervalMin}
            syncId={this.state.syncId}
          />
        </div>
      </div>
    )
  }
}
