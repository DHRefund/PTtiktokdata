-- =========================================================
-- Tính năng AI: sổ chi phí gọi Claude và kho kết quả phân tích
-- =========================================================

-- Mỗi lượt gọi model ghi một dòng. Dùng để đặt trần chi phí theo ngày và xem lại chi tiêu.
create table if not exists ai_usage (
  id                bigint generated always as identity primary key,
  user_id           uuid references users(id) on delete set null,
  feature           text not null,
  model             text not null,
  input_tokens      int not null default 0,
  output_tokens     int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_usd          numeric(12, 6),          -- null khi chưa biết giá của model
  status            text not null default 'ok' check (status in ('ok', 'error', 'refused')),
  duration_ms       int,
  created_at        timestamptz not null default now()
);

create index if not exists ai_usage_created_idx on ai_usage (created_at desc);

-- Kết quả phân tích có cấu trúc. input_hash là mã băm của dữ liệu đầu vào và tuỳ chọn:
-- cùng dữ liệu thì dùng lại kết quả cũ (không tốn tiền), dữ liệu đổi thì tạo bản mới.
create table if not exists ai_results (
  id         bigint generated always as identity primary key,
  user_id    uuid references users(id) on delete set null,
  kind       text not null check (kind in ('creator_brief', 'outreach', 'compare', 'video_insights')),
  subject    text not null,
  input_hash text not null,
  model      text not null,
  result     jsonb not null,
  created_at timestamptz not null default now(),
  unique (kind, subject, input_hash)
);

create index if not exists ai_results_subject_idx on ai_results (kind, subject, created_at desc);

-- Chỉ service_role truy cập (giống các bảng khác)
alter table ai_usage   enable row level security;
alter table ai_results enable row level security;
