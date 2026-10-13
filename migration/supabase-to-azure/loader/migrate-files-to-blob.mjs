import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { DefaultAzureCredential } from '@azure/identity'
import { BlobServiceClient } from '@azure/storage-blob'

function requireEnv(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function sanitizeFileName(value, fallback) {
  const cleaned = String(value || fallback || 'file')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || fallback || 'file'
}

async function readJson(dir, file) {
  return JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'))
}

function decodeDataUrl(url) {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/s.exec(url)
  if (!match) throw new Error('Invalid data URL.')
  const contentType = match[1] || 'application/octet-stream'
  const payload = match[3] || ''
  const buffer = match[2] ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8')
  return { buffer, contentType }
}

async function fetchSourceBytes(reference, fileName, supabaseUrl, serviceKey) {
  if (!reference) {
    return { status: 'missing_source_reference', buffer: null, contentType: null, detail: 'Source record has no storage reference.' }
  }

  if (reference.startsWith('data:')) {
    const decoded = decodeDataUrl(reference)
    return { status: 'ready', ...decoded, detail: 'Decoded legacy data URL.' }
  }

  if (/^https?:\/\//i.test(reference)) {
    const url = new URL(reference)
    const headers = {}

    if (url.host === new URL(supabaseUrl).host) {
      headers.apikey = serviceKey
      headers.Authorization = `Bearer ${serviceKey}`
    }

    const response = await fetch(url, { headers })
    if (!response.ok) {
      return {
        status: 'download_failed',
        buffer: null,
        contentType: null,
        detail: `HTTP ${response.status} while downloading ${url.origin}.`,
      }
    }

    return {
      status: 'ready',
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      detail: 'Downloaded absolute source URL.',
    }
  }

  const normalized = reference.replace(/^\/+/, '')
  const slash = normalized.indexOf('/')
  if (slash <= 0) {
    return {
      status: 'unresolved_storage_reference',
      buffer: null,
      contentType: null,
      detail: `Storage reference "${reference}" does not include a bucket/path pair.`,
    }
  }

  const bucket = normalized.slice(0, slash)
  const objectPath = normalized.slice(slash + 1)
  const objectUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`

  const response = await fetch(objectUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })

  if (!response.ok) {
    return {
      status: 'download_failed',
      buffer: null,
      contentType: null,
      detail: `Supabase Storage returned HTTP ${response.status} for ${bucket}/${objectPath}.`,
    }
  }

  return {
    status: 'ready',
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    detail: `Downloaded Supabase Storage object for ${fileName || objectPath}.`,
  }
}

function buildCandidates(snapshot) {
  const result = []

  for (const row of snapshot.material_uploads || []) {
    result.push({
      source_entity: 'material_uploads',
      source_record_key: row.id,
      file_name: sanitizeFileName(row.file_name, `material-upload-${row.id}`),
      source_reference: row.file_url,
      destination_prefix: 'material-uploads',
    })
  }

  for (const row of snapshot.customer_documents || []) {
    result.push({
      source_entity: 'customer_documents',
      source_record_key: row.id,
      file_name: sanitizeFileName(row.file_name, `customer-document-${row.id}`),
      source_reference: row.storage_path,
      destination_prefix: 'customer-documents',
    })
  }

  for (const row of snapshot.supplier_import_jobs || []) {
    if (!row.file_name && !row.storage_path) continue
    result.push({
      source_entity: 'supplier_import_jobs',
      source_record_key: row.id,
      file_name: sanitizeFileName(row.file_name, `supplier-import-${row.id}`),
      source_reference: row.storage_path,
      destination_prefix: 'supplier-imports',
    })
  }

  return result
}

async function main() {
  const sourceDir = path.resolve(process.argv[2] || 'migration/supabase-to-azure/snapshots/latest')
  const outputFile = path.resolve(process.argv[3] || path.join(sourceDir, 'file-migration-report.json'))

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const storageAccountUrl = requireEnv('AZURE_STORAGE_ACCOUNT_URL')
  const environment = requireEnv('ODISCOM_SUPPLY_ENVIRONMENT').toLowerCase()

  if (environment !== 'test') {
    throw new Error(`This file migrator is TEST-only. ODISCOM_SUPPLY_ENVIRONMENT must equal "test", not "${environment}".`)
  }

  const containerName = String(process.env.AZURE_STORAGE_CONTAINER || 'application-uploads').trim()
  const snapshot = {
    material_uploads: await readJson(sourceDir, 'material_uploads.json'),
    customer_documents: await readJson(sourceDir, 'customer_documents.json'),
    supplier_import_jobs: await readJson(sourceDir, 'supplier_import_jobs.json'),
  }

  const credential = new DefaultAzureCredential()
  const blobServiceClient = new BlobServiceClient(storageAccountUrl, credential)
  const containerClient = blobServiceClient.getContainerClient(containerName)
  const exists = await containerClient.exists()

  if (!exists) {
    throw new Error(`Azure Blob container "${containerName}" does not exist. Infrastructure must be deployed before file migration.`)
  }

  const report = []
  const candidates = buildCandidates(snapshot)

  for (const candidate of candidates) {
    const source = await fetchSourceBytes(
      candidate.source_reference,
      candidate.file_name,
      supabaseUrl,
      serviceKey,
    )

    if (source.status !== 'ready') {
      report.push({
        ...candidate,
        status: source.status,
        source_size_bytes: null,
        target_size_bytes: null,
        source_sha256: null,
        target_sha256: null,
        target_uri: null,
        passed: false,
        detail: source.detail,
      })
      console.warn(`Skipped ${candidate.source_entity}/${candidate.source_record_key}: ${source.detail}`)
      continue
    }

    const sourceHash = sha256(source.buffer)
    const blobName = `${candidate.destination_prefix}/${candidate.source_record_key}/${candidate.file_name}`
    const blockBlob = containerClient.getBlockBlobClient(blobName)

    await blockBlob.uploadData(source.buffer, {
      blobHTTPHeaders: {
        blobContentType: source.contentType || 'application/octet-stream',
      },
      metadata: {
        source_system: 'supabase',
        source_entity: candidate.source_entity,
        source_record_key: String(candidate.source_record_key),
        source_sha256: sourceHash,
      },
      conditions: {
        ifNoneMatch: '*',
      },
    })

    const properties = await blockBlob.getProperties()
    const targetBuffer = await blockBlob.downloadToBuffer()
    const targetHash = sha256(targetBuffer)
    const passed = Number(properties.contentLength) === source.buffer.length && targetHash === sourceHash

    report.push({
      ...candidate,
      status: passed ? 'migrated' : 'verification_failed',
      source_size_bytes: source.buffer.length,
      target_size_bytes: Number(properties.contentLength),
      source_sha256: sourceHash,
      target_sha256: targetHash,
      target_uri: blockBlob.url,
      passed,
      detail: passed ? 'Size and SHA-256 verified after Azure Blob upload.' : 'Post-upload checksum/size mismatch.',
    })

    console.log(`${passed ? 'Verified' : 'FAILED'} ${candidate.source_entity}/${candidate.source_record_key} -> ${blockBlob.url}`)
  }

  const summary = {
    generated_at: new Date().toISOString(),
    environment,
    container: containerName,
    total_candidates: report.length,
    migrated_and_verified: report.filter((row) => row.passed).length,
    unresolved_or_failed: report.filter((row) => !row.passed).length,
    records: report,
  }

  await fs.writeFile(outputFile, JSON.stringify(summary, null, 2) + '\n', 'utf8')

  if (summary.unresolved_or_failed > 0) {
    console.warn(`File migration completed with ${summary.unresolved_or_failed} unresolved/failed record(s). Review ${outputFile}.`)
    process.exitCode = 2
  } else {
    console.log(`File migration PASSED: ${summary.migrated_and_verified}/${summary.total_candidates} verified.`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
