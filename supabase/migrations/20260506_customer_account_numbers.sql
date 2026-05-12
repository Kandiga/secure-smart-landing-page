-- Secure Smart customer/account numbering
-- Adds stable human-readable identifiers while keeping UUID primary keys internal.
-- Apply only after review/approval together with the matching CRM/public-site code deploy.

create sequence if not exists public.secure_smart_customer_number_seq start with 1001 increment by 1;
create sequence if not exists public.secure_smart_account_number_seq start with 1001 increment by 1;

create or replace function public.next_secure_smart_customer_number()
returns text
language sql
volatile
set search_path = public
as $$
  select 'SS-CUS-' || lpad(nextval('public.secure_smart_customer_number_seq')::text, 6, '0')
$$;

create or replace function public.next_secure_smart_account_number()
returns text
language sql
volatile
set search_path = public
as $$
  select 'SS-ACC-' || lpad(nextval('public.secure_smart_account_number_seq')::text, 6, '0')
$$;

alter table public.profiles
  add column if not exists customer_number text;

alter table public.companies
  add column if not exists account_number text;

update public.profiles
set customer_number = public.next_secure_smart_customer_number()
where customer_number is null;

update public.companies
set account_number = public.next_secure_smart_account_number()
where account_number is null;

alter table public.profiles
  alter column customer_number set default public.next_secure_smart_customer_number(),
  alter column customer_number set not null;

alter table public.companies
  alter column account_number set default public.next_secure_smart_account_number(),
  alter column account_number set not null;

create unique index if not exists profiles_customer_number_key on public.profiles(customer_number);
create unique index if not exists companies_account_number_key on public.companies(account_number);

comment on column public.profiles.id is 'Internal immutable Supabase/Auth UUID for the customer user.';
comment on column public.profiles.customer_number is 'Human-readable Secure Smart customer number, e.g. SS-CUS-001001.';
comment on column public.companies.id is 'Internal immutable company/account UUID.';
comment on column public.companies.account_number is 'Human-readable Secure Smart company account number, e.g. SS-ACC-001001.';
