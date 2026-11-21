# Kiến trúc và tích hợp repo

## Các thành phần

Scheduler tạo job đến hạn trong Postgres. Worker claim job bằng lease, gọi adapter, lưu dữ liệu gốc, chuẩn hóa và tạo snapshot. Job tổng hợp tính tín hiệu và xuất một phiên bản dashboard. Web chỉ đọc phiên bản đã xuất; người dùng có thể yêu cầu cập nhật qua job thay vì chờ crawler trong request.

Luồng: nguồn khám phá → ứng viên → đối chiếu định danh → snapshot → bổ sung TikToday → tính tín hiệu → Gemini giải thích → xuất dashboard.

Các bước bổ sung có thể thất bại độc lập: Gemini lỗi không ngăn xuất dữ liệu có căn cứ; nguồn khám phá lỗi không xóa phiên bản dashboard trước đó.

## Cấu trúc đề xuất giai đoạn đầu

| Vị trí dự kiến | Trách nhiệm |
| --- | --- |
| `collector/entrypoints/` | Chạy scheduler/worker bằng Node.js riêng |
| `collector/adapters/` | Adapter nguồn khám phá, TikToday, Gemini |
| `collector/jobs/` | Claim, lease, retry, checkpoint |
| `collector/pipeline/` | Chuẩn hóa, đối chiếu, snapshot, xếp hạng |
| `src/lib/opportunities/` | Hàm server đọc dashboard cho web |
| `supabase/migrations/` | Migration bổ sung khi triển khai |

Đây là vị trí dự kiến, chưa tạo các thư mục mã. Chỉ chuyển sang `apps/web`, `apps/collector`, `packages/shared` khi thực tế cần workspace riêng.

## Tận dụng mã hiện tại

- `src/lib/tiktoday/core.ts`: `createFetcher` nhận cache, quota, HTTP client, thời gian và sleep qua dependency injection; dùng làm lõi dùng chung.
- `src/lib/tiktoday/endpoints.ts`: giữ một bảng endpoint, TTL và cách tạo cache key.
- `src/lib/cache/quota.ts`: RPC `reserve_quota`/`finish_usage` là sổ quota chung cho web và worker.
- `src/lib/ai/web.ts`: tham khảo luồng Gemini Search hiện có; tách phần gọi provider khỏi action có session.
- `api_cache`: giữ tương thích giao diện hiện tại. Snapshot lịch sử là dữ liệu bổ sung, không thay bằng cache upsert.

## Ranh giới cần refactor khi triển khai

Nhiều module hiện import `server-only` và dùng alias `@/`; không giả định Node worker có thể import trực tiếp. Tách lõi TypeScript không phụ thuộc Next.js, tạo wrapper web có `server-only` và wrapper worker đọc env riêng. Worker không gọi Server Action, không tạo cookie và không giả lập người dùng.

`userId: null` được hỗ trợ trong interface quota hiện tại; phải kiểm tra SQL và thêm định danh tác nhân/job vào sổ khi triển khai. Không gán job cho một tài khoản người dùng giả.

Không thêm đường HTTP gọi TikToday riêng để bỏ qua cache/quota. Nếu cần tách HTTP client sang module dùng chung, mọi caller vẫn đi qua cùng fetcher và RPC.

## Xuất dashboard nhất quán

Mỗi lần tổng hợp tạo `dashboard_run_id`, tập kết quả và metadata. Chỉ đổi con trỏ phiên bản đang dùng sau khi lưu thành công toàn bộ. UI đọc một phiên bản nhất quán, có `computed_at`, thời gian dữ liệu nguồn và độ phủ. Phiên bản lỗi không thay phiên bản tốt trước đó.
