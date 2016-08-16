import _ from 'intl'
import Component from 'base-component'
import CopyToClipboard from 'react-copy-to-clipboard'
import debounce from 'lodash/debounce'
import Icon from 'icon'
import invoke from 'invoke'
import IsoDevice from 'iso-device'
import NoVnc from 'react-novnc'
import React from 'react'
import { Button } from 'react-bootstrap-4/lib'
import { resolveUrl } from 'xo'
import { Container, Row, Col } from 'grid'
import { Range } from 'form'
import {
  CpuSparkLines,
  MemorySparkLines,
  VifSparkLines,
  XvdSparkLines
} from 'xo-sparklines'

export default class TabConsole extends Component {
  _sendCtrlAltDel = () => {
    this.refs.noVnc.sendCtrlAltDel()
  }

  _getRemoteClipboard = clipboard => {
    this.setState({ clipboard })
    this.refs.clipboard.value = clipboard
  }
  _setRemoteClipboard = invoke(() => {
    const setRemoteClipboard = debounce(value => {
      this.setState({ clipboard: value })
      this.refs.noVnc.setClipboard(value)
    }, 200)
    return event => setRemoteClipboard(event.target.value)
  })

  _getClipboardContent = () =>
    this.refs.clipboard && this.refs.clipboard.value

  _toggleMinimalLayout = () => {
    this.props.toggleHeader()
    this.setState({ minimalLayout: !this.state.minimalLayout })
  }

  _handleResize = scale =>
    this.setState({ scale })

  render () {
    const {
      statsOverview,
      vm
    } = this.props
    const {
      minimalLayout,
      scale
    } = this.state

    if (vm.power_state !== 'Running') {
      return (
        <p>Console is only available for running VMs.</p>
      )
    }

    return (
      <Container>
        {!minimalLayout && statsOverview && <Row className='text-xs-center'>
          <Col mediumSize={3}>
            <p>
              <Icon icon='cpu' size={2} />
              {' '}
              <CpuSparkLines data={statsOverview} />
            </p>
          </Col>
          <Col mediumSize={3}>
            <p>
              <Icon icon='memory' size={2} />
              {' '}
              <MemorySparkLines data={statsOverview} />
            </p>
          </Col>
          <Col mediumSize={3}>
            <p>
              <Icon icon='network' size={2} />
              {' '}
              <VifSparkLines data={statsOverview} />
            </p>
          </Col>
          <Col mediumSize={3}>
            <p>
              <Icon icon='disk' size={2} />
              {' '}
              <XvdSparkLines data={statsOverview} />
            </p>
          </Col>
        </Row>}
        <Row>
          <Col mediumSize={3}>
            <IsoDevice vm={vm} />
          </Col>
          <Col mediumSize={3}>
            <div className='input-group'>
              <input type='text' className='form-control' ref='clipboard' onChange={this._setRemoteClipboard} />
              <span className='input-group-btn'>
                <CopyToClipboard text={this.state.clipboard || ''}>
                  <button className='btn btn-secondary'>
                    <Icon icon='clipboard' /> {_('copyToClipboardLabel')}
                  </button>
                </CopyToClipboard>
              </span>
            </div>
          </Col>
          <Col mediumSize={2}>
            <button
              className='btn btn-secondary'
              onClick={this._sendCtrlAltDel}
            >
              <Icon icon='vm-keyboard' /> {_('ctrlAltDelButtonLabel')}
            </button>
          </Col>
          <Col mediumSize={3}>
            <Range
              min={0.1}
              max={3}
              defaultValue={1}
              onChange={this._handleResize}
              step={0.1}
            />
          </Col>
          <Col mediumSize={1}>
            <Button bsStyle='secondary' onClick={this._toggleMinimalLayout}>
              <Icon icon={this.state.minimalLayout ? 'caret' : 'caret-up'} />
            </Button>
          </Col>
        </Row>
        <Row className='console'>
          <Col>
            <NoVnc
              onClipboardChange={this._getRemoteClipboard}
              ref='noVnc'
              scale={scale}
              url={resolveUrl(`consoles/${vm.id}`)}
            />
            {!minimalLayout && <p><em><Icon icon='info' /> {_('tipLabel')} {_('tipConsoleLabel')}</em></p>}
          </Col>
        </Row>
      </Container>
    )
  }
}
