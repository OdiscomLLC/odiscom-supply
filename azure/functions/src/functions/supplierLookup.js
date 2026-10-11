import { app } from '@azure/functions'
import { loadSupplierSecrets } from '../lib/secrets.js'
import { searchDigiKeyProduct } from '../lib/digikey.js'
import { searchMouserProduct } from '../lib/mouser.js'
import { authorizeInternalRequest, INTERNAL_ROLES } from '../lib/entraAuth.js'

const adapters = {
  digikey: searchDigiKeyProduct,
  mouser: searchMouserProduct,
}

app.http('supplierLookup', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'supplier-connectors/{supplier}/lookup',
  handler: async (request, context) => {
    const authorization = await authorizeInternalRequest(request, {
      requiredRoles: [INTERNAL_ROLES.PLATFORM_ADMIN, INTERNAL_ROLES.PROCUREMENT, INTERNAL_ROLES.OPERATIONS],
    })
    if (!authorization.ok) return authorization.response

    const supplier = String(request.params.supplier || '').toLowerCase()
    const adapter = adapters[supplier]

    if (!adapter) {
      return { status: 404, jsonBody: { success: false, message: 'Unsupported supplier connector.' } }
    }

    let body
    try {
      body = await request.json()
    } catch {
      return { status: 400, jsonBody: { success: false, message: 'JSON request body is required.' } }
    }

    const manufacturer = String(body?.manufacturer || '').trim()
    const mpn = String(body?.mpn || '').trim()
    if (!manufacturer || !mpn) {
      return { status: 400, jsonBody: { success: false, message: 'manufacturer and mpn are required.' } }
    }

    try {
      const secrets = await loadSupplierSecrets(supplier)
      const result = await adapter({ manufacturer, mpn, secrets })

      return {
        status: 200,
        jsonBody: {
          success: true,
          supplier,
          manufacturer,
          mpn,
          found: result.found,
          offer: result.row || null,
          source_checked_at: new Date().toISOString(),
        },
      }
    } catch (error) {
      context.error('Supplier connector lookup failed', {
        principalObjectId: authorization.principal.objectId,
        supplier,
        manufacturer,
        mpn,
        message: error instanceof Error ? error.message : String(error),
      })

      return {
        status: 502,
        jsonBody: {
          success: false,
          supplier,
          message: 'Supplier connector lookup failed.',
        },
      }
    }
  },
})
