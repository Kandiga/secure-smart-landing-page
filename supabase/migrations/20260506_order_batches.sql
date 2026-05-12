-- Secure Smart Orders Cockpit batching workflow
-- Internal CRM only. No supplier secrets or credentials belong in this file.

create extension if not exists "pgcrypto";

create sequence if not exists public.order_batch_number_seq start with 1 increment by 1;

create or replace function public.next_order_batch_number()
returns text
language sql
as $$
  select 'SS-BATCH-' || lpad(nextval('public.order_batch_number_seq')::text, 6, '0')
$$;

create table if not exists public.order_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique default public.next_order_batch_number(),
  status text not null default 'waiting_approval' check (status in ('generated', 'waiting_approval', 'approved', 'executing', 'completed', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  exported_at timestamptz,
  export_version integer not null default 1,
  customer_value numeric(14,2) not null default 0,
  purchase_total numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.order_batches(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  sku text not null,
  item_name text,
  customer_name text,
  order_number text,
  project_name text,
  customer_qty numeric(14,2) not null default 0,
  customer_unit_price numeric(12,2) not null default 0,
  customer_total numeric(14,2) not null default 0,
  purchase_unit_cost numeric(12,2),
  purchase_total numeric(14,2),
  supplier_name text,
  supplier_email text,
  supplier_form_sent_at timestamptz,
  supplier_form_returned_at timestamptz,
  supplier_approved_at timestamptz,
  order_confirmation_sent_at timestamptz,
  pi_no text,
  pi_received_at timestamptz,
  backorder_units numeric(14,2) not null default 0,
  purchase_status text not null default 'draft' check (purchase_status in ('draft', 'form_sent', 'supplier_returned', 'securesmart_approved', 'order_confirmation_sent', 'pi_received', 'supplied_to_customer')),
  stock_status text not null default 'needs_purchase',
  status text not null default 'waiting_approval',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_item_id)
);

create index if not exists order_batches_status_created_idx on public.order_batches(status, created_at desc);

alter table public.order_batch_items add column if not exists supplier_name text;
alter table public.order_batch_items add column if not exists order_number text;
alter table public.order_batch_items add column if not exists supplier_email text;
alter table public.order_batch_items add column if not exists supplier_form_sent_at timestamptz;
alter table public.order_batch_items add column if not exists supplier_form_returned_at timestamptz;
alter table public.order_batch_items add column if not exists supplier_approved_at timestamptz;
alter table public.order_batch_items add column if not exists order_confirmation_sent_at timestamptz;
alter table public.order_batch_items add column if not exists pi_no text;
alter table public.order_batch_items add column if not exists pi_received_at timestamptz;
alter table public.order_batch_items add column if not exists backorder_units numeric(14,2) not null default 0;
alter table public.order_batch_items add column if not exists purchase_status text not null default 'draft';
alter table public.order_batch_items add column if not exists updated_at timestamptz not null default now();
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_batch_items_purchase_status_check') then
    alter table public.order_batch_items add constraint order_batch_items_purchase_status_check check (purchase_status in ('draft', 'form_sent', 'supplier_returned', 'securesmart_approved', 'order_confirmation_sent', 'pi_received', 'supplied_to_customer'));
  end if;
end $$;
create index if not exists order_batch_items_batch_sku_idx on public.order_batch_items(batch_id, sku);
create index if not exists order_batch_items_order_item_idx on public.order_batch_items(order_item_id);

alter table public.order_batches enable row level security;
alter table public.order_batch_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_batches' and policyname = 'order batches admin read') then
    create policy "order batches admin read" on public.order_batches for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_batches' and policyname = 'order batches admin insert') then
    create policy "order batches admin insert" on public.order_batches for insert with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_batches' and policyname = 'order batches admin update') then
    create policy "order batches admin update" on public.order_batches for update using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_batches' and policyname = 'order batches admin delete') then
    create policy "order batches admin delete" on public.order_batches for delete using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_batch_items' and policyname = 'order batch items admin read') then
    create policy "order batch items admin read" on public.order_batch_items for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_batch_items' and policyname = 'order batch items admin insert') then
    create policy "order batch items admin insert" on public.order_batch_items for insert with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_batch_items' and policyname = 'order batch items admin update') then
    create policy "order batch items admin update" on public.order_batch_items for update using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_batch_items' and policyname = 'order batch items admin delete') then
    create policy "order batch items admin delete" on public.order_batch_items for delete using (public.is_admin());
  end if;
end $$;
