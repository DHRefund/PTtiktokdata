# Vận hành, quota và triển khai

## Job và lịch chạy

Dùng Postgres queue ở giai đoạn đầu, chưa cần Redis. Scheduler tạo job với dedupe key theo source, scope, loại và cửa sổ lịch. Worker claim atomically bằng transaction/`FOR UPDATE SKIP LOCKED`, ghi lease token và heartbeat. Worker ghi kết quả hoặc checkpoint chỉ khi còn giữ token; lease hết hạn được claim lại. Thiết kế chấp nhận thực thi ít nhất một lần, xử lý idempotent tại nơi lưu.

Trạng thái: queued → running → succeeded/partial; lỗi tạm → retry_wait; hết lần thử → failed; nguồn cần đăng nhập hoặc bị chặn → blocked. Mỗi batch lưu checkpoint sau khi commit; job resume không tải lại toàn bộ khi có thể.

Lịch thử nghiệm: khám phá mỗi 12 giờ, cập nhật nhóm ưu tiên mỗi 24 giờ, tổng hợp sau batch thành công và tìm bối cảnh Gemini tối đa mỗi 24 giờ cho tập nhỏ. Đây là cấu hình ban đầu, phụ thuộc khả năng nguồn; không cam kết realtime. Có jitter và concurrency theo nguồn, mặc định một job/source. Không chạy bù vô hạn các kỳ đã bỏ lỡ.

Retry lỗi mạng/429/5xx tối đa 3 attempts với backoff+jitter và tôn trọng Retry-After. Sai schema hoặc lỗi xác thực không retry dồn; tạm dừng adapter. Có công tắc tắt nguồn, hủy lịch và chạy lại job lỗi.

## Ngân sách TikToday dùng chung

Mọi lượt web và worker phải đi qua `reserve_quota`/`finish_usage`. Worker đọc cấu hình thật trong DB, không hardcode 100/ngày hay 1.000/chu kỳ. Một trần worker riêng cần được kiểm tra atomically cùng quota toàn cục khi triển khai; kiểm tra rồi gọi ở hai bước riêng có thể vượt trần khi nhiều worker.

Ưu tiên cache và dữ liệu còn đủ mới. Quota bổ sung dành cho ứng viên có ID xác minh và thiếu dữ liệu. Giới hạn theo ngày lẫn phần còn lại của chu kỳ, giữ phần dự phòng cho thao tác web. Không chạy 20 lượt/ngày chỉ vì còn quota ngày nếu chu kỳ không đủ duy trì. Job ghi rõ chi phí dự kiến, thực tế và lý do bỏ qua.

Worker không force refresh mọi cache theo mỗi lần chạy. Cache hit dùng thời điểm fetch cũ, không tạo snapshot mới. 404 được ghi nhận theo chính sách hiện tại, không retry liên tục.

## Gemini và chi phí nguồn

Tận dụng sổ AI hiện tại sau khi tách khỏi session. Cần cơ chế giữ chỗ chi phí chung, atomic, trước khi web/worker gọi; kiểm tra tổng rồi ghi sau có thể vượt ngân sách. Giới hạn bổ sung số call/ngày, concurrency và token/search theo provider. Chi phí 0 trong cấu hình Gemini hiện tại không có nghĩa không bị rate limit hoặc miễn phí ở mọi gói.

Cache bối cảnh theo sản phẩm/chủ đề, market, cửa sổ thời gian và prompt version. Theo dõi riêng token, grounding/search nếu provider tính phí, gói dữ liệu nguồn và hạ tầng browser; chưa có bảng giá được xác minh thì không đưa dự toán tiền cố định.

## Triển khai và bảo mật

Web triển khai như hiện tại. Worker chạy Node trên container/VPS/dịch vụ job phù hợp; browser runtime chỉ thêm sau khảo sát nếu thực sự cần. Scheduler phải có khóa chống nhiều instance tạo lịch trùng.

Biến môi trường dự kiến: `COLLECTOR_ENABLED`, `COLLECTOR_WORKER_ID`, cấu hình concurrency/lease và secret nguồn. Tái dùng Supabase/TikToday/Gemini secret ở môi trường worker theo quyền cần thiết. Cookie nguồn là secret, không commit; ưu tiên secret manager, có quy trình cập nhật khi hết hạn.

Chỉ tải host được allowlist, kiểm tra redirect và chặn địa chỉ nội bộ khi xử lý URL bên ngoài. Không thực thi hướng dẫn có trong HTML hoặc nội dung AI. Log phải che token, cookie và header nhạy cảm.

## Quan sát và khôi phục

Theo dõi tỷ lệ thành công theo nguồn, số item mới, tỷ lệ ghép ID, metric thiếu, độ trễ dữ liệu, hàng đợi, lease hết hạn, quota và chi phí. Batch rỗng bất thường hoặc tỷ lệ parse giảm phải phát cảnh báo vận hành; không hiểu là thị trường không còn sản phẩm.

Khi adapter hỏng: tắt riêng nguồn, giữ dashboard cũ có nhãn stale, sửa parser trên fixture rồi chạy lại raw còn lưu. Khi worker dừng: web vẫn đọc bản xuất trước đó. Khi rollback schema: ưu tiên migration bổ sung tương thích, không xóa lịch sử để giải quyết lỗi triển khai.
