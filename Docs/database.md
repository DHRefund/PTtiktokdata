# Thiết kế database (Supabase / Postgres)

Cập nhật: 2026-11-21. Xem thêm: [tech-stack.md](tech-stack.md) (mục 4 và 4b), [tiktoday-api.md](tiktoday-api.md).

Phạm vi: giai đoạn 0 và 1. Chỉ có các bảng nền móng (cấu hình, tài khoản, cache, nhật ký quota, lịch sử tìm kiếm). Bảng thực thể `creators`, `products`, `videos` chưa thiết kế vì chưa biết cấu trúc thật của response (làm ở giai đoạn 2).

## 1. Nguyên tắc

1. **Dữ liệu API lưu nguyên dạng `jsonb`.** Trường có lúc thêm lúc thiếu không làm hỏng gì và không cần sửa schema. Chỉ tách cột thật cho thứ cần lọc, sắp xếp (làm ở giai đoạn 2, có thể dùng generated column lấy từ `jsonb`).
2. **Chỉ server truy cập DB**, bằng `service_role`. Bật RLS trên mọi bảng và không tạo policy nào, nên `anon` và `authenticated` không đọc được gì. Hàm quota cũng bị thu quyền thực thi của hai vai trò đó.
3. **Giữ chỗ quota trước, gọi API sau, báo kết quả cuối cùng.** Giữ chỗ chạy nguyên tử trong Postgres để hai người dùng cùng lúc không vượt hạn mức.
4. **Một nơi duy nhất đọc dữ liệu từ `jsonb`** (hàm trong `lib/`), để khi API đổi tên trường chỉ sửa một chỗ.

## 2. Các bảng

| Bảng | Mục đích |
| :--- | :--- |
| `app_settings` | Cấu hình hạn mức theo gói (đổi gói chỉ sửa một dòng) |
| `users` | 2 tài khoản đăng nhập giả |
| `api_cache` | Cache response thô theo `cache_key` |
| `api_usage` | Sổ mỗi lượt gọi API: dùng để tính quota, rate limit và hiển thị nhật ký |
| `search_history` | Lịch sử các lần tìm kiếm và id kết quả |

## 3. Migration (`supabase/migrations/0001_init.sql`)

> File thực tế trong dự án là bản chuẩn. So với đoạn SQL dưới đây, file có thêm hàm `get_quota_status()` (chỉ đọc, trả quota đã dùng, hạn mức và thời điểm reset cho Dashboard). Cột `api_cache.response` lưu trường `data` của response TikToday, không phải toàn bộ body.

```sql
-- =========================================================
-- Cấu hình hạn mức
-- =========================================================
create table app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Gói Free. cycle_start là ngày bắt đầu chu kỳ 30 ngày hiện tại
-- (suy ra từ "reset 00:00 20/12/2026"). Kiểm tra lại trên dashboard TikToday.
insert into app_settings (key, value) values (
  'quota',
  '{
    "per_second": 2,
    "per_minute": 60,
    "per_day": 100,
    "per_cycle": 1000,
    "cycle_days": 30,
    "cycle_start": "2026-11-20",
    "timezone": "Asia/Ho_Chi_Minh"
  }'::jsonb
);

-- =========================================================
-- Tài khoản đăng nhập giả
-- =========================================================
create table users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- =========================================================
-- Cache response thô
-- =========================================================
create table api_cache (
  cache_key       text primary key,
  endpoint        text not null,
  params          jsonb not null default '{}'::jsonb,
  status          text not null check (status in ('ok', 'not_found')),
  response        jsonb,               -- toàn bộ body response (null khi not_found)
  requested_count int,                 -- limit/count đã tải, dùng để cắt bản cache cho yêu cầu nhỏ hơn
  request_id      text,
  parser_version  int not null default 1,
  fetched_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

create index api_cache_endpoint_idx on api_cache (endpoint, fetched_at desc);
create index api_cache_expires_idx  on api_cache (expires_at);

-- =========================================================
-- Sổ lượt gọi API (quota + rate limit + nhật ký)
-- =========================================================
create table api_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid references users(id) on delete set null,
  endpoint    text not null,
  cache_key   text,
  cost        int not null default 1 check (cost >= 0),  -- quota tính cho lượt này, về 0 nếu không bị tính
  called_at   timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  http_status int,
  code        text,                    -- OK, NOT_FOUND, RATE_LIMITED...
  request_id  text,
  duration_ms int
);

create index api_usage_called_at_idx on api_usage (called_at desc);

-- =========================================================
-- Lịch sử tìm kiếm
-- =========================================================
create table search_history (
  id              bigint generated always as identity primary key,
  user_id         uuid references users(id) on delete set null,
  kind            text not null check (kind in ('creator', 'product', 'video')),
  query           text not null,
  requested_count int,
  result_ids      text[] not null default '{}',
  cache_key       text,
  created_at      timestamptz not null default now()
);

create index search_history_created_idx on search_history (created_at desc);

-- =========================================================
-- Giữ chỗ quota (nguyên tử)
-- Trả ok = true kèm usage_id nếu còn hạn mức, ngược lại ok = false kèm reason
-- và retry_after_ms (số mili giây nên chờ).
-- reason: RATE_SECOND | RATE_MINUTE | QUOTA_DAY | QUOTA_CYCLE
-- =========================================================
create or replace function reserve_quota(
  p_user      uuid,
  p_endpoint  text,
  p_cache_key text,
  p_cost      int default 1
)
returns table (
  ok             boolean,
  usage_id       bigint,
  reason         text,
  retry_after_ms int,
  used_today     int,
  used_cycle     int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  s            jsonb;
  tz           text;
  now_ts       timestamptz := clock_timestamp();
  day_start    timestamptz;
  cycle_start  timestamptz;
  cycle_days   int;
  n_sec        int;
  n_min        int;
  u_day        int;
  u_cycle      int;
  oldest       timestamptz;
  new_id       bigint;
begin
  -- Tuần tự hoá mọi lượt giữ chỗ, hai người dùng cùng lúc không thể cùng lọt qua
  perform pg_advisory_xact_lock(hashtext('tiktoday_quota'));

  select value into s from app_settings where key = 'quota';
  tz         := s->>'timezone';
  cycle_days := (s->>'cycle_days')::int;

  day_start   := date_trunc('day', now_ts at time zone tz) at time zone tz;
  cycle_start := ((s->>'cycle_start')::date)::timestamp at time zone tz;
  -- Chu kỳ tự lăn tới trước: bắt đầu + n * cycle_days
  cycle_start := cycle_start + make_interval(
    days => cycle_days * greatest(0, floor(extract(epoch from (now_ts - cycle_start)) / (86400.0 * cycle_days))::int)
  );

  select count(*) into n_sec from api_usage where called_at > now_ts - interval '1 second';
  select count(*) into n_min from api_usage where called_at > now_ts - interval '1 minute';
  select coalesce(sum(cost), 0) into u_day   from api_usage where called_at >= day_start;
  select coalesce(sum(cost), 0) into u_cycle from api_usage where called_at >= cycle_start;

  -- Rate limit (mọi lượt, kể cả health check)
  if n_sec >= (s->>'per_second')::int then
    select min(called_at) into oldest from api_usage where called_at > now_ts - interval '1 second';
    return query select false, null::bigint, 'RATE_SECOND'::text,
      greatest(1, ceil(extract(epoch from (oldest + interval '1 second' - now_ts)) * 1000))::int,
      u_day, u_cycle;
    return;
  end if;

  if n_min >= (s->>'per_minute')::int then
    select min(called_at) into oldest from api_usage where called_at > now_ts - interval '1 minute';
    return query select false, null::bigint, 'RATE_MINUTE'::text,
      greatest(1, ceil(extract(epoch from (oldest + interval '1 minute' - now_ts)) * 1000))::int,
      u_day, u_cycle;
    return;
  end if;

  -- Quota (chỉ khi lượt này tốn quota)
  if p_cost > 0 and u_day + p_cost > (s->>'per_day')::int then
    return query select false, null::bigint, 'QUOTA_DAY'::text,
      greatest(1, ceil(extract(epoch from ((day_start + interval '1 day') - now_ts)) * 1000))::int,
      u_day, u_cycle;
    return;
  end if;

  if p_cost > 0 and u_cycle + p_cost > (s->>'per_cycle')::int then
    return query select false, null::bigint, 'QUOTA_CYCLE'::text,
      greatest(1, ceil(extract(epoch from ((cycle_start + make_interval(days => cycle_days)) - now_ts)) * 1000))::int,
      u_day, u_cycle;
    return;
  end if;

  insert into api_usage (user_id, endpoint, cache_key, cost, called_at)
  values (p_user, p_endpoint, p_cache_key, p_cost, now_ts)
  returning id into new_id;

  return query select true, new_id, null::text, 0, u_day + p_cost, u_cycle + p_cost;
end;
$$;

-- =========================================================
-- Báo kết quả sau khi gọi API. Nếu lượt đó không bị tính quota thì trả quota lại (cost = 0).
-- =========================================================
create or replace function finish_usage(
  p_id          bigint,
  p_http_status int,
  p_code        text,
  p_request_id  text,
  p_counted     boolean,
  p_duration_ms int
)
returns void
language sql
security definer
set search_path = public
as $$
  update api_usage
     set finished_at = clock_timestamp(),
         http_status = p_http_status,
         code        = p_code,
         request_id  = p_request_id,
         duration_ms = p_duration_ms,
         cost        = case when p_counted then cost else 0 end
   where id = p_id;
$$;

-- =========================================================
-- Bảo mật: chỉ service_role truy cập
-- =========================================================
alter table app_settings   enable row level security;
alter table users          enable row level security;
alter table api_cache      enable row level security;
alter table api_usage      enable row level security;
alter table search_history enable row level security;

revoke all on function reserve_quota(uuid, text, text, int) from public, anon, authenticated;
revoke all on function finish_usage(bigint, int, text, text, boolean, int) from public, anon, authenticated;
grant execute on function reserve_quota(uuid, text, text, int) to service_role;
grant execute on function finish_usage(bigint, int, text, text, boolean, int) to service_role;
```

## 4. Quy ước `cache_key`

Khoá được chuẩn hoá ở `lib/cache/`: handle bỏ `@` và chữ thường, từ khoá cắt khoảng trắng thừa và chữ thường.

| Endpoint | `cache_key` | Ghi chú |
| :--- | :--- | :--- |
| `creator.profile` | `creator.profile:{handle}` | |
| `creator.affiliate` | `creator.affiliate:{handle}` | |
| `creator.search` | `creator.search:{keyword}` | Không chứa `count`; `requested_count` lưu số đã tải |
| `creator.videos` | `creator.videos:{handle}:{since}` | `since` rỗng nếu không dùng; `limit` lưu ở `requested_count` |
| `product.details` | `product.details:{id}` | |
| `product.search` | `product.search:{query}` | `requested_count` = `limit` |
| `video.details` | `video.details:{id}` | |
| `video.search` | `video.search:{query}` | `requested_count` = `limit` |

Yêu cầu có `count` nhỏ hơn hoặc bằng `requested_count` đã cache thì cắt từ bản cache. Lớn hơn thì gọi lại API và ghi đè.

## 5. Luồng một lượt gọi (phía ứng dụng)

1. Đọc `api_cache` theo `cache_key`. Còn hạn và không có `forceRefresh` thì trả luôn.
2. Gọi `rpc('reserve_quota', { p_user, p_endpoint, p_cache_key, p_cost })`. Nếu `ok = false`:
   - `RATE_SECOND`, `RATE_MINUTE`: chờ `retry_after_ms` rồi giữ chỗ lại (tối đa vài lần).
   - `QUOTA_DAY`, `QUOTA_CYCLE`: báo người dùng hết hạn mức, kèm thời điểm reset, và trả bản cache cũ nếu có.
3. Gọi TikToday. Đo thời gian.
4. Gọi `rpc('finish_usage', ...)` với `p_counted` theo bảng dưới.
5. Ghi `api_cache` (upsert) theo bảng dưới.

| Kết quả từ TikToday | `p_counted` | Ghi `api_cache` |
| :--- | :---: | :--- |
| `200 OK` | true | `status = 'ok'`, TTL theo endpoint |
| `404 NOT_FOUND` (đúng đường dẫn) | true | `status = 'not_found'`, TTL 24 giờ |
| `429 RATE_LIMITED` | false | Không ghi. Chờ `Retry-After` rồi thử lại |
| `429 QUOTA_EXCEEDED` | false | Không ghi. Báo hết hạn mức |
| `500`, `503` | false | Không ghi. Thử lại có giới hạn |
| `400`, `401`, `403`, `413`, `501` | false | Không ghi |
| `health.check` | cost = 0 ngay từ đầu | Không ghi |

Nếu server chết giữa bước 2 và 4, dòng `api_usage` giữ nguyên `cost` đã giữ chỗ. Cách này nghiêng về phía an toàn: tính dư, không bao giờ tính thiếu.

## 6. Truy vấn thường dùng

Quota đã dùng hôm nay và trong chu kỳ (giờ Việt Nam), cho Dashboard:

```sql
select coalesce(sum(cost), 0) as used_today
from api_usage
where called_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
```

Nhật ký 50 lượt gần nhất:

```sql
select called_at, endpoint, code, http_status, cost, request_id, duration_ms
from api_usage
order by called_at desc
limit 50;
```

Dọn cache đã hết hạn lâu (chạy tay hoặc lịch định kỳ, tuỳ chọn):

```sql
delete from api_cache where expires_at < now() - interval '30 days';
```

## 7. Điều chưa chắc, cần kiểm tra khi chạy thật

- **Múi giờ reset quota.** Docs ghi "reset 00:00" mà không nói múi giờ. Mình đặt `Asia/Ho_Chi_Minh`. Nếu TikToday reset theo UTC thì sửa `timezone` trong `app_settings`, không cần đổi code.
- **`cycle_start` = 2026-11-20** suy ra từ "chu kỳ 30 ngày reset 00:00 20/12/2026". Cần đối chiếu trên dashboard.
- **Cách TikToday tính rate limit khi gọi lỗi.** Mình đếm mọi lượt vào rate limit phía mình, kể cả lượt lỗi, để an toàn.
- **Quota thực tế do TikToday quyết định.** Sổ `api_usage` chỉ là ước tính của web. Nếu lệch, đối chiếu với số liệu trên dashboard TikToday và chỉnh bằng một dòng `api_usage` bù hoặc đổi `per_day`.
- **Phiên bản parser (`parser_version`)** để 1. Tăng lên khi đổi cách đọc `jsonb`, để biết bản cache nào cần đọc lại.
