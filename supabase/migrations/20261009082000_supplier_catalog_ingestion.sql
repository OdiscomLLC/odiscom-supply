-- Supplier catalog ingestion and canonical product / supplier-offer model.
-- New supplier feeds create or match canonical products by normalized manufacturer + MPN.
-- Supplier-specific cost, stock, lead time, and terms live in supplier_offers.
-- New canonical products remain draft until explicitly published by an Odiscom admin.

alter table public.products
  add column if not exists manufacturer_key text,
  add column if not exists mpn_key text,
  add column if not exists catalog_origin text not null default 'manual',
  add column if not exists sourcing_status text not null default 'quote_only';

update public.products
set manufacturer_key = nullif(regexp_replace(lower(coalesce(manufacturer,'')), '[^a-z0-9]+', '', 'g'),''),
    mpn_key = nullif(regexp_replace(lower(coalesce(manufacturer_part_number,sku,'')), '[^a-z0-9]+', '', 'g'),'')
where manufacturer_key is null or mpn_key is null;

alter table public.products
  drop constraint if exists products_catalog_origin_check,
  add constraint products_catalog_origin_check
    check (catalog_origin in ('manual','supplier_import','supplier_portal','odiscom_curated')),
  drop constraint if exists products_sourcing_status_check,
  add constraint products_sourcing_status_check
    check (sourcing_status in ('quote_only','offer_available','stale','unavailable'));

create unique index if not exists products_manufacturer_mpn_unique
on public.products(manufacturer_key, mpn_key)
where manufacturer_key is not null and mpn_key is not null;

create table if not exists public.supplier_catalog_sources (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  source_type text not null,
  status text not null default 'active',
  credential_reference text,
  endpoint_url text,
  field_mapping jsonb not null default '{}'::jsonb,
  sync_settings jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_catalog_sources_type_check check (source_type in ('api','csv','sftp','edi','portal','manual')),
  constraint supplier_catalog_sources_status_check check (status in ('active','paused','disabled'))
);

create unique index if not exists supplier_catalog_sources_supplier_name_unique
on public.supplier_catalog_sources(supplier_id, lower(name));

create table if not exists public.supplier_import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.supplier_catalog_sources(id) on delete set null,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  status text not null default 'pending',
  file_name text,
  storage_path text,
  source_reference text,
  row_count integer not null default 0,
  matched_count integer not null default 0,
  created_product_count integer not null default 0,
  updated_offer_count integer not null default 0,
  review_count integer not null default 0,
  rejected_count integer not null default 0,
  error_summary text,
  created_by_user_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint supplier_import_jobs_status_check check (status in ('pending','processing','completed','completed_with_review','failed','cancelled'))
);

create index if not exists supplier_import_jobs_supplier_created_idx
on public.supplier_import_jobs(supplier_id, created_at desc);

create table if not exists public.supplier_import_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.supplier_import_jobs(id) on delete cascade,
  row_number integer,
  supplier_sku text,
  manufacturer text,
  manufacturer_part_number text,
  product_name text,
  description text,
  category text,
  unit text,
  unit_cost numeric,
  currency text not null default 'USD',
  available_quantity numeric,
  availability_status text,
  lead_time_days integer,
  lead_time_text text,
  minimum_order_quantity numeric,
  price_breaks jsonb not null default '[]'::jsonb,
  image_url text,
  spec_sheet_url text,
  country_of_origin text,
  taa_compliant boolean,
  baba_compliant boolean,
  manufacturer_key text,
  mpn_key text,
  match_status text not null default 'unmatched',
  matched_product_id uuid references public.products(id) on delete set null,
  validation_errors jsonb not null default '[]'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint supplier_import_rows_status_check check (match_status in ('unmatched','matched','created','ambiguous','rejected'))
);

create index if not exists supplier_import_rows_job_idx
on public.supplier_import_rows(job_id, row_number);
create index if not exists supplier_import_rows_keys_idx
on public.supplier_import_rows(manufacturer_key, mpn_key);

create table if not exists public.supplier_offers (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  source_id uuid references public.supplier_catalog_sources(id) on delete set null,
  supplier_sku text,
  offer_key text not null default 'default',
  channel_type text not null default 'distributor',
  unit_cost numeric,
  currency text not null default 'USD',
  available_quantity numeric,
  availability_status text not null default 'unknown',
  lead_time_days integer,
  lead_time_text text,
  minimum_order_quantity numeric,
  price_breaks jsonb not null default '[]'::jsonb,
  freight_terms text,
  manufacturer_authorized boolean,
  quote_required boolean not null default false,
  valid_until timestamptz,
  source_updated_at timestamptz,
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  notes text,
  review_status text not null default 'pending',
  submitted_by_user_id uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_offers_channel_check check (channel_type in ('manufacturer_direct','authorized_distributor','distributor','reseller','marketplace')),
  constraint supplier_offers_availability_check check (availability_status in ('in_stock','limited','backorder','made_to_order','unknown','discontinued')),
  constraint supplier_offers_review_status_check check (review_status in ('pending','approved','rejected')),
  constraint supplier_offers_cost_check check (unit_cost is null or unit_cost >= 0),
  constraint supplier_offers_qty_check check (available_quantity is null or available_quantity >= 0),
  constraint supplier_offers_moq_check check (minimum_order_quantity is null or minimum_order_quantity >= 0)
);

create unique index if not exists supplier_offers_unique_offer
on public.supplier_offers(supplier_id, product_id, offer_key);
create index if not exists supplier_offers_product_active_idx
on public.supplier_offers(product_id, active, last_seen_at desc);
create index if not exists supplier_offers_supplier_active_idx
on public.supplier_offers(supplier_id, active, last_seen_at desc);

alter table public.supplier_catalog_sources enable row level security;
alter table public.supplier_import_jobs enable row level security;
alter table public.supplier_import_rows enable row level security;
alter table public.supplier_offers enable row level security;

revoke all on public.supplier_catalog_sources from anon;
revoke all on public.supplier_import_jobs from anon;
revoke all on public.supplier_import_rows from anon;
revoke all on public.supplier_offers from anon;

grant select on public.supplier_catalog_sources to authenticated;
grant select on public.supplier_import_jobs to authenticated;
grant select on public.supplier_import_rows to authenticated;
grant select on public.supplier_offers to authenticated;
grant all on public.supplier_catalog_sources to service_role;
grant all on public.supplier_import_jobs to service_role;
grant all on public.supplier_import_rows to service_role;
grant all on public.supplier_offers to service_role;

drop policy if exists "Admins manage supplier catalog sources" on public.supplier_catalog_sources;
create policy "Admins manage supplier catalog sources"
on public.supplier_catalog_sources for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Suppliers read own catalog sources" on public.supplier_catalog_sources;
create policy "Suppliers read own catalog sources"
on public.supplier_catalog_sources for select to authenticated
using ((select private.is_admin()) or exists (
  select 1 from public.suppliers s
  where s.id=supplier_catalog_sources.supplier_id
    and s.owner_user_id=(select auth.uid())
));

drop policy if exists "Admins manage supplier import jobs" on public.supplier_import_jobs;
create policy "Admins manage supplier import jobs"
on public.supplier_import_jobs for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Suppliers read own import jobs" on public.supplier_import_jobs;
create policy "Suppliers read own import jobs"
on public.supplier_import_jobs for select to authenticated
using ((select private.is_admin()) or exists (
  select 1 from public.suppliers s
  where s.id=supplier_import_jobs.supplier_id
    and s.owner_user_id=(select auth.uid())
));

drop policy if exists "Admins manage supplier import rows" on public.supplier_import_rows;
create policy "Admins manage supplier import rows"
on public.supplier_import_rows for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Suppliers read own import rows" on public.supplier_import_rows;
create policy "Suppliers read own import rows"
on public.supplier_import_rows for select to authenticated
using ((select private.is_admin()) or exists (
  select 1
  from public.supplier_import_jobs j
  join public.suppliers s on s.id=j.supplier_id
  where j.id=supplier_import_rows.job_id
    and s.owner_user_id=(select auth.uid())
));

drop policy if exists "Admins manage supplier offers" on public.supplier_offers;
create policy "Admins manage supplier offers"
on public.supplier_offers for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Suppliers read own offers" on public.supplier_offers;
create policy "Suppliers read own offers"
on public.supplier_offers for select to authenticated
using ((select private.is_admin()) or exists (
  select 1 from public.suppliers s
  where s.id=supplier_offers.supplier_id
    and s.owner_user_id=(select auth.uid())
));

drop policy if exists "Suppliers insert own offers" on public.supplier_offers;
drop policy if exists "Suppliers update own offers" on public.supplier_offers;
drop policy if exists "Suppliers insert own review products" on public.products;
drop policy if exists "Suppliers update own review products" on public.products;

revoke insert, update, delete on public.products from authenticated;
grant select on public.products to authenticated;
revoke insert, update, delete on public.supplier_offers from authenticated;
grant select on public.supplier_offers to authenticated;

insert into public.suppliers(name,product_categories,onboarding_status,approval_status,priority,notes)
select v.name,v.categories,'target','pending','normal',v.notes
from (values
  ('DigiKey','Industrial networking; electronic components; power; connectors; telecom-supporting hardware','Known Odiscom Supply sourcing relationship; verify account status and current line card before representing authorization.'),
  ('Mouser Electronics','Industrial networking; electronic components; power; connectors; telecom-supporting hardware','Known Odiscom Supply sourcing relationship; verify account status and current line card before representing authorization.'),
  ('Southern Controls','Industrial automation; networking; controls; N-Tron and related industrial hardware','Known Odiscom Supply sourcing relationship; verify current account status, brands, and pricing channel before representing authorization.'),
  ('HMS Networks / N-Tron','Industrial Ethernet; N-Tron switches; networking hardware','Known Odiscom Supply sourcing relationship; verify whether purchasing is manufacturer-direct or through an authorized distributor for each product.')
) as v(name,categories,notes)
where not exists(select 1 from public.suppliers s where lower(s.name)=lower(v.name));

insert into public.supplier_catalog_sources(supplier_id,name,source_type,status,field_mapping,sync_settings)
select s.id,'Manual / quoted pricing','manual','active','{}'::jsonb,
       '{"publishing":"draft_only","pricing_visibility":"internal","refresh":"on_quote_or_import"}'::jsonb
from public.suppliers s
where not exists(
  select 1 from public.supplier_catalog_sources c
  where c.supplier_id=s.id and lower(c.name)=lower('Manual / quoted pricing')
);


insert into public.supplier_catalog_sources
  (supplier_id,name,source_type,status,credential_reference,endpoint_url,field_mapping,sync_settings)
select s.id,v.source_name,'api','paused',v.credential_reference,v.endpoint_url,'{}'::jsonb,v.sync_settings::jsonb
from (values
  ('DigiKey','DigiKey Product Information V4 API','OAuth client credentials required','https://api.digikey.com/products/v4/','{"capabilities":["product_search","product_details","pricing","availability","media"],"activation":"requires DigiKey developer application"}'),
  ('Mouser Electronics','Mouser Search API','Mouser API key required',null,'{"capabilities":["product_search","availability","pricing","price_breaks","lead_time","compliance","datasheets"],"activation":"requires My Mouser Search API access"}'),
  ('Ingram Micro','Ingram Micro Reseller API','Ingram Micro developer credentials and active account required','https://api.ingrammicro.com:443/','{"capabilities":["catalog","price_availability","warehouse_stock","orders","invoices","freight"],"activation":"requires Ingram Micro reseller/developer approval"}'),
  ('TD SYNNEX','TD SYNNEX Developer API','TD SYNNEX PartnerFirst / developer credentials required',null,'{"capabilities":["catalog","price_availability","inventory","quotes","orders","invoices","freight"],"activation":"requires TD SYNNEX customer and developer portal credentials"}')
) as v(supplier_name,source_name,credential_reference,endpoint_url,sync_settings)
join public.suppliers s on lower(s.name)=lower(v.supplier_name)
where not exists (
  select 1 from public.supplier_catalog_sources c
  where c.supplier_id=s.id and lower(c.name)=lower(v.source_name)
);

insert into public.supplier_catalog_sources
  (supplier_id,name,source_type,status,credential_reference,field_mapping,sync_settings)
select s.id,'CSV / quote catalog feed','csv','paused','Supplier CSV or structured quote export required','{}'::jsonb,
       '{"capabilities":["catalog","cost","availability","lead_time"],"activation":"upload mapped supplier CSV or quote export"}'::jsonb
from public.suppliers s
where lower(s.name)=lower('Adams Cable Equipment, Inc.')
  and not exists (
    select 1 from public.supplier_catalog_sources c
    where c.supplier_id=s.id and lower(c.name)=lower('CSV / quote catalog feed')
  );
