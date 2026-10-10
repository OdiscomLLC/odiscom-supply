# Supabase → Azure SQL Migration Control Pack

**Odiscom Supply LLC**  
**Snapshot baseline:** 2026-10-10

This folder controls the eventual migration from the current Supabase production database to the Odiscom Supply Azure SQL database.

It is designed to prevent a "copy rows and hope" migration. Every domain must reconcile before Supabase can be retired.

## Current production baseline

| Object | Rows |
| --- | ---: |
| products | 458 |
| suppliers | 19 |
| supplier_offers | 458 |
| supplier_catalog_sources | 25 |
| supplier_import_jobs | 1 |
| supplier_import_rows | 470 |
| customers | 0 |
| quotes | 2 |
| quote_items | 2 |
| orders | 1 |
| order_items | 0 |
| order_events | 1 |
| material_uploads | 1 |
| customer_documents | 0 |
| hardware_opportunities | 2 |
| hardware_opportunity_items | 1,408 |
| opportunity_supplier_quotes | 10 |

These counts are a point-in-time baseline, not the final cutover counts. Re-run the source audit immediately before each migration rehearsal and before final cutover.

## Current integrity baseline

As of the baseline snapshot:

- products missing normalized manufacturer/MPN keys: **0**
- duplicate canonical manufacturer + MPN combinations: **0**
- supplier offers orphaned from products: **0**
- supplier offers orphaned from suppliers: **0**
- quote items orphaned from quotes: **0**
- order items orphaned from orders: **0**
- hardware opportunity items orphaned from opportunities: **0**
- opportunity supplier quotes orphaned from opportunities: **0**
- approved supplier offers: **458**
- active supplier offers: **458**
- active/public products: **0**
- draft products: **458**

The 458 supplier offers are historical/stale source intelligence from the Adams inventory seed unless refreshed by a newer source. Approval state must not be confused with current inventory freshness.

## Important customer-master transformation

The current `customers` table has **0 rows**, but production already contains Odiscom LLC transactions:

- 2 accepted quotes for Odiscom LLC
- 1 order for Odiscom LLC

Therefore the Azure migration cannot rely on `public.customers` as the sole source of customer identity.

Migration rule:

1. Build a customer master from:
   - existing `customers`;
   - distinct companies referenced by `quotes`;
   - distinct companies referenced by `orders`;
   - distinct companies referenced by `material_uploads`.
2. Normalize company identity conservatively.
3. Create one persisted migration mapping per source customer organization.
4. Odiscom LLC must become a normal `commerce.Customer` row with `IsRelatedCompany = 1`.
5. Its quotes/orders then reference that customer row.
6. Do not grant Odiscom LLC internal Odiscom Supply roles merely because it is a related company.

No current Supabase production record should be rewritten just to make migration easier.

## ID strategy

Preserve existing UUID primary keys wherever the target entity maps one-to-one.

Examples:

- product ID → ProductId
- supplier ID → SupplierId
- quote ID → QuoteId
- order ID → SalesOrderId
- hardware opportunity ID → HardwareOpportunityId

For normalized entities that do not currently exist, such as Manufacturer or the new customer master:

- generate the target UUID once;
- store it in a migration mapping file/table;
- never regenerate it between rehearsals.

## Migration order

1. Manufacturer
2. Product
3. Supplier
4. Supplier contacts
5. Supplier catalog sources
6. Supplier offers
7. Supplier import jobs
8. Supplier import rows
9. External organization mappings
10. Customer master
11. Customer contacts/locations/documents
12. Quotes
13. Quote items
14. Sales orders
15. Sales order items
16. Order events
17. Payment/shipment references
18. Hardware opportunities
19. Hardware opportunity items
20. Opportunity supplier quotes
21. File/document objects

## File migration

Files require separate binary integrity validation.

For every migrated object record:

- source storage path/URL
- target Blob/SharePoint URI
- file size
- SHA-256 checksum
- document visibility
- owning customer/supplier if applicable
- migration timestamp

Do not mark document migration complete based on database metadata alone.

## Supplier freshness rules

Historical supplier data must retain source timestamps.

Do not rewrite stale historical inventory as current stock during migration.

Required fields to preserve:

- source_updated_at
- last_seen_at
- valid_until
- availability status
- available quantity
- quote-required flag
- review status
- source identity

## Rehearsal gates

A migration rehearsal passes only when:

1. source audit runs clean;
2. target row counts reconcile by domain;
3. canonical product uniqueness matches;
4. all foreign-key relationships reconcile;
5. transactional totals reconcile;
6. customer ownership checks pass;
7. supplier ownership checks pass;
8. file checksums reconcile;
9. representative customer/supplier/internal authorization tests pass;
10. application reads from Azure reproduce the same business result.

## Final cutover

Before final migration:

1. announce/freeze source writes for the cutover window;
2. capture final source audit;
3. perform final incremental export;
4. load target;
5. run target audit;
6. compare source vs target;
7. switch application writes;
8. monitor;
9. retain Supabase read-only/archival rollback period;
10. retire Supabase only after explicit acceptance.

## Hard boundary

This migration moves **Odiscom Supply LLC** data only.

It must not import Odiscom LLC engineering data, os.odiscom.com data, Odiscom AI data, or other Odiscom LLC records except for deliberate Odiscom Supply customer transactions or separately approved intercompany exchanges.
