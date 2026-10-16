-- 003 : commandes fournisseur automatiques, mesure d'audience, rapports, réglages.

alter table products add column if not exists supplier_variant_id text not null default '';
alter table products add column if not exists supplier_country text not null default '';
alter table orders add column if not exists supplier_order_id text;
alter table orders add column if not exists supplier_status text not null default '';
alter table orders add column if not exists supplier_note text not null default '';

-- Un compteur par boutique et par jour. Aucune adresse IP ni cookie n'est conservé.
create table if not exists analytics_daily (
  site_id      text not null references sites(id) on delete cascade,
  day          date not null,
  pageviews    int  not null default 0,
  sessions     int  not null default 0,
  visitors     int  not null default 0,
  add_to_cart  int  not null default 0,
  checkouts    int  not null default 0,
  sources      jsonb not null default '{}',
  devices      jsonb not null default '{}',
  countries    jsonb not null default '{}',
  pages        jsonb not null default '{}',
  primary key (site_id, day)
);

-- Empreintes anonymes du jour (visiteurs uniques), effacées au bout de 2 jours.
create table if not exists analytics_visitors (
  site_id text not null,
  day     date not null,
  hash    text not null,
  primary key (site_id, day, hash)
);

create or replace function jsonb_inc(j jsonb, k text)
returns jsonb language sql immutable as $$
  select coalesce(j, '{}'::jsonb) || jsonb_build_object(k, coalesce((j ->> k)::int, 0) + 1);
$$;

create or replace function track_event(
  p_site text, p_day date, p_type text, p_path text, p_source text,
  p_device text, p_country text, p_hash text, p_entry boolean
) returns void language plpgsql as $$
declare
  added int := 0;
begin
  insert into analytics_daily (site_id, day) values (p_site, p_day) on conflict do nothing;
  if p_type = 'pageview' then
    insert into analytics_visitors values (p_site, p_day, p_hash) on conflict do nothing;
    get diagnostics added = row_count;
    update analytics_daily set
      pageviews = pageviews + 1,
      visitors  = visitors + added,
      sessions  = sessions + (case when p_entry then 1 else 0 end),
      sources   = case when p_entry then jsonb_inc(sources, p_source) else sources end,
      devices   = case when p_entry then jsonb_inc(devices, p_device) else devices end,
      countries = case when p_entry then jsonb_inc(countries, p_country) else countries end,
      pages     = jsonb_inc(pages, p_path)
    where site_id = p_site and day = p_day;
  elsif p_type = 'add_to_cart' then
    update analytics_daily set add_to_cart = add_to_cart + 1 where site_id = p_site and day = p_day;
  elsif p_type = 'checkout' then
    update analytics_daily set checkouts = checkouts + 1 where site_id = p_site and day = p_day;
  end if;
  if random() < 0.01 then
    delete from analytics_visitors where day < p_day - 1;
  end if;
end;
$$;

create table if not exists reports (
  id            text primary key default gen_random_uuid()::text,
  day           date not null unique,
  created_at    timestamptz not null default now(),
  headline      text not null default '',
  revenue_cents int  not null default 0,
  profit_cents  int  not null default 0,
  orders        int  not null default 0,
  sites         jsonb not null default '[]',
  todos         jsonb not null default '[]',
  alerts        jsonb not null default '[]',
  agents        jsonb not null default '[]',
  ideas         jsonb not null default '[]'
);

create table if not exists settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

alter table analytics_daily    enable row level security;
alter table analytics_visitors enable row level security;
alter table reports            enable row level security;
alter table settings           enable row level security;
