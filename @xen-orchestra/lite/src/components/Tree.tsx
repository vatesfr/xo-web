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

const Ul = styled.ul`
  list-style-type: none;
`

const Tree = withState<State, Props, Effects, Computed, ParentState, ParentEffects>({}, ({ children }) => (
  <Ul>{children}</Ul>
))

export default Tree
