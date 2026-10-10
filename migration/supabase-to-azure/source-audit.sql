-- Odiscom Supply Supabase source audit
-- Run immediately before every migration rehearsal and final cutover.

select 'products' as object_name, count(*)::bigint as row_count from public.products
union all select 'suppliers', count(*)::bigint from public.suppliers
union all select 'supplier_offers', count(*)::bigint from public.supplier_offers
union all select 'supplier_catalog_sources', count(*)::bigint from public.supplier_catalog_sources
union all select 'supplier_import_jobs', count(*)::bigint from public.supplier_import_jobs
union all select 'supplier_import_rows', count(*)::bigint from public.supplier_import_rows
union all select 'customers', count(*)::bigint from public.customers
union all select 'quotes', count(*)::bigint from public.quotes
union all select 'quote_items', count(*)::bigint from public.quote_items
union all select 'orders', count(*)::bigint from public.orders
union all select 'order_items', count(*)::bigint from public.order_items
union all select 'order_events', count(*)::bigint from public.order_events
union all select 'material_uploads', count(*)::bigint from public.material_uploads
union all select 'customer_documents', count(*)::bigint from public.customer_documents
union all select 'hardware_opportunities', count(*)::bigint from public.hardware_opportunities
union all select 'hardware_opportunity_items', count(*)::bigint from public.hardware_opportunity_items
union all select 'opportunity_supplier_quotes', count(*)::bigint from public.opportunity_supplier_quotes
order by object_name;

select
  (select count(*) from public.products where manufacturer_key is null or mpn_key is null)
    as products_missing_canonical_key,
  (select count(*) from (
      select manufacturer_key, mpn_key, count(*)
      from public.products
      where manufacturer_key is not null and mpn_key is not null
      group by manufacturer_key, mpn_key
      having count(*) > 1
   ) d)
    as duplicate_canonical_products,
  (select count(*) from public.supplier_offers so left join public.products p on p.id = so.product_id where p.id is null)
    as orphan_supplier_offers_product,
  (select count(*) from public.supplier_offers so left join public.suppliers s on s.id = so.supplier_id where s.id is null)
    as orphan_supplier_offers_supplier,
  (select count(*) from public.quote_items qi left join public.quotes q on q.id = qi.quote_id where q.id is null)
    as orphan_quote_items,
  (select count(*) from public.order_items oi left join public.orders o on o.id = oi.order_id where o.id is null)
    as orphan_order_items,
  (select count(*) from public.hardware_opportunity_items i left join public.hardware_opportunities o on o.id = i.opportunity_id where o.id is null)
    as orphan_opportunity_items,
  (select count(*) from public.opportunity_supplier_quotes q left join public.hardware_opportunities o on o.id = q.opportunity_id where o.id is null)
    as orphan_opportunity_supplier_quotes,
  (select count(*) from public.supplier_offers where review_status = 'approved')
    as approved_supplier_offers,
  (select count(*) from public.supplier_offers where active = true)
    as active_supplier_offers,
  (select count(*) from public.products where status = 'active')
    as active_products,
  (select count(*) from public.products where status = 'draft')
    as draft_products;

-- Current transactional companies that require a target customer master row.
select
  lower(trim(company)) as normalized_company,
  company,
  min(email) as sample_email,
  count(*) as transaction_count
from (
  select company, email from public.quotes
  union all
  select company, email from public.orders
  union all
  select company, customer_email as email from public.material_uploads
) x
where nullif(trim(company), '') is not null
group by lower(trim(company)), company
order by normalized_company;

-- Product canonical identity checksum inputs.
select manufacturer_key, mpn_key, id
from public.products
order by manufacturer_key, mpn_key, id;

-- Supplier offer relationship/freshness checksum inputs.
select
  id,
  supplier_id,
  product_id,
  source_id,
  offer_key,
  unit_cost,
  available_quantity,
  availability_status,
  lead_time_days,
  review_status,
  active,
  source_updated_at,
  last_seen_at,
  valid_until
from public.supplier_offers
order by supplier_id, product_id, offer_key;
