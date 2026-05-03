-- Secure Smart Backend/Auth/CRM/ERP foundation
-- Apply in Supabase SQL editor or via Supabase CLI after project creation.
-- No supplier credentials or secrets belong in this file.

create extension if not exists "pgcrypto";

create type public.account_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.app_role as enum ('customer', 'admin', 'super_admin');
create type public.application_status as enum ('pending', 'approved', 'rejected', 'needs_more_info');
create type public.quote_status as enum ('draft', 'submitted', 'converted_to_order', 'cancelled');
create type public.order_status as enum ('new', 'review', 'approved', 'needs_purchase', 'partial_stock', 'ready_to_deliver', 'delivered', 'cancelled');
create type public.stock_status as enum ('in_stock', 'partial', 'missing', 'needs_purchase');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone text,
  first_name text,
  last_name text,
  role public.app_role not null default 'customer',
  account_status public.account_status not null default 'pending',
  phone_verified boolean not null default false,
  email_verified boolean not null default false,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  vat_number text,
  registration_number text,
  website text,
  billing_address jsonb,
  shipping_address jsonb,
  created_at timestamptz not null default now()
);

create table public.company_members (
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  member_role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table public.trade_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  customer_type text,
  interests text[] not null default '{}',
  notes text,
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  brand text not null,
  title text not null,
  category text,
  public_description text,
  image_url text,
  warranty text,
  unit_per_carton integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_trade_data (
  product_id uuid primary key references public.products(id) on delete cascade,
  customer_display_price_usd numeric(12,2),
  customer_display_price_ils numeric(12,2),
  availability_status text,
  stock_bucket text,
  carton_qty integer,
  visible_to_approved boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.product_purchase_data (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  supplier_name text not null,
  supplier_sku text,
  purchase_unit_price numeric(12,2),
  purchase_currency text not null default 'USD',
  supplier_availability text,
  supplier_stock_qty integer,
  last_checked_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now()
);

create table public.quote_carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  status public.quote_status not null default 'draft',
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table public.quote_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid references public.quote_carts(id) on delete cascade,
  product_id uuid references public.products(id),
  sku text not null,
  quantity integer not null check (quantity > 0),
  customer_unit_price numeric(12,2),
  customer_currency text not null default 'USD',
  requested_notes text
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  customer_user_id uuid references public.profiles(id) on delete set null,
  order_number text unique,
  project_name text,
  source text not null default 'website',
  status public.order_status not null default 'new',
  total_customer_value numeric(14,2) not null default 0,
  total_purchase_cost numeric(14,2) not null default 0,
  gross_margin numeric(14,2) not null default 0,
  margin_pct numeric(8,2),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  sku text not null,
  product_title text,
  order_quantity integer not null check (order_quantity > 0),
  customer_unit_price numeric(12,2),
  customer_total numeric(14,2),
  purchase_unit_price numeric(12,2),
  purchase_total numeric(14,2),
  margin numeric(14,2),
  margin_pct numeric(8,2),
  stock_status public.stock_status not null default 'needs_purchase',
  missing_quantity integer not null default 0,
  supplier_name text,
  line_status text not null default 'new',
  notes text
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_approved_customer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and account_status = 'approved'
  );
$$;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.trade_applications enable row level security;
alter table public.products enable row level security;
alter table public.product_trade_data enable row level security;
alter table public.product_purchase_data enable row level security;
alter table public.quote_carts enable row level security;
alter table public.quote_cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles
create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles self update limited" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Products are public-safe basics. Trade and purchase data are separate.
create policy "products public read active" on public.products for select using (active = true);
create policy "products admin write" on public.products for all using (public.is_admin()) with check (public.is_admin());

-- Trade data only for approved customers and admins.
create policy "trade data approved read" on public.product_trade_data for select using (public.is_approved_customer() or public.is_admin());
create policy "trade data admin write" on public.product_trade_data for all using (public.is_admin()) with check (public.is_admin());

-- Purchasing power/cost data admin-only.
create policy "purchase data admin only" on public.product_purchase_data for all using (public.is_admin()) with check (public.is_admin());

-- Companies and members.
create policy "company members read own" on public.companies for select using (
  public.is_admin() or exists (select 1 from public.company_members cm where cm.company_id = id and cm.user_id = auth.uid())
);
create policy "companies admin write" on public.companies for all using (public.is_admin()) with check (public.is_admin());
create policy "company_members own read" on public.company_members for select using (public.is_admin() or user_id = auth.uid());
create policy "company_members admin write" on public.company_members for all using (public.is_admin()) with check (public.is_admin());

-- Trade applications.
create policy "applications own or admin read" on public.trade_applications for select using (public.is_admin() or user_id = auth.uid());
create policy "applications insert own" on public.trade_applications for insert with check (user_id = auth.uid());
create policy "applications admin update" on public.trade_applications for update using (public.is_admin()) with check (public.is_admin());

-- Quote carts.
create policy "quote carts own or admin" on public.quote_carts for select using (public.is_admin() or user_id = auth.uid());
create policy "quote carts insert own" on public.quote_carts for insert with check (user_id = auth.uid() or public.is_admin());
create policy "quote carts update own draft" on public.quote_carts for update using (public.is_admin() or user_id = auth.uid());
create policy "quote items own cart or admin" on public.quote_cart_items for select using (
  public.is_admin() or exists (select 1 from public.quote_carts qc where qc.id = cart_id and qc.user_id = auth.uid())
);
create policy "quote items insert own cart" on public.quote_cart_items for insert with check (
  public.is_admin() or exists (select 1 from public.quote_carts qc where qc.id = cart_id and qc.user_id = auth.uid())
);

-- Orders: customers see their own company/user rows; admins see all.
create policy "orders own or admin read" on public.orders for select using (public.is_admin() or customer_user_id = auth.uid());
create policy "orders admin write" on public.orders for all using (public.is_admin()) with check (public.is_admin());
create policy "order items own order or admin read" on public.order_items for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.customer_user_id = auth.uid())
);
create policy "order items admin write" on public.order_items for all using (public.is_admin()) with check (public.is_admin());
create policy "order events own order or admin read" on public.order_events for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.customer_user_id = auth.uid())
);
create policy "order events admin write" on public.order_events for all using (public.is_admin()) with check (public.is_admin());

-- Audit logs admin-only.
create policy "audit admin only" on public.audit_logs for all using (public.is_admin()) with check (public.is_admin());

-- Create profile after auth signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, first_name, last_name, email_verified)
  values (
    new.id,
    coalesce(new.email, ''),
    new.phone,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    coalesce(new.email_confirmed_at is not null, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
