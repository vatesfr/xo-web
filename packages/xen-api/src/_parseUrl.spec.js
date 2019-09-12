/* eslint-env jest */

import parseUrl from './_parseUrl'

const withData = (data, fn) => {
  Object.keys(data).forEach(title => {
    describe(title, () => fn(data[title]))
  })
}

describe('parseUrl()', () => {
  withData(
    {
      'without protocol': '',
      'with HTTP': 'http:',
      'with HTTPS': 'https:',
    },
    protocol => {
      withData(
        {
          'without slashes': '',
          'with 1 slashes': '/',
          'with 2 slashes': '//',
        },
        slashes => {
          withData(
            {
              'without credentials': '',
              'with credentials': 'bob:s3cr3t@',
            },
            credentials => {
              withData(
                {
                  'with hostname': 'server.example.net',
                  'with IPv4': '172.16.254.1',
                  'with IPv6': '[2001:db8::7334]',
                },
                hostname => {
                  withData(
                    {
                      'without port': '',
                      'with port': ':4343',
                    },
                    port => {
                      withData(
                        {
                          'without trailing slash': '',
                          'with trailing slash': '/',
                        },
                        trailingSlash => {
                          const url =
                            protocol +
                            slashes +
                            credentials +
                            hostname +
                            port +
                            trailingSlash

                          test(url, () => {
                            expect(parseUrl(url)).toMatchSnapshot()
                          })
                        }
                      )
                    }
                  )
                }
              )
            }
          )
        }
      )
    }
  )
})
