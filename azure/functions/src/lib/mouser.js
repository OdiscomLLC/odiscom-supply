import { normalizeCatalogKey, normalizeText, parseNumber } from './normalization.js'

const API_URL = 'https://api.mouser.com/api/v1/search/partnumber'

function exactPart(parts, manufacturer, mpn) {
  const manufacturerKey = normalizeCatalogKey(manufacturer)
  const mpnKey = normalizeCatalogKey(mpn)

  return (parts || []).find((part) => {
    const partKey = normalizeCatalogKey(part?.ManufacturerPartNumber)
    const partManufacturerKey = normalizeCatalogKey(part?.Manufacturer)
    return partKey === mpnKey && (!manufacturerKey || partManufacturerKey === manufacturerKey)
  }) || null
}

function availabilityNumber(value) {
  if (typeof value === 'number') return value
  const match = String(value || '').replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

export async function searchMouserProduct({ manufacturer, mpn, secrets, fetchImpl = fetch }) {
  const url = `${API_URL}?apiKey=${encodeURIComponent(secrets.apiKey)}`
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      SearchByPartRequest: {
        mouserPartNumber: mpn,
        partSearchOptions: 'None',
      },
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.Errors?.[0]?.Message || data?.message || 'Mouser product search failed.')
  }

  const part = exactPart(data?.SearchResults?.Parts, manufacturer, mpn)
  if (!part) return { found: false }

  const quantity = availabilityNumber(part.Availability)
  const priceBreaks = (part.PriceBreaks || [])
    .map((priceBreak) => ({
      BreakQuantity: parseNumber(priceBreak.Quantity),
      UnitPrice: parseNumber(priceBreak.Price),
      Currency: priceBreak.Currency || 'USD',
    }))
    .filter((priceBreak) => priceBreak.BreakQuantity !== null || priceBreak.UnitPrice !== null)

  return {
    found: true,
    row: {
      manufacturer: normalizeText(part.Manufacturer) || manufacturer,
      manufacturer_part_number: normalizeText(part.ManufacturerPartNumber) || mpn,
      supplier_sku: normalizeText(part.MouserPartNumber),
      product_name: normalizeText(part.Description) || `${manufacturer} ${mpn}`,
      description: normalizeText(part.Description),
      category: normalizeText(part.Category),
      unit: 'each',
      unit_cost: priceBreaks.find((priceBreak) => priceBreak.UnitPrice !== null)?.UnitPrice ?? null,
      currency: 'USD',
      available_quantity: quantity,
      availability_status: quantity !== null && quantity > 0 ? 'in_stock' : 'unknown',
      lead_time_days: parseNumber(part.LeadTime),
      lead_time_text: normalizeText(part.LeadTime),
      minimum_order_quantity: parseNumber(part.Min),
      price_breaks: priceBreaks,
      image_url: normalizeText(part.ImagePath),
      spec_sheet_url: normalizeText(part.DataSheetUrl),
      country_of_origin: null,
      taa_compliant: null,
      baba_compliant: null,
      channel_type: 'distributor',
      manufacturer_authorized: null,
      source_reference: normalizeText(part.ProductDetailUrl),
    },
  }
}
