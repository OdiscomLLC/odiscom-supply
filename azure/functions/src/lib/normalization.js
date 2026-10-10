export function normalizeCatalogKey(value) {
  const cleaned = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  return cleaned || null
}

export function normalizeText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const cleaned = String(value).replace(/[$,%]/g, '').replace(/,/g, '').trim()
  if (!cleaned) return null
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}
