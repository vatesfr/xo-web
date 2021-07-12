import classNames from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'
import ReactDOM from 'react-dom'

import Component from '../base-component'
import getPosition from './get-position'

import styles from './index.css'

// ===================================================================

let instance

export class TooltipViewer extends Component {
  constructor() {
    super()

    this.state.place = 'top'
  }

  componentDidMount() {
    if (instance) {
      throw new Error('Tooltip viewer is a singleton!')
    }
    instance = this
  }

  componentWillUnmount() {
    instance = undefined
  }

  render() {
    const { className, content, place, show, style } = this.state

    return (
      <div
        className={classNames(
          show && content !== undefined ? styles.tooltipEnabled : styles.tooltipDisabled,
          className
        )}
        style={{
          marginTop: (place === 'top' && '-10px') || (place === 'bottom' && '10px'),
          marginLeft: (place === 'left' && '-10px') || (place === 'right' && '10px'),
          ...style,
        }}
      >
        {content}
      </div>
    )
  }
}

// ===================================================================

export default class Tooltip extends Component {
  static propTypes = {
    children: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
    className: PropTypes.string,
    content: PropTypes.node,
    style: PropTypes.object,
    tagName: PropTypes.string,
  }

  componentDidMount() {
    this._addListeners()
  }

  componentWillUnmount() {
    this._removeListeners()
  }

  _addListeners() {
    const node = (this._node = ReactDOM.findDOMNode(this))

    // 2020-06-15: Use pointer events instead of mouse events to workaround
    // Chrome not firing any mouse event on disabled inputs. Pointer events
    // should be correctly fired on most browsers and are similar to mouse
    // events on mouse-controlled devices.
    // https://github.com/reach/reach-ui/issues/564#issuecomment-620502842
    // https://caniuse.com/#feat=mdn-api_pointerevent
    node.addEventListener('pointerenter', this._showTooltip)
    node.addEventListener('pointerleave', this._hideTooltip)
    node.addEventListener('pointermove', this._updateTooltip)
  }

  _removeListeners() {
    const node = this._node
    this._hideTooltip()

    if (!node) {
      return
    }

    node.removeEventListener('pointerenter', this._showTooltip)
    node.removeEventListener('pointerleave', this._hideTooltip)
    node.removeEventListener('pointermove', this._updateTooltip)

    this._node = null
  }

  _showTooltip = event => {
    const { props } = this

    instance.setState(
      {
        className: props.className,
        content: props.content,
        show: true,
        style: props.style,
      },
      () => this._updateTooltip(event)
    )
  }

  _hideTooltip = () => {
    instance.setState({ show: false })
  }

  _updateTooltip = event => {
    const node = ReactDOM.findDOMNode(instance)
    const result = getPosition(event, event.currentTarget, node, instance.state.place, 'solid', {})

    if (result.isNewState) {
      return instance.setState(result.newState, () => this._updateTooltip(event))
    }

    const { position } = result
    node.style.left = `${position.left}px`
    node.style.top = `${position.top}px`
  }

  render() {
    const { children } = this.props

    if (!children) {
      return <span />
    }

    if (typeof children === 'string') {
      return <span>{children}</span>
    }

    return children
  }
}

// ===================================================================

export const conditionalTooltip = (children, tooltip) =>
  tooltip !== undefined && tooltip !== '' ? <Tooltip content={tooltip}>{children}</Tooltip> : children
