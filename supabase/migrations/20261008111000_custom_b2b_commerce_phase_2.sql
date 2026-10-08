-- Custom B2B commerce foundation: buyer profiles/documents, order checkout/tracking,
-- payment webhook ledger, and structured product comparison fields.

alter table public.customers
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text not null default 'US',
  add column if not exists tax_status text not null default 'standard',
  add column if not exists payment_preference text not null default 'invoice-or-po',
  add column if not exists freight_preference text not null default 'quote-best-option',
  add column if not exists po_required boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.customers
  drop constraint if exists customers_tax_status_check,
  add constraint customers_tax_status_check check (tax_status in ('standard','tax-exempt','resale','government')),
  drop constraint if exists customers_payment_preference_check,
  add constraint customers_payment_preference_check check (payment_preference in ('invoice-or-po','ach','card','terms')),
  drop constraint if exists customers_freight_preference_check,
  add constraint customers_freight_preference_check check (freight_preference in ('quote-best-option','prepaid-add','customer-account','jobsite-delivery','pickup'));

drop policy if exists "Customers create own profile" on public.customers;
create policy "Customers create own profile"
on public.customers for insert to authenticated
with check (
  lower(email)=lower((select auth.jwt()->>'email'))
  and account_status='prospect'
  and pricing_tier='standard'
);

create or replace function public.guard_customer_internal_fields()
returns trigger
language plpgsql
security invoker
set search_path=pg_catalog, public, private
as $$
begin
  if (select private.is_admin()) then return new; end if;
  if lower(new.email) is distinct from lower(old.email)
     or new.account_status is distinct from old.account_status
     or new.pricing_tier is distinct from old.pricing_tier then
    raise exception 'Internal customer account fields cannot be changed from the buyer portal.';
  end if;
  new.updated_at:=now();
  return new;
end;
$$;
revoke execute on function public.guard_customer_internal_fields() from public, anon, authenticated;
drop trigger if exists guard_customer_internal_fields_trigger on public.customers;
create trigger guard_customer_internal_fields_trigger before update on public.customers
for each row execute function public.guard_customer_internal_fields();

create table if not exists public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  customer_email text not null,
  document_type text not null,
  file_name text not null,
  storage_path text not null unique,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  constraint customer_documents_type_check check (document_type in ('tax_exemption','resale_certificate','purchase_order','credit_application','other')),
  constraint customer_documents_status_check check (status in ('submitted','reviewing','accepted','rejected'))
);
alter table public.customer_documents enable row level security;
drop policy if exists "Admins manage customer documents" on public.customer_documents;
create policy "Admins manage customer documents" on public.customer_documents for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "Customers read own documents" on public.customer_documents;
create policy "Customers read own documents" on public.customer_documents for select to authenticated
using (owner_user_id=(select auth.uid()) and lower(customer_email)=lower((select auth.jwt()->>'email')));
drop policy if exists "Customers submit own documents" on public.customer_documents;
create policy "Customers submit own documents" on public.customer_documents for insert to authenticated
with check (owner_user_id=(select auth.uid()) and lower(customer_email)=lower((select auth.jwt()->>'email')) and status='submitted');
revoke all on public.customer_documents from anon;
grant select, insert on public.customer_documents to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('buyer-documents','buyer-documents',false,10485760,
array['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Buyer document upload own folder" on storage.objects;
create policy "Buyer document upload own folder" on storage.objects for insert to authenticated
with check (bucket_id='buyer-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Buyer document read own folder" on storage.objects;
create policy "Buyer document read own folder" on storage.objects for select to authenticated
using (bucket_id='buyer-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Admins manage buyer documents storage" on storage.objects;
create policy "Admins manage buyer documents storage" on storage.objects for all to authenticated
using (bucket_id='buyer-documents' and (select private.is_admin()))
with check (bucket_id='buyer-documents' and (select private.is_admin()));

alter table public.orders
  add column if not exists payment_method text not null default 'unselected',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists po_number text,
  add column if not exists customer_reference text,
  add column if not exists freight_preference text,
  add column if not exists delivery_location text,
  add column if not exists fulfillment_status text not null default 'pending',
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists expected_delivery date,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.orders
  drop constraint if exists orders_payment_method_check,
  add constraint orders_payment_method_check check (payment_method in ('unselected','purchase_order','invoice','card','ach','terms')),
  drop constraint if exists orders_payment_status_check,
  add constraint orders_payment_status_check check (payment_status in ('unpaid','pending','paid','not_required','failed','refunded')),
  drop constraint if exists orders_fulfillment_status_check,
  add constraint orders_fulfillment_status_check check (fulfillment_status in ('pending','sourcing','ready','partially_shipped','shipped','delivered','on_hold','cancelled'));

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  title text not null,
  detail text,
  visibility text not null default 'customer',
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  constraint order_events_type_check check (event_type in ('order_created','payment_selected','payment_pending','payment_received','payment_failed','po_submitted','invoice_requested','terms_requested','sourcing','ready','shipped','delivered','tracking_updated','note')),
  constraint order_events_visibility_check check (visibility in ('customer','internal'))
);
create index if not exists order_events_order_created_idx on public.order_events(order_id,created_at desc);
alter table public.order_events enable row level security;
drop policy if exists "Admins manage order events" on public.order_events;
create policy "Admins manage order events" on public.order_events for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "Customers read own visible order events" on public.order_events;
create policy "Customers read own visible order events" on public.order_events for select to authenticated
using (visibility='customer' and exists (
  select 1 from public.orders o
  where o.id=order_events.order_id and lower(o.email)=lower((select auth.jwt()->>'email'))
));
grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  order_id uuid references public.orders(id) on delete set null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant all on public.stripe_webhook_events to service_role;
drop policy if exists "Webhook events service only" on public.stripe_webhook_events;
create policy "Webhook events service only" on public.stripe_webhook_events for select to authenticated using (false);

create or replace function public.touch_order_updated_at()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public
as $$ begin new.updated_at:=now(); return new; end; $$;
revoke execute on function public.touch_order_updated_at() from public, anon, authenticated;
drop trigger if exists touch_order_updated_at_trigger on public.orders;
create trigger touch_order_updated_at_trigger before update on public.orders
for each row execute function public.touch_order_updated_at();

insert into public.order_events(order_id,event_type,title,detail,visibility,created_by)
select o.id,'order_created','Order created','Order created from accepted quote.','customer','system'
from public.orders o
where not exists(select 1 from public.order_events e where e.order_id=o.id and e.event_type='order_created');

alter table public.products
  add column if not exists manufacturer_part_number text,
  add column if not exists upc text,
  add column if not exists country_of_origin text,
  add column if not exists taa_compliant boolean,
  add column if not exists baba_compliant boolean,
  add column if not exists specifications jsonb not null default '{}'::jsonb;
create index if not exists products_manufacturer_part_number_idx on public.products(manufacturer_part_number);
