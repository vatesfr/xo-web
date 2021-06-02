import React, { Children } from 'react'
import styled from 'styled-components'
import { withState } from 'reaclette'

interface ParentState {}

interface State {}

interface Props {
  children: React.ReactNode
}

interface ParentEffects {}

interface Effects {}

interface Computed {}

const StyledUl = styled.ul`
  list-style-type: none;
`

const TreeView = withState<State, Props, Effects, Computed, ParentState, ParentEffects>({}, ({ children }) => (
  <StyledUl>{children}</StyledUl>
))

export default TreeView
