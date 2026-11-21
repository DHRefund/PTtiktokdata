-- Source-specific JSON contract preserves FastMoss fields without inventing
-- Kalodata rating/creator/average-price values or verified TikTok product IDs.
create table if not exists fastmoss_batches (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  payload_hash text not null unique,
  collected_on date not null,
  imported_at timestamptz not null default now()
);
create index if not exists fastmoss_batches_latest_idx on fastmoss_batches(collected_on desc, imported_at desc);
alter table fastmoss_batches enable row level security;
