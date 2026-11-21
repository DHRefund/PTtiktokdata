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
-- Trạng thái quota cho Dashboard (không giữ chỗ, chỉ đọc)
-- =========================================================
create or replace function get_quota_status()
returns table (
  used_today      int,
  used_cycle      int,
  limit_day       int,
  limit_cycle     int,
  limit_second    int,
  limit_minute    int,
  day_resets_at   timestamptz,
  cycle_resets_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  s           jsonb;
  tz          text;
  now_ts      timestamptz := clock_timestamp();
  day_start   timestamptz;
  cycle_start timestamptz;
  cycle_days  int;
begin
  select value into s from app_settings where key = 'quota';
  tz         := s->>'timezone';
  cycle_days := (s->>'cycle_days')::int;

  day_start   := date_trunc('day', now_ts at time zone tz) at time zone tz;
  cycle_start := ((s->>'cycle_start')::date)::timestamp at time zone tz;
  cycle_start := cycle_start + make_interval(
    days => cycle_days * greatest(0, floor(extract(epoch from (now_ts - cycle_start)) / (86400.0 * cycle_days))::int)
  );

  return query select
    (select coalesce(sum(cost), 0)::int from api_usage where called_at >= day_start),
    (select coalesce(sum(cost), 0)::int from api_usage where called_at >= cycle_start),
    (s->>'per_day')::int,
    (s->>'per_cycle')::int,
    (s->>'per_second')::int,
    (s->>'per_minute')::int,
    day_start + interval '1 day',
    cycle_start + make_interval(days => cycle_days);
end;
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
revoke all on function get_quota_status() from public, anon, authenticated;
grant execute on function get_quota_status() to service_role;
grant execute on function reserve_quota(uuid, text, text, int) to service_role;
grant execute on function finish_usage(bigint, int, text, text, boolean, int) to service_role;
