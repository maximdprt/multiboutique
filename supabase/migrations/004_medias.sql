-- 004 : médias (images produits et images des pages), stockés dans Supabase Storage (bucket public "medias").
-- Une ligne par image : d'où elle vient, sa qualité mesurée, son texte alternatif.

create table if not exists media (
  id          text primary key default gen_random_uuid()::text,
  site_id     text not null references sites(id) on delete cascade,
  product_id  text references products(id) on delete set null,
  url         text not null,                 -- adresse publique de l'image traitée
  path        text not null default '',      -- chemin dans le stockage
  width       int  not null default 0,
  height      int  not null default 0,
  bytes       int  not null default 0,
  alt         text not null default '',
  source      text not null default 'upload', -- cj, url, upload, demo
  source_url  text not null default '',      -- image d'origine (pour la récupérer à nouveau)
  score       int  not null default 0,       -- qualité mesurée, de 0 à 100
  hash        text not null default '',      -- empreinte visuelle (repère les doublons)
  notes       jsonb not null default '[]',   -- traitements appliqués (agrandie, mise au carré…)
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists media_site_idx on media (site_id);
create index if not exists media_product_idx on media (product_id);
alter table media enable row level security;
