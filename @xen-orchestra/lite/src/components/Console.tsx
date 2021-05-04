import React from 'react'
import RFB from '@novnc/novnc/lib/rfb'
import { FormattedMessage } from 'react-intl'
import { withState } from 'reaclette'

import { confirm } from './Modal'

import XapiConnection, { ObjectsByType, Vm } from '../libs/xapi'

interface ParentState {
  objectsByType: ObjectsByType
  xapi: XapiConnection
}

interface State {
  confirmCtrlAltDel: boolean
  container: React.RefObject<HTMLDivElement>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rfb?: any
}

interface Props {
  vmId: string
  scale: number
  setCtrlAltDel: (fn: () => void) => void
}

interface ParentEffects {}

interface Effects {
  sendCtrlAltDel: () => void
}

interface Computed {}

// https://github.com/novnc/noVNC/blob/master/docs/API.md
const Console = withState<State, Props, Effects, Computed, ParentState, ParentEffects>(
  {
    initialState: () => ({
      confirmCtrlAltDel: false,
      container: React.createRef(),
      rfb: undefined,
    }),
    effects: {
      initialize: async function () {
        const { vmId } = this.props
        const { objectsByType, xapi } = this.state
        const consoles = (objectsByType.get('VM')?.get(vmId) as Vm)?.$consoles.filter(
          vmConsole => vmConsole.protocol === 'rfb'
        )

        if (consoles === undefined || consoles.length === 0) {
          throw new Error('Could not find VM console')
        }

        if (xapi.sessionId === undefined) {
          throw new Error('Not connected to XAPI')
        }

        const url = new URL(consoles[0].location)
        url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        url.searchParams.set('session_id', xapi.sessionId)

        this.state.rfb = new RFB(this.state.container.current, url, {
          wsProtocols: ['binary'],
        })
        this.state.rfb.scaleViewport = true

        this.props.setCtrlAltDel(this.effects.sendCtrlAltDel)
      },
      sendCtrlAltDel: async function () {
        await confirm({
          message: <FormattedMessage id='confirmCtrlAltDel' />,
          title: <FormattedMessage id='ctrlAltDel' />,
        })
        this.state.rfb!.sendCtrlAltDel()
      },
    },
  },
  ({ scale, state }) => (
    <div ref={state.container} style={{ margin: 'auto', height: `${scale}%`, width: `${scale}%` }} />
  )
)

export default Console
