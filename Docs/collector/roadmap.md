# Lộ trình và tiêu chí nghiệm thu

## Giai đoạn 0 — Kiểm chứng nguồn

Chọn một ngành hàng và khảo sát Kalodata/FastMoss bằng quyền truy cập thực tế. Ghi hồ sơ nguồn theo `sources.md`, thu batch nhỏ ở ít nhất hai thời điểm, xác nhận ID và ý nghĩa metric. Nếu không truy cập ổn định/không phù hợp quyền sử dụng, chọn export hoặc nguồn khác; không triển khai crawler giả định.

Nghiệm thu: có mẫu đã che secret, bảng trường thực, cách truy cập, giới hạn và quyết định go/no-go cho từng nguồn. Chưa đủ lịch sử thì chỉ xác nhận khả năng thu thập, không xác nhận tăng trưởng.

## Giai đoạn 1 — Nền worker và lưu trữ

Thêm migration, queue/lease, raw batches, định danh và observations. Tách lõi TikToday dùng chung nhưng giữ wrapper Next.js. Thêm chế độ dry-run không ghi và không tự gọi provider trả phí trừ khi được cấu hình rõ.

Nghiệm thu: hai worker không cùng claim một lease; lease hết hạn có thể phục hồi; retry không tạo trùng; checkpoint nhất quán; kill giữa job không mất dữ liệu đã commit. Web hiện tại vẫn hoạt động.

## Giai đoạn 2 — Một adapter khám phá và TikToday

Bật adapter đã xác minh, ghép bằng ID, bổ sung chi tiết có chọn lọc. Snapshot dựa trên timestamp thật, phân biệt cache hit với quan sát mới. Áp dụng hạn mức worker trong quota chung.

Nghiệm thu: truy ngược observation tới raw batch; không ghép hai listing cùng tên; gọi đồng thời từ web/worker không vượt giới hạn đã cấu hình; không gọi endpoint unavailable. Xác minh mẫu nhỏ với nguồn thật trong ngân sách đã cấu hình.

## Giai đoạn 3 — Tổng hợp và dashboard

Tạo thuật toán có version, publication atomic và giao diện đọc dữ liệu đã tổng hợp. Thu đủ lịch sử và cohort trước khi bật điểm. Chuyển thẻ vận hành khỏi trọng tâm trang chủ khi dashboard cơ hội dùng được.

Nghiệm thu: mở trang chủ không gọi nguồn bên ngoài; mỗi số liệu có nguồn/kỳ/độ mới; thiếu lịch sử không có tăng trưởng giả; dữ liệu cũ không mang nhãn mới; nguồn lỗi giữ bản dashboard tốt trước đó. Không gọi tập theo dõi là toàn thị trường.

## Giai đoạn 4 — Gemini và nguồn thứ hai

Thêm bối cảnh có citation, ngân sách chung với web và giải thích dựa trên evidence. Sau đó tích hợp nguồn khám phá thứ hai qua cùng hợp đồng, thể hiện chênh lệch thay vì cộng số liệu.

Nghiệm thu: Gemini lỗi vẫn xuất dashboard; không có số liệu bán hàng tự sinh; URL/citation gắn đúng nhận định; nội dung prompt injection không tạo job/call ngoài kế hoạch; nhiều nguồn không tạo bản sao sản phẩm hoặc cộng trùng doanh thu.

## Kiểm thử cần có khi triển khai

- Unit: parse fixture thật, metric thiếu/làm tròn/khoảng, ngày giờ/tiền tệ, matching, score và cohort thiếu mẫu.
- Integration DB: claim/lease, idempotency, checkpoint, quota cạnh tranh, giữ chỗ ngân sách và xuất phiên bản.
- Contract: adapter → observation → evidence trên dashboard.
- Smoke có kiểm soát: một batch nhỏ nguồn thật, không gọi mạng trong CI mặc định.
- Regression: các test hiện có, typecheck, lint và build khi thay code liên quan. Đọc guide Next.js cục bộ trước khi sửa phần framework theo AGENTS.md.

## Quyết định chưa chốt

Nguồn và gói truy cập cụ thể, ngành hàng đầu tiên, máy chạy worker, trần chi phí, lịch tối ưu và ngưỡng score cần chốt từ dữ liệu thử. Chưa ước lượng thời gian/chi phí triển khai cố định khi chưa qua giai đoạn 0.

## Thứ tự thực hiện tiếp theo

Bắt đầu bằng khảo sát nguồn và mẫu dữ liệu, sau đó mới viết migration/worker. Không bắt đầu bằng thay trang chủ hoặc viết crawler cho nhiều nguồn cùng lúc.
