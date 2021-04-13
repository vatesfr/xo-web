import React from 'react'
import { withState } from 'reaclette'

import Console from './Console'
import RangeInput from './RangeInput'

interface ParentState {}

interface State {
  consoleScale: number
}

interface Props {
  vmId: string
}

interface ParentEffects {}

interface Effects {
  scaleConsole: React.ChangeEventHandler<HTMLInputElement>
}

interface Computed {}

const TabConsole = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    initialState: () => ({
      // Value in percent
      consoleScale: 100,
    }),
    effects: {
      scaleConsole: function (e) {
        this.state.consoleScale = +e.currentTarget.value

        // With "scaleViewport", the canvas occupies all
        // available space of its container.
        // But when the size of the container is changed,
        // the canvas size isn't updated
        // Issue https://github.com/novnc/noVNC/issues/1364
        // PR https://github.com/novnc/noVNC/pull/1365
        window.dispatchEvent(new UIEvent('resize'))
      },
    },
  },
  ({ state, effects, vmId }) => (
    <div style={{ height: '100vh' }}>
      <RangeInput max={100} min={1} onChange={effects.scaleConsole} step={1} value={state.consoleScale} />
      <Console vmId={vmId} scale={state.consoleScale} />
    </div>
  )
)

export default TabConsole