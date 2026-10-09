export function normalizeCatalogKey(value) {
  const cleaned = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  return cleaned || null
}

export function normalizeText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

export function parseBoolean(value) {
  if (typeof value === 'boolean') return value
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return null
  if (['1','true','yes','y','compliant'].includes(text)) return true
  if (['0','false','no','n','noncompliant','not compliant'].includes(text)) return false
  return null
}

export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const cleaned = String(value).replace(/[$,%]/g,'').replace(/,/g,'').trim()
  if (!cleaned) return null
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

export function slugifyProduct(manufacturer, mpn, name) {
  return [manufacturer, mpn, name]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,180)
}

export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < String(text || '').length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"' && quoted && next === '"') {
      field += '"'
      i += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      row.push(field)
      field = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1
      row.push(field)
      field = ''
      if (row.some((value) => String(value).trim() !== '')) rows.push(row)
      row = []
      continue
    }
    field += char
  }

  row.push(field)
  if (row.some((value) => String(value).trim() !== '')) rows.push(row)
  if (!rows.length) return []

  const headers = rows[0].map((value) => String(value).trim())
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

export function mapSupplierRow(raw, mapping = {}) {
  const read = (key, fallbacks = []) => {
    const source = mapping[key] || key
    const direct = raw?.[source]
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct
    for (const fallback of fallbacks) {
      if (raw?.[fallback] !== undefined && raw?.[fallback] !== null && String(raw[fallback]).trim() !== '') return raw[fallback]
    }
    return null
  }

  const manufacturer = normalizeText(read('manufacturer', ['brand','mfr','vendor_name']))
  const mpn = normalizeText(read('manufacturer_part_number', ['mpn','part_number','manufacturer_sku']))
  const supplierSku = normalizeText(read('supplier_sku', ['sku','item_number','vendor_sku']))
  const name = normalizeText(read('product_name', ['name','title','description_short']))

  return {
    supplier_sku: supplierSku,
    manufacturer,
    manufacturer_part_number: mpn,
    product_name: name,
    description: normalizeText(read('description', ['long_description'])),
    category: normalizeText(read('category', ['product_category'])),
    unit: normalizeText(read('unit', ['uom'])) || 'each',
    unit_cost: parseNumber(read('unit_cost', ['cost','price','net_price'])),
    currency: normalizeText(read('currency')) || 'USD',
    available_quantity: parseNumber(read('available_quantity', ['quantity','qty','stock','inventory'])),
    availability_status: normalizeText(read('availability_status', ['availability','stock_status'])) || 'unknown',
    lead_time_days: parseNumber(read('lead_time_days')),
    lead_time_text: normalizeText(read('lead_time_text', ['lead_time'])),
    minimum_order_quantity: parseNumber(read('minimum_order_quantity', ['moq'])),
    image_url: normalizeText(read('image_url', ['image'])),
    spec_sheet_url: normalizeText(read('spec_sheet_url', ['datasheet_url','spec_url'])),
    country_of_origin: normalizeText(read('country_of_origin', ['origin_country'])),
    taa_compliant: parseBoolean(read('taa_compliant', ['taa'])),
    baba_compliant: parseBoolean(read('baba_compliant', ['baba'])),
    manufacturer_key: normalizeCatalogKey(manufacturer),
    mpn_key: normalizeCatalogKey(mpn),
    raw_data: raw || {},
  }
}

export function validateSupplierRow(row) {
  const errors = []
  if (!row.manufacturer_key) errors.push('manufacturer is required')
  if (!row.mpn_key) errors.push('manufacturer part number is required for automatic catalog matching')
  if (!row.product_name) errors.push('product name is required')
  if (row.unit_cost !== null && row.unit_cost < 0) errors.push('unit cost cannot be negative')
  if (row.available_quantity !== null && row.available_quantity < 0) errors.push('available quantity cannot be negative')
  return errors
}

export function normalizeAvailability(value) {
  const text = String(value || '').trim().toLowerCase().replace(/[\s-]+/g,'_')
  if (['in_stock','instock','available'].includes(text)) return 'in_stock'
  if (['limited','low_stock'].includes(text)) return 'limited'
  if (['backorder','backordered','out_of_stock'].includes(text)) return 'backorder'
  if (['made_to_order','mto'].includes(text)) return 'made_to_order'
  if (['discontinued','obsolete'].includes(text)) return 'discontinued'
  return 'unknown'
}
