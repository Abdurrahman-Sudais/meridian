-- =====================================================================
-- MERIDIAN — database schema (Supabase / Postgres)
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Money is stored in MINOR units of the checkout currency (kobo, pesewas, cents).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Products --------------------------------------------------
create table if not exists products (
  id          int primary key,
  name        text not null,
  cat         text not null,
  price_usd   numeric(12,2) not null check (price_usd >= 0),   -- display price used on the site
  stock       int not null default 1 check (stock >= 0),
  active      boolean not null default true,
  data        jsonb not null default '{}'::jsonb,               -- year, ref, condition, imgs, colors, options...
  updated_at  timestamptz not null default now()
);

-- ---------- Promo codes -----------------------------------------------
create table if not exists promo_codes (
  code     text primary key,
  percent  int not null check (percent between 1 and 90),
  active   boolean not null default true
);

-- ---------- Orders ----------------------------------------------------
create table if not exists orders (
  id          uuid primary key default gen_random_uuid(),
  reference   text unique not null,              -- Paystack reference
  email       text not null,
  name        text not null,
  phone       text,
  address     jsonb not null default '{}'::jsonb,
  currency    text not null,
  subtotal    bigint not null,
  discount    bigint not null default 0,
  shipping    bigint not null default 0,
  total       bigint not null,
  promo       text,
  status      text not null default 'pending'
              check (status in ('pending','paid','paid_needs_review','failed','cancelled','shipped','refunded')),
  paystack    jsonb,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);

create table if not exists order_items (
  id          bigserial primary key,
  order_id    uuid not null references orders(id) on delete cascade,
  product_id  int  not null references products(id),
  name        text not null,
  option      text,
  color       text,
  qty         int  not null check (qty > 0),
  unit_price  bigint not null
);
create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists orders_status_idx on orders(status, created_at desc);

-- ---------- Row Level Security ----------------------------------------
-- The browser may only READ active products. Everything else goes through
-- the server functions, which use the service-role key (bypasses RLS).
alter table products    enable row level security;
alter table promo_codes enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

drop policy if exists "public read active products" on products;
create policy "public read active products" on products for select using (active);

-- ---------- Mark an order paid (atomic, idempotent) -------------------
-- Called by the server after Paystack confirms a payment.
-- Decrements stock; if a one-of-one piece was sold twice at the same moment,
-- the second order is flagged 'paid_needs_review' so you can refund it.
create or replace function mark_order_paid(p_reference text, p_amount bigint, p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders%rowtype;
  it record;
  short boolean := false;
begin
  select * into o from orders where reference = p_reference for update;
  if not found then return 'not_found'; end if;
  if o.status <> 'pending' then return o.status; end if;          -- already handled
  if p_amount <> o.total then
    update orders set status = 'paid_needs_review', paystack = p_payload, paid_at = now() where id = o.id;
    return 'amount_mismatch';
  end if;

  for it in select product_id, sum(qty) q from order_items where order_id = o.id group by product_id loop
    update products set stock = stock - it.q, updated_at = now()
      where id = it.product_id and stock >= it.q;
    if not found then short := true; end if;
  end loop;

  update orders
     set status  = case when short then 'paid_needs_review' else 'paid' end,
         paystack = p_payload,
         paid_at  = now()
   where id = o.id;
  return case when short then 'oversold' else 'paid' end;
end $$;

revoke all on function mark_order_paid(text, bigint, jsonb) from public, anon, authenticated;
