# Tổng quan web "TikTok Data API"

Cập nhật: 2026-11-21. Xem thêm: [tiktoday-api.md](tiktoday-api.md) (tài liệu API), [tech-stack.md](tech-stack.md) (công nghệ và kiến trúc).

## 1. Web này là gì

"TikTok Data API" là web cá nhân, dùng cho chủ dự án và một người bạn. Web gọi TikToday API để **tải dữ liệu TikTok và TikTok Shop về, lưu lại trong Supabase, rồi hiển thị** dưới dạng bảng, trang chi tiết và biểu đồ.

Ba ý chính:

- **Tải về một lần, xem nhiều lần.** Gói Free chỉ có 100 lượt gọi mỗi ngày, nên mọi dữ liệu đã tải đều được lưu và hiển thị từ DB. Chỉ gọi lại API khi người dùng chủ động làm mới hoặc dữ liệu quá cũ.
- **Hiển thị dữ liệu thô trước, thiết kế sau.** Cấu trúc thật của nhiều trường trong response (`top_videos`, `stats`, `skus`...) chưa biết. Giai đoạn đầu web lưu nguyên JSON và hiển thị tạm, sau khi xem dữ liệu thật mới thiết kế lại giao diện.
- **Đây là công cụ cá nhân.** Chỉ có đăng nhập giả (xem tech-stack), không đăng ký, không phân quyền.

## 2. Dữ liệu web có thể lấy

Dựa trên 9 endpoint đang mở. Mỗi lượt gọi tốn 1 quota (trừ health check).

| Nhóm | Dữ liệu | Endpoint |
| :--- | :--- | :--- |
| **Creator** | Hồ sơ TikTok công khai: tên, bio, follower, tổng tim, video gần đây (mọi quốc gia) | `creator.profile` |
| | Hồ sơ affiliate TikTok Shop: GMV, số sản phẩm bán, hoa hồng, agency, ngành hàng, tăng trưởng, lượt xem video, nhân khẩu học người theo dõi (ưu tiên VN) | `creator.affiliate` |
| | Danh sách creator affiliate theo từ khoá, tối đa 50 | `creator.search` |
| | Video mới nhất của một creator, lọc theo thời gian | `creator.videos` |
| **Sản phẩm** | Tìm sản phẩm theo từ khoá, tối đa 50 | `product.search` |
| | Chi tiết sản phẩm: giá, SKU, đánh giá, shop, thông số | `product.details` |
| **Video** | Tìm video theo từ khoá, tối đa 50 | `video.search` |
| | Chi tiết một video: tương tác, người đăng, có gắn sản phẩm hay không (mọi quốc gia) | `video.details` |
| **Hệ thống** | Kiểm tra key, không tốn quota | `health.check` |

Ba endpoint chưa mở (affiliate của sản phẩm, tìm sản phẩm affiliate, link phát video) sẽ được thêm vào khi TikToday mở.

## 3. Các trang của web

| Trang | Làm gì | Nguồn dữ liệu |
| :--- | :--- | :--- |
| **Đăng nhập** | Vào bằng một trong hai tài khoản có sẵn | Auth giả |
| **Tổng quan (Dashboard)** | Quota còn lại hôm nay, trạng thái key, lối tắt vào các mục, vài mục xem gần đây | `api_usage`, `health.check` |
| **Creator: tìm kiếm** | Nhập từ khoá, hiển thị bảng creator affiliate: follower, ngành hàng, GMV (khoảng), hoa hồng, tăng trưởng. Lọc và sắp xếp. Chọn creator để lưu | `creator.search` |
| **Creator: chi tiết** | Nhập handle hoặc bấm từ bảng. Gộp hồ sơ TikTok và hồ sơ affiliate, biểu đồ tỉ trọng doanh thu video/live, ngành hàng, giới tính, độ tuổi, tỉnh/thành người theo dõi, video nổi bật, video mới nhất | `creator.profile`, `creator.affiliate`, `creator.videos` |
| **Sản phẩm: tìm kiếm** | Nhập từ khoá, bảng sản phẩm: giá, đã bán, đánh giá, shop | `product.search` |
| **Sản phẩm: chi tiết** | Giá, các SKU, thông số, đánh giá, thông tin shop, giao hàng | `product.details` |
| **Video: tìm kiếm** | Nhập từ khoá, bảng video: mô tả, hashtag, lượt xem, thích, bình luận, chia sẻ | `video.search` |
| **Video: chi tiết** | Nhập id hoặc bấm từ bảng. Số liệu tương tác, người đăng, nhạc, video có bán hàng hay không | `video.details` |
| **Thư viện dữ liệu** | Mọi creator, sản phẩm, video đã tải về. Tìm trong dữ liệu đã lưu (không tốn quota), xem lịch sử thay đổi theo thời gian, xuất Excel | Supabase |
| **Nhật ký API** | Lịch sử các lượt gọi: thời gian, endpoint, kết quả, có tính quota không, `request_id` | `api_usage` |

## 4. Luồng sử dụng điển hình

1. Đăng nhập, vào trang **Creator: tìm kiếm**, nhập "beauty".
2. Web gọi `creator.search` (1 quota), lưu 20 creator vào DB, hiển thị bảng.
3. Bấm một creator. Nếu đã có hồ sơ trong DB và còn mới, hiển thị ngay, không tốn quota. Nếu chưa có, web gọi `creator.profile` và `creator.affiliate` (2 quota) rồi lưu.
4. Trong trang chi tiết, bấm "Lấy video mới nhất" (`creator.videos`, 1 quota) khi cần.
5. Muốn so sánh, chọn nhiều creator từ **Thư viện**, lọc theo ngành hàng và hoa hồng, xuất Excel.

Quy tắc chung: dữ liệu đã có trong DB thì hiển thị từ DB, kèm nhãn "cập nhật lúc ..." và nút "Làm mới" (tốn 1 quota mỗi endpoint).

## 5. Giới hạn cần tính đến

- **Quota Free: 100 lượt/ngày, 1.000 lượt/30 ngày**, rate limit 2 lượt/giây và 60 lượt/phút. Một trang chi tiết creator đầy đủ tốn tới 3 lượt, nên quota là tài nguyên chính cần quản lý. Web luôn hiển thị số lượt còn lại và cảnh báo trước khi một thao tác tốn nhiều lượt.
- **`creator.affiliate` chủ yếu có dữ liệu VN.** Creator ngoài VN có thể trả rỗng và vẫn bị tính quota.
- **Search tối đa 50 kết quả, không phân trang.** Muốn nhiều hơn phải đổi từ khoá.
- **Doanh thu và lượt bán là khoảng/ước tính** (`gmv_range`...), một số creator để `null`. Giao diện hiển thị đúng như vậy.
- **Link ảnh/video có hạn dùng.** Web không lưu link lâu dài. Nếu cần hiển thị ảnh bền vững, phải tải ảnh về Supabase Storage (làm sau nếu cần).
- **Dữ liệu từ bên thứ ba, đang beta.** Cấu trúc có thể đổi, nên web lưu nguyên JSON response (`jsonb`) để không mất dữ liệu khi API đổi.

## 6. Lộ trình

| Giai đoạn | Nội dung | Kết quả |
| :--- | :--- | :--- |
| **0. Nền móng** | Khởi tạo dự án, đăng nhập giả, lớp gọi TikToday có cache, quota và retry, migration Supabase | Gọi được API an toàn, có nhật ký |
| **1. Creator** | Tìm kiếm, chi tiết (profile + affiliate), lưu vào DB, hiển thị dữ liệu thô | Xem được dữ liệu thật để biết API trả gì |
| **2. Thiết kế lại theo dữ liệu thật** | Dựa vào JSON đã tải, thiết kế lại bảng, trang chi tiết, biểu đồ, cập nhật kiểu Zod | Giao diện khớp dữ liệu |
| **3. Sản phẩm và video** | Tìm kiếm và chi tiết cho sản phẩm, video, video của creator | Phủ đủ 9 endpoint |
| **4. Thư viện và xuất Excel** | Tìm trong dữ liệu đã lưu, lịch sử thay đổi, xuất Excel | Dùng được hằng ngày |
| **5. Mở rộng (tuỳ chọn)** | Chấm điểm creator, endpoint mới khi TikToday mở, lưu ảnh, auth thật | Theo nhu cầu |

Thiết kế giao diện giai đoạn 2 và 3, dựa trên dữ liệu thật đã gọi thử: xem [ui-design.md](ui-design.md). Các tính năng AI (phân tích, so sánh, hỏi đáp): xem [ai.md](ai.md).

## 7. Câu hỏi còn mở

- Giai đoạn 1 nên làm trang nào trước: tìm kiếm creator hay nhập thẳng handle để xem hồ sơ? (đề xuất: làm cả hai, vì nhập handle dùng ngay được cho thử nghiệm)
- Khi hiển thị thư viện, có cần phân nhóm theo "chiến dịch" hoặc nhãn tự đặt (ví dụ "ứng viên KOC mỹ phẩm") không?
- Có cần so sánh hai creator cạnh nhau không?
