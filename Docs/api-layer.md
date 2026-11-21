# Thiết kế lớp gọi API và Server Actions

Cập nhật: 2026-11-21. Xem thêm: [tiktoday-api.md](tiktoday-api.md) (API), [database.md](database.md) (DB, hàm quota), [tech-stack.md](tech-stack.md).

Tài liệu này chốt "hợp đồng" giữa giao diện và backend: lớp `lib/` làm gì, mỗi Server Action nhận gì, trả gì, tốn bao nhiêu quota. Khi hợp đồng này cố định, giao diện và backend làm độc lập được.

## 1. Nguyên tắc

1. **Mọi lượt gọi TikToday đi qua một hàm duy nhất** (`fetchWithCache`). Không nơi nào khác được gọi `fetch` tới `openapi.tiktoday.vn`.
2. **Server Action không ném lỗi, mà trả về kết quả** (`{ ok: true | false }`). Lỗi ném ra từ Server Action bị Next.js che nội dung ở production, giao diện sẽ không biết lỗi gì.
3. **Mỗi action tự `requireUser()` và validate Zod** trước khi làm gì khác, vì action là endpoint công khai.
4. **Không tự động tốn quota.** Chỉ gọi API khi người dùng bấm, hoặc khi chưa có dữ liệu trong cache. Dữ liệu hết hạn vẫn hiển thị, người dùng quyết định có làm mới hay không.
5. **Mọi kết quả kèm `meta`**: lấy từ cache hay API, thời điểm lấy, còn bao nhiêu quota. Giao diện luôn hiển thị được "cập nhật lúc ..." và "còn X lượt".

## 2. Cấu trúc module

```
src/
  actions/
    auth.ts            # login, logout
    creators.ts        # searchCreators, getCreatorProfile, getCreatorAffiliate, getCreatorVideos, getCreatorOverview
    products.ts        # searchProducts, getProductDetails
    videos.ts          # searchVideos, getVideoDetails
    system.ts          # getDashboardStats, checkConnection, getUsageLog, getSearchHistory
  lib/
    auth/              # token, requireUser, mật khẩu
    tiktoday/
      client.ts        # gọi HTTP thô, parse khung response, ném TikTodayError
      endpoints.ts     # bảng khai báo từng endpoint (xem mục 5)
      schemas.ts       # Zod cho input và response (optional + passthrough)
      errors.ts        # TikTodayError, bảng ánh xạ mã lỗi
      fetch.ts         # fetchWithCache: cache + quota + retry + ghi sổ
    cache/
      keys.ts          # chuẩn hoá và tạo cache_key
      store.ts         # đọc/ghi api_cache
      quota.ts         # gọi rpc reserve_quota / finish_usage
    db/                # client Supabase (service_role, chỉ dùng ở server)
    read/              # hàm đọc dữ liệu từ jsonb (một nơi duy nhất)
```

## 3. Client HTTP thô (`client.ts`)

Một hàm, không biết gì về cache hay quota:

```ts
type RawResult = {
  httpStatus: number;
  code: string;            // "OK", "NOT_FOUND", ...
  data: unknown;           // trường data của response
  requestId?: string;
  retryAfterSec?: number;  // từ header Retry-After
};

callApi(spec: EndpointSpec, input: unknown): Promise<RawResult>
```

- Gắn header `Authorization: Bearer ${TIKTODAY_API_KEY}`. Key đọc từ biến môi trường, không bao giờ log.
- Timeout chủ động bằng `AbortController` = timeout của endpoint + 5 giây (30s hoặc 55s theo tài liệu, health 2s).
- Mọi response lỗi (HTTP khác 2xx) được chuyển thành `TikTodayError` có `httpStatus`, `code`, `message`, `requestId`, `retryAfterSec`.
- Lỗi mạng và hết thời gian chờ thành `TikTodayError` với `code = "NETWORK"` hoặc `"TIMEOUT"`.

## 4. Hàm chính `fetchWithCache` (`fetch.ts`)

```ts
fetchWithCache<T>(
  spec: EndpointSpec<T>,
  input: ValidatedInput,
  opts: { userId: string; forceRefresh?: boolean }
): Promise<FetchResult<T>>
```

Các bước:

1. Tạo `cache_key` bằng `spec.cacheKey(input)`.
2. Đọc `api_cache`. Nếu còn hạn và không `forceRefresh`: trả `source: "cache"`. Với search, nếu `requested_count` đã cache lớn hơn hoặc bằng `count` yêu cầu thì cắt bản cache, không gọi lại.
3. Giữ chỗ quota: `reserve_quota(userId, endpoint, cacheKey, spec.cost)`.
   - `RATE_SECOND`, `RATE_MINUTE`: nếu `retry_after_ms` ≤ 10 giây thì chờ rồi giữ chỗ lại (tối đa 3 lần). Nếu lâu hơn, trả lỗi `RATE_LIMITED` kèm thời gian chờ.
   - `QUOTA_DAY`, `QUOTA_CYCLE`: không chờ. Nếu có bản cache cũ thì trả bản cũ với `stale: true` kèm cảnh báo hết hạn mức. Không có thì trả lỗi.
4. Gọi `callApi`. Khi lỗi có thể thử lại (`429 RATE_LIMITED`, `500`, `503`), tối đa 3 lần: chờ `Retry-After` nếu có, không thì 1s rồi 2s. Mỗi lần thử lại phải giữ chỗ quota lại (lượt thất bại trước đó đã được hoàn trả ở bước 5). Tổng thời gian không vượt ngân sách của endpoint.
5. `finish_usage(...)` với `p_counted` theo bảng trong [database.md](database.md#5-luồng-một-lượt-gọi-phía-ứng-dụng).
6. Ghi `api_cache` theo bảng đó (thành công và `404`, không ghi các lỗi khác).
7. Validate response bằng Zod ở chế độ mềm: sai kiểu hoặc thiếu trường chỉ ghi cảnh báo vào log, không chặn, và vẫn trả dữ liệu.
8. Trả `FetchResult<T>`.

Kiểu kết quả dùng chung cho mọi action:

```ts
type Meta = {
  source: "cache" | "api";
  fetchedAt: string;          // ISO
  expiresAt: string;
  stale: boolean;             // đã quá hạn nhưng vẫn hiển thị
  requestId?: string;
  quota?: { usedToday: number; limitToday: number; usedCycle: number; limitCycle: number };
};

type ActionError = {
  code: ErrorCode;
  message: string;            // tiếng Việt, hiển thị được ngay
  retryAfterMs?: number;
  requestId?: string;
};

type ActionResult<T> =
  | { ok: true; data: T; meta: Meta }
  | { ok: false; error: ActionError; staleData?: { data: T; meta: Meta } };
```

`NOT_FOUND` trả `ok: false` với `error.code = "NOT_FOUND"`, nhưng `meta` vẫn nói là từ cache (đã cache 404) để giao diện hiện "không tìm thấy, đã kiểm tra lúc ...".

### Mã lỗi của web (`ErrorCode`)

| Mã | Khi nào | Giao diện nên làm |
| :--- | :--- | :--- |
| `UNAUTHORIZED` | Chưa đăng nhập hoặc token hết hạn | Chuyển về `/login` |
| `INVALID_INPUT` | Zod từ chối input, hoặc API trả `400` | Hiện lỗi cạnh ô nhập |
| `NOT_FOUND` | API trả `404` | "Không có dữ liệu" (creator riêng tư, ngoài VN, hoặc không tồn tại) |
| `RATE_LIMITED` | Quá 2/s hoặc 60/phút và phải chờ lâu | "Thử lại sau X giây" |
| `QUOTA_DAY` | Hết 100 lượt hôm nay | Hiện giờ reset, vẫn cho xem dữ liệu đã lưu |
| `QUOTA_CYCLE` | Hết 1.000 lượt chu kỳ | Như trên |
| `QUOTA_PROVIDER` | TikToday trả `429 QUOTA_EXCEEDED` (hạn mức phía TikToday, khác với sổ quota của web) | Như trên, đối chiếu với dashboard TikToday |
| `API_KEY_INVALID` | API trả `401` | Báo kiểm tra `TIKTODAY_API_KEY` |
| `FORBIDDEN` | API trả `403` (`PERMISSION_DENIED`, `SUBJECT_SUSPENDED`) | Báo liên hệ hỗ trợ TikToday, kèm `requestId` |
| `UPSTREAM` | `500`, `503` hết số lần thử lại | "Dịch vụ tạm lỗi, thử lại sau" |
| `TIMEOUT`, `NETWORK` | Quá thời gian hoặc mất mạng | Cho phép thử lại |
| `NOT_AVAILABLE` | `501`, endpoint chưa mở | Ẩn hoặc làm xám chức năng |
| `UNKNOWN` | Còn lại | Hiện `requestId` để tra |

## 5. Bảng khai báo endpoint (`endpoints.ts`)

Mỗi endpoint là một object khai báo, không có logic riêng:

| Khoá | Method và đường dẫn | Input | Cost | Timeout | TTL | `cache_key` |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `health.check` | GET `/health/v1/check` | không | 0 | 2s | không cache | không |
| `creator.profile` | GET `/creator/v1/creators/{handle}/profile` | `handle` | 1 | 30s | 24h | `creator.profile:{handle}` |
| `creator.affiliate` | GET `/creator/v1/creators/{handle}/affiliate` | `handle` | 1 | 55s | 24h | `creator.affiliate:{handle}` |
| `creator.search` | POST `/creator/v1/creators/search` | `keyword?`, `count?` | 1 | 55s | 6h | `creator.search:{keyword}` |
| `creator.videos` | GET `/creator/v1/creators/{handle}/videos` | `handle`, `limit?`, `since?` | 1 | 55s | 6h | `creator.videos:{handle}:{since}` |
| `product.details` | GET `/product/v1/products/{id}/details` | `id` | 1 | 55s | 12h | `product.details:{id}` |
| `product.search` | POST `/product/v1/products/search` | `query`, `limit?` | 1 | 55s | 6h | `product.search:{query}` |
| `video.details` | GET `/video/v1/videos/{id}` | `id` | 1 | 30s | 24h | `video.details:{id}` |
| `video.search` | POST `/video/v1/videos/search` | `query`, `limit?` | 1 | 55s | 6h | `video.search:{query}` |

Ba endpoint chưa mở (`product.affiliate`, `product.affiliate_search`, `video.play_url`) được khai báo sẵn với cờ `available: false`. `fetchWithCache` trả ngay `NOT_AVAILABLE` mà không gọi API.

Endpoint dùng `{handle}` trong đường dẫn thì handle được `encodeURIComponent` sau khi chuẩn hoá.

## 6. Quy tắc Zod cho input

| Trường | Quy tắc |
| :--- | :--- |
| `handle` | Bỏ `@` đầu, chữ thường, khớp `^[a-z0-9_.]{1,24}$` |
| `id` (sản phẩm, video) | Chỉ chữ số. Sản phẩm không giới hạn độ dài cứng, video tối đa 20 ký tự |
| `keyword`, `query` | Cắt khoảng trắng hai đầu, tối đa 200 ký tự. `keyword` của creator được để trống (API cho phép), `query` của sản phẩm và video bắt buộc |
| `count`, `limit` | Số nguyên 1 đến 50, mặc định 20 |
| `since` | Số nguyên dương, unix time tính bằng giây |
| `forceRefresh` | boolean, mặc định `false` |

Zod của response dùng `.passthrough()` và mọi trường `optional`, theo quy tắc ở [tech-stack.md](tech-stack.md). Trường `null` được chấp nhận ở `gmv`, `video_gmv`, `live_gmv`, `commission_rate_range` và `category_shares[].name`.

## 7. Danh sách Server Action

Mọi action đều bắt đầu bằng `requireUser()` rồi validate input. Cột "Quota" là số lượt tối đa có thể tốn khi cache trống.

### Nhóm Creator

| Action | Input | Gọi | Quota | Ghi chú |
| :--- | :--- | :--- | :---: | :--- |
| `searchCreators` | `keyword?`, `count?`, `forceRefresh?` | `creator.search` | 1 | Ghi `search_history` (kind `creator`) |
| `getCreatorProfile` | `handle`, `forceRefresh?` | `creator.profile` | 1 | Mọi quốc gia |
| `getCreatorAffiliate` | `handle`, `forceRefresh?` | `creator.affiliate` | 1 | Ưu tiên VN. Nếu đã biết `region` khác VN từ cache khác thì cảnh báo trước, không gọi |
| `getCreatorVideos` | `handle`, `limit?`, `since?`, `forceRefresh?` | `creator.videos` | 1 | |
| `getCreatorOverview` | `handle`, `forceRefresh?` | `creator.profile` rồi `creator.affiliate` | 2 | Gọi tuần tự (rate limit 2/s). Một bên lỗi vẫn trả bên còn lại. Kết quả: `{ profile: ActionResult, affiliate: ActionResult }` |
| `previewCreatorOverviewCost` | `handle` | không gọi API | 0 | Chỉ đọc cache, trả "sẽ tốn 0, 1 hay 2 lượt" để giao diện báo trước khi bấm |

### Nhóm Sản phẩm và Video

| Action | Input | Gọi | Quota | Ghi chú |
| :--- | :--- | :--- | :---: | :--- |
| `searchProducts` | `query`, `limit?`, `forceRefresh?` | `product.search` | 1 | Ghi `search_history` (kind `product`) |
| `getProductDetails` | `id`, `forceRefresh?` | `product.details` | 1 | |
| `searchVideos` | `query`, `limit?`, `forceRefresh?` | `video.search` | 1 | Ghi `search_history` (kind `video`) |
| `getVideoDetails` | `id`, `forceRefresh?` | `video.details` | 1 | |

### Nhóm Hệ thống

| Action | Input | Gọi | Quota | Ghi chú |
| :--- | :--- | :--- | :---: | :--- |
| `login` | `username`, `password` | không | 0 | Đúng thì đặt cookie token. Sai thì trả `UNAUTHORIZED` chung chung, không nói sai chỗ nào |
| `logout` | không | không | 0 | Xoá cookie |
| `getDashboardStats` | không | chỉ đọc DB | 0 | Quota hôm nay và chu kỳ, thời điểm reset, 5 mục xem gần đây |
| `checkConnection` | không | `health.check` | 0 | Chỉ chịu rate limit, bấm tay |
| `getUsageLog` | `limit?` (mặc định 50) | chỉ đọc DB | 0 | Từ `api_usage` |
| `getSearchHistory` | `kind?`, `limit?` | chỉ đọc DB | 0 | Từ `search_history` |

Việc đọc dữ liệu để hiển thị trang (danh sách đã lưu, thư viện) làm trong Server Component trực tiếp từ DB, không đi qua action.

## 8. Luồng mẫu: xem hồ sơ creator

1. Người dùng nhập `@Example.Creator` và bấm xem.
2. Giao diện gọi `previewCreatorOverviewCost`, thấy cache trống, hiện "Sẽ tốn 2 lượt. Còn 87 lượt hôm nay."
3. Người dùng xác nhận, giao diện gọi `getCreatorOverview`.
4. Action chuẩn hoá handle thành `example.creator`, gọi `fetchWithCache` cho `creator.profile`, rồi cho `creator.affiliate`.
5. Kết quả trả về hai `ActionResult`. Nếu affiliate trả `NOT_FOUND` (ngoài VN), trang vẫn hiển thị hồ sơ TikTok và ghi chú "không có dữ liệu affiliate".
6. Lần mở lại trong 24 giờ: `previewCreatorOverviewCost` trả 0, dữ liệu hiện ngay kèm "cập nhật lúc ...".

## 9. Log

Mỗi lượt gọi API ghi một dòng log gồm endpoint, `cache_key`, nguồn (cache hay API), `httpStatus`, `code`, `request_id`, thời gian. Không bao giờ log API key, mật khẩu, token. `request_id` bắt buộc có để gửi hỗ trợ TikToday khi có lỗi.

## 10. Kế hoạch kiểm thử (Vitest)

Mock `fetch` bằng response mẫu lấy từ tài liệu API. Các ca cần có:

| Ca | Kỳ vọng |
| :--- | :--- |
| Cache còn hạn | Không giữ chỗ quota, không gọi API |
| Cache hết hạn, gọi lại thành công | Ghi cache mới, `cost` giữ 1 |
| `forceRefresh` | Bỏ qua cache còn hạn |
| Search `count=20` khi cache có `count=50` | Cắt 20 phần tử, không gọi API |
| `404` | Cache `not_found` 24h, `cost` giữ 1, lần sau không gọi lại |
| `429 RATE_LIMITED` rồi thành công | Chờ theo `Retry-After`, hoàn quota lượt hỏng, thử lại |
| `500` ba lần liên tiếp | Trả `UPSTREAM`, `cost` của cả ba lượt về 0 |
| `RATE_SECOND` với `retry_after_ms` nhỏ | Chờ rồi gọi thành công |
| `RATE_MINUTE` với `retry_after_ms` lớn | Trả `RATE_LIMITED`, không chờ |
| `QUOTA_DAY` khi có cache cũ | Trả `ok: true`, `stale: true`, kèm cảnh báo |
| `QUOTA_DAY` khi không có cache | Trả `ok: false`, `QUOTA_DAY` |
| Response thiếu trường hoặc sai kiểu | Vẫn trả dữ liệu, có cảnh báo trong log |
| Chưa đăng nhập | Mọi action trả `UNAUTHORIZED`, không gọi API |
| Hai lượt giữ chỗ cùng lúc ở sát hạn mức | Chỉ một lượt được `ok` (kiểm tra ở mức DB) |

## 11. Điều còn mở

- **Ngân sách thời gian của Server Action.** Endpoint chạy tới 55 giây, cộng chờ rate limit và thử lại có thể vượt `maxDuration` của Vercel. Cần đặt `maxDuration` cho từng route dùng action và giới hạn tổng thời gian thử lại. Cần kiểm tra giới hạn thực tế của gói Vercel đang dùng.
- **`getCreatorOverview` gọi tuần tự hay song song.** Mình chọn tuần tự để không đụng rate limit 2/s. Nếu thấy chậm, đổi sang song song vì giới hạn cho phép 2 lượt trong một giây.
- **Hành vi thực tế của `Retry-After`** (đơn vị giây, có luôn xuất hiện không) chưa được kiểm chứng, sẽ xác nhận khi gọi thử.
- **Lô nhiều creator** (chấm điểm hàng loạt) chưa thiết kế. Cần job chạy nền, làm ở giai đoạn sau.
