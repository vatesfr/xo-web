import React from 'react'
import styled, { ThemeProvider } from 'styled-components'
import { withState } from 'reaclette'
import { IconName } from '@fortawesome/fontawesome-svg-core'

import Icon from './Icon'
import LinkWrapper from './LinkWrapper'

interface ParentState {}

interface State {
  isNodeOpen: boolean
  nodeData: object | undefined
  selectedNodeId: string | undefined
}

interface Props {
  // data: Object<{ icon?: IconName; id: string; nameLabel: string }>
  children?: React.ReactNode
}

interface ParentEffects {}

interface Effects {
  setSelectedNodeId: (id: string) => void
  openNode: (id: string) => void
}

interface Computed {}

const Ul = styled.ul`
  list-style-type: none;
  li {
    cursor: pointer;
    width: fit-content;
  }
`

const getNodeData = props => {
  const data = {}
  Object.keys(props).forEach(key => {
    if (key.startsWith('data-')) {
      data[key.slice(5)] = props[key]
    }
  })
  return Object.keys(data).length === 0 ? undefined : data
}

const TreeNode = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    initialState: () => ({
      selectedNodeId: undefined,
      isNodeOpen: undefined,
    }),
    effects: {
      setSelectedNodeId: function (id) {
        this.state.selectedNodeId = this.state.selectedNodeId === undefined ? id : undefined
      },
      openNode: function (id) {
        this.effects.setSelectedNodeId(id)
        this.state.isNodeOpen = this.state.selectedNodeId === id
      },
    },
    computed: {
      nodeData: (state, props) => getNodeData(props),
    },
  },
  ({ effects, children, state: { isNodeOpen, nodeData }, link }) => {
    // 'danger', 'info', 'link', 'primary', 'success', 'warning'
    const { id, nameLabel, icon, iconColor, to } = nodeData
    return React.Children.count(children) > 0 ? (
      <Ul key={id}>
        <li onClick={() => effects.openNode(id)}>
          <LinkWrapper link={link} to={to}>
            <Icon icon={`chevron-${isNodeOpen ? 'down' : 'right'}`} size='sm' />{' '}
            {icon !== undefined && <Icon icon={icon} color={iconColor} />} {nameLabel}
          </LinkWrapper>
        </li>
        {isNodeOpen &&
          React.Children.map(children, child => {
            if (child == null) {
              return child
            }
            const { props } = child
            const { id, nameLabel, icon, iconColor, to } = getNodeData(props)
            return (
              <Ul key={id}>
                {React.Children.count(props.children) > 0 ? (
                  <TreeNode data-id={id} data-nameLabel={nameLabel} data-icon={icon} data-iconColor={iconColor}>
                    {props.children}
                  </TreeNode>
                ) : (
                  <li>
                    <LinkWrapper link={props.link} to={to}>
                      {icon !== undefined && <Icon icon={icon} color={iconColor} />} {nameLabel}
                    </LinkWrapper>
                  </li>
                )}
              </Ul>
            )
          })}
      </Ul>
    ) : (
      <li>
        <LinkWrapper link={link} to={to}>
          {nameLabel}
        </LinkWrapper>
      </li>
    )
  }
)

export default TreeNode
