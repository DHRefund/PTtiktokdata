-- Nullable for historical schemaVersion 1 rows. Do not rewrite old batches.
alter table market_batch_rows add column if not exists image_url text;
-- FastMoss stores its versioned payload as jsonb; no column change needed.
