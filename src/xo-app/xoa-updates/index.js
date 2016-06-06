import ActionButton from 'action-button'
import ansiUp from 'ansi_up'
import assign from 'lodash/assign'
import BaseComponent from 'base-component'
import isEmpty from 'lodash/isEmpty'
import map from 'lodash/map'
import React from 'react'
import xoaUpdater, { exposeTrial, isTrialRunning } from 'xoa-updater'
import { confirm } from 'modal'
import { Container } from 'grid'
import { connectStore } from 'utils'
import { error } from 'notification'
import { FormattedDate } from 'react-intl'
import { Password } from 'form'

const states = {
  disconnected: 'Disconnected',
  updating: 'Updating',
  upgrading: 'Upgrading',
  upToDate: 'Up to Date',
  upgradeNeeded: 'Upgrade required',
  registerNeeded: 'Registration required',
  error: 'An error occured'
}

const update = () => xoaUpdater.update()
const upgrade = () => xoaUpdater.upgrade()

@connectStore((state) => {
  return {
    configuration: state.xoaConfiguration,
    log: state.xoaUpdaterLog,
    registration: state.xoaRegisterState,
    state: state.xoaUpdaterState,
    trial: state.xoaTrialState
  }
})
export default class XoaUpdates extends BaseComponent {
  // These 3 inputs are "controlled" http://facebook.github.io/react/docs/forms.html#controlled-components
  _handleProxyHostChange = event => this.setState({proxyHost: event.target.value || ''})
  _handleProxyPortChange = event => this.setState({proxyPort: event.target.value || ''})
  _handleProxyUserChange = event => this.setState({proxyUser: event.target.value || ''})

  _handleConfigReset = () => {
    const { configuration } = this.props
    const { proxyPassword } = this.refs
    proxyPassword.value = ''
    this.setState(configuration)
  }

  _register = async () => {
    const {
      email,
      password
    } = this.refs

    const { registration } = this.props
    const alreadyRegistered = (registration.state === 'registered')
    if (alreadyRegistered) {
      try {
        await confirm({
          title: 'Replace registration ?',
          body: <p>
          Your XO appliance is already registered to {registration.email}, do you want to forget and replace this registration ?
          </p>})
      } catch (error) {
        return
      }
      return xoaUpdater.register(email.value, password.value, alreadyRegistered)
      .then(() => { email.value = password.value = '' })
    }
  }

  _configure = async () => {
    const {
      proxyHost,
      proxyPort,
      proxyUser
    } = this.state
    const { proxyPassword } = this.refs
    return xoaUpdater.configure({
      proxyHost,
      proxyPort,
      proxyUser,
      proxyPassword: proxyPassword.value
    })
    .then(config => {
      this.setState({
        proxyHost: undefined,
        proxyPort: undefined,
        proxyUser: undefined
      })
      proxyPassword.value = ''
    })
  }

  _trialAllowed = trial => trial.state === 'default' && exposeTrial(trial.trial)
  _trialAvailable = trial => trial.state === 'default' && isTrialRunning(trial.trial)
  _trialConsumed = trial => trial.state === 'default' && !isTrialRunning(trial.trial) && !exposeTrial(trial.trial)
  _updaterDown = trial => isEmpty(trial) || trial.state === 'ERROR'

  _startTrial = async () => {
    try {
      await confirm({
        title: 'Ready for trial ?',
        body: <p>During the trial period, XOA need to have a working internet connection. This limitation does not apply for our paid plans!</p>
      })
      return xoaUpdater.requestTrial()
        .then(() => xoaUpdater.update())
        .catch(err => error('Request Trial', err.message || String(err)))
    } catch (_) {
      return
    }
  }

  render () {
    const textClasses = {
      info: 'text-info',
      success: 'text-success',
      warning: 'text-warning',
      error: 'text-danger'
    }

    const {
      log,
      registration,
      state,
      trial
    } = this.props
    let { configuration } = this.props // Configuration from the store

    configuration = assign({}, configuration)
    const {
      proxyHost,
      proxyPort,
      proxyUser
    } = this.state // Edited non-saved configuration values override in view
    let configEdited = false
    proxyHost !== undefined && (configuration.proxyHost = proxyHost) && (configEdited = true)
    proxyPort !== undefined && (configuration.proxyPort = proxyPort) && (configEdited = true)
    proxyUser !== undefined && (configuration.proxyUser = proxyUser) && (configEdited = true)

    return <Container>{+process.env.XOA_PLAN === 5
      ? <div>
        <h2 className='text-danger'>No updater available for Community Edition</h2>
        <p>Please consider subscribe on xen-orchestra.com and try it with all features for free during 15 days!</p>
        <p className='text-danger'>Manual update could break your current installation due to dependencies issues, do it with caution</p>
      </div>
      : <div>
        <p>
          <strong>{states[state]}</strong>
          {' '}
          <ActionButton
            btnStyle='info'
            handler={update}
            icon='refresh'>
            Update
          </ActionButton>
          {' '}
          <ActionButton
            btnStyle='primary'
            handler={upgrade}
            icon='upgrade'>
            Upgrade
          </ActionButton>
        </p>
        <div>
          {map(log, (log, key) => (
            <p key={key}>
              <span className={textClasses[log.level]} >{log.date}</span>: <span dangerouslySetInnerHTML={{__html: ansiUp.ansi_to_html(log.message)}} />
            </p>
            ))}
        </div>
        <h2>Settings {configEdited ? '*' : ''}</h2>
        <form className='form-inline'>
          <fieldset>
            <div className='form-group'>
              <input
                className='form-control'
                placeholder='Host (myproxy.example.org)'
                type='text'
                value={configuration.proxyHost}
                onChange={this._handleProxyHostChange}
              />
            </div>
            {' '}
            <div className='form-group'>
              <input
                className='form-control'
                placeholder='Port (3128 ?...)'
                type='text'
                value={configuration.proxyPort}
                onChange={this._handleProxyPortChange}
              />
            </div>
            {' '}
            <div className='form-group'>
              <input
                className='form-control'
                placeholder='User name'
                type='text'
                value={configuration.proxyUser}
                onChange={this._handleProxyUserChange}
              />
            </div>
            {' '}
            <div className='form-group'>
              <Password
                placeholder='password'
                ref='proxyPassword'
              />
            </div>
          </fieldset>
          <br />
          <fieldset>
            <ActionButton icon='save' btnStyle='primary' handler={this._configure}>Save</ActionButton>
            {' '}
            <button type='button' className='btn btn-default' onClick={this._handleConfigReset} disabled={!configEdited}>Reset</button>
          </fieldset>
        </form>
        <h2>Registration</h2>
        <p>
          <strong>{registration.state}</strong>
          {registration.email && <span> to {registration.email}</span>}
          <span className='text-danger'>{registration.error}</span>
        </p>
        <form id='registrationForm' className='form-inline'>
          <div className='form-group'>
            <input
              className='form-control'
              placeholder='account email'
              ref='email'
              required
              type='text'
            />
          </div>
          {' '}
          <div className='form-group'>
            <Password
              placeholder='password'
              ref='password'
              required
            />
          </div>
          {' '}
          <ActionButton form='registrationForm' icon='success' btnStyle='primary' handler={this._register}>Register</ActionButton>
        </form>
        {process.env.XOA_PLAN === 1 &&
          <div>
            <h2>Trial</h2>
            {this._trialAllowed(trial) &&
              <div>
                {registration.state !== 'registered' && <p>Please, take time to register to enjoy your trial.</p>}
                {registration.state === 'registered' &&
                  <ActionButton btnStyle='success' handler={this._startTrial} icon='trial'>Start trial</ActionButton>
                }
              </div>
            }
            {this._trialAvailable(trial) &&
              <p className='text-success'>You can use a trial version until <FormattedDate value={new Date(trial.trial.end)} month='long' day='numeric' year='numeric' hour='2-digit' minute='2-digit' second='2-digit' />. Upgrade your appliance to get it.</p>
            }
            {this._trialConsumed(trial) &&
              <p>Your trial has been consumed and period is over</p>
            }
          </div>
        }
        {(process.env.XOA_PLAN > 1 && process.env.XOA_PLAN < 5) &&
          <div>
            {trial.state === 'trustedTrial' &&
              <p>{trial.message}</p>
            }
            {trial.state === 'untrustedTrial' &&
              <p className='text-danger'>{trial.message}</p>
            }
          </div>
        }
        {process.env.XOA_PLAN < 5 &&
          <div>
            {this._updaterDown(trial) &&
              <p className='text-danger'>
                Your xoa-updater service appears to be down. Your XOA cannot run fully without reaching this service.
              </p>
            }
          </div>
        }
      </div>
    }
    </Container>
  }
}
