# Nguồn dữ liệu và hợp đồng adapter

## Vai trò nguồn

| Nguồn | Vai trò dự kiến | Điều phải kiểm chứng |
| --- | --- | --- |
| Kalodata/FastMoss | Khám phá danh sách và chỉ số xu hướng | Cách truy cập, quyền sử dụng, ID, phân trang, kỳ và đơn vị chỉ số |
| TikToday | Bổ sung chi tiết sản phẩm, video, creator | Trường thực có trong response; endpoint chưa mở không được lên lịch |
| Gemini Web Search | Bối cảnh nhu cầu, mùa vụ, nguồn thông tin | URL trích dẫn, thời điểm thông tin, mức liên quan đến đúng sản phẩm |

Thứ tự chọn phương thức: API/export được cung cấp → tải dữ liệu có cấu trúc được phép → thu thập trang HTML/browser khi phù hợp quyền truy cập. Không thiết kế phụ thuộc endpoint nội bộ chưa xác minh. Khi gặp CAPTCHA, cấm truy cập hoặc phiên hết hạn: dừng nguồn, ghi trạng thái cần xử lý; không tự tìm cách vượt chặn.

## Khảo sát nguồn

Với mỗi nguồn lập hồ sơ gồm URL mẫu, cách xác thực, bảng/trường khả dụng, giới hạn trang/kỳ, điều kiện sử dụng, mẫu dữ liệu đã che thông tin nhạy cảm và chi phí. Chạy thử nhỏ, kiểm tra lặp lại sau một lần cập nhật. Nếu chỉ có export thủ công, hỗ trợ import có nguồn gốc trước khi tự động hóa.

Không đưa số liệu mẫu vào dashboard thật. Adapter chưa có bằng chứng hoạt động phải giữ `disabled`.

## Hợp đồng logic

Mỗi adapter có `source`, `adapter_version`, capability (`discover`, `observe`, `context`), thị trường hỗ trợ và giới hạn truy cập. Các thao tác trả một batch với:

- `batch_id`, `job_id`, `fetched_at`, URL nguồn, cursor tiếp tục nếu có.
- Danh sách item với external ID, product/shop ID nếu có, market, tên, URL và các metric observations.
- Mỗi metric có tên, giá trị hoặc khoảng, đơn vị, tiền tệ, loại `cumulative`/`period`/`rank`, `period_start`, `period_end`, múi giờ nguồn và mức chính xác.
- `observed_at`/`source_updated_at` nếu nguồn có cung cấp; không thay bằng thời điểm fetch mà không ghi rõ.
- Payload gốc hoặc tham chiếu file, hash payload, cảnh báo và trạng thái partial.

Lỗi chuẩn: `AUTH_REQUIRED`, `ACCESS_BLOCKED`, `RATE_LIMITED`, `SCHEMA_CHANGED`, `TIMEOUT`, `UNAVAILABLE`, `INVALID_DATA`. Không có dữ liệu hợp lệ là kết quả rỗng, không tự chuyển thành số 0.

## Định danh và đối chiếu

Ưu tiên `(market, TikTok product ID)` và xác minh shop ID nếu có. Không ép hai listing cùng tên thành một sản phẩm. External ID của nhà cung cấp được ánh xạ riêng. Tên/ảnh/giá tương tự chỉ tạo đề xuất ghép để duyệt. Bản chưa ghép vẫn có thể xem như ứng viên độc lập, chưa được bổ sung TikToday bằng ID suy đoán.

## Gemini

Lưu truy vấn, ngày tìm, provider/model, văn bản và citations. Nội dung web là dữ liệu không đáng tin cậy, không phải chỉ thị cho worker. Chỉ cho phép công cụ đọc; không cho model tự chọn URL tùy ý để worker tải hoặc tự tiêu quota TikToday.

Kết luận phải tham chiếu bằng chứng có ID. Không trích xuất snippet thành doanh thu đã xác minh. Nếu tìm thấy một sản phẩm mới qua web, ghi ứng viên cần đối chiếu; không tự nhập vào bảng bán chạy.
