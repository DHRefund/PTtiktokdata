# Tech stack và kiến trúc

Cập nhật: 2026-11-21. Trạng thái: đã chốt. Tài liệu API xem [tiktoday-api.md](tiktoday-api.md).

Web dùng dữ liệu TikToday API để tra cứu và lọc creator, sản phẩm, video TikTok Shop tại Việt Nam. Người dùng: chủ dự án và một người bạn.

---

## 1. Stack

| Lớp | Công nghệ | Ghi chú |
| :--- | :--- | :--- |
| Framework | Next.js 16 (App Router, bản `latest` trên npm lúc viết: 16.4.6) + TypeScript | Server Actions làm lớp gọi backend, không tự viết REST nội bộ. Cần Node 20.9 trở lên (máy hiện có Node 22.13.1) |
| Database | Supabase (Postgres) | Lưu cache, sổ quota, snapshot creator, tài khoản. Truy cập qua `@supabase/supabase-js` hoặc Drizzle |
| Auth | Xác thực giả có chữ ký (xem mục 3) | Chuyển sang Supabase Auth khi cần auth thật |
| Validate | Zod | Bắt buộc cho input của mọi Server Action và kiểu response từ API |
| UI | Tailwind CSS 4 + shadcn/ui (kiểu `radix-nova`, nền Radix) + `lucide-react` + `next-themes` + `sonner` | Thành phần nằm trong `src/components/ui/` do shadcn sinh, không sửa tay trừ khi cần. Màu theo biến CSS trong `src/app/globals.css` (chủ đạo xanh lục, sáng/tối). Lớp mỏng `src/components/common.tsx` (Card, Pill, Stat...) giữ API riêng của dự án. Font Inter có bộ ký tự tiếng Việt |
| Bảng dữ liệu | TanStack Table v9 (`@tanstack/react-table`) | Đã dùng cho bảng creator (`creator-data-table.tsx`): sắp xếp bấm tiêu đề cột, lọc nhanh. v9 khai báo `features` và `columns` ở phạm vi module và đọc state qua `table.state`, khác v8. Chưa áp dụng cho bảng sản phẩm/video (đang dùng lưới thẻ) |
| Biểu đồ | Recharts 3 qua thành phần `chart` của shadcn (`src/components/charts.tsx`) | Doanh thu theo kênh, ngành hàng, độ tuổi, giới tính, khu vực của creator; lượt quota theo ngày ở Tổng quan |
| Xuất file | `exceljs` | Xuất Excel danh sách KOC đã chấm điểm |
| AI | `@anthropic-ai/sdk` (Claude), `react-markdown` + `remark-gfm` | Phân tích creator, so sánh, phân tích video, hỏi đáp có công cụ. Chỉ đọc cache, có trần chi phí mỗi ngày. Xem [ai.md](ai.md) |
| Token | `jose` (JWT), `bcryptjs` (băm mật khẩu) | |
| Test | Vitest | Mock response lấy từ tài liệu API |
| Triển khai | Vercel + Supabase | Đặt `maxDuration` đủ cao vì endpoint chạy tới 55 giây |

Không dùng: SQLite (ổ đĩa serverless không giữ dữ liệu), `p-queue` (bộ nhớ không giữ giữa các lần gọi, giới hạn tốc độ nằm trong DB).

---

## 2. Luồng xử lý một lượt gọi TikToday

1. Người dùng thao tác (tìm, xem hồ sơ...), gọi một Server Action, ví dụ `getCreatorProfile(handle)`.
2. Action gọi `requireUser()`, validate input bằng Zod.
3. Tra bảng `api_cache` theo khoá `endpoint + tham số`. Còn hạn (TTL) thì trả luôn, không tốn quota.
4. Chưa có thì gọi hàm Postgres giữ chỗ quota. Hàm chạy nguyên tử, kiểm tra còn dưới 100 lượt/ngày, 2 lượt/giây và 60 lượt/phút.
5. Gọi TikToday bằng key từ biến môi trường server. Retry chỉ với `429 RATE_LIMITED` (chờ `Retry-After`), `500`, `503`.
6. Lưu kết quả kèm `fetched_at`, `request_id`, ghi `api_usage`, trả dữ liệu về giao diện.

Giao diện hiển thị "còn X lượt hôm nay" lấy từ `api_usage`.

---

## 3. Xác thực giả

Mục tiêu: chỉ 2 người dùng, không cần đăng ký hay phân quyền, nhưng người ngoài không được gọi API để đốt quota.

| Phần | Cách làm |
| :--- | :--- |
| Tài khoản | 2 tài khoản seed sẵn (biến môi trường hoặc bảng `users`). Mật khẩu lưu dạng băm bcrypt, không lưu thô |
| Đăng nhập | Server Action `login(username, password)`. Đúng thì tạo token |
| Token | JWT ký bằng secret trong `.env.local`, có hạn dùng (mặc định 7 ngày) |
| Lưu token | Cookie `httpOnly`, `secure`, `sameSite=lax`. Không dùng localStorage |
| Chặn truy cập | `proxy.ts` (tên mới của `middleware.ts` từ Next.js 16) chuyển về `/login` nếu thiếu token hợp lệ |
| Chặn ở action | Mỗi Server Action tự gọi `requireUser()`, vì action là endpoint công khai và có thể bị gọi trực tiếp |
| Đăng xuất | Server Action xoá cookie |

Khi cần auth thật: thay `login` và `requireUser()` bằng Supabase Auth, các action khác giữ nguyên.

---

## 4. Bảng dữ liệu (Supabase)

| Bảng | Nội dung |
| :--- | :--- |
| `api_cache` | khoá `endpoint+params`, `response` (jsonb), `fetched_at`, `expires_at` |
| `api_usage` | thời điểm gọi, endpoint, `request_id`, có tính quota không, mã kết quả |
| `creators` | snapshot hồ sơ creator (`handle`, dữ liệu profile + affiliate, `stats_until`) để lưu lịch sử. Thiết kế chi tiết ở giai đoạn 2 (xem 4b) |
| `search_history` | từ khoá, loại tìm kiếm, thời điểm, danh sách id kết quả (xem 4b) |
| `users` | tài khoản seed (`username`, `password_hash`) nếu không để trong biến môi trường |

Bật RLS trên mọi bảng. Chỉ server truy cập bằng `service_role`.

---

## 4b. Chiến lược cache

Cache hai lớp, mỗi lớp giải quyết một việc.

### Lớp 1: cache response thô (`api_cache`), làm ngay từ giai đoạn 0

Mỗi lượt gọi API lưu nguyên JSON (`jsonb`), khoá là `endpoint + tham số đã chuẩn hoá`. Mục tiêu: không tốn quota khi gọi lại cùng một thứ.

| Việc | Quy tắc |
| :--- | :--- |
| Chuẩn hoá khoá | Handle: bỏ `@`, chữ thường. Từ khoá search: cắt khoảng trắng thừa, chữ thường |
| Khoá search | Không chứa `count`. Lưu `count` đã tải kèm theo. Yêu cầu `count` nhỏ hơn hoặc bằng bản đã cache thì cắt từ bản cache, không gọi lại |
| Cache `404 NOT_FOUND` | Có, TTL 24 giờ, vì 404 vẫn tính quota |
| Không cache | `400`, `401`, `403`, `429`, `500`, `503` (lỗi tạm thời hoặc lỗi của mình) |
| Hết hạn | Vẫn hiển thị bản cũ kèm nhãn "cập nhật lúc ...". Không tự gọi lại ngầm. Người dùng bấm "Làm mới" mới tốn quota |
| Làm mới cưỡng bức | Mọi action nhận cờ `forceRefresh` để bỏ qua cache |
| Gọi trùng | Dựa vào khoá duy nhất khi upsert. Với 2 người dùng, chấp nhận hiếm khi trùng, chưa cần khoá phức tạp |

TTL đề xuất (ước lượng, chỉnh sau khi có dữ liệu thật):

| Endpoint | TTL |
| :--- | :---: |
| `creator.profile` | 24 giờ |
| `creator.affiliate` | 24 giờ |
| `creator.videos` | 6 giờ |
| `creator.search`, `product.search`, `video.search` | 6 giờ |
| `product.details` | 12 giờ |
| `video.details` | 24 giờ |

### Lớp 2: lưu theo thực thể (`creators`, `products`, `videos`), làm ở giai đoạn 2

Chưa biết cấu trúc thật của response nên chưa thiết kế cột. Sau khi xem dữ liệu thật mới làm. Hướng đã chốt:

- Mỗi lần nhận dữ liệu, upsert theo khoá tự nhiên: `handle`, `product_id`, `video id`.
- **Kết quả search là hồ sơ rút gọn.** `creator.search` trả gần đủ trường của `creator.affiliate`, chỉ thiếu `bio`, `follower_genders`, `follower_regions`. Mỗi lần tìm, các creator trong kết quả được upsert vào `creators`. Trang chi tiết hiển thị ngay phần đã có, chỉ gọi thêm API khi cần phần còn thiếu.
- **Lịch sử.** Chỉ ghi thêm một dòng snapshot khi dữ liệu thay đổi (ví dụ `stats_until` khác lần trước) để xem xu hướng mà không phình bảng.
- Bảng `search_history` (từ khoá, loại, thời điểm, danh sách id kết quả) để trang Thư viện xem lại các lần tìm.

### Tiết kiệm quota liên quan đến cache

- Trước khi gọi `creator.affiliate`, kiểm tra dữ liệu có sẵn (từ search hoặc profile) xem creator có thuộc VN không, để tránh 404 tốn quota.
- Tìm creator trước, rồi mới mở chi tiết: nhiều thông tin đã có từ kết quả search.

---

## 5. Cấu trúc thư mục dự kiến

```
src/
  app/              # trang, layout, /login
  components/ui/    # thành phần shadcn/ui (do CLI sinh)
  components/       # thành phần của dự án: common, entities, nav, sidebar, user-menu...
  actions/          # Server Actions (mỗi action: requireUser + Zod)
  lib/tiktoday/     # client, retry, kiểu Zod cho từng endpoint
  lib/cache/        # đọc/ghi cache, giữ chỗ quota
  lib/auth/         # login, token, requireUser
  db/               # migration SQL, client Supabase
  proxy.ts          # thay cho middleware.ts từ Next.js 16
Docs/               # tài liệu dự án
```

---

## 6. Quy tắc bắt buộc

1. **Server Action là endpoint công khai.** Luôn `requireUser()` và validate bằng Zod trong từng action.
2. **Key chỉ ở server.** `TIKTODAY_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET` không bao giờ có tiền tố `NEXT_PUBLIC_`, không commit `.env.local`.
3. **Action của cùng một người dùng chạy tuần tự**, hợp với rate limit. Việc hàng loạt (chấm điểm hàng trăm creator) chạy nền theo lô, không bắn từ trình duyệt.
4. **Đọc dữ liệu hiển thị trang** trong Server Component, trực tiếp từ DB. Server Action dành cho thao tác người dùng kích hoạt (tìm, xem, xuất).
5. **Không lưu link ảnh/video** (`avatar_url`, `image_urls`, `play_url`) vì có hạn dùng.
6. **Dữ liệu doanh thu là khoảng và ước tính** (`gmv_range`, `gpm_range`), giao diện phải ghi rõ.
7. **Dữ liệu API lưu nguyên dạng `jsonb`**, vì trường trong response có thể lúc có lúc không. Zod dùng `optional` và `passthrough`: trường thiếu hoặc sai kiểu thì ghi cảnh báo, không chặn, giao diện hiển thị `-`. Chỉ có **một hàm duy nhất** đọc dữ liệu từ `jsonb` để khi API đổi tên trường chỉ sửa một chỗ. Chi tiết schema: [database.md](database.md).
8. **Tiết kiệm quota:** `creator.affiliate` cho creator ngoài VN vẫn bị tính quota khi 404, nên kiểm tra creator thuộc VN trước.

---

## 6b. Biến môi trường

| Biến | Mục đích |
| :--- | :--- |
| `TIKTODAY_API_KEY` | Key TikToday (`ttk_live_...`) |
| `SUPABASE_URL` | URL dự án Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Khoá service role, chỉ dùng ở server |
| `AUTH_SECRET` | Secret ký JWT |
| `AUTH_USERS` | Danh sách tài khoản seed (username + hash), nếu không dùng bảng `users` |

---

## 7. Kế hoạch dựng

1. Khởi tạo Next.js + TypeScript + Tailwind + shadcn/ui trong `g:\tiktokdata`.
2. Auth giả: trang `/login`, `proxy.ts`, `requireUser()`, 2 tài khoản seed.
3. Lớp `lib/tiktoday/`: client, kiểu Zod, retry theo bảng lỗi.
4. Migration Supabase: `api_cache`, `api_usage`, hàm giữ chỗ quota.
5. Trang đầu tiên: nhập handle, hiển thị hồ sơ gộp profile + affiliate.
6. Sau đó: tìm creator, lọc và chấm điểm, xuất Excel; rồi đến sản phẩm và video.

## 8. Việc còn mở

- Username và mật khẩu của 2 tài khoản (bạn tự đặt vào `.env.local`).
- Cách chạy migration Supabase: viết SQL để chạy tay trong SQL Editor, hay dùng Supabase CLI.
- Chỉnh lại TTL cache (bảng ở mục 4b) sau khi xem dữ liệu thật, vì số liệu như lượt xem video đổi nhanh hơn GMV.
