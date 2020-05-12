import _ from 'intl'
import filter from 'lodash/filter'
import includes from 'lodash/includes'
import map from 'lodash/map'
import pFinally from 'promise-toolbox/finally'
import PropTypes from 'prop-types'
import React from 'react'

import ActionButton from './action-button'
import Component from './base-component'
import Icon from './icon'
import Tooltip from './tooltip'
import { confirm } from './modal'
import { SelectTag } from './select-objects'

const INPUT_STYLE = {
  maxWidth: '8em',
}
const TAG_STYLE = {
  backgroundColor: '#2598d9',
  borderRadius: '0.5em',
  color: 'white',
  fontSize: '0.6em',
  margin: '0.2em',
  marginTop: '-0.1em',
  padding: '0.3em',
  verticalAlign: 'middle',
}
const LINK_STYLE = {
  cursor: 'pointer',
}
const ADD_TAG_STYLE = {
  cursor: 'pointer',
  fontSize: '0.8em',
  marginLeft: '0.2em',
}
const REMOVE_TAG_STYLE = {
  cursor: 'pointer',
}

class SelectExistingTag extends Component {
  state = { tags: [] }

  get value() {
    return this.state.tags.map(_ => _.value)
  }

  render() {
    return (
      <SelectTag
        multi
        onChange={this.linkState('tags')}
        value={this.state.tags}
      />
    )
  }
}

export default class Tags extends Component {
  static propTypes = {
    labels: PropTypes.arrayOf(PropTypes.string).isRequired,
    onAdd: PropTypes.func,
    onChange: PropTypes.func,
    onClick: PropTypes.func,
    onDelete: PropTypes.func,
  }

  componentWillMount() {
    this.setState({ editing: false })
  }

  _startEdit = () => {
    this.setState({ editing: true })
  }
  _stopEdit = () => {
    this.setState({ editing: false })
  }

  _addTag = newTag => {
    const { labels, onAdd, onChange } = this.props

    if (!includes(labels, newTag)) {
      onAdd && onAdd(newTag)
      onChange && onChange([...labels, newTag])
    }
  }
  _deleteTag = tag => {
    const { onChange, onDelete } = this.props

    onDelete && onDelete(tag)
    onChange && onChange(filter(this.props.labels, t => t !== tag))
  }

  _onKeyDown = event => {
    const { keyCode, target } = event

    if (keyCode === 13) {
      if (target.value) {
        this._addTag(target.value)
        target.value = ''
      }
    } else if (keyCode === 27) {
      this._stopEdit()
    } else {
      return
    }

    event.preventDefault()
  }

  _selectExistingTags = () =>
    confirm({
      body: <SelectExistingTag />,
      icon: 'add',
      title: _('selectExistingTags'),
    })
      ::pFinally(this._stopEdit)
      .then(tags => Promise.all(tags.map(this._addTag)))

  _closeEditionIfUnfocused = () => {
    if (this._canBlur) {
      this._stopEdit()
    }
  }

  _onMouseDown = () => {
    this._canBlur = false
  }

  _onMouseUp = () => {
    this._canBlur = true
  }

  render() {
    const { labels, onAdd, onChange, onClick, onDelete } = this.props

    const deleteTag = (onDelete || onChange) && this._deleteTag

    return (
      <span className='form-group' style={{ color: '#999' }}>
        <Icon icon='tags' />{' '}
        <span>
          {map(labels.sort(), (label, index) => (
            <Tag
              label={label}
              onDelete={deleteTag}
              key={index}
              onClick={onClick}
            />
          ))}
        </span>
        {(onAdd || onChange) && !this.state.editing ? (
          <span onClick={this._startEdit} style={ADD_TAG_STYLE}>
            <Icon icon='add-tag' />
          </span>
        ) : (
          <span
            className='form-inline'
            onBlur={this._closeEditionIfUnfocused}
            onMouseDown={this._onMouseDown}
            onMouseUp={this._onMouseUp}
          >
            <span className='input-group'>
              <input
                autoFocus
                className='form-control'
                onKeyDown={this._onKeyDown}
                style={INPUT_STYLE}
                type='text'
              />
              <span className='input-group-btn'>
                <Tooltip content={_('selectExistingTags')}>
                  <ActionButton handler={this._selectExistingTags} icon='add' />
                </Tooltip>
              </span>
            </span>
          </span>
        )}
      </span>
    )
  }
}

export const Tag = ({ type, label, onDelete, onClick }) => (
  <span style={TAG_STYLE}>
    <span
      onClick={onClick && (() => onClick(label))}
      style={onClick && LINK_STYLE}
    >
      {label}
    </span>{' '}
    {onDelete ? (
      <span
        onClick={onDelete && (() => onDelete(label))}
        style={REMOVE_TAG_STYLE}
      >
        <Icon icon='remove-tag' />
      </span>
    ) : (
      []
    )}
  </span>
)
Tag.propTypes = {
  label: PropTypes.string.isRequired,
}
