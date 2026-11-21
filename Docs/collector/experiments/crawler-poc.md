# Crawler Kalodata bản thử

Trạng thái: tạm dừng theo yêu cầu người dùng; đăng nhập Google trong browser tự động bị từ chối, chưa thu thập thành công bằng script. Luồng hiện tại là Codex đọc bằng trình duyệt theo yêu cầu, xem [HANDOFF](../HANDOFF.md).

Entry point: `collector/kalodata.mjs`. Chạy từ thư mục gốc repository.

## Cách chạy

1. `npm install` để cài dependency Playwright.
2. `node collector/kalodata.mjs --login`: mở Microsoft Edge đã cài trên máy với profile riêng. Tự đăng nhập, chọn Việt Nam và bộ lọc; khi bảng xuất hiện, nhấn Enter ở terminal. Lệnh sẽ kiểm tra và thu mẫu rồi đóng browser.
3. `node collector/kalodata.mjs`: chạy không hiện cửa sổ, dùng lại profile để lấy trang đầu.

Không chạy hai instance cùng profile. Cần Edge cài sẵn; nếu thiếu, báo lỗi thay vì tự cài hoặc đổi browser. Phiên của trình duyệt Codex không được sao chép; lần đầu crawler bắt buộc đăng nhập riêng. Có thể cần đăng nhập lại khi phiên hết hạn.

## Dữ liệu và giới hạn

Đọc DOM sau JavaScript bằng Playwright, lưu tối đa 10 dòng cùng tiêu đề cột, URL, market và thời điểm fetch vào `.collector/output/`. Giữ nguyên chuỗi hiển thị để không mất tiền tệ, số làm tròn và dấu so sánh. Chỉ nhận thị trường Việt Nam, thứ hạng bắt đầu 1; không chuyển trang, không mở chi tiết, không gọi Gemini/TikToday hoặc ghi DB.

Profile và output nằm trong `.collector/`, được gitignore. Profile chứa phiên đăng nhập nhạy cảm; không commit hoặc gửi cho người khác. Không xuất cookie/token vào log.

Lỗi đăng nhập, khóa dữ liệu, lệch cấu trúc hoặc không có bảng sẽ dừng, không thử vượt chặn. Với CAPTCHA, người dùng xử lý ở luồng đăng nhập thủ công. Chưa hỗ trợ scheduler, retry, queue, chuẩn hóa, ID/link hoặc tự xác minh tiêu chí sắp xếp. File là raw batch thử nghiệm, chưa phải dashboard top hot.

Lệnh `--help` chỉ in hướng dẫn, không mở browser. Chỉ xác nhận thu thập thật thành công khi có file output từ profile đã đăng nhập; kiểm tra cú pháp không thay thế bước này.
