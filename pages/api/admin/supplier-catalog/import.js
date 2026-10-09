import { createSupabaseAdmin, requireAdmin } from '../../../../lib/supabaseAdmin'
import { mapSupplierRow, normalizeAvailability, parseCsv, slugifyProduct, validateSupplierRow } from '../../../../lib/supplierCatalog'

function clean(value, max = 220) {
  return typeof value === 'string' ? value.trim().slice(0, max) : value
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' })
  if (!(await requireAdmin(req))) return res.status(401).json({ success: false, message: 'Admin authentication required' })

  const supplierId = clean(req.body?.supplierId, 80)
  const sourceId = clean(req.body?.sourceId, 80) || null
  let mapping = req.body?.mapping && typeof req.body.mapping === 'object' ? req.body.mapping : {}
  const dryRun = Boolean(req.body?.dryRun)
  const rowsInput = Array.isArray(req.body?.rows)
    ? req.body.rows
    : typeof req.body?.csv === 'string'
      ? parseCsv(req.body.csv)
      : []

  if (!supplierId) return res.status(400).json({ success: false, message: 'supplierId is required' })
  if (!rowsInput.length) return res.status(400).json({ success: false, message: 'Provide CSV text or rows.' })
  if (rowsInput.length > 5000) return res.status(400).json({ success: false, message: 'Imports are limited to 5,000 rows per job.' })

  const admin = createSupabaseAdmin()
  const { data: supplier, error: supplierError } = await admin.from('suppliers').select('id,name').eq('id', supplierId).maybeSingle()
  if (supplierError || !supplier) return res.status(404).json({ success: false, message: 'Supplier not found' })

  let source = null
  if (sourceId) {
    const { data: sourceData, error: sourceError } = await admin.from('supplier_catalog_sources').select('id,supplier_id,field_mapping').eq('id', sourceId).maybeSingle()
    if (sourceError || !sourceData || sourceData.supplier_id !== supplierId) {
      return res.status(400).json({ success: false, message: 'Catalog source does not belong to this supplier.' })
    }
    source = sourceData
    if ((!req.body?.mapping || Object.keys(mapping).length === 0) && source.field_mapping && typeof source.field_mapping === 'object') {
      mapping = source.field_mapping
    }
  }

  const normalizedRows = rowsInput.map((raw, index) => {
    const row = mapSupplierRow(raw, mapping)
    return {
      ...row,
      row_number: index + 2,
      validation_errors: validateSupplierRow(row),
    }
  })

  const keys = normalizedRows
    .filter((row) => row.manufacturer_key && row.mpn_key)
    .map((row) => `${row.manufacturer_key}::${row.mpn_key}`)

  const uniqueManufacturerKeys = [...new Set(normalizedRows.map((row) => row.manufacturer_key).filter(Boolean))]
  const { data: candidateProducts, error: candidateError } = uniqueManufacturerKeys.length
    ? await admin.from('products').select('*').in('manufacturer_key', uniqueManufacturerKeys)
    : { data: [], error: null }

  if (candidateError) return res.status(500).json({ success: false, message: candidateError.message })

  const productByKey = new Map((candidateProducts || []).map((product) => [`${product.manufacturer_key}::${product.mpn_key}`, product]))
  const preview = normalizedRows.map((row) => ({
    row_number: row.row_number,
    manufacturer: row.manufacturer,
    manufacturer_part_number: row.manufacturer_part_number,
    supplier_sku: row.supplier_sku,
    product_name: row.product_name,
    unit_cost: row.unit_cost,
    available_quantity: row.available_quantity,
    match_status: row.validation_errors.length
      ? 'rejected'
      : productByKey.has(`${row.manufacturer_key}::${row.mpn_key}`) ? 'matched' : 'create_draft',
    validation_errors: row.validation_errors,
  }))

  if (dryRun) {
    const summary = preview.reduce((acc, row) => {
      acc[row.match_status] = (acc[row.match_status] || 0) + 1
      return acc
    }, {})
    return res.status(200).json({ success: true, dryRun: true, supplier: supplier.name, summary, rows: preview.slice(0, 250), totalRows: preview.length })
  }

  const { data: job, error: jobError } = await admin.from('supplier_import_jobs').insert([{
    source_id: sourceId,
    supplier_id: supplierId,
    status: 'processing',
    row_count: normalizedRows.length,
    source_reference: clean(req.body?.sourceReference, 500) || null,
    file_name: clean(req.body?.fileName, 240) || null,
    created_by_user_id: null,
    started_at: new Date().toISOString(),
  }]).select().single()

  if (jobError) return res.status(500).json({ success: false, message: jobError.message })

  let matchedCount = 0
  let createdProductCount = 0
  let updatedOfferCount = 0
  let reviewCount = 0
  let rejectedCount = 0

  const stagingRows = []

  try {
    for (const row of normalizedRows) {
      let matchStatus = 'unmatched'
      let productId = null
      const errors = [...row.validation_errors]

      if (errors.length) {
        matchStatus = 'rejected'
        rejectedCount += 1
      } else {
        const key = `${row.manufacturer_key}::${row.mpn_key}`
        let product = productByKey.get(key)

        if (product) {
          matchedCount += 1
          matchStatus = 'matched'
        } else {
          const slug = slugifyProduct(row.manufacturer, row.manufacturer_part_number || row.supplier_sku, row.product_name)
          const { data: created, error: createError } = await admin.from('products').insert([{
            name: row.product_name,
            sku: row.manufacturer_part_number || row.supplier_sku,
            slug,
            category: row.category,
            manufacturer: row.manufacturer,
            manufacturer_part_number: row.manufacturer_part_number || row.supplier_sku,
            manufacturer_key: row.manufacturer_key,
            mpn_key: row.mpn_key,
            description: row.description,
            unit: row.unit || 'each',
            image_url: row.image_url,
            spec_sheet_url: row.spec_sheet_url,
            country_of_origin: row.country_of_origin,
            taa_compliant: row.taa_compliant,
            baba_compliant: row.baba_compliant,
            status: 'draft',
            catalog_origin: 'supplier_import',
            sourcing_status: 'offer_available',
          }]).select().single()

          if (createError) {
            if (String(createError.message || '').toLowerCase().includes('duplicate')) {
              const { data: existing } = await admin.from('products')
                .select('*')
                .eq('manufacturer_key', row.manufacturer_key)
                .eq('mpn_key', row.mpn_key)
                .maybeSingle()
              product = existing
              if (product) {
                matchedCount += 1
                matchStatus = 'matched'
              } else {
                errors.push(createError.message)
                matchStatus = 'ambiguous'
                reviewCount += 1
              }
            } else {
              errors.push(createError.message)
              matchStatus = 'ambiguous'
              reviewCount += 1
            }
          } else {
            product = created
            productByKey.set(key, product)
            createdProductCount += 1
            matchStatus = 'created'
          }
        }

        if (product) {
          productId = product.id
          const offerKey = row.supplier_sku || 'default'
          const { error: offerError } = await admin.from('supplier_offers').upsert([{
            supplier_id: supplierId,
            product_id: product.id,
            source_id: sourceId,
            supplier_sku: row.supplier_sku,
            offer_key: offerKey,
            channel_type: 'distributor',
            unit_cost: row.unit_cost,
            currency: row.currency || 'USD',
            available_quantity: row.available_quantity,
            availability_status: normalizeAvailability(row.availability_status),
            lead_time_days: row.lead_time_days,
            lead_time_text: row.lead_time_text,
            minimum_order_quantity: row.minimum_order_quantity,
            manufacturer_authorized: null,
            quote_required: row.unit_cost === null,
            source_updated_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            active: true,
            review_status: 'approved',
            reviewed_at: new Date().toISOString(),
          }], { onConflict: 'supplier_id,product_id,offer_key' })

          if (offerError) {
            errors.push(offerError.message)
            matchStatus = 'ambiguous'
            reviewCount += 1
          } else {
            updatedOfferCount += 1
            if (product.sourcing_status !== 'offer_available') {
              await admin.from('products').update({ sourcing_status: 'offer_available', updated_at: new Date().toISOString() }).eq('id', product.id)
            }
          }
        }
      }

      stagingRows.push({
        job_id: job.id,
        row_number: row.row_number,
        supplier_sku: row.supplier_sku,
        manufacturer: row.manufacturer,
        manufacturer_part_number: row.manufacturer_part_number,
        product_name: row.product_name,
        description: row.description,
        category: row.category,
        unit: row.unit,
        unit_cost: row.unit_cost,
        currency: row.currency,
        available_quantity: row.available_quantity,
        availability_status: normalizeAvailability(row.availability_status),
        lead_time_days: row.lead_time_days,
        lead_time_text: row.lead_time_text,
        minimum_order_quantity: row.minimum_order_quantity,
        image_url: row.image_url,
        spec_sheet_url: row.spec_sheet_url,
        country_of_origin: row.country_of_origin,
        taa_compliant: row.taa_compliant,
        baba_compliant: row.baba_compliant,
        manufacturer_key: row.manufacturer_key,
        mpn_key: row.mpn_key,
        match_status: matchStatus,
        matched_product_id: productId,
        validation_errors: errors,
        raw_data: row.raw_data,
      })
    }

    if (stagingRows.length) {
      for (let index = 0; index < stagingRows.length; index += 500) {
        const { error: stagingError } = await admin.from('supplier_import_rows').insert(stagingRows.slice(index, index + 500))
        if (stagingError) throw stagingError
      }
    }

    const finalStatus = reviewCount || rejectedCount ? 'completed_with_review' : 'completed'
    const completedAt = new Date().toISOString()
    await admin.from('supplier_import_jobs').update({
      status: finalStatus,
      matched_count: matchedCount,
      created_product_count: createdProductCount,
      updated_offer_count: updatedOfferCount,
      review_count: reviewCount,
      rejected_count: rejectedCount,
      completed_at: completedAt,
    }).eq('id', job.id)

    if (sourceId) {
      await admin.from('supplier_catalog_sources').update({
        last_sync_at: completedAt,
        last_success_at: completedAt,
        last_error: null,
        updated_at: completedAt,
      }).eq('id', sourceId)
    }

    return res.status(200).json({
      success: true,
      jobId: job.id,
      status: finalStatus,
      summary: { rows: normalizedRows.length, matchedCount, createdProductCount, updatedOfferCount, reviewCount, rejectedCount },
    })
  } catch (error) {
    const failedAt = new Date().toISOString()
    const errorMessage = String(error?.message || error)
    await admin.from('supplier_import_jobs').update({
      status: 'failed',
      error_summary: errorMessage,
      completed_at: failedAt,
    }).eq('id', job.id)

    if (sourceId) {
      await admin.from('supplier_catalog_sources').update({
        last_sync_at: failedAt,
        last_error_at: failedAt,
        last_error: errorMessage.slice(0, 2000),
        updated_at: failedAt,
      }).eq('id', sourceId)
    }

    return res.status(500).json({ success: false, jobId: job.id, message: errorMessage })
  }
}
