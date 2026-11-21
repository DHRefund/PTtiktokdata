# Hệ thống thu thập dữ liệu và khám phá cơ hội bán hàng

Ngày thiết kế: 21/11/2026. Trạng thái: thiết kế trước triển khai; đã có thử nghiệm đọc bảng Kalodata và chuẩn hóa mẫu bằng Gemini, chưa có crawler tự động, migration hoặc thay đổi ứng dụng tương ứng.

## Mục tiêu

**Trạng thái mới nhất:** người dùng tạm dừng crawler tự động, chọn Codex thu thập theo yêu cầu và đưa snapshot vào web. Đọc [báo cáo bàn giao cho Claude Code](HANDOFF.md) để biết hợp đồng dữ liệu và phần đã tích hợp. Kiến trúc worker bên dưới là phương án tương lai, chưa phải luồng vận hành hiện tại.

Người dùng mở trang chủ để tìm sản phẩm đáng nghiên cứu, hiểu vì sao sản phẩm được đề xuất và xem cách các shop/creator đang bán. Hệ thống kết hợp nguồn khám phá như Kalodata/FastMoss, TikToday đang có và Gemini Web Search. Đề xuất hỗ trợ lựa chọn; không bảo đảm doanh số hoặc lợi nhuận.

## Quyết định kiến trúc

- Chung repository và Supabase với ứng dụng hiện tại.
- Worker thu thập chạy bằng tiến trình và lịch triển khai riêng; request Next.js không chạy crawler.
- Worker ghi dữ liệu chuẩn hóa và lịch sử; web đọc bản dashboard đã tổng hợp.
- Mỗi nguồn có adapter riêng và công tắc tắt độc lập.
- Thử nguồn thật trước khi cam kết trường dữ liệu, lịch cập nhật và độ phủ.
- Bản đầu phục vụ thị trường Việt Nam, một ngành hàng được cấu hình; thời gian lưu UTC, kỳ phân tích và lịch chạy dùng `Asia/Ho_Chi_Minh`.

## Bộ tài liệu

1. [Kiến trúc và tích hợp repo](architecture.md)
2. [Nguồn dữ liệu và hợp đồng adapter](sources.md)
3. [Mô hình dữ liệu và chất lượng](data-model.md)
4. [Dashboard và xếp hạng cơ hội](dashboard.md)
5. [Vận hành, quota và triển khai](operations.md)
6. [Lộ trình và tiêu chí nghiệm thu](roadmap.md)
7. [Biên bản thử Kalodata và Gemini ngày 21/11/2026](experiments/2026-11-21-kalodata.md)

## Phạm vi bản đầu

Cập nhật sau thử nghiệm và thống nhất với người dùng ngày 21/11/2026: chấp nhận bắt đầu bằng **10 sản phẩm ở trang đầu Kalodata** trong phạm vi trial hiện có. Không cần mở trang 2, thêm tài khoản hoặc nâng gói cho bản thử đầu. Mục tiêu là kiểm chứng luồng thu thập → lưu → hiển thị từ tập nhỏ này trước khi mở rộng.

Nhãn trên dashboard phải phản ánh bộ lọc/kỳ/cách sắp xếp đã xác minh. Trong lần thử, doanh thu hiển thị giảm dần nhưng trạng thái sắp xếp chưa được kiểm tra trực tiếp; chưa gắn nhãn “top 10 toàn thị trường” hoặc “10 sản phẩm tốt nhất để bán”. Danh sách có thể thay đổi theo cấu hình bảng và cập nhật nguồn, không phải 10 sản phẩm cố định vĩnh viễn.

Trial hiển thị giới hạn 10 lượt xem chi tiết/ngày; đã kiểm chứng một lượt, chưa kiểm chứng đủ 10 lượt hoặc quy tắc reset/mở lại. Chỉ bổ sung chi tiết khi cần, không mặc định thu được mọi trường vì một số phần vẫn bị khóa. TikToday dùng cho các endpoint đang khả dụng; endpoint affiliate theo sản phẩm hiện chưa mở trong repo nên chưa cam kết lấy đầy đủ người bán/creator cho từng sản phẩm.

Một nguồn khám phá đã kiểm chứng, TikToday bổ sung chi tiết và Gemini bổ sung bối cảnh. Có danh sách ứng viên, lịch sử số liệu, xếp hạng trong tập đã thu thập, nguồn chứng minh, trạng thái cập nhật và trang quản trị job tối thiểu. Nguồn thứ hai chỉ bật sau khi adapter đầu tiên ổn định.

Chưa bao gồm quét toàn thị trường, tự đặt hàng, tự đăng bán, tự liên hệ creator hoặc ước tính lợi nhuận khi chưa có giá vốn và chi phí. Không yêu cầu chuyển repo thành monorepo ngay.

## Những điểm cần xác minh trước khi viết collector

- Trang/bảng cụ thể của từng nhà cung cấp và cách truy cập được phép: API, export hoặc trang có thể thu thập.
- Tài khoản/gói hiện có cho phép lấy và hiển thị lại dữ liệu nào; không mặc định có quyền tái phân phối.
- Có product ID, market, kỳ thống kê, đơn vị tiền tệ và dấu thời gian hay không.
- Ngành hàng ưu tiên, hạ tầng chạy worker và ngân sách nguồn dữ liệu.
- Không dùng Gemini làm bằng chứng duy nhất cho số bán hoặc doanh thu.

Tài liệu này mô tả thiết kế của dự án, không xác nhận tính năng hoặc khả năng truy cập hiện tại của Kalodata/FastMoss. Các tên nguồn là mục tiêu khảo sát.
