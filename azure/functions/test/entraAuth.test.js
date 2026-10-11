import test from 'node:test'
import assert from 'node:assert/strict'
import { authorizeInternalRequest, INTERNAL_ROLES } from '../src/lib/entraAuth.js'

function requestWith(auth) {
  return { headers: new Headers(auth ? { authorization: auth } : {}) }
}

test('internal auth rejects missing bearer token', async () => {
  const result = await authorizeInternalRequest(requestWith(null), {
    requiredRoles: [INTERNAL_ROLES.PROCUREMENT],
    verifier: async () => { throw new Error('should not run') },
  })
  assert.equal(result.ok, false)
  assert.equal(result.response.status, 401)
})

test('internal auth rejects valid token without required role', async () => {
  const result = await authorizeInternalRequest(requestWith('Bearer token'), {
    requiredRoles: [INTERNAL_ROLES.PROCUREMENT],
    verifier: async () => ({ tid:'tenant', oid:'object', roles:[INTERNAL_ROLES.READ_ONLY] }),
  })
  assert.equal(result.ok, false)
  assert.equal(result.response.status, 403)
})

test('internal auth accepts required Entra app role', async () => {
  const result = await authorizeInternalRequest(requestWith('Bearer token'), {
    requiredRoles: [INTERNAL_ROLES.PROCUREMENT],
    requiredScopes: ['access_as_user'],
    verifier: async () => ({
      tid:'tenant',
      oid:'object',
      sub:'subject',
      roles:[INTERNAL_ROLES.PROCUREMENT],
      scp:'access_as_user',
      preferred_username:'user@odiscomsupply.com',
    }),
  })
  assert.equal(result.ok, true)
  assert.equal(result.principal.objectId, 'object')
  assert.deepEqual(result.principal.roles, [INTERNAL_ROLES.PROCUREMENT])
})


test('internal auth rejects token that has role but lacks required delegated scope', async () => {
  const result = await authorizeInternalRequest(requestWith('Bearer token'), {
    requiredRoles: [INTERNAL_ROLES.PROCUREMENT],
    requiredScopes: ['access_as_user'],
    verifier: async () => ({
      tid:'tenant',
      oid:'object',
      roles:[INTERNAL_ROLES.PROCUREMENT],
      scp:'openid profile',
    }),
  })
  assert.equal(result.ok, false)
  assert.equal(result.response.status, 403)
})
