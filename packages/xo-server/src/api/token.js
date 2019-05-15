// TODO: Prevent token connections from creating tokens.
// TODO: Token permission.
export async function create({ expiresIn }) {
  return (await this.createAuthenticationToken({
    expiresIn,
    userId: this.session.get('user_id'),
  })).id
}

create.description = 'create a new authentication token'

create.params = {
  expiresIn: {
    optional: true,
    type: ['number', 'string'],
  },
}

create.permission = '' // sign in

// -------------------------------------------------------------------

// TODO: an user should be able to delete its own tokens.
async function delete_({ token: id }) {
  await this.deleteAuthenticationToken(id)
}

export { delete_ as delete }

delete_.description = 'delete an existing authentication token'

delete_.permission = 'admin'

delete_.params = {
  token: { type: 'string' },
}

// -------------------------------------------------------------------

export async function deleteAll() {
  await this.deleteAuthenticationTokens({
    filter: {
      user_id: this.session.get('user_id'),
      id: {
        __not: this.session.get('authenticationToken'),
      },
    },
  })
}

deleteAll.description =
  'delete all tokens of the current user except the current one'

deleteAll.permission = ''
