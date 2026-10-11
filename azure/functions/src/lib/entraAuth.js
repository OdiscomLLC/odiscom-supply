import { createRemoteJWKSet, jwtVerify } from 'jose'

let jwksCache = null
let jwksTenantId = null

function requiredConfig() {
  const tenantId = String(process.env.ODISCOM_SUPPLY_TENANT_ID || '').trim()
  const clientId = String(process.env.INTERNAL_API_CLIENT_ID || '').trim()

  if (!tenantId || !clientId) {
    throw new Error('Microsoft Entra internal API configuration is incomplete.')
  }

  return { tenantId, clientId }
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || request.headers.get('Authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1] || null
}

function getJwks(tenantId) {
  if (!jwksCache || jwksTenantId !== tenantId) {
    const uri = new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
    jwksCache = createRemoteJWKSet(uri)
    jwksTenantId = tenantId
  }
  return jwksCache
}

export async function verifyEntraAccessToken(token) {
  const { tenantId, clientId } = requiredConfig()
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`

  const { payload, protectedHeader } = await jwtVerify(token, getJwks(tenantId), {
    issuer,
    audience: clientId,
    algorithms: ['RS256'],
  })

  if (payload.tid !== tenantId) {
    throw new Error('Token tenant is not authorized.')
  }

  if (payload.ver && payload.ver !== '2.0') {
    throw new Error('Unsupported Microsoft access-token version.')
  }

  if (!payload.oid) {
    throw new Error('Token is missing the Entra object ID.')
  }

  if (protectedHeader.alg !== 'RS256') {
    throw new Error('Unexpected token signing algorithm.')
  }

  return payload
}

export async function authorizeInternalRequest(
  request,
  {
    requiredRoles = [],
    verifier = verifyEntraAccessToken,
  } = {},
) {
  const token = bearerToken(request)
  if (!token) {
    return {
      ok: false,
      response: {
        status: 401,
        jsonBody: {
          success: false,
          message: 'Authentication is required.',
        },
      },
    }
  }

  let claims
  try {
    claims = await verifier(token)
  } catch {
    return {
      ok: false,
      response: {
        status: 401,
        jsonBody: {
          success: false,
          message: 'Authentication failed.',
        },
      },
    }
  }

  const roles = Array.isArray(claims.roles) ? claims.roles : []
  const accepted = requiredRoles.length === 0 || requiredRoles.some((role) => roles.includes(role))

  if (!accepted) {
    return {
      ok: false,
      response: {
        status: 403,
        jsonBody: {
          success: false,
          message: 'You do not have permission to perform this operation.',
        },
      },
    }
  }

  return {
    ok: true,
    principal: {
      tenantId: claims.tid,
      objectId: claims.oid,
      subject: claims.sub || null,
      roles,
      preferredUsername: claims.preferred_username || claims.upn || null,
      name: claims.name || null,
    },
  }
}

export const INTERNAL_ROLES = Object.freeze({
  PLATFORM_ADMIN: 'Platform.Admin',
  OPERATIONS: 'Operations.User',
  SALES: 'Sales.User',
  PROCUREMENT: 'Procurement.User',
  FULFILLMENT: 'Fulfillment.User',
  FINANCE: 'Finance.User',
  READ_ONLY: 'ReadOnly.User',
})
