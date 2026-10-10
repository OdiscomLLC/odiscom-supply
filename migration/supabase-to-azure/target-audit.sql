-- Odiscom Supply Azure SQL target audit
-- Compare results with migration/supabase-to-azure/source-audit.sql output.

SELECT 'catalog.Product' AS object_name, COUNT_BIG(*) AS row_count FROM catalog.Product
UNION ALL SELECT 'sourcing.Supplier', COUNT_BIG(*) FROM sourcing.Supplier
UNION ALL SELECT 'sourcing.SupplierOffer', COUNT_BIG(*) FROM sourcing.SupplierOffer
UNION ALL SELECT 'sourcing.SupplierCatalogSource', COUNT_BIG(*) FROM sourcing.SupplierCatalogSource
UNION ALL SELECT 'sourcing.SupplierImportJob', COUNT_BIG(*) FROM sourcing.SupplierImportJob
UNION ALL SELECT 'sourcing.SupplierImportRow', COUNT_BIG(*) FROM sourcing.SupplierImportRow
UNION ALL SELECT 'commerce.Customer', COUNT_BIG(*) FROM commerce.Customer
UNION ALL SELECT 'commerce.Quote', COUNT_BIG(*) FROM commerce.Quote
UNION ALL SELECT 'commerce.QuoteItem', COUNT_BIG(*) FROM commerce.QuoteItem
UNION ALL SELECT 'commerce.SalesOrder', COUNT_BIG(*) FROM commerce.SalesOrder
UNION ALL SELECT 'commerce.SalesOrderItem', COUNT_BIG(*) FROM commerce.SalesOrderItem
UNION ALL SELECT 'commerce.OrderEvent', COUNT_BIG(*) FROM commerce.OrderEvent
UNION ALL SELECT 'commerce.CustomerDocument', COUNT_BIG(*) FROM commerce.CustomerDocument
UNION ALL SELECT 'commerce.MaterialUpload', COUNT_BIG(*) FROM commerce.MaterialUpload
UNION ALL SELECT 'ops.HardwareOpportunity', COUNT_BIG(*) FROM ops.HardwareOpportunity
UNION ALL SELECT 'ops.HardwareOpportunityItem', COUNT_BIG(*) FROM ops.HardwareOpportunityItem
UNION ALL SELECT 'ops.OpportunitySupplierQuote', COUNT_BIG(*) FROM ops.OpportunitySupplierQuote
ORDER BY object_name;

SELECT
  (SELECT COUNT_BIG(*)
   FROM catalog.Product
   WHERE ManufacturerId IS NULL OR NULLIF(LTRIM(RTRIM(MpnKey)), '') IS NULL)
    AS products_missing_canonical_key,
  (SELECT COUNT_BIG(*)
   FROM (
      SELECT ManufacturerId, MpnKey
      FROM catalog.Product
      GROUP BY ManufacturerId, MpnKey
      HAVING COUNT_BIG(*) > 1
   ) d)
    AS duplicate_canonical_products,
  (SELECT COUNT_BIG(*)
   FROM sourcing.SupplierOffer so
   LEFT JOIN catalog.Product p ON p.ProductId = so.ProductId
   WHERE p.ProductId IS NULL)
    AS orphan_supplier_offers_product,
  (SELECT COUNT_BIG(*)
   FROM sourcing.SupplierOffer so
   LEFT JOIN sourcing.Supplier s ON s.SupplierId = so.SupplierId
   WHERE s.SupplierId IS NULL)
    AS orphan_supplier_offers_supplier,
  (SELECT COUNT_BIG(*)
   FROM commerce.QuoteItem qi
   LEFT JOIN commerce.Quote q ON q.QuoteId = qi.QuoteId
   WHERE q.QuoteId IS NULL)
    AS orphan_quote_items,
  (SELECT COUNT_BIG(*)
   FROM commerce.SalesOrderItem oi
   LEFT JOIN commerce.SalesOrder o ON o.SalesOrderId = oi.SalesOrderId
   WHERE o.SalesOrderId IS NULL)
    AS orphan_order_items,
  (SELECT COUNT_BIG(*)
   FROM ops.HardwareOpportunityItem i
   LEFT JOIN ops.HardwareOpportunity o ON o.HardwareOpportunityId = i.HardwareOpportunityId
   WHERE o.HardwareOpportunityId IS NULL)
    AS orphan_opportunity_items,
  (SELECT COUNT_BIG(*)
   FROM ops.OpportunitySupplierQuote q
   LEFT JOIN ops.HardwareOpportunity o ON o.HardwareOpportunityId = q.HardwareOpportunityId
   WHERE o.HardwareOpportunityId IS NULL)
    AS orphan_opportunity_supplier_quotes;

-- Verify related-company treatment without granting internal access.
SELECT
  CustomerId,
  LegalName,
  DisplayName,
  IsRelatedCompany,
  AccountStatus
FROM commerce.Customer
WHERE IsRelatedCompany = 1
ORDER BY LegalName;

-- Verify target supplier offer freshness and review state.
SELECT
  ReviewStatus,
  IsActive,
  AvailabilityStatus,
  COUNT_BIG(*) AS offer_count
FROM sourcing.SupplierOffer
GROUP BY ReviewStatus, IsActive, AvailabilityStatus
ORDER BY ReviewStatus, IsActive, AvailabilityStatus;
