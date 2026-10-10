# Odiscom Supply — Microsoft-Native Migration Blueprint

**Status:** Approved architectural direction  
**Date:** 2026-10-10  
**Scope:** Odiscom Supply LLC / odiscomsupply.com  
**Current platform:** Next.js on Vercel + Supabase + GitHub  
**Target platform:** Microsoft-only production stack

---

## 1. Non-negotiable company boundary

Odiscom Supply LLC and Odiscom LLC are separate companies and must remain separate in identity, data ownership, contracts, accounting, supplier relationships, and system administration.

### Odiscom Supply LLC

- Operates **odiscomsupply.com**.
- Sells telecom, fiber, wireless, networking, industrial, and related hardware/materials.
- Owns its supplier catalog, supplier pricing, customer quotes, sales orders, fulfillment records, customer documents, supplier records, and sourcing workflows.
- Serves the external market broadly.
- **Odiscom LLC is one customer of Odiscom Supply LLC.**

### Odiscom LLC

- Architecture & Engineering firm.
- Operates **odiscom.com** and its own internal systems.
- May buy products/materials from Odiscom Supply.
- Odiscom Supply must not inherit Odiscom LLC registrations, engineering licenses, past performance, supplier approvals, contracts, vendor representations, or other entity-specific credentials unless a specific agreement explicitly permits it.

### os.odiscom.com boundary

`os.odiscom.com` is an Odiscom LLC system and is an external peer from the perspective of Odiscom Supply.

**Hard constraint:** this migration may not modify, deploy into, reconfigure, or create a dependency on `os.odiscom.com`.

Future Odiscom Supply integration with `os.odiscom.com` is allowed only through an explicit, approved interface. Until such an interface exists, Odiscom Supply must continue to operate independently.

---

## 2. Target user experiences

The Microsoft-native Odiscom Supply platform will provide three intentionally separate experiences.

### A. External B2B Customer Experience

**Audience:** contractors, ISPs, integrators, public-sector buyers, commercial customers, Odiscom LLC, and other buyers.

**Primary domain:** `www.odiscomsupply.com`

Capabilities:

- Public catalog and manufacturer search.
- Product/specification pages.
- BOM/material-list upload.
- Project cart.
- Request-for-pricing / quote request.
- Customer account.
- Company profile and ship-to locations.
- Tax/resale documents.
- Quotes and quote acceptance.
- Orders.
- PO/customer-reference information.
- Shipment and delivery status.
- Invoice/payment information as applicable.
- Customer-visible order events.

Odiscom LLC uses this customer experience as a customer account. It does not receive internal Odiscom Supply administrative privileges merely because the companies are affiliated.

### B. External Supplier Experience

**Audience:** manufacturers, distributors, supplier sales representatives, and other approved supply partners.

Capabilities:

- Supplier onboarding/profile.
- Product and offer submissions.
- Cost, availability, MOQ, price-break, lead-time, freight, and validity updates.
- File/API/catalog-feed status.
- RFQ response workflows.
- Supplier-specific documents.
- Review/approval status.

A supplier may access only its own supplier organization and its own submissions/offers.

### C. Odiscom Supply Internal Experience

**Audience:** approved Odiscom Supply personnel only.

**Identity:** Microsoft Entra ID.

**Primary internal surface:** SharePoint Online / SPFx workspace, backed by Azure services.

Capabilities:

- Operations dashboard.
- Quotes.
- Orders.
- Fulfillment.
- Customer administration.
- Supplier pipeline.
- Supplier-offer review.
- Catalog imports.
- Live supplier API connectors.
- Hardware opportunity workflow.
- BOM normalization and sourcing.
- Pricing/margin review.
- Compliance review.
- Internal documents and operational records.

The internal experience is not a public-store route with a generic password page. It must be protected by Microsoft identity and role authorization.

---

## 3. Microsoft target architecture

### Public and external application tier

**Azure App Service**
- Hosts the external customer and supplier web applications.
- Preserves the custom Odiscom Supply storefront instead of forcing the public ecommerce experience into SharePoint.
- Supports server-rendered application/API needs that exist in the current Next.js implementation.

**Azure Front Door**
- Fronts public Odiscom Supply applications.
- Centralizes TLS, custom domains, edge routing, WAF, and controlled cutover from Vercel.

### Identity

**Microsoft Entra ID**
- Odiscom Supply internal workforce identity.
- Internal access is based on approved Odiscom Supply identities/groups/roles.

**Microsoft Entra External ID**
- External customer and supplier identities.
- External users must not become members of internal Odiscom Supply security groups.
- Customer and supplier authorization is separated even when the same email address could theoretically exist in both contexts.

### Internal application surface

**SharePoint Online + SPFx**
- Internal Odiscom Supply operations workspace.
- Dashboards, task-oriented views, document surfaces, and staff workflows.
- Uses Microsoft Graph and Azure APIs.
- Reuses technical patterns proven in Odiscom AI where appropriate without making Odiscom Supply part of Odiscom LLC.

### API and business logic

**Azure Functions**
- Quote/order/customer/supplier APIs.
- Supplier connector execution.
- BOM processing.
- Catalog normalization.
- offer ranking.
- RFQ workflow.
- integration adapters.
- webhooks.

**Azure API Management** may be added when external/partner/API governance warrants it.

### Transactional data

**Azure SQL Database**
- System of record for structured commerce and sourcing data.
- Replaces Supabase/Postgres.
- Appropriate for products, suppliers, offers, customers, quotes, orders, opportunity records, import audit data, and relational history.

### Documents/files

**SharePoint Online**
- Internal operational documents and governed business records.

**Azure Blob Storage**
- Application-managed external uploads and generated artifacts where direct SharePoint storage is not appropriate.
- BOM uploads, temporary import files, generated quote/order artifacts, integration payload archives.

Customer- or supplier-facing delivery of protected files occurs through the application/API layer rather than exposing internal SharePoint libraries directly unless deliberately configured.

### Secrets

**Azure Key Vault**
- DigiKey, Mouser, future supplier API secrets.
- Stripe/payment secrets if retained.
- webhook secrets.
- inter-system credentials.

No supplier secret belongs in browser-visible configuration.

### Messaging and workflows

**Logic Apps / Power Automate**
- Human workflow, approvals, SharePoint-oriented automation, and Microsoft 365 integrations.

**Azure Service Bus**
- Use where durable asynchronous application events are needed, such as supplier synchronization, bulk imports, quote generation, or order-event processing.

### Observability

**Application Insights + Azure Monitor**
- Request telemetry.
- function failures.
- supplier API failures.
- queue/workflow health.
- application exceptions.

### Source control and CI/CD

**Azure DevOps Repos + Azure Pipelines**
- Replaces GitHub.
- Build/deploy pipelines for Azure App Service, Functions, SPFx, and infrastructure.
- Production environment approvals and audit history.

### Infrastructure

**Bicep**
- Preferred infrastructure-as-code for Azure resources.
- Keeps the target fully Microsoft-native.

---

## 4. Data-domain ownership

The target database is organized by Odiscom Supply business domains rather than by whichever UI happens to consume the data.

### Commerce

- Customer
- CustomerContact
- CustomerLocation
- CustomerDocument
- Quote
- QuoteItem
- SalesOrder
- SalesOrderItem
- OrderEvent
- PaymentReference
- Shipment

### Catalog

- Product
- Manufacturer
- ProductSpecification
- ProductDocument

### Supplier sourcing

- Supplier
- SupplierContact
- SupplierCatalogSource
- SupplierOffer
- SupplierImportJob
- SupplierImportRow
- SupplierRFQ
- SupplierRFQLine
- SupplierQuote

### Opportunity intelligence

- HardwareOpportunity
- HardwareOpportunityItem
- OpportunitySupplierQuote
- OpportunityDecision

### Identity/authorization

- InternalRoleAssignment
- ExternalOrganization
- ExternalOrganizationMember
- CustomerAccountLink
- SupplierAccountLink

Microsoft identity object IDs are stored as identity references. Email addresses are contact attributes, not the sole authorization key.

---

## 5. Current Supabase → Microsoft data mapping

| Current Supabase object | Microsoft target | Notes |
| --- | --- | --- |
| `products` | Azure SQL Product | Preserve canonical manufacturer + MPN identity |
| `suppliers` | Azure SQL Supplier | Odiscom Supply-owned supplier master |
| `supplier_offers` | Azure SQL SupplierOffer | Supplier-specific cost/availability/lead time |
| `supplier_catalog_sources` | Azure SQL SupplierCatalogSource + Key Vault refs | Store secret reference, never secret value |
| `supplier_import_jobs` | Azure SQL SupplierImportJob | Durable import audit |
| `supplier_import_rows` | Azure SQL SupplierImportRow | Staging/audit; retention policy may later archive old raw rows |
| `customers` | Azure SQL Customer | Odiscom LLC is one row/account here |
| `quotes` | Azure SQL Quote | Separate customer-visible and internal fields |
| `quote_items` | Azure SQL QuoteItem | Preserve confirmed-cost tracking |
| `orders` | Azure SQL SalesOrder | Preserve PO/payment/fulfillment fields |
| `order_items` | Azure SQL SalesOrderItem | Preserve cost and supplier attribution |
| `order_events` | Azure SQL OrderEvent | Visibility remains explicit |
| `material_uploads` | Azure SQL upload metadata + Blob Storage | Files move to Microsoft storage |
| `customer_documents` | Azure SQL metadata + SharePoint/Blob | Restricted by customer organization |
| `hardware_opportunities` | Azure SQL HardwareOpportunity | Supply company opportunity workflow |
| `hardware_opportunity_items` | Azure SQL HardwareOpportunityItem | Preserve solicitation-line detail |
| `opportunity_supplier_quotes` | Azure SQL OpportunitySupplierQuote | Supplier cost/compliance review |
| `admin_users` | Entra groups/roles + Azure SQL role assignment if needed | Supabase password/admin model is retired |
| Supabase Storage | SharePoint/Blob | Migrate by document class |
| Supabase Auth | Entra ID / Entra External ID | No Supabase auth after cutover |
| RLS policies | Application/API authorization + SQL permissions | Entra identity/organization IDs become canonical access keys |

---

## 6. Current web-route → target experience mapping

### Public/customer routes

These remain part of the public/customer application:

- `/`
- `/shop`
- `/category/[slug]`
- `/manufacturers`
- `/manufacturer/[slug]`
- `/product/[slug]`
- `/compare`
- `/project-cart`
- `/material-upload`
- `/quote`
- `/quote/accept/[id]`
- `/account`
- `/account/company`
- `/account/documents`
- `/account/quotes/[id]`
- `/account/orders/[id]`

### Supplier routes

These become the external supplier application:

- `/supplier`
- `/supplier/profile`
- `/supplier/products`

The existing `/supplier/login` password flow is transitional and will be replaced by Entra External ID.

### Internal routes

Current `/admin/*` functionality migrates to the internal Microsoft workspace rather than remaining a public-web admin section:

- Dashboard
- Hardware opportunities
- Quotes
- Orders
- Products
- Suppliers
- Catalog imports
- Supplier review
- Material uploads
- Supplier connector status/sync

The final internal experience is SharePoint/SPFx + Azure API services, protected with Entra ID.

---

## 7. Supplier connectors

Supplier connectors are business assets of Odiscom Supply and should survive the platform migration.

### DigiKey

Current connector functions:
- OAuth/client credential authentication.
- Product search/detail lookup.
- exact manufacturer/MPN matching.
- pricing/price breaks.
- stock/availability.
- lead time.
- supplier SKU.
- datasheet/image metadata.

Target:
- Azure Function.
- credentials in Key Vault.
- scheduled/manual execution.
- supplier source health in Azure SQL.
- telemetry in Application Insights.

### Mouser

Target mirrors DigiKey:
- Azure Function.
- Key Vault secret.
- offer upsert to Azure SQL.
- monitored source health.

### Adams Cable Equipment

- Historical May 29, 2026 inventory remains historical sourcing intelligence, not current inventory.
- Normalize and migrate all canonical products/offers/import audit.
- Preserve stale/historical state.
- Do not convert old quantities into current stock.

### Future suppliers

All future supplier integrations should conform to a common Microsoft-hosted adapter contract:

1. authenticate,
2. lookup by exact manufacturer + manufacturer part number,
3. normalize response,
4. store supplier offer,
5. record source time/freshness,
6. retain authorization/compliance evidence separately,
7. emit telemetry,
8. never auto-publish a new canonical product without Odiscom Supply review unless an explicit policy later allows it.

---

## 8. Odiscom LLC as a customer

Odiscom LLC is handled as a normal customer organization inside Odiscom Supply.

Possible future workflow:

1. Odiscom LLC submits a BOM/material request to Odiscom Supply.
2. Odiscom Supply creates a customer quote request.
3. Odiscom Supply sources supplier offers.
4. Odiscom Supply prices the material package.
5. Odiscom LLC receives an Odiscom Supply quote.
6. Odiscom LLC issues a PO or otherwise accepts under agreed terms.
7. Odiscom Supply fulfills the order.
8. Odiscom Supply records the sale in its own accounting/commerce records.

This preserves company separation while allowing automation.

---

## 9. Odiscom AI relationship

Odiscom Supply may reuse **technical patterns** from Odiscom AI, especially:

- Entra authentication patterns.
- Azure Functions conventions.
- SharePoint/SPFx deployment patterns.
- Microsoft Graph integration patterns.
- environment/configuration structure.
- Azure monitoring conventions.
- permission/group models.
- deployment scripts and Bicep patterns when they are generic.

However:

- Odiscom Supply is not an Odiscom LLC module.
- Odiscom Supply data is not silently moved into an Odiscom LLC SharePoint site/database.
- Odiscom AI must not become a required runtime dependency for Odiscom Supply.
- Any Odiscom LLC ↔ Odiscom Supply data exchange must use an explicit intercompany integration.

---

## 10. os.odiscom.com integration boundary

A future adapter may permit approved exchanges with `os.odiscom.com`.

Allowed future patterns:

- HTTPS API with explicit service identity.
- Microsoft Graph/SharePoint access granted to a specific app registration.
- event/webhook contract.
- read-only query endpoint.
- controlled document exchange.

Not allowed without a separately approved task:

- changing `os.odiscom.com` code,
- changing its DNS,
- changing its SharePoint site,
- changing its Entra application,
- changing its permissions,
- writing directly to its underlying data stores,
- making Odiscom Supply depend on undocumented internal behavior.

The initial Odiscom Supply migration has **no dependency on os.odiscom.com**.

---

## 11. Identity and authorization design

### Internal staff

Use Entra ID security groups / application roles, for example:

- OdiscomSupply-Platform-Admins
- OdiscomSupply-Operations
- OdiscomSupply-Sales
- OdiscomSupply-Procurement
- OdiscomSupply-Fulfillment
- OdiscomSupply-Finance
- OdiscomSupply-ReadOnly

Internal APIs validate Entra-issued tokens and required roles/groups server-side.

### Customers

Use Entra External ID.

Authorization is organization-based:
- external identity → customer organization membership → customer records.

A customer cannot query another customer's quotes/orders/documents.

### Suppliers

Use Entra External ID.

Authorization is supplier-organization-based:
- external identity → supplier membership → supplier records/offers/submissions.

A supplier cannot access other suppliers or internal Odiscom Supply data.

### Separation requirement

Authentication and authorization are separate checks. A valid Microsoft identity does not itself grant access to internal, customer, or supplier data.

---

## 12. Migration phases

### Phase 0 — Architecture freeze / current-store stability

Effective immediately:

- Keep current Vercel/Supabase store operational.
- Do not add major new platform dependencies to Supabase.
- Do not redesign auth deeply in Supabase when the function is destined for Entra.
- Continue only high-value transitional work such as supplier connectors, current-store fixes, catalog quality, and revenue-enabling workflows.
- New business logic should be modular enough to move to Azure Functions.

### Phase 1 — Microsoft foundation

Create Odiscom Supply Microsoft foundation:

- Azure subscription/resource groups.
- Azure DevOps project/repositories.
- Key Vault.
- Azure SQL.
- App Service.
- Function Apps.
- Application Insights.
- Blob Storage.
- SharePoint Online internal operations site.
- Entra application registrations.
- Entra internal groups/roles.
- Entra External ID configuration.
- Bicep infrastructure repo.

**Decision gate:** establish whether Odiscom Supply receives a separate Microsoft 365/Entra tenant or operates within an existing tenant with strict company-level isolation. Separate-company governance favors a separate tenant, but the final tenant choice must be explicitly approved.

### Phase 2 — Data model and API

- Build Azure SQL schema.
- Build migration scripts.
- Build customer/supplier/catalog/quote/order APIs.
- Establish identity-to-organization mapping.
- Add audit/telemetry.
- Validate access isolation.

### Phase 3 — Supplier sourcing migration

- Move DigiKey connector to Azure Functions.
- Move Mouser connector.
- Migrate Adams historical feed.
- Migrate supplier catalog sources/import history/offers.
- Validate exact manufacturer/MPN matching and ranking behavior.

### Phase 4 — Internal workspace

- Build SharePoint/SPFx Odiscom Supply command center.
- Replace current `/admin` functions.
- Validate internal Entra role restrictions.
- Do not expose internal operations navigation on public pages.

### Phase 5 — Customer application

- Move public storefront/customer portal from Vercel to Azure App Service.
- Migrate customer auth to Entra External ID.
- Move BOM uploads to Blob/SharePoint architecture.
- Migrate quotes/orders/customer documents.
- Validate public catalog and customer data isolation.

### Phase 6 — Supplier application

- Move supplier portal to Azure.
- Migrate supplier identities to Entra External ID.
- Validate supplier organization isolation.
- Enable reviewed supplier-offer updates through Azure APIs.

### Phase 7 — Controlled cutover

Cutover only when:

- public storefront feature parity is confirmed,
- customer login works,
- supplier login works,
- internal Entra login works,
- quote/order workflows work,
- supplier connectors work,
- documents migrate successfully,
- monitoring is active,
- Azure backup/recovery is validated,
- production DNS cutover plan is tested,
- rollback procedure exists.

### Phase 8 — Retirement

After an agreed stabilization period:

- stop Supabase writes,
- preserve final export/archive,
- remove Supabase secrets,
- retire Supabase project,
- disconnect Vercel,
- remove Vercel secrets,
- migrate remaining source/history into Azure DevOps,
- archive GitHub repository after validation,
- confirm no production dependency remains on GitHub, Vercel, or Supabase.

---

## 13. Migration validation requirements

Every major domain must pass row-count and business-semantic reconciliation.

Examples:

- Product canonical manufacturer/MPN uniqueness.
- Supplier offer count and supplier ownership.
- historical vs fresh source status.
- customer/company ownership.
- quote ↔ quote item consistency.
- quote ↔ order relationship.
- order totals.
- order event visibility.
- supplier import job/row traceability.
- opportunity/item/quote relationships.
- document file integrity and access control.

Production cutover is not complete merely because records were copied.

---

## 14. Current transitional rules

Until Microsoft cutover:

1. Vercel/Supabase remain production for Odiscom Supply only.
2. Current supplier API secrets remain server-side.
3. No new `NEXT_PUBLIC_` secret variables.
4. No public admin access should be expanded.
5. Current internal/admin functions are transitional.
6. Odiscom Supply remains legally/systemically separate from Odiscom LLC.
7. Odiscom LLC may be represented in Supply as a customer.
8. No Odiscom LLC system is modified as part of this migration.
9. No change to `os.odiscom.com` without explicit task-specific approval.
10. All migrations require verification before source retirement.

---

## 15. Immediate next implementation sequence

1. Preserve current production store while completing the first live DigiKey connector verification.
2. Create the Microsoft foundation inventory and tenant decision.
3. Create Azure DevOps project/repositories for Odiscom Supply.
4. Define Bicep resource layout.
5. Create Azure SQL v1 schema mapped from the current Supabase schema.
6. Establish Entra identity architecture:
   - internal workforce,
   - customers,
   - suppliers.
7. Establish the SharePoint Odiscom Supply internal site structure.
8. Port supplier connector framework to Azure Functions.
9. Build data migration/reconciliation tooling.
10. Migrate internal admin functions first while public store remains live.
11. Migrate external customer/supplier experiences after internal APIs are stable.
12. Cut over `odiscomsupply.com` only after parity and rollback validation.

---

## 16. Architectural decision summary

The target is **not** “move the current app from Vercel to another host.”

The target is a Microsoft-native Odiscom Supply platform with:

- an independent legal/company boundary,
- an Azure-hosted B2B storefront,
- external customer and supplier identities,
- an Entra/SharePoint internal workspace,
- Azure SQL transactional data,
- Azure Functions business logic and supplier integrations,
- Key Vault secrets,
- SharePoint/Blob documents,
- Azure monitoring,
- Azure DevOps source control and deployment,
- optional explicit interfaces to Odiscom LLC systems,
- and no production dependency on GitHub, Vercel, or Supabase after cutover.
