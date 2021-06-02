import React from 'react'
import styled from 'styled-components'
import { withState } from 'reaclette'
import { IconName } from '@fortawesome/fontawesome-svg-core'

import Icon from './Icon'

interface ParentState {}

interface State {
  isNodeOpened: boolean
  selectedNodeId: string | undefined
}

interface Props {
  icon?: IconName
  id: string
  label: string
  children?: React.ReactNode
}

interface ParentEffects {}

interface Effects {
  setSelectedNodeId: (id: string) => void
  openNode: (id: string) => void
}

interface Computed {}

const StyledUl = styled.ul`
  list-style-type: none;
  li: {
    cursor: pointer;
    width: fit-content;
  }
`

const TreeItem = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    initialState: () => ({
      selectedNodeId: undefined,
      isNodeOpened: undefined,
    }),
    effects: {
      setSelectedNodeId: function (id) {
        if (this.state.selectedNodeId === undefined) {
          this.state.selectedNodeId = id
          return
        }
        this.state.selectedNodeId = undefined
      },
      openNode: function (id) {
        this.effects.setSelectedNodeId(id)
        this.state.isNodeOpened = this.state.selectedNodeId === id
      },
    },
  },
  ({ effects, icon, id, label, children, state: { isNodeOpened } }) =>
    React.Children.count(children) > 0 ? (
      <StyledUl key={id}>
        <li onClick={() => effects.openNode(id)}>
          <Icon icon={`chevron-${isNodeOpened ? 'down' : 'right'}`} size='sm' />{' '}
          {icon !== undefined && <Icon icon={icon} />} {label}
        </li>
        {isNodeOpened &&
          React.Children.map(children, child => {
            if (child == null) {
              return child
            }
            const { icon, id, label, children } = child.props
            return (
              <StyledUl key={id}>
                {children !== undefined ? (
                  <TreeItem id={id} label={label} icon={icon}>
                    {children}
                  </TreeItem>
                ) : (
                  <li>{label}</li>
                )}
              </StyledUl>
            )
          })}
      </StyledUl>
    ) : (
      <li>{label}</li>
    )
)

export default TreeItem
