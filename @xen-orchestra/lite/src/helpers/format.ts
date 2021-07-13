import humanFormat from 'human-format'

const safeHumanFormat = (
  value: number,
  opts: {
    decimals?: number
    prefix?: string
    scale?: unknown
    separator?: string
    unit?: string
  }
) => {
  try {
    return humanFormat(value, opts)
  } catch (error) {
    console.error('humanFormat', value, opts, error)
    return 'N/D'
  }
}

export const formatSize = (bytes: number): string =>
  bytes != null ? safeHumanFormat(bytes, { scale: 'binary', unit: 'B' }) : 'N/D'
