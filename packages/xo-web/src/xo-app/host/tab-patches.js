import _ from 'intl'
import PropTypes from 'prop-types'
import React, { Component } from 'react'
import SortedTable from 'sorted-table'
import TabButton from 'tab-button'
import Upgrade from 'xoa-upgrade'
import { alert, chooseAction } from 'modal'
import { connectStore, formatSize } from 'utils'
import { Container, Row, Col } from 'grid'
import { createDoesHostNeedRestart } from 'selectors'
import { FormattedRelative, FormattedTime } from 'react-intl'
import { installAllPatchesOnHost, restartHost } from 'xo'
import { isEmpty } from 'lodash'

const MISSING_PATCH_COLUMNS = [
  {
    name: _('patchNameLabel'),
    itemRenderer: patch => patch.name,
    sortCriteria: patch => patch.name,
  },
  {
    name: _('patchDescription'),
    itemRenderer: patch => (
      <a href={patch.documentationUrl} target='_blank'>
        {patch.description}
      </a>
    ),
    sortCriteria: patch => patch.description,
  },
  {
    name: _('patchReleaseDate'),
    itemRenderer: patch => (
      <span>
        <FormattedTime
          value={patch.date}
          day='numeric'
          month='long'
          year='numeric'
        />{' '}
        (<FormattedRelative value={patch.date} />)
      </span>
    ),
    sortCriteria: patch => patch.date,
    sortOrder: 'desc',
  },
  {
    name: _('patchGuidance'),
    itemRenderer: patch => patch.guidance,
    sortCriteria: patch => patch.guidance,
  },
]

const MISSING_PATCH_COLUMNS_XCP = [
  {
    name: _('patchNameLabel'),
    itemRenderer: patch => patch.name,
    sortCriteria: 'name',
  },
  {
    name: _('patchDescription'),
    itemRenderer: patch => patch.description,
    sortCriteria: 'description',
  },
  {
    name: _('patchVersion'),
    itemRenderer: patch => patch.version,
  },
  {
    name: _('patchRelease'),
    itemRenderer: patch => patch.release,
  },
  {
    name: _('patchSize'),
    itemRenderer: patch => formatSize(patch.size),
    sortCriteria: 'size',
  },
]

const INDIVIDUAL_ACTIONS_XCP = [
  {
    disabled: patch => patch.changelog === null,
    handler: patch =>
      alert(
        _('changelog'),
        <Container>
          <Row className='mb-1'>
            <Col size={3}>
              <strong>{_('changelogPatch')}</strong>
            </Col>
            <Col size={9}>{patch.name}</Col>
          </Row>
          <Row className='mb-1'>
            <Col size={3}>
              <strong>{_('changelogDate')}</strong>
            </Col>
            <Col size={9}>
              <FormattedTime
                value={patch.changelog.date * 1000}
                day='numeric'
                month='long'
                year='numeric'
              />
            </Col>
          </Row>
          <Row className='mb-1'>
            <Col size={3}>
              <strong>{_('changelogAuthor')}</strong>
            </Col>
            <Col size={9}>{patch.changelog.author}</Col>
          </Row>
          <Row>
            <Col size={3}>
              <strong>{_('changelogDescription')}</strong>
            </Col>
            <Col size={9}>{patch.changelog.description}</Col>
          </Row>
        </Container>
      ),
    icon: 'preview',
    label: _('showChangelog'),
  },
]

const INSTALLED_PATCH_COLUMNS = [
  {
    name: _('patchNameLabel'),
    itemRenderer: patch => patch.name,
    sortCriteria: patch => patch.name,
  },
  {
    name: _('patchDescription'),
    itemRenderer: patch => patch.description,
    sortCriteria: patch => patch.description,
  },
  {
    default: true,
    name: _('patchApplied'),
    itemRenderer: patch => {
      const time = patch.time * 1000
      return (
        <span>
          <FormattedTime
            value={time}
            day='numeric'
            month='long'
            year='numeric'
          />{' '}
          (<FormattedRelative value={time} />)
        </span>
      )
    },
    sortCriteria: patch => patch.time,
    sortOrder: 'desc',
  },
  {
    name: _('patchSize'),
    itemRenderer: patch => formatSize(patch.size),
    sortCriteria: patch => patch.size,
  },
]

class XcpPatches extends Component {
  render() {
    const { missingPatches, host, installAllPatches } = this.props
    const hasMissingPatches = !isEmpty(missingPatches)
    return (
      <Container>
        <Row>
          <Col className='text-xs-right'>
            {this.props.needsRestart && (
              <TabButton
                btnStyle='warning'
                handler={restartHost}
                handlerParam={host}
                icon='host-reboot'
                labelId='rebootUpdateHostLabel'
              />
            )}
            <TabButton
              disabled={!hasMissingPatches}
              btnStyle={hasMissingPatches ? 'primary' : undefined}
              handler={installAllPatches}
              icon={hasMissingPatches ? 'host-patch-update' : 'success'}
              labelId={hasMissingPatches ? 'patchUpdateButton' : 'hostUpToDate'}
            />
          </Col>
        </Row>
        {hasMissingPatches && (
          <Row>
            <Col>
              <SortedTable
                columns={MISSING_PATCH_COLUMNS_XCP}
                collection={missingPatches}
                individualActions={INDIVIDUAL_ACTIONS_XCP}
              />
            </Col>
          </Row>
        )}
      </Container>
    )
  }
}

@connectStore(() => ({
  needsRestart: createDoesHostNeedRestart((_, props) => props.host),
}))
class XenServerPatches extends Component {
  render() {
    const { host, missingPatches, installAllPatches, hostPatches } = this.props
    const hasMissingPatches = !isEmpty(missingPatches)
    return (
      <Container>
        <Row>
          <Col className='text-xs-right'>
            {this.props.needsRestart && (
              <TabButton
                btnStyle='warning'
                handler={restartHost}
                handlerParam={host}
                icon='host-reboot'
                labelId='rebootUpdateHostLabel'
              />
            )}
            <TabButton
              disabled={!hasMissingPatches}
              btnStyle={hasMissingPatches ? 'primary' : undefined}
              handler={installAllPatches}
              icon={hasMissingPatches ? 'host-patch-update' : 'success'}
              labelId={hasMissingPatches ? 'patchUpdateButton' : 'hostUpToDate'}
            />
          </Col>
        </Row>
        {hasMissingPatches && (
          <Row>
            <Col>
              <h3>{_('hostMissingPatches')}</h3>
              <SortedTable
                collection={missingPatches}
                columns={MISSING_PATCH_COLUMNS}
              />
            </Col>
          </Row>
        )}
        <Row>
          <Col>
            <h3>{_('hostAppliedPatches')}</h3>
            <SortedTable
              collection={hostPatches}
              columns={INSTALLED_PATCH_COLUMNS}
            />
          </Col>
        </Row>
      </Container>
    )
  }
}

export default class TabPatches extends Component {
  static contextTypes = {
    router: PropTypes.object,
  }

  _installAllPatches = () => {
    const { host } = this.props
    const { $pool: pool, productBrand } = host

    if (productBrand === 'XCP-ng') {
      return installAllPatchesOnHost({ host })
    }

    return chooseAction({
      body: <p>{_('installAllPatchesContent')}</p>,
      buttons: [{ label: _('installAllPatchesRedirect'), value: 'goToPool' }],
      icon: 'host-patch-update',
      title: _('installAllPatchesTitle'),
    }).then(() => this.context.router.push(`/pools/${pool}/patches`))
  }

  render() {
    if (process.env.XOA_PLAN < 2) {
      return (
        <Container>
          <Upgrade place='hostPatches' available={2} />
        </Container>
      )
    }
    if (this.props.missingPatches === null) {
      return <em>{_('cannotFetchMissingPatches')}</em>
    }
    const Patches =
      this.props.host.productBrand === 'XCP-ng' ? XcpPatches : XenServerPatches
    return (
      <Patches {...this.props} installAllPatches={this._installAllPatches} />
    )
  }
}
