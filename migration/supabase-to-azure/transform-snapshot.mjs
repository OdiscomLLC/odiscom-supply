import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function deterministicUuid(scope, value) {
  const bytes = Buffer.from(sha256(`${scope}:${value}`).slice(0, 32), 'hex')
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function text(value) {
  const result = String(value ?? '').trim()
  return result || null
}

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function json(value) {
  return value === null || value === undefined ? null : JSON.stringify(value)
}

function dateOr(value, fallback) {
  return value || fallback || new Date(0).toISOString()
}

async function readJson(dir, name) {
  return JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'))
}

async function writeJson(dir, name, rows, files) {
  const serialized = stableJson(rows) + '\n'
  await fs.writeFile(path.join(dir, name), serialized, 'utf8')
  files[name] = {
    rows: Array.isArray(rows) ? rows.length : null,
    sha256: sha256(serialized),
  }
}

function indexBy(rows, keyFn) {
  const map = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return map
}

async function main() {
  const sourceDir = path.resolve(process.argv[2] || 'migration/supabase-to-azure/snapshots/latest')
  const outputDir = path.resolve(process.argv[3] || path.join(sourceDir, 'azure-shaped'))
  await fs.mkdir(outputDir, { recursive: true })

  const sourceManifest = await readJson(sourceDir, 'manifest.json')
  const tables = {}
  for (const name of Object.keys(sourceManifest.counts)) {
    tables[name] = await readJson(sourceDir, `${name}.json`)
  }
  const customerMaster = await readJson(sourceDir, 'customer-master.json')

  const files = {}
  const legacy = []
  const mapping = []

  const archive = (sourceEntity, sourceKey, fieldName, value, reason = 'No first-class target column') => {
    if (value === null || value === undefined || value === '') return
    legacy.push({
      SourceSystem: 'supabase',
      SourceEntity: sourceEntity,
      SourceRecordKey: String(sourceKey),
      FieldName: fieldName,
      JsonValue: JSON.stringify(value),
      ArchiveReason: reason,
    })
  }

  const manufacturerByKey = new Map()
  for (const product of tables.products) {
    const key = text(product.manufacturer_key)
    if (!key) throw new Error(`Product ${product.id} has no manufacturer_key.`)
    if (!manufacturerByKey.has(key)) {
      manufacturerByKey.set(key, {
        ManufacturerId: deterministicUuid('manufacturer', key),
        Name: text(product.manufacturer) || key,
        ManufacturerKey: key,
        Website: null,
        Status: 'active',
        CreatedAt: dateOr(product.created_at),
        UpdatedAt: dateOr(product.updated_at, product.created_at),
      })
    }
  }
  const manufacturers = [...manufacturerByKey.values()].sort((a, b) => a.ManufacturerKey.localeCompare(b.ManufacturerKey))

  const products = tables.products.map((row) => {
    const manufacturer = manufacturerByKey.get(row.manufacturer_key)
    if (!manufacturer) throw new Error(`Manufacturer mapping missing for product ${row.id}.`)

    archive('products', row.id, 'price', row.price, 'Legacy storefront price retained for audit')
    archive('products', row.id, 'cost', row.cost, 'Legacy product-level cost retained for audit; target cost is supplier-offer based')
    archive('products', row.id, 'lead_time', row.lead_time, 'Legacy product-level lead time retained for audit')
    archive('products', row.id, 'supplier_name', row.supplier_name, 'Legacy denormalized supplier field')
    archive('products', row.id, 'supplier_status', row.supplier_status, 'Legacy denormalized supplier field')
    archive('products', row.id, 'supplier_user_id', row.supplier_user_id, 'Supabase identity is not an Entra object ID')

    return {
      ProductId: row.id,
      ManufacturerId: manufacturer.ManufacturerId,
      ManufacturerPartNumber: row.manufacturer_part_number,
      MpnKey: row.mpn_key,
      Sku: row.sku,
      Slug: row.slug,
      Name: row.name,
      Description: row.description,
      Category: row.category,
      Unit: row.unit,
      Upc: row.upc,
      CountryOfOrigin: row.country_of_origin,
      TaaCompliant: row.taa_compliant,
      BabaCompliant: row.baba_compliant,
      ImageUrl: row.image_url,
      SpecSheetUrl: row.spec_sheet_url,
      SpecificationsJson: json(row.specifications),
      CatalogOrigin: row.catalog_origin,
      SourcingStatus: row.sourcing_status,
      PublicationStatus: row.status || 'draft',
      CreatedAt: dateOr(row.created_at),
      UpdatedAt: dateOr(row.updated_at, row.created_at),
    }
  })

  const supplierNameIndex = indexBy(tables.suppliers, (row) => normalize(row.name))
  const supplierOrganizations = []
  const suppliers = []
  const supplierContacts = []

  for (const row of tables.suppliers) {
    const externalOrganizationId = deterministicUuid('external-supplier', row.id)
    supplierOrganizations.push({
      ExternalOrganizationId: externalOrganizationId,
      OrganizationType: 'supplier',
      LegalName: row.name,
      Status: 'active',
      EntraExternalTenantId: null,
      CreatedAt: dateOr(row.created_at),
      UpdatedAt: dateOr(row.updated_at, row.created_at),
    })

    suppliers.push({
      SupplierId: row.id,
      ExternalOrganizationId: externalOrganizationId,
      LegalName: row.name,
      DisplayName: row.name,
      Website: row.website,
      Phone: row.phone,
      ProductCategories: row.product_categories,
      Brands: row.brands,
      PaymentTerms: row.payment_terms,
      DefaultLeadTime: row.lead_time,
      ApprovalStatus: row.approval_status || 'pending',
      OnboardingStatus: row.onboarding_status || 'new',
      Priority: row.priority,
      NextAction: row.next_action,
      ResaleCertificateStatus: row.resale_certificate_status,
      CreditStatus: row.credit_status,
      AccountNumber: row.account_number,
      Notes: row.notes,
      CreatedAt: dateOr(row.created_at),
      UpdatedAt: dateOr(row.updated_at, row.created_at),
    })

    if (row.contact_name || row.email || row.phone || row.sales_rep) {
      supplierContacts.push({
        SupplierContactId: deterministicUuid('supplier-primary-contact', row.id),
        SupplierId: row.id,
        ContactName: row.contact_name || row.sales_rep,
        Email: row.email,
        Phone: row.phone,
        RoleTitle: row.sales_rep ? 'Sales representative' : null,
        IsPrimary: true,
        CreatedAt: dateOr(row.created_at),
        UpdatedAt: dateOr(row.updated_at, row.created_at),
      })
    }

    archive('suppliers', row.id, 'owner_user_id', row.owner_user_id, 'Supabase identity is not an Entra object ID')
    archive('suppliers', row.id, 'application_url', row.application_url)
    archive('suppliers', row.id, 'government_programs', row.government_programs)
    archive('suppliers', row.id, 'last_contact_at', row.last_contact_at)
  }

  const supplierCatalogSources = tables.supplier_catalog_sources.map((row) => ({
    SupplierCatalogSourceId: row.id,
    SupplierId: row.supplier_id,
    Name: row.name,
    SourceType: row.source_type,
    Status: row.status,
    CredentialReference: row.credential_reference,
    EndpointUrl: row.endpoint_url,
    FieldMappingJson: json(row.field_mapping),
    SyncSettingsJson: json(row.sync_settings),
    LastSyncAt: row.last_sync_at,
    LastSuccessAt: row.last_success_at,
    LastErrorAt: row.last_error_at,
    LastError: row.last_error,
    CreatedAt: dateOr(row.created_at),
    UpdatedAt: dateOr(row.updated_at, row.created_at),
  }))

  const supplierOffers = tables.supplier_offers.map((row) => {
    archive('supplier_offers', row.id, 'submitted_by_user_id', row.submitted_by_user_id, 'Supabase identity is not an Entra object ID')
    return {
      SupplierOfferId: row.id,
      SupplierId: row.supplier_id,
      ProductId: row.product_id,
      SupplierCatalogSourceId: row.source_id,
      SupplierSku: row.supplier_sku,
      OfferKey: row.offer_key,
      ChannelType: row.channel_type,
      UnitCost: row.unit_cost,
      Currency: row.currency || 'USD',
      AvailableQuantity: row.available_quantity,
      AvailabilityStatus: row.availability_status,
      LeadTimeDays: row.lead_time_days,
      LeadTimeText: row.lead_time_text,
      MinimumOrderQuantity: row.minimum_order_quantity,
      PriceBreaksJson: json(row.price_breaks),
      FreightTerms: row.freight_terms,
      ManufacturerAuthorized: row.manufacturer_authorized,
      QuoteRequired: Boolean(row.quote_required),
      ValidUntil: row.valid_until,
      SourceUpdatedAt: row.source_updated_at,
      LastSeenAt: row.last_seen_at,
      IsActive: Boolean(row.active),
      ReviewStatus: row.review_status || 'pending',
      SubmittedByEntraObjectId: null,
      ReviewedAt: row.reviewed_at,
      ReviewNotes: row.review_notes,
      Notes: row.notes,
      CreatedAt: dateOr(row.created_at),
      UpdatedAt: dateOr(row.updated_at, row.created_at),
    }
  })

  const supplierImportJobs = tables.supplier_import_jobs.map((row) => {
    archive('supplier_import_jobs', row.id, 'created_by_user_id', row.created_by_user_id, 'Supabase identity is not an Entra object ID')
    return {
      SupplierImportJobId: row.id,
      SupplierCatalogSourceId: row.source_id,
      SupplierId: row.supplier_id,
      Status: row.status,
      FileName: row.file_name,
      StorageUri: row.storage_path,
      SourceReference: row.source_reference,
      RowCount: row.row_count,
      MatchedCount: row.matched_count,
      CreatedProductCount: row.created_product_count,
      UpdatedOfferCount: row.updated_offer_count,
      ReviewCount: row.review_count,
      RejectedCount: row.rejected_count,
      ErrorSummary: row.error_summary,
      CreatedByEntraObjectId: null,
      StartedAt: row.started_at,
      CompletedAt: row.completed_at,
      CreatedAt: dateOr(row.created_at),
    }
  })

  const supplierImportRows = tables.supplier_import_rows.map((row) => ({
    SupplierImportRowId: row.id,
    SupplierImportJobId: row.job_id,
    RowNumber: row.row_number ?? 0,
    SupplierSku: row.supplier_sku,
    Manufacturer: row.manufacturer,
    ManufacturerPartNumber: row.manufacturer_part_number,
    ProductName: row.product_name,
    UnitCost: row.unit_cost,
    Currency: row.currency,
    AvailableQuantity: row.available_quantity,
    AvailabilityStatus: row.availability_status,
    LeadTimeDays: row.lead_time_days,
    LeadTimeText: row.lead_time_text,
    MinimumOrderQuantity: row.minimum_order_quantity,
    PriceBreaksJson: json(row.price_breaks),
    CountryOfOrigin: row.country_of_origin,
    TaaCompliant: row.taa_compliant,
    BabaCompliant: row.baba_compliant,
    MatchStatus: row.match_status,
    MatchedProductId: row.matched_product_id,
    ValidationErrorsJson: json(row.validation_errors),
    RawDataJson: json(row.raw_data),
    CreatedAt: dateOr(row.created_at),
  }))

  const sourceCustomersById = new Map(tables.customers.map((row) => [row.id, row]))
  const customerByCompany = new Map()
  const customerByEmail = new Map()
  const customerOrganizations = []
  const customers = []
  const customerContacts = []
  const customerLocations = []

  for (const master of customerMaster) {
    const existingSource = master.source_records
      .filter((record) => record.source_entity === 'customers')
      .map((record) => sourceCustomersById.get(record.source_key))
      .find(Boolean)

    const customerId = existingSource?.id || deterministicUuid('customer', master.company_key)
    const externalOrganizationId = deterministicUuid('external-customer', master.company_key)
    const createdAt = existingSource?.created_at || master.first_seen_at || new Date(0).toISOString()
    const updatedAt = existingSource?.updated_at || master.last_seen_at || createdAt

    customerOrganizations.push({
      ExternalOrganizationId: externalOrganizationId,
      OrganizationType: 'customer',
      LegalName: master.display_company,
      Status: existingSource?.account_status || 'active',
      EntraExternalTenantId: null,
      CreatedAt: createdAt,
      UpdatedAt: updatedAt,
    })

    customers.push({
      CustomerId: customerId,
      ExternalOrganizationId: externalOrganizationId,
      LegalName: master.display_company,
      DisplayName: master.display_company,
      AccountStatus: existingSource?.account_status || 'active',
      PricingTier: existingSource?.pricing_tier || null,
      TaxStatus: existingSource?.tax_status || null,
      PaymentPreference: existingSource?.payment_preference || null,
      FreightPreference: existingSource?.freight_preference || null,
      PoRequired: Boolean(existingSource?.po_required),
      IsRelatedCompany: Boolean(master.is_related_company),
      CreatedAt: createdAt,
      UpdatedAt: updatedAt,
    })

    const contactId = deterministicUuid('customer-primary-contact', customerId)
    const contactEmail = existingSource?.email || master.observed_emails?.[0] || null
    const contactName = existingSource?.contact_name || master.observed_contacts?.[0] || null
    const contactPhone = existingSource?.phone || master.observed_phones?.[0] || null

    if (contactEmail || contactName || contactPhone) {
      customerContacts.push({
        CustomerContactId: contactId,
        CustomerId: customerId,
        ContactName: contactName,
        Email: contactEmail,
        Phone: contactPhone,
        RoleTitle: null,
        IsPrimary: true,
        CreatedAt: createdAt,
        UpdatedAt: updatedAt,
      })
    }

    if (existingSource && (existingSource.address_line1 || existingSource.city || existingSource.state || existingSource.postal_code)) {
      customerLocations.push({
        CustomerLocationId: deterministicUuid('customer-default-location', customerId),
        CustomerId: customerId,
        LocationName: 'Default',
        AddressLine1: existingSource.address_line1,
        AddressLine2: existingSource.address_line2,
        City: existingSource.city,
        StateProvince: existingSource.state,
        PostalCode: existingSource.postal_code,
        Country: existingSource.country || 'United States',
        IsDefaultShipTo: true,
        CreatedAt: createdAt,
        UpdatedAt: updatedAt,
      })
    }

    customerByCompany.set(master.company_key, { customerId, contactId: contactEmail || contactName || contactPhone ? contactId : null })
    for (const email of master.observed_emails || []) customerByEmail.set(normalize(email), customerId)

    for (const sourceRecord of master.source_records) {
      mapping.push({
        SourceSystem: 'supabase',
        SourceEntity: sourceRecord.source_entity,
        SourceKey: sourceRecord.source_key,
        TargetEntity: 'commerce.Customer',
        TargetId: customerId,
        MappingReason: existingSource?.id === customerId ? 'Preserved existing customer UUID' : 'Normalized company customer master',
        IsGeneratedTargetId: existingSource?.id !== customerId,
      })
    }
  }

  const getCustomer = (company, email) => {
    const companyMatch = customerByCompany.get(normalize(company))
    if (companyMatch) return companyMatch
    const emailCustomerId = customerByEmail.get(normalize(email))
    if (emailCustomerId) {
      const contact = customerContacts.find((row) => row.CustomerId === emailCustomerId)
      return { customerId: emailCustomerId, contactId: contact?.CustomerContactId || null }
    }
    return null
  }

  const productBySlug = new Map(products.filter((row) => row.Slug).map((row) => [row.Slug, row]))
  const productByName = indexBy(products, (row) => normalize(row.Name))
  const supplierIdFromName = (name) => {
    const matches = supplierNameIndex.get(normalize(name)) || []
    return matches.length === 1 ? matches[0].id : null
  }

  const quotes = tables.quotes.map((row) => {
    const customer = getCustomer(row.company, row.email)
    if (!customer) throw new Error(`Quote ${row.id} cannot be assigned to a customer organization.`)
    archive('quotes', row.id, 'assigned_to', row.assigned_to, 'Legacy assignee is not an Entra object ID')
    return {
      QuoteId: row.id,
      QuoteNumber: row.quote_id,
      CustomerId: customer.customerId,
      CustomerContactId: customer.contactId,
      Status: row.status,
      Priority: row.priority,
      Source: row.source,
      CustomerReference: null,
      Details: row.details,
      InternalNotes: row.internal_notes,
      AssignedToEntraObjectId: null,
      AcceptanceToken: row.acceptance_token,
      QuotedAt: row.quoted_at,
      AcceptedAt: row.accepted_at,
      ValidUntil: null,
      CreatedAt: dateOr(row.created_at),
      UpdatedAt: dateOr(row.quoted_at || row.accepted_at, row.created_at),
    }
  })

  const quoteItems = tables.quote_items.map((row) => {
    const product = row.product_slug ? productBySlug.get(row.product_slug) : null
    const supplierId = supplierIdFromName(row.supplier_name)
    if (row.supplier_name && !supplierId) archive('quote_items', row.id, 'supplier_name', row.supplier_name, 'Could not resolve unique supplier by legacy name')
    return {
      QuoteItemId: row.id,
      QuoteId: row.quote_id,
      ProductId: product?.ProductId || null,
      ProductName: row.product_name,
      ManufacturerPartNumber: product?.ManufacturerPartNumber || null,
      Quantity: row.quantity,
      Unit: row.unit,
      UnitPrice: row.unit_price,
      UnitCost: row.unit_cost,
      TotalPrice: row.total_price,
      SupplierId: supplierId,
      CostConfirmed: Boolean(row.cost_confirmed),
      Notes: row.notes,
      CreatedAt: dateOr(row.created_at),
    }
  })

  const salesOrders = []
  const salesOrderItems = []
  const shipments = []
  const paymentReferences = []

  for (const row of tables.orders) {
    const customer = getCustomer(row.company, row.email)
    if (!customer) throw new Error(`Order ${row.id} cannot be assigned to a customer organization.`)

    archive('orders', row.id, 'delivery_location', row.delivery_location, 'Legacy unstructured delivery location retained for audit')
    archive('orders', row.id, 'phone', row.phone, 'Contact phone is represented through customer contact')

    salesOrders.push({
      SalesOrderId: row.id,
      QuoteId: row.quote_id,
      OrderNumber: row.order_number,
      CustomerId: customer.customerId,
      CustomerContactId: customer.contactId,
      Status: row.status,
      Total: row.total,
      PaymentMethod: row.payment_method,
      PaymentStatus: row.payment_status,
      PoNumber: row.po_number,
      CustomerReference: row.customer_reference,
      FreightPreference: row.freight_preference,
      CustomerLocationId: null,
      FulfillmentStatus: row.fulfillment_status,
      ExpectedDelivery: row.expected_delivery,
      ShippedAt: row.shipped_at,
      DeliveredAt: row.delivered_at,
      CreatedAt: dateOr(row.created_at),
      UpdatedAt: dateOr(row.updated_at, row.created_at),
    })

    if (row.carrier || row.tracking_number || row.tracking_url || row.shipped_at || row.delivered_at) {
      shipments.push({
        ShipmentId: deterministicUuid('shipment', row.id),
        SalesOrderId: row.id,
        Carrier: row.carrier,
        TrackingNumber: row.tracking_number,
        TrackingUrl: row.tracking_url,
        Status: row.fulfillment_status,
        ExpectedDelivery: row.expected_delivery,
        ShippedAt: row.shipped_at,
        DeliveredAt: row.delivered_at,
        CreatedAt: dateOr(row.created_at),
        UpdatedAt: dateOr(row.updated_at, row.created_at),
      })
    }

    if (row.stripe_checkout_session_id) {
      paymentReferences.push({
        PaymentReferenceId: deterministicUuid('stripe-checkout-session', row.id),
        SalesOrderId: row.id,
        Provider: 'stripe',
        ProviderReference: row.stripe_checkout_session_id,
        PaymentMethod: row.payment_method,
        Status: row.payment_status,
        Amount: row.total,
        Currency: 'USD',
        CreatedAt: dateOr(row.created_at),
        UpdatedAt: dateOr(row.updated_at, row.created_at),
      })
    }

    if (row.stripe_payment_intent_id) {
      paymentReferences.push({
        PaymentReferenceId: deterministicUuid('stripe-payment-intent', row.id),
        SalesOrderId: row.id,
        Provider: 'stripe',
        ProviderReference: row.stripe_payment_intent_id,
        PaymentMethod: row.payment_method,
        Status: row.payment_status,
        Amount: row.total,
        Currency: 'USD',
        CreatedAt: dateOr(row.created_at),
        UpdatedAt: dateOr(row.updated_at, row.created_at),
      })
    }
  }

  for (const row of tables.order_items) {
    const nameMatches = productByName.get(normalize(row.product_name)) || []
    const product = nameMatches.length === 1 ? nameMatches[0] : null
    const supplierId = supplierIdFromName(row.supplier_name)
    if (row.supplier_name && !supplierId) archive('order_items', row.id, 'supplier_name', row.supplier_name, 'Could not resolve unique supplier by legacy name')
    salesOrderItems.push({
      SalesOrderItemId: row.id,
      SalesOrderId: row.order_id,
      ProductId: product?.ProductId || null,
      ProductName: row.product_name,
      Quantity: row.quantity,
      UnitPrice: row.unit_price,
      UnitCost: row.unit_cost,
      TotalPrice: row.total_price,
      SupplierId: supplierId,
      CostConfirmed: Boolean(row.cost_confirmed),
      CreatedAt: dateOr(row.created_at),
    })
  }

  const orderEvents = tables.order_events.map((row) => {
    archive('order_events', row.id, 'created_by', row.created_by, 'Legacy text identity is not an Entra object ID')
    return {
      OrderEventId: row.id,
      SalesOrderId: row.order_id,
      EventType: row.event_type,
      Title: row.title,
      Detail: row.detail,
      Visibility: row.visibility,
      MetadataJson: json(row.metadata),
      CreatedByEntraObjectId: null,
      CreatedAt: dateOr(row.created_at),
    }
  })

  const customerDocuments = tables.customer_documents.map((row) => {
    const customerId = customerByEmail.get(normalize(row.customer_email))
    if (!customerId) throw new Error(`Customer document ${row.id} cannot be assigned by customer_email.`)
    archive('customer_documents', row.id, 'owner_user_id', row.owner_user_id, 'Supabase identity is not an Entra object ID')
    return {
      CustomerDocumentId: row.id,
      CustomerId: customerId,
      DocumentType: row.document_type,
      FileName: row.file_name,
      StorageUri: row.storage_path,
      Status: row.status,
      Visibility: 'customer',
      CreatedAt: dateOr(row.created_at),
    }
  })

  const materialUploads = tables.material_uploads.map((row) => {
    const customer = getCustomer(row.company, row.customer_email)
    return {
      MaterialUploadId: row.id,
      CustomerId: customer?.customerId || null,
      CustomerContactId: customer?.contactId || null,
      SourceCompanyName: row.company,
      SourceEmail: row.customer_email,
      FileName: row.file_name || `material-upload-${row.id}`,
      StorageUri: row.file_url || `legacy://material_uploads/${row.id}`,
      Notes: row.notes,
      Status: row.status || 'new',
      UploadedByEntraObjectId: null,
      CreatedAt: dateOr(row.created_at),
      UpdatedAt: dateOr(row.created_at),
    }
  })

  const hardwareOpportunities = tables.hardware_opportunities.map((row) => {
    archive('hardware_opportunities', row.id, 'assigned_to', row.assigned_to, 'Legacy assignee is not an Entra object ID')
    return {
      HardwareOpportunityId: row.id,
      SolicitationNumber: row.solicitation_number,
      Title: row.title,
      Agency: row.agency,
      ContractingOffice: row.contracting_office,
      NoticeType: row.notice_type,
      Naics: row.naics,
      Psc: row.psc,
      SetAside: row.set_aside,
      PostedAt: row.posted_at,
      ResponseDeadline: row.response_deadline,
      SourceUrl: row.source_url,
      DeliveryLocations: row.delivery_locations,
      ScopeSummary: row.scope_summary,
      BiddingEntity: row.bidding_entity,
      Stage: row.stage,
      Priority: row.priority,
      FitScore: row.fit_score,
      EstimatedValue: row.estimated_value,
      TargetRevenue: row.target_revenue,
      EstimatedCost: row.estimated_cost,
      AssignedToEntraObjectId: null,
      NextAction: row.next_action,
      NextActionDue: row.next_action_due,
      SubmissionMethod: row.submission_method,
      SubmissionContact: row.submission_contact,
      Notes: row.notes,
      CreatedAt: dateOr(row.created_at),
      UpdatedAt: dateOr(row.updated_at, row.created_at),
    }
  })

  const hardwareOpportunityItems = tables.hardware_opportunity_items.map((row) => {
    for (const field of ['source_item_number', 'source_sequence', 'manufacturer_description', 'unit_quantity', 'source_file']) {
      archive('hardware_opportunity_items', row.id, field, row[field])
    }
    return {
      HardwareOpportunityItemId: row.id,
      HardwareOpportunityId: row.opportunity_id,
      LineNumber: row.line_number,
      ClinNumber: row.clin_number,
      SiteName: row.site_name,
      Description: row.description,
      Quantity: row.quantity,
      Unit: row.unit,
      PreferredManufacturer: row.preferred_manufacturer,
      PreferredPartNumber: row.preferred_part_number,
      BrandNameOrEqual: row.brand_name_or_equal,
      TaaRequired: row.taa_required,
      BabaRequired: row.baba_required,
      DomesticSourceRequired: row.domestic_source_required,
      BestSupplierId: row.best_supplier_id,
      UnitCost: row.unit_cost,
      FreightAllocation: row.freight_allocation,
      SellUnitPrice: row.sell_unit_price,
      LeadTime: row.lead_time,
      ComplianceNotes: row.compliance_notes,
      DeliveryDate: row.delivery_date,
      QuantityStatus: row.quantity_status,
      CreatedAt: dateOr(row.created_at),
      UpdatedAt: dateOr(row.updated_at, row.created_at),
    }
  })

  const opportunitySupplierQuotes = tables.opportunity_supplier_quotes.map((row) => ({
    OpportunitySupplierQuoteId: row.id,
    HardwareOpportunityId: row.opportunity_id,
    SupplierId: row.supplier_id,
    Status: row.status,
    RfqSentAt: row.rfq_sent_at,
    ResponseDueAt: row.response_due_at,
    ReceivedAt: row.received_at,
    ValidityExpiresAt: row.validity_expires_at,
    MaterialCost: row.material_cost,
    FreightCost: row.freight_cost,
    OtherCost: row.other_cost,
    SellPrice: row.sell_price,
    LeadTime: row.lead_time,
    ComplianceStatus: row.compliance_status,
    DomesticStatus: row.domestic_status,
    QuoteReference: row.quote_reference,
    QuoteUri: row.quote_url,
    ContactName: row.contact_name,
    ContactEmail: row.contact_email,
    CostsConfirmed: Boolean(row.costs_confirmed),
    Notes: row.notes,
    CreatedAt: dateOr(row.created_at),
    UpdatedAt: dateOr(row.updated_at, row.created_at),
  }))

  const outputs = {
    'identity.ExternalOrganization.json': [...customerOrganizations, ...supplierOrganizations],
    'catalog.Manufacturer.json': manufacturers,
    'catalog.Product.json': products,
    'sourcing.Supplier.json': suppliers,
    'sourcing.SupplierContact.json': supplierContacts,
    'sourcing.SupplierCatalogSource.json': supplierCatalogSources,
    'sourcing.SupplierOffer.json': supplierOffers,
    'sourcing.SupplierImportJob.json': supplierImportJobs,
    'sourcing.SupplierImportRow.json': supplierImportRows,
    'commerce.Customer.json': customers,
    'commerce.CustomerContact.json': customerContacts,
    'commerce.CustomerLocation.json': customerLocations,
    'commerce.CustomerDocument.json': customerDocuments,
    'commerce.MaterialUpload.json': materialUploads,
    'commerce.Quote.json': quotes,
    'commerce.QuoteItem.json': quoteItems,
    'commerce.SalesOrder.json': salesOrders,
    'commerce.SalesOrderItem.json': salesOrderItems,
    'commerce.OrderEvent.json': orderEvents,
    'commerce.PaymentReference.json': paymentReferences,
    'commerce.Shipment.json': shipments,
    'ops.HardwareOpportunity.json': hardwareOpportunities,
    'ops.HardwareOpportunityItem.json': hardwareOpportunityItems,
    'ops.OpportunitySupplierQuote.json': opportunitySupplierQuotes,
    'migration.SourceRecordMap.json': mapping,
    'migration.SourceFieldArchive.json': legacy,
  }

  for (const [name, rows] of Object.entries(outputs)) {
    await writeJson(outputDir, name, rows, files)
    console.log(`Transformed ${name}: ${rows.length}`)
  }

  const manifest = {
    schema_version: 1,
    source_manifest_sha256: sha256(stableJson(sourceManifest) + '\n'),
    transformed_at: new Date().toISOString(),
    files,
    checks: {
      source_products: tables.products.length,
      target_products: products.length,
      source_suppliers: tables.suppliers.length,
      target_suppliers: suppliers.length,
      source_supplier_offers: tables.supplier_offers.length,
      target_supplier_offers: supplierOffers.length,
      source_quotes: tables.quotes.length,
      target_quotes: quotes.length,
      source_orders: tables.orders.length,
      target_sales_orders: salesOrders.length,
      source_opportunity_items: tables.hardware_opportunity_items.length,
      target_opportunity_items: hardwareOpportunityItems.length,
      legacy_fields_archived: legacy.length,
    },
  }

  await writeJson(outputDir, 'transform-manifest.json', manifest, files)
  console.log(`Azure-shaped transform complete: ${outputDir}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
})
