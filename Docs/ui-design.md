# Thiết kế giao diện (giai đoạn 2 và 3)

Tài liệu này ghi lại kết quả gọi thử API thật ngày 21/11/2026 và thiết kế giao diện dựa trên đó. Các tài liệu khác: [overview.md](overview.md), [tech-stack.md](tech-stack.md), [api-layer.md](api-layer.md), [database.md](database.md), [tiktoday-api.md](tiktoday-api.md).

## 1. Kết quả gọi thử API thật

Mỗi endpoint đang mở được gọi một lần qua `fetchWithCache`. Tổng tốn 8 trong 100 lượt của ngày.

| Endpoint | Kết quả |
| :--- | :--- |
| `health.check` | Tốt, không tốn quota |
| `creator.search` | Tốt với từ khoá. Gọi với từ khoá rỗng nhận `UPSTREAM` ba lần liên tiếp, nên giao diện bắt buộc nhập từ khoá |
| `creator.profile` | Tốt |
| `creator.affiliate` | Tốt, nhưng xem mục 2 |
| `creator.videos` | Tốt |
| `product.search` | Tốt |
| `product.details` | Tốt |
| `video.search` | Tốt |
| `video.details` | **Lỗi `UPSTREAM` (503) liên tục** trên hai id khác nhau. Cần báo TikToday. Mã yêu cầu mẫu: `01a1fc0e-c996-718f-a6ec-158e9c7de50f` |

Lỗi 503 không bị tính quota, và sổ quota hoàn lại đúng như thiết kế.

## 2. Phát hiện quan trọng về dữ liệu

1. **`creator.affiliate` có thể trả sai người.** Hỏi `achi.achi1505` nhưng nhận hồ sơ của `bonnie_unbox` (mã yêu cầu `01a1fc0e-51ce-70eb-9b0f-558482f62152`). Quy tắc: giao diện luôn so sánh `handle` trả về với handle đã hỏi, nếu lệch thì coi là "không có dữ liệu affiliate".
2. **Kết quả `creator.search` có cùng dạng với `creator.affiliate`**: GMV, số đơn, ngành hàng, hoa hồng, `top_videos` kèm sản phẩm. Vì vậy bảng tìm kiếm có thể hiển thị số liệu bán hàng ngay mà không cần gọi thêm.
3. **`creator.profile` rất ít**: tên, bio, số người theo dõi, theo dõi, tim, và 12 video gần nhất chỉ có `id` và `description`.
4. **Nhiều số liệu là khoảng hoặc `null`** (`gmv_range`, `gmv`, `commission_rate_range`...). Giao diện hiển thị khoảng khi không có số chính xác, và "Chưa có dữ liệu" khi `null`.
5. **Video** (từ `video.search` và `creator.videos`) có đủ lượt xem, tim, bình luận, chia sẻ, lưu, nhạc, ảnh bìa. `video.details` lỗi nên chưa cần dùng.
6. **Mốc thời gian không đồng nhất**: video dùng giây (`create_time`), đánh giá sản phẩm dùng mili giây.
7. **Giá**: danh sách sản phẩm trả số (`sale_price`), chi tiết trả thêm chuỗi (`sale_price_text`) và từng SKU.
8. **Link ảnh có chữ ký và hạn dùng**, nên không lưu lâu dài (đã ghi ở overview).

## 3. Nguyên tắc giao diện

- **Quota là tài nguyên chính.** Luôn hiển thị số lượt còn lại. Mọi nút gọi API ghi rõ chi phí, ví dụ "Tìm (1 lượt)".
- **Mở trang không tự tiêu quota ngoài ý muốn.** Trang tìm kiếm chỉ gọi API khi người dùng gửi form. Trang creator chỉ gọi `creator.profile` (tối đa 1 lượt). Số liệu bán hàng và danh sách video là nút riêng, bấm mới gọi. Liên kết giữa các trang dùng `prefetch={false}`.
- **Cache là mặc định.** Mỗi kết quả ghi nguồn ("từ cache" hoặc "vừa gọi API"), thời điểm cập nhật, và có nút "Làm mới" (tốn lượt).
- **Lỗi nào cũng có thông báo tiếng Việt và hướng xử lý**, không có trang trắng. Lỗi tạm (`UPSTREAM`) có nút "Thử lại".
- **Ưu tiên server.** Trang là Server Component, tìm kiếm dùng form `GET` (URL chia sẻ được, tải lại là đọc cache). Client Component chỉ dùng cho điều hướng đang chọn và các nút gọi API.
- **Số hiển thị gọn**: "1,99 triệu", "512 nghìn", "52.689₫", "48,6%". Giờ hiển thị theo múi giờ `Asia/Ho_Chi_Minh`.
- Sáng và tối theo hệ thống, dùng được trên điện thoại.

## 3b. Nền tảng giao diện (nâng cấp 21/11/2026)

- **shadcn/ui** (kiểu `radix-nova`, khởi tạo bằng CLI, cấu hình trong `components.json`): Button, Card, Input, Native Select, Badge, Table, Skeleton, Alert, Avatar, Dropdown Menu, Breadcrumb, Sidebar, Tooltip, Sonner, Label, Separator, Sheet.
- **Khung ứng dụng**: Sidebar của shadcn (thu gọn được, thành ngăn kéo trên điện thoại, trạng thái nhớ qua cookie), thanh đầu trang có breadcrumb, thẻ hạn mức API ở chân thanh bên, menu người dùng (đổi sáng/tối/theo hệ thống, đăng xuất).
- **Giao diện sáng/tối** bằng `next-themes` (class `dark`), mặc định theo hệ thống. Mọi màu dùng biến CSS (`bg-card`, `text-muted-foreground`...), không dùng màu cố định.
- **Thông báo** bằng Sonner (toast) cho các nút Làm mới và Tải dữ liệu.
- **Font** Inter có bộ ký tự tiếng Việt (font Geist cũ không có).
- **Biểu đồ** (Recharts qua `chart` của shadcn): hồ sơ creator có biểu đồ tròn cho doanh thu theo kênh (video/live), ngành hàng, giới tính; cột cho độ tuổi; thanh ngang cho khu vực. Tổng quan có biểu đồ cột lượt quota theo ngày (14 ngày, giờ Việt Nam). Màu lấy từ `--chart-1..5` nên đổi theo chủ đề sáng/tối.
- **Bảng creator** (TanStack Table v9): sắp xếp bằng cách bấm tiêu đề cột (mặc định theo người theo dõi giảm dần, giá trị thiếu xếp cuối), ô lọc nhanh theo tên, handle, MCN, ngành hàng. Việc sắp xếp và lọc chạy ngay trên dữ liệu đã tải nên không gọi lại API và không tốn quota. Ô "xếp theo" trong form tìm kiếm đã bỏ.
- Thành phần của dự án (`src/components/common.tsx`, `entities.tsx`) được viết lại trên nền shadcn, giữ nguyên tên để các trang không phải đổi.

## 4. Bản đồ trang

| Đường dẫn | Nội dung | Chi phí khi mở |
| :--- | :--- | :--- |
| `/` | Tổng quan: quota, tìm kiếm gần đây, nhật ký gọi API, kiểm tra kết nối | 0 |
| `/creators` | Tìm creator affiliate: ô từ khoá, số lượng, sắp xếp, bảng kết quả | 1 lượt khi gửi form (0 nếu cache) |
| `/creators/[handle]` | Hồ sơ creator (xem mục 5) | Tối đa 1 lượt cho profile |
| `/products` | Tìm sản phẩm, lưới thẻ | 1 lượt khi gửi form |
| `/products/[id]` | Chi tiết sản phẩm: ảnh, giá, biến thể, đánh giá, shop | 1 lượt |
| `/videos` | Tìm video, lưới thẻ có ảnh bìa và số liệu | 1 lượt khi gửi form |
| `/videos/[id]` | Chi tiết video: mô tả, cờ `is_ecommerce`, quốc gia, tương tác kèm tỷ lệ, người đăng, nhạc. Mở từ nút "Chi tiết (1 lượt)" trên thẻ video. Làm theo mô tả chính thức của TikToday, chưa kiểm chứng với response thật vì endpoint đang lỗi | 1 lượt (lỗi không tính) |
| `/guide` | Hướng dẫn đọc số liệu và thuật ngữ | 0 |
| `/history` | Lịch sử tìm kiếm, cho biết mở lại có tốn quota không | 0 |
| `/explore` | Trang thử nghiệm JSON thô của giai đoạn 1, giữ để đối chiếu dữ liệu | Theo nút |

Điều hướng là thanh bên trái (trên điện thoại là hàng liên kết ở đầu trang), kèm chỉ báo quota luôn hiện.

## 5. Trang hồ sơ creator

1. **Đầu trang** (từ `creator.profile`): ảnh, tên, `@handle`, bio, số người theo dõi, đang theo dõi, tổng tim. Nút "Làm mới hồ sơ (1 lượt)" và nhãn nguồn dữ liệu.
2. **Số liệu bán hàng** (từ `creator.affiliate`): nếu đã có trong cache thì hiển thị ngay, nếu chưa thì nút "Tải số liệu bán hàng (1 lượt)". Gồm:
   - Thẻ số: GMV, số đơn, GPM, hoa hồng, cấp độ, lượt xem video trung bình.
   - Tỷ lệ doanh thu video và live.
   - Ngành hàng (tỷ lệ theo ngành).
   - Người theo dõi: độ tuổi, giới tính, khu vực (thanh ngang).
   - Video nổi bật kèm sản phẩm đã bán.
3. **Video gần đây** (từ `creator.videos`): nếu đã có cache thì lưới video, nếu chưa thì nút "Tải video gần đây (1 lượt)". Trong lúc chưa tải, hiển thị 12 mô tả video từ `profile`.

## 6. Kiểu dữ liệu và lớp hiển thị

- `src/lib/tiktoday/types.ts`: kiểu TypeScript mô tả response thật. Mọi trường đều tuỳ chọn, vì API còn beta và nhiều trường `null`. Chỉ ép kiểu ở biên (khi nhận từ `fetchWithCache`), không validate chặt để API thêm hoặc bớt trường không làm vỡ trang.
- `src/lib/format.ts`: định dạng số, tiền, phần trăm, ngày, thời lượng (có test).
- `fetchWithCache` có thêm tuỳ chọn `cacheOnly`: chỉ đọc cache, không gọi API, không tốn quota. Nếu chưa có trả mã lỗi `NOT_CACHED`.
- Ảnh dùng `next/image` với `unoptimized` và `referrerPolicy="no-referrer"`, vì link ảnh có chữ ký hạn dùng và nhiều tên miền CDN, không nên để Next tải lại.

## 7. Ngoài phạm vi lần này

Lưu danh sách creator hoặc sản phẩm, ghi chú, xuất Excel, so sánh hai creator, tìm trong dữ liệu đã lưu (giai đoạn 4). Chưa tạo bảng thực thể `creators`, `products`, `videos`: cache thô (`api_cache`) đủ cho giao diện hiện tại.

## 8. Việc còn mở

- Báo TikToday hai lỗi ở mục 1 và mục 2.
- `video.details` vẫn trả 503 `UPSTREAM_ERROR` ("data temporarily unavailable") trên 4 id khác nhau ngày 21/11/2026. Trang `/videos/[id]` đã làm theo mô tả chính thức. Khi endpoint chạy lại, cần đối chiếu response thật và chỉnh kiểu dữ liệu nếu khác.
- Tìm creator bằng từ khoá rỗng có lỗi hay không là do API hay do tham số: cần hỏi TikToday.
