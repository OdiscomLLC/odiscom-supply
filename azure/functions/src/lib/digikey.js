import { normalizeCatalogKey, normalizeText, parseNumber } from './normalization.js'

const TOKEN_URL = 'https://api.digikey.com/v1/oauth2/token'
const API_ROOT = 'https://api.digikey.com/products/v4'

async function getToken({ clientId, clientSecret }, fetchImpl = fetch) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  })

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = await response.json()
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.message || 'DigiKey OAuth failed.')
  }
  return data.access_token
}

function requestHeaders(token, secrets) {
  const result = {
    Authorization: `Bearer ${token}`,
    'X-DIGIKEY-Client-Id': secrets.clientId,
    'X-DIGIKEY-Locale-Site': 'US',
    'X-DIGIKEY-Locale-Language': 'en',
    'X-DIGIKEY-Locale-Currency': 'USD',
    'Content-Type': 'application/json',
  }
  if (secrets.accountId) result['X-DIGIKEY-Account-Id'] = secrets.accountId
  return result
}

function exactProduct(products, manufacturer, mpn) {
  const manufacturerKey = normalizeCatalogKey(manufacturer)
  const mpnKey = normalizeCatalogKey(mpn)

  return (products || []).find((product) => {
    const partKey = normalizeCatalogKey(product?.ManufacturerProductNumber)
    const productManufacturerKey = normalizeCatalogKey(product?.Manufacturer?.Name)
    return partKey === mpnKey && (!manufacturerKey || productManufacturerKey === manufacturerKey)
  }) || null
}

export async function searchDigiKeyProduct({ manufacturer, mpn, secrets, fetchImpl = fetch }) {
  const token = await getToken(secrets, fetchImpl)
  const response = await fetchImpl(`${API_ROOT}/search/keyword`, {
    method: 'POST',
    headers: requestHeaders(token, secrets),
    body: JSON.stringify({ Keywords: mpn, Limit: 10, Offset: 0 }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.detail || data?.title || data?.message || 'DigiKey product search failed.')
  }

  const product = exactProduct([...(data?.ExactMatches || []), ...(data?.Products || [])], manufacturer, mpn)
  if (!product) return { found: false }

  const variation = (product.ProductVariations || [])[0] || {}
  const standardPricing = variation.StandardPricing || []
  const quantity = parseNumber(
    variation.QuantityAvailableforPackageType ??
    variation.QuantityAvailable ??
    product.QuantityAvailable ??
    product.ManufacturerPublicQuantity
  )
  const unitCost = parseNumber(product.UnitPrice ?? standardPricing?.[0]?.UnitPrice)
  const weeks = parseNumber(product.ManufacturerLeadWeeks)

  return {
    found: true,
    row: {
      manufacturer: normalizeText(product?.Manufacturer?.Name) || manufacturer,
      manufacturer_part_number: normalizeText(product?.ManufacturerProductNumber) || mpn,
      supplier_sku: normalizeText(variation?.DigiKeyProductNumber),
      product_name: normalizeText(product?.Description?.ProductDescription) || `${manufacturer} ${mpn}`,
      description: normalizeText(product?.Description?.DetailedDescription),
      category: normalizeText(product?.Category?.Name),
      unit: 'each',
      unit_cost: unitCost,
      currency: 'USD',
      available_quantity: quantity,
      availability_status: quantity !== null && quantity > 0 ? 'in_stock' : 'unknown',
      lead_time_days: weeks === null ? null : Math.round(weeks * 7),
      lead_time_text: weeks === null ? null : `${weeks} manufacturer lead weeks`,
      minimum_order_quantity: parseNumber(variation?.MinimumOrderQuantity),
      price_breaks: standardPricing,
      image_url: normalizeText(product?.PhotoUrl),
      spec_sheet_url: normalizeText(product?.DatasheetUrl),
      country_of_origin: null,
      taa_compliant: null,
      baba_compliant: null,
      channel_type: 'distributor',
      manufacturer_authorized: null,
      source_reference: normalizeText(product?.ProductUrl),
    },
  }
}
