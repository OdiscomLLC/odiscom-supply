import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const TABLES = [
  'products',
  'suppliers',
  'supplier_catalog_sources',
  'supplier_offers',
  'supplier_import_jobs',
  'supplier_import_rows',
  'customers',
  'quotes',
  'quote_items',
  'orders',
  'order_items',
  'order_events',
  'material_uploads',
  'customer_documents',
  'hardware_opportunities',
  'hardware_opportunity_items',
  'opportunity_supplier_quotes',
]

const PAGE_SIZE = 1000

function requireEnv(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

function normalizeCompany(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

async function apiFetch(url, serviceKey, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Supabase export request failed (${response.status}): ${text.slice(0, 500)}`)
  }

  return response
}

async function exactCount(baseUrl, table, serviceKey) {
  const url = new URL(`${baseUrl}/rest/v1/${table}`)
  url.searchParams.set('select', 'id')

  const response = await apiFetch(url, serviceKey, {
    headers: {
      Prefer: 'count=exact',
      Range: '0-0',
    },
  })

  const contentRange = response.headers.get('content-range') || ''
  const match = /\/(\d+)$/.exec(contentRange)
  if (!match) throw new Error(`Could not read exact count for ${table} from Content-Range: ${contentRange}`)
  return Number(match[1])
}

async function exportTable(baseUrl, table, serviceKey) {
  const rows = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL(`${baseUrl}/rest/v1/${table}`)
    url.searchParams.set('select', '*')
    url.searchParams.set('order', 'id.asc')

    const response = await apiFetch(url, serviceKey, {
      headers: {
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
      },
    })

    const page = await response.json()
    if (!Array.isArray(page)) throw new Error(`Unexpected export response for ${table}.`)
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

function buildCustomerMaster(data) {
  const byCompany = new Map()

  const add = ({ sourceEntity, sourceKey, company, name, email, phone, createdAt }) => {
    const companyKey = normalizeCompany(company)
    if (!companyKey) return

    const current = byCompany.get(companyKey) || {
      company_key: companyKey,
      display_company: String(company || '').trim(),
      is_related_company: companyKey === 'odiscom llc',
      source_records: [],
      observed_contacts: [],
      observed_emails: [],
      observed_phones: [],
      first_seen_at: createdAt || null,
      last_seen_at: createdAt || null,
    }

    current.source_records.push({ source_entity: sourceEntity, source_key: sourceKey })
    if (name && !current.observed_contacts.includes(name)) current.observed_contacts.push(name)
    if (email && !current.observed_emails.includes(email)) current.observed_emails.push(email)
    if (phone && !current.observed_phones.includes(phone)) current.observed_phones.push(phone)

    if (createdAt && (!current.first_seen_at || createdAt < current.first_seen_at)) current.first_seen_at = createdAt
    if (createdAt && (!current.last_seen_at || createdAt > current.last_seen_at)) current.last_seen_at = createdAt

    byCompany.set(companyKey, current)
  }

  for (const row of data.customers || []) {
    add({
      sourceEntity: 'customers',
      sourceKey: row.id,
      company: row.company,
      name: row.contact_name,
      email: row.email,
      phone: row.phone,
      createdAt: row.created_at,
    })
  }

  for (const row of data.quotes || []) {
    add({
      sourceEntity: 'quotes',
      sourceKey: row.id,
      company: row.company,
      name: row.name,
      email: row.email,
      phone: row.phone,
      createdAt: row.created_at,
    })
  }

  for (const row of data.orders || []) {
    add({
      sourceEntity: 'orders',
      sourceKey: row.id,
      company: row.company,
      name: row.contact_name,
      email: row.email,
      phone: row.phone,
      createdAt: row.created_at,
    })
  }

  for (const row of data.material_uploads || []) {
    add({
      sourceEntity: 'material_uploads',
      sourceKey: row.id,
      company: row.company,
      email: row.customer_email,
      createdAt: row.created_at,
    })
  }

  return [...byCompany.values()]
    .map((item) => ({
      ...item,
      source_records: item.source_records.sort((a, b) =>
        `${a.source_entity}:${a.source_key}`.localeCompare(`${b.source_entity}:${b.source_key}`)
      ),
      observed_contacts: item.observed_contacts.sort(),
      observed_emails: item.observed_emails.sort(),
      observed_phones: item.observed_phones.sort(),
    }))
    .sort((a, b) => a.company_key.localeCompare(b.company_key))
}

async function main() {
  const baseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const outputRoot = path.resolve(process.argv[2] || 'migration/supabase-to-azure/snapshots/latest')

  await fs.mkdir(outputRoot, { recursive: true })

  const beforeCounts = {}
  for (const table of TABLES) beforeCounts[table] = await exactCount(baseUrl, table, serviceKey)

  const data = {}
  const files = {}

  for (const table of TABLES) {
    const rows = await exportTable(baseUrl, table, serviceKey)
    if (rows.length !== beforeCounts[table]) {
      throw new Error(`Source count changed while exporting ${table}: expected ${beforeCounts[table]}, exported ${rows.length}.`)
    }

    data[table] = rows
    const serialized = stableJson(rows) + '\n'
    const fileName = `${table}.json`
    await fs.writeFile(path.join(outputRoot, fileName), serialized, 'utf8')
    files[fileName] = { rows: rows.length, sha256: sha256(serialized) }
    console.log(`Exported ${table}: ${rows.length}`)
  }

  const afterCounts = {}
  for (const table of TABLES) afterCounts[table] = await exactCount(baseUrl, table, serviceKey)

  const changedTables = TABLES.filter((table) => beforeCounts[table] !== afterCounts[table])
  if (changedTables.length) {
    throw new Error(`Source changed during snapshot: ${changedTables.join(', ')}. Re-run the export.`)
  }

  const customerMaster = buildCustomerMaster(data)
  const customerSerialized = stableJson(customerMaster) + '\n'
  await fs.writeFile(path.join(outputRoot, 'customer-master.json'), customerSerialized, 'utf8')
  files['customer-master.json'] = { rows: customerMaster.length, sha256: sha256(customerSerialized) }

  const manifest = {
    schema_version: 1,
    source_system: 'supabase',
    source_project_host: new URL(baseUrl).host,
    exported_at: new Date().toISOString(),
    consistent_counts: true,
    counts: afterCounts,
    files,
    exclusions: [
      'auth.users credentials/session material',
      'environment variable values',
      'SUPABASE_SERVICE_ROLE_KEY',
      'supplier API secret values',
    ],
  }

  const manifestSerialized = stableJson(manifest) + '\n'
  await fs.writeFile(path.join(outputRoot, 'manifest.json'), manifestSerialized, 'utf8')
  await fs.writeFile(path.join(outputRoot, 'manifest.sha256'), `${sha256(manifestSerialized)}  manifest.json\n`, 'utf8')

  console.log(`Snapshot complete: ${outputRoot}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
