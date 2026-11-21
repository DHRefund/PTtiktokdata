# Mô hình dữ liệu và chất lượng

## Các bảng đề xuất

Tên bảng và trường dưới đây là hợp đồng thiết kế, chưa phải migration đã áp dụng.

| Bảng | Nội dung chính |
| --- | --- |
| `collector_sources` | Source, enabled, capability, config không chứa secret, trạng thái và lần thành công cuối |
| `collector_jobs` | Loại job, source, payload, dedupe key, trạng thái, priority, due_at, attempt, lease, checkpoint, lỗi |
| `collector_runs` | Mỗi attempt, thời gian, phiên bản adapter, số item thành công/lỗi, chi phí, trace |
| `collector_raw_batches` | Source, job/run, URL, fetched_at, hash, payload JSON hoặc storage path, parser version |
| `market_products` | UUID nội bộ, market, TikTok ID nullable, shop ID, tên, category, first_seen/last_seen |
| `product_source_links` | Product UUID, source, external ID, URL, cách ghép, trạng thái và độ tin cậy |
| `product_observations` | Product/link, raw batch, metric, value/range, unit/currency, kỳ, observed_at, fetched_at, precision |
| `product_contexts` | Gemini query, model, thời gian, nội dung, citations, evidence IDs, input hash |
| `opportunity_runs` | Phiên bản thuật toán, phạm vi/category, as_of, trạng thái và coverage |
| `product_opportunities` | Run/product, điểm, thành phần, bằng chứng, gaps, nhãn freshness, giải thích |
| `dashboard_publications` | Con trỏ run được xuất cho mỗi market/category |

Quan hệ: job → run → raw batch → observations; product → source links → observations; opportunity → observations/context làm bằng chứng. Giữ được đường truy ngược từ thẻ dashboard tới nguồn gốc.

## Ràng buộc

- Unique TikTok ID theo market khi không null; unique `(source, market, external_id)` cho source link.
- Observation chống trùng theo link, metric, kỳ và thời điểm quan sát nguồn; lưu revision nếu cùng khóa nhưng nguồn sửa số liệu. Hash payload hỗ trợ nhận diện tải lại.
- Không dùng `fetched_at` mới để biến dữ liệu nguồn cũ thành dữ liệu mới.
- Retry cùng batch/checkpoint không tạo thêm sản phẩm hay observation trùng. Ghi batch, observations và checkpoint trong transaction phù hợp.
- Index cho job đến hạn, lease hết hạn, product ID, source link và chuỗi thời gian `(product_id, metric, observed_at)`.
- Dữ liệu nội bộ chỉ đọc/ghi qua server với RLS; không công khai service role. Web đọc tập cột đã chọn, không trả raw payload và cấu hình nguồn.

## Diễn giải metric

Số bán tích lũy chỉ so sánh khi cùng listing, nguồn, đơn vị và cách đo. Chênh lệch âm đánh dấu reset/correction, không hiển thị là bán âm. Khoảng thời gian thực giữa hai snapshot phải được giữ; chỉ gắn nhãn 24 giờ khi đủ gần theo tolerance được cấu hình.

Giá trị làm tròn, khoảng, GMV ước tính và doanh thu kỳ có kiểu riêng. Không cộng doanh thu nhiều nguồn của cùng sản phẩm. Không lấy giá hiện tại nhân chênh lệch lượt bán rồi gọi là doanh thu thực. Không so sánh VND với tiền tệ khác trước khi có quy tắc quy đổi và thời điểm tỷ giá.

Thiếu dữ liệu là null/gap. Giá thường là khoảng SKU; không dùng giá thấp nhất làm giá bán đại diện nếu chưa có căn cứ.

## Cache và lịch sử

`api_cache` tiếp tục phục vụ chức năng hiện tại. Adapter TikToday lưu observation từ kết quả có `meta.fetchedAt`; cache hit không tạo quan sát mới giả. Cache cũ vẫn được lưu với nhãn cũ, không dùng làm bằng chứng tăng trưởng mới.

## Lưu giữ ban đầu

Đề xuất raw payload 30 ngày, log job 90 ngày, observations và kết quả tổng hợp 12 tháng; cấu hình lại theo dung lượng và điều kiện nguồn. Không lưu cookie/token vào payload/log. Tách storage cho raw lớn, có job dọn và giữ hash/metadata sau khi hết hạn. Link ảnh có thể hết hạn; hiển thị fallback và chỉ lưu bản ảnh riêng nếu được phép.
