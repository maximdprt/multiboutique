-- 002 : agents (veille, construction de boutique, contenu) et leur journal.

create table if not exists opportunities (
  id           text primary key default gen_random_uuid()::text,
  created_at   timestamptz not null default now(),
  run_id       text,
  niche        text not null,
  product      text not null default '',
  summary      text not null default '',
  why_now      text not null default '',
  queries      jsonb not null default '[]',
  competition  text not null default 'moyenne',
  price_range  text not null default '',
  margin_hint  text not null default '',
  score        int  not null default 50,
  examples     jsonb not null default '[]',
  sources      jsonb not null default '[]',
  status       text not null default 'nouvelle' check (status in ('nouvelle','retenue','ecartee','lancee')),
  site_id      text
);
create index if not exists opportunities_created on opportunities (created_at desc);

create table if not exists agent_runs (
  id           text primary key default gen_random_uuid()::text,
  kind         text not null,
  status       text not null default 'en_cours',
  title        text not null default '',
  log          jsonb not null default '[]',
  result       jsonb,
  site_id      text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists agent_runs_created on agent_runs (created_at desc);

alter table opportunities enable row level security;
alter table agent_runs    enable row level security;
