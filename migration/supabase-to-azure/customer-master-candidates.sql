-- Odiscom Supply customer-master migration candidates.
--
-- Current production may contain customer transactions even when public.customers
-- has no corresponding row. This query produces a conservative organization
-- candidate set without rewriting production.
--
-- The migration loader must persist a SourceRecordMap before generating any new
-- target CustomerId/ExternalOrganizationId so rehearsals reuse the same IDs.

with customer_sources as (
  select
    'customers'::text as source_entity,
    id::text as source_key,
    company,
    contact_name,
    email,
    phone,
    created_at
  from public.customers

  union all

  select
    'quotes',
    id::text,
    company,
    name as contact_name,
    email,
    phone,
    created_at
  from public.quotes

  union all

  select
    'orders',
    id::text,
    company,
    contact_name,
    email,
    phone,
    created_at
  from public.orders

  union all

  select
    'material_uploads',
    id::text,
    company,
    null::text as contact_name,
    customer_email as email,
    null::text as phone,
    created_at
  from public.material_uploads
),
normalized as (
  select
    *,
    lower(regexp_replace(trim(company), '\s+', ' ', 'g')) as company_key
  from customer_sources
  where nullif(trim(company), '') is not null
)
select
  company_key,
  min(company) as display_company,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at,
  count(*) as source_record_count,
  array_agg(distinct source_entity order by source_entity) as source_entities,
  array_agg(distinct email order by email)
    filter (where nullif(trim(email), '') is not null) as observed_emails,
  array_agg(distinct contact_name order by contact_name)
    filter (where nullif(trim(contact_name), '') is not null) as observed_contacts,
  bool_or(company_key = 'odiscom llc') as is_related_company
from normalized
group by company_key
order by company_key;
