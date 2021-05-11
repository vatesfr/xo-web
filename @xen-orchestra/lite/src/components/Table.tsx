import React from 'react'
import styled from 'styled-components'
import { Dictionary, isEmpty, map } from 'lodash'
import { FormattedMessage } from 'react-intl'
import { Map } from 'immutable'
import { withState } from 'reaclette'

type Collections = Dictionary<unknown> | unknown[]

export type TableColumn<Type> = {
  itemRenderer: { (item: Type): string | JSX.Element }
  name: JSX.Element
}

interface ParentState {}

interface State {}

interface Props {
  collections: Collections | Map<string, unknown> | undefined
  columns: TableColumn<never>[]
}

interface ParentEffects {}

interface Effects {}

interface Computed {
  collections: Collections
}

const StyledTable = styled.table`
  thead {
    background-color: #2d83c3;
    color: #fff;
  }
  td,
  th {
    padding: 1em;
  }
  tbody tr:nth-child(even) {
    background-color: #2d83c324;
  }
  tbody tr:hover {
    background-color: #4749494f;
    transition: 0.4s;
  }
`

const Table = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    computed: {
      collections: (_, { collections }) => {
        if (collections === undefined) {
          return []
        }
        if (Map.isMap(collections)) {
          return collections.toArray().map(item => item[1])
        }
        return collections
      },
    },
  },
  ({ columns, state }) =>
    !isEmpty(state.collections) ? (
      <StyledTable>
        <thead>
          <tr>
            {columns.map((col, index) => (
              <th key={index}>{col.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {map(state.collections, (item: never, index) => (
            <tr key={index}>
              {columns.map((col, index) => (
                <td key={index}>{col.itemRenderer(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </StyledTable>
    ) : (
      <FormattedMessage id='noData' />
    )
)

export default Table
