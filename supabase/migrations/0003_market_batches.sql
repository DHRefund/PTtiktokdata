-- =========================================================
-- Dữ liệu thị trường từ nguồn ngoài (Kalodata...), theo từng lần thu thập
-- Khác api_cache: đây không phải response TikToday. Mỗi lần thu thập là một batch bất biến,
-- có nguồn, kỳ, tiền tệ và ngày thu thập, để sau này so sánh giữa các lần chụp.
-- =========================================================

create table if not exists market_batches (
  id                uuid primary key default gen_random_uuid(),
  source            text not null,                 -- 'kalodata'
  source_url        text not null,
  collected_on      date not null,                 -- ngày thu thập (không giả lập giờ chính xác)
  collection_method text not null,
  market            text not null,                 -- 'VN'
  currency          text not null,                 -- tiền tệ hiển thị của nguồn, không quy đổi
  period_start      date not null,
  period_end        date not null,
  sort_verified     boolean not null default false,
  precision         text not null,                 -- 'display-rounded'...
  schema_version    int not null,
  payload_hash      text not null,                 -- mã băm nội dung batch, chống nhập trùng
  imported_at       timestamptz not null default now(),
  unique (source, payload_hash)
);

create index if not exists market_batches_latest_idx on market_batches (source, market, collected_on desc, imported_at desc);

-- Giá trị giữ nguyên chuỗi của nguồn ("₫83.87b", "147.45k", ">999.9%"): đây là số làm tròn để hiển thị, không phải số chính xác.
create table if not exists market_batch_rows (
  batch_id      uuid not null references market_batches(id) on delete cascade,
  rank          int not null,                      -- thứ tự trên bảng nguồn, không phải định danh bền vững
  name          text not null,
  revenue       text not null,
  sold          text not null,
  growth        text not null,
  rating        text not null,
  average_price text not null,
  commission    text,                              -- null khi nguồn không có
  creators      text not null,
  product_id    text,                              -- TikTok product ID đã xác minh, luôn là chuỗi
  primary key (batch_id, rank)
);

create index if not exists market_batch_rows_product_idx on market_batch_rows (product_id) where product_id is not null;

-- Chỉ server (service role) đọc/ghi
alter table market_batches enable row level security;
alter table market_batch_rows enable row level security;
