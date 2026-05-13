-- Secure Smart VIP customer and order reference fields
-- Safe additive migration. No supplier/customer secrets belong in this file.

alter table public.companies add column if not exists is_vip boolean not null default false;
alter table public.companies add column if not exists vip_label text not null default 'VIP';
alter table public.companies add column if not exists vip_notes text;
alter table public.companies add column if not exists updated_at timestamptz not null default now();

alter table public.orders add column if not exists customer_po_number text;
alter table public.orders add column if not exists customer_visible_note text;
alter table public.orders add column if not exists internal_admin_note text;

alter table public.order_batch_items add column if not exists customer_po_number text;
alter table public.order_batch_items add column if not exists customer_visible_note text;
alter table public.order_batch_items add column if not exists internal_admin_note text;
alter table public.order_batch_items add column if not exists customer_is_vip boolean not null default false;
alter table public.order_batch_items add column if not exists customer_vip_label text;

create index if not exists companies_is_vip_idx on public.companies(is_vip);
create index if not exists orders_customer_po_number_idx on public.orders(customer_po_number);
