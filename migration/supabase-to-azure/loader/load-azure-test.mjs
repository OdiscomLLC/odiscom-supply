import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sql from 'mssql'
import { DefaultAzureCredential } from '@azure/identity'

const LOAD_PLAN = [
  ['identity.ExternalOrganization.json', 'identity', 'ExternalOrganization'],
  ['catalog.Manufacturer.json', 'catalog', 'Manufacturer'],
  ['catalog.Product.json', 'catalog', 'Product'],
  ['sourcing.Supplier.json', 'sourcing', 'Supplier'],
  ['sourcing.SupplierContact.json', 'sourcing', 'SupplierContact'],
  ['sourcing.SupplierCatalogSource.json', 'sourcing', 'SupplierCatalogSource'],
  ['sourcing.SupplierOffer.json', 'sourcing', 'SupplierOffer'],
  ['sourcing.SupplierImportJob.json', 'sourcing', 'SupplierImportJob'],
  ['sourcing.SupplierImportRow.json', 'sourcing', 'SupplierImportRow'],
  ['commerce.Customer.json', 'commerce', 'Customer'],
  ['commerce.CustomerContact.json', 'commerce', 'CustomerContact'],
  ['commerce.CustomerLocation.json', 'commerce', 'CustomerLocation'],
  ['commerce.CustomerDocument.json', 'commerce', 'CustomerDocument'],
  ['commerce.MaterialUpload.json', 'commerce', 'MaterialUpload'],
  ['commerce.Quote.json', 'commerce', 'Quote'],
  ['commerce.QuoteItem.json', 'commerce', 'QuoteItem'],
  ['commerce.SalesOrder.json', 'commerce', 'SalesOrder'],
  ['commerce.SalesOrderItem.json', 'commerce', 'SalesOrderItem'],
  ['commerce.OrderEvent.json', 'commerce', 'OrderEvent'],
  ['commerce.PaymentReference.json', 'commerce', 'PaymentReference'],
  ['commerce.Shipment.json', 'commerce', 'Shipment'],
  ['ops.HardwareOpportunity.json', 'ops', 'HardwareOpportunity'],
  ['ops.HardwareOpportunityItem.json', 'ops', 'HardwareOpportunityItem'],
  ['ops.OpportunitySupplierQuote.json', 'ops', 'OpportunitySupplierQuote'],
  ['migration.SourceRecordMap.json', 'migration', 'SourceRecordMap'],
  ['migration.SourceFieldArchive.json', 'migration', 'SourceFieldArchive'],
]

function requireEnv(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function quoteName(name) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe SQL identifier: ${name}`)
  return `[${name}]`
}

async function readJson(dir, file) {
  return JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'))
}

async function connect() {
  const server = requireEnv('SQL_SERVER_FQDN')
  const database = requireEnv('SQL_DATABASE_NAME')
  const environment = requireEnv('ODISCOM_SUPPLY_ENVIRONMENT')

  if (environment.toLowerCase() !== 'test') {
    throw new Error(`This loader is TEST-only. ODISCOM_SUPPLY_ENVIRONMENT must equal "test", not "${environment}".`)
  }

  const credential = new DefaultAzureCredential()
  const token = await credential.getToken('https://database.windows.net/.default')
  if (!token?.token) throw new Error('Could not obtain an Azure SQL access token.')

  const pool = new sql.ConnectionPool({
    server,
    database,
    port: 1433,
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
    },
    authentication: {
      type: 'azure-active-directory-access-token',
      options: {
        token: token.token,
      },
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  })

  await pool.connect()
  return pool
}

async function tableCount(executor, schema, table) {
  const result = await executor.request().query(
    `SELECT COUNT_BIG(*) AS [count] FROM ${quoteName(schema)}.${quoteName(table)};`
  )
  return Number(result.recordset[0].count)
}

async function insertRow(executor, schema, table, row) {
  const entries = Object.entries(row).filter(([, value]) => value !== undefined)
  if (!entries.length) throw new Error(`No columns to insert into ${schema}.${table}.`)

  const request = executor.request()
  const columns = []
  const params = []

  entries.forEach(([column, value], index) => {
    const param = `p${index}`
    columns.push(quoteName(column))
    params.push(`@${param}`)
    request.input(param, value === undefined ? null : value)
  })

  await request.query(
    `INSERT INTO ${quoteName(schema)}.${quoteName(table)} (${columns.join(', ')}) VALUES (${params.join(', ')});`
  )
}

async function createMigrationRun(pool, manifest) {
  const id = crypto.randomUUID()
  const request = pool.request()
  request.input('id', sql.UniqueIdentifier, id)
  request.input('sourceSnapshotAt', sql.DateTime2, manifest.transformed_at ? new Date(manifest.transformed_at) : new Date())
  request.input('sourceHash', sql.Char(64), manifest.source_manifest_sha256 || null)
  request.input('notes', sql.NVarChar(sql.MAX), 'Automated Azure SQL TEST rehearsal load from deterministic transformed snapshot.')

  await request.query(`
    INSERT INTO [migration].[MigrationRun]
      ([MigrationRunId], [RunType], [SourceSystem], [TargetSystem], [SourceSnapshotAt], [Status], [SourceManifestHash], [Notes])
    VALUES
      (@id, 'rehearsal', 'supabase', 'azure-sql', @sourceSnapshotAt, 'running', @sourceHash, @notes);
  `)

  return id
}

async function markRun(pool, runId, status, targetHash = null, notes = null) {
  const request = pool.request()
  request.input('id', sql.UniqueIdentifier, runId)
  request.input('status', sql.NVarChar(30), status)
  request.input('targetHash', sql.Char(64), targetHash)
  request.input('notes', sql.NVarChar(sql.MAX), notes)

  await request.query(`
    UPDATE [migration].[MigrationRun]
    SET [Status] = @status,
        [CompletedAt] = SYSUTCDATETIME(),
        [TargetManifestHash] = @targetHash,
        [Notes] = CASE WHEN @notes IS NULL THEN [Notes] ELSE CONCAT([Notes], CHAR(10), @notes) END
    WHERE [MigrationRunId] = @id;
  `)
}

async function recordMetric(executor, runId, domainName, metricName, sourceValue, targetValue, passed, detail = null) {
  const request = executor.request()
  request.input('runId', sql.UniqueIdentifier, runId)
  request.input('domainName', sql.NVarChar(100), domainName)
  request.input('metricName', sql.NVarChar(150), metricName)
  request.input('sourceValue', sql.NVarChar(500), String(sourceValue))
  request.input('targetValue', sql.NVarChar(500), String(targetValue))
  request.input('passed', sql.Bit, passed)
  request.input('detail', sql.NVarChar(sql.MAX), detail)

  await request.query(`
    INSERT INTO [migration].[ReconciliationMetric]
      ([MigrationRunId], [DomainName], [MetricName], [SourceValue], [TargetValue], [Passed], [Detail])
    VALUES
      (@runId, @domainName, @metricName, @sourceValue, @targetValue, @passed, @detail);
  `)
}

async function main() {
  const sourceDir = path.resolve(process.argv[2] || 'migration/supabase-to-azure/snapshots/latest/azure-shaped')
  const manifest = await readJson(sourceDir, 'transform-manifest.json')
  const pool = await connect()
  let runId = null

  try {
    for (const [, schema, table] of LOAD_PLAN) {
      const count = await tableCount(pool, schema, table)
      if (count !== 0) {
        throw new Error(
          `Refusing to load non-empty target table ${schema}.${table} (${count} rows). Use a fresh TEST database for rehearsals.`
        )
      }
    }

    runId = await createMigrationRun(pool, manifest)
    const transaction = new sql.Transaction(pool)
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED)

    try {
      const targetCounts = {}

      for (const [file, schema, table] of LOAD_PLAN) {
        const rows = await readJson(sourceDir, file)

        for (const originalRow of rows) {
          const row = { ...originalRow }
          if (schema === 'migration' && table === 'SourceFieldArchive') {
            row.MigrationRunId = runId
          }
          await insertRow(transaction, schema, table, row)
        }

        const count = await tableCount(transaction, schema, table)
        targetCounts[`${schema}.${table}`] = count
        const expected = rows.length
        const passed = count === expected

        await recordMetric(
          transaction,
          runId,
          `${schema}.${table}`,
          'row_count',
          expected,
          count,
          passed,
          passed ? null : 'Target row count does not match transformed snapshot.'
        )

        if (!passed) {
          throw new Error(`Row-count mismatch for ${schema}.${table}: expected ${expected}, got ${count}.`)
        }

        console.log(`Loaded ${schema}.${table}: ${count}`)
      }

      const targetHash = sha256(JSON.stringify(targetCounts, Object.keys(targetCounts).sort()))
      await transaction.commit()
      await markRun(pool, runId, 'passed', targetHash, 'All transformed table row counts reconciled.')
      console.log(`Migration rehearsal PASSED. Run ID: ${runId}`)
    } catch (error) {
      try {
        await transaction.rollback()
      } catch {}
      throw error
    }
  } catch (error) {
    if (runId) {
      try {
        await markRun(pool, runId, 'failed', null, error instanceof Error ? error.message : String(error))
      } catch {}
    }
    throw error
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
