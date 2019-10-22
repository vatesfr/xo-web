import _ from 'intl'
import React, { Component } from 'react'
import SortedTable from 'sorted-table'
import TabButton from 'tab-button'
import Upgrade from 'xoa-upgrade'
import { addSubscriptions, connectStore, formatSize } from 'utils'
import { alert } from 'modal'
import { Col, Container, Row } from 'grid'
import { createGetObjectsOfType } from 'selectors'
import { FormattedRelative, FormattedTime } from 'react-intl'
import {
  installAllPatchesOnPool,
  installPatches,
  subscribeHostMissingPatches,
} from 'xo'
import { isEmpty } from 'lodash'

const MISSING_PATCH_COLUMNS = [
  {
    name: _('patchNameLabel'),
    itemRenderer: _ => _.name,
    sortCriteria: 'name',
  },
  {
    name: _('patchDescription'),
    itemRenderer: ({ description, documentationUrl }) => (
      <a href={documentationUrl} target='_blank'>
        {description}
      </a>
    ),
    sortCriteria: 'description',
  },
  {
    name: _('patchReleaseDate'),
    itemRenderer: ({ date }) => (
      <span>
        <FormattedTime value={date} day='numeric' month='long' year='numeric' />{' '}
        (<FormattedRelative value={date} />)
      </span>
    ),
    sortCriteria: 'date',
    sortOrder: 'desc',
  },
  {
    name: _('patchGuidance'),
    itemRenderer: _ => _.guidance,
    sortCriteria: 'guidance',
  },
]

const ACTIONS = [
  {
    handler: (patches, { pool }) => installPatches(patches, pool),
    icon: 'host-patch-update',
    label: _('install'),
    level: 'primary',
  },
]

const MISSING_PATCH_COLUMNS_XCP = [
  {
    name: _('patchNameLabel'),
    itemRenderer: _ => _.name,
    sortCriteria: 'name',
  },
  {
    name: _('patchDescription'),
    itemRenderer: _ => _.description,
    sortCriteria: 'description',
  },
  {
    name: _('patchVersion'),
    itemRenderer: _ => _.version,
  },
  {
    name: _('patchRelease'),
    itemRenderer: _ => _.release,
  },
  {
    name: _('patchSize'),
    itemRenderer: _ => formatSize(_.size),
    sortCriteria: 'size',
  },
]

const INDIVIDUAL_ACTIONS_XCP = [
  {
    disabled: _ => _.changelog === null,
    handler: ({ name, changelog: { author, date, description } }) =>
      alert(
        _('changelog'),
        <Container>
          <Row className='mb-1'>
            <Col size={3}>
              <strong>{_('changelogPatch')}</strong>
            </Col>
            <Col size={9}>{name}</Col>
          </Row>
          <Row className='mb-1'>
            <Col size={3}>
              <strong>{_('changelogDate')}</strong>
            </Col>
            <Col size={9}>
              <FormattedTime
                value={date * 1000}
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
            <Col size={9}>{author}</Col>
          </Row>
          <Row>
            <Col size={3}>
              <strong>{_('changelogDescription')}</strong>
            </Col>
            <Col size={9}>{description}</Col>
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
    itemRenderer: _ => _.name,
    sortCriteria: 'name',
  },
  {
    name: _('patchDescription'),
    itemRenderer: _ => _.description,
    sortCriteria: 'description',
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
    sortCriteria: 'time',
    sortOrder: 'desc',
  },
  {
    name: _('patchSize'),
    itemRenderer: _ => formatSize(_.size),
    sortCriteria: 'size',
  },
]

@addSubscriptions(({ master }) => ({
  missingPatches: cb => subscribeHostMissingPatches(master, cb),
}))
@connectStore({
  hostPatches: createGetObjectsOfType('patch').pick(
    (_, { master }) => master.patches
  ),
})
export default class TabPatches extends Component {
  render() {
    const {
      hostPatches,
      missingPatches = [],
      pool,
      master: { productBrand },
    } = this.props

    return (
      <Upgrade place='poolPatches' required={2}>
        <Container>
          <Row>
            <Col className='text-xs-right'>
              <TabButton
                btnStyle='primary'
                data-pool={pool}
                disabled={isEmpty(missingPatches)}
                handler={installAllPatchesOnPool}
                icon='host-patch-update'
                labelId='installPoolPatches'
              />
            </Col>
          </Row>
          {missingPatches === null ? (
            <Row>
              <Col>
                <p>
                  <em>{_('cannotFetchMissingPatches')}</em>
                </p>
              </Col>
            </Row>
          ) : productBrand === 'XCP-ng' ? (
            <Row>
              <Col>
                <h3>{_('hostMissingPatches')}</h3>
                <SortedTable
                  columns={MISSING_PATCH_COLUMNS_XCP}
                  collection={missingPatches}
                  individualActions={INDIVIDUAL_ACTIONS_XCP}
                />
              </Col>
            </Row>
          ) : (
            <div>
              <Row>
                <Col>
                  <h3>{_('hostMissingPatches')}</h3>
                  <SortedTable
                    actions={ACTIONS}
                    collection={missingPatches}
                    columns={MISSING_PATCH_COLUMNS}
                    data-pool={pool}
                  />
                </Col>
              </Row>
              <Row>
                <Col>
                  <h3>{_('hostAppliedPatches')}</h3>
                  <SortedTable
                    collection={hostPatches}
                    columns={INSTALLED_PATCH_COLUMNS}
                  />
                </Col>
              </Row>
            </div>
          )}
        </Container>
      </Upgrade>
    )
  }
}
