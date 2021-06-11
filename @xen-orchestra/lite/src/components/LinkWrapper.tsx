import PropTypes from 'prop-types'
import React from 'react'
import { Link } from 'react-router-dom'

const LinkWrapper = ({ children, link, to }) => (link ? <Link to={to}>{children}</Link> : <span>{children}</span>)

LinkWrapper.propTypes = {
  link: PropTypes.bool,
  newTab: PropTypes.bool,
  to: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
}

export default LinkWrapper
