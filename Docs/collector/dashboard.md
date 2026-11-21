# Dashboard khám phá cơ hội

## Trải nghiệm trang chủ

Bộ lọc đầu trang: thị trường, ngành hàng, khoảng giá, kỳ phân tích. Hiển thị phạm vi dữ liệu, cập nhật gần nhất và số nguồn hoạt động. Bản đầu không tuyên bố bao phủ toàn thị trường.

Các khối chính:

1. Đáng nghiên cứu: sản phẩm đủ bằng chứng để xếp hạng trong tập đang theo dõi.
2. Tăng trưởng nhanh: có lịch sử so sánh tương thích.
3. Mới phát hiện: sản phẩm mới vào tập, không đồng nghĩa mới ra thị trường.
4. Danh sách theo dõi: bước sau bản đầu, có biến động từ lần xem trước.

Thẻ sản phẩm có tên/ảnh, giá và đơn vị, nhãn nguồn, kỳ chỉ số, xu hướng nếu đủ dữ liệu, điểm cơ hội, mức đầy đủ dữ liệu, lý do ngắn và nút xem căn cứ. Trang chi tiết cho xem chuỗi thời gian, nguồn bất đồng, shop, video/creator đã xác minh liên quan và bối cảnh web.

Quota, nhật ký API và chi phí chuyển sang khu vực vận hành khi triển khai giao diện; không xóa tính năng hiện có. Việc thay trang chủ chỉ thực hiện sau khi pipeline có dữ liệu thật đạt nghiệm thu.

## Cách xếp hạng bản đầu

Thuật toán xác định tính điểm; Gemini chỉ viết giải thích từ kết quả đó. Chưa dùng mô hình học máy hoặc hứa hẹn xác suất bán thành công.

Đề xuất điểm thử nghiệm trên thang 100:

| Thành phần | Trọng số | Điều kiện |
| --- | --- | --- |
| Đà tăng trưởng | 40 | Chênh lệch số bán hoặc metric tăng trưởng tương thích, có nền và ngưỡng volume |
| Nhu cầu quan sát | 35 | Lượt bán trong kỳ hoặc chênh lệch tích lũy hợp lệ |
| Tính liên tục | 25 | Có ít nhất 3 kỳ hợp lệ, không chỉ một đợt tăng đơn lẻ |

Chuẩn hóa theo percentile trong cùng market/category/kỳ, cố định cách xử lý hòa hạng và lưu phiên bản thuật toán. Không xếp hạng khi cohort dưới 20 sản phẩm hợp lệ; hiện danh sách dữ liệu với nhãn chưa đủ mẫu. Trọng số và ngưỡng là giả thuyết cần kiểm tra, không phải kết luận thị trường.

Thiếu một thành phần bắt buộc thì chưa xuất điểm tổng, không tự phân bổ lại trọng số làm điểm thiếu dữ liệu cao giả. Sản phẩm mới vẫn xuất ở khối mới phát hiện. Tăng phần trăm từ nền quá nhỏ không đủ để vào top; dùng ngưỡng lượt tăng tối thiểu theo ngành được cấu hình sau thử nghiệm.

## Độ tin cậy tách khỏi cơ hội

Hiện riêng độ mới, mức chính xác và độ đầy đủ. Hai nguồn không tự được coi là độc lập; có thể cùng lấy một upstream. Khi chỉ số khác định nghĩa hoặc khác kỳ, hiển thị cạnh nhau, không lấy trung bình. Khi chỉ số tương thích nhưng lệch lớn, đánh dấu cần kiểm tra và không dùng để khẳng định chắc chắn.

Mặc định thử nghiệm: dữ liệu trong 24 giờ là mới, 24–72 giờ là cũ, trên 72 giờ không vào khối tăng trưởng hiện tại. Ngưỡng điều chỉnh theo từng nguồn; nguồn không có thời điểm cập nhật phải ghi rõ chỉ biết thời gian thu thập.

## Vai trò AI và lợi nhuận

AI nhận metric đã tính, evidence IDs và gaps; trả lý do, bối cảnh, rủi ro dữ liệu và bước nghiên cứu tiếp theo. Không cho AI sửa số, ghép ID hoặc quyết định gọi thêm API. Không có citation hợp lệ thì bỏ nhận định đó.

Không gọi điểm cơ hội là điểm lợi nhuận. Muốn gợi ý theo vốn/biên lãi cần thêm giá vốn, phí sàn, vận chuyển, hoàn hàng, quảng cáo và mục tiêu người dùng. Chức năng này nằm ngoài bản đầu.

## Trạng thái giao diện

- Chưa có dữ liệu: hướng dẫn chọn ngành hoặc chờ job, không hiện demo như dữ liệu thật.
- Đang cập nhật: tiếp tục đọc phiên bản tốt gần nhất.
- Nguồn lỗi: hiện cảnh báo phạm vi bị thiếu và lần cập nhật thành công cuối.
- Gemini lỗi: vẫn hiện số liệu và giải thích theo template.
