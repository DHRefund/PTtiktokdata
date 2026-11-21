# Tài liệu TikToday API cho dự án web

Cập nhật: 2026-11-21. Nguồn: tài liệu `developers.tiktoday.vn` do chủ dự án dán lại.

TikToday API là REST API bên thứ ba (không phải API chính thức của TikTok), trả dữ liệu TikTok và TikTok Shop chủ yếu tại Việt Nam. Hiện có 12 endpoint: 9 đang mở, 3 chưa mở (trả `501 NOT_AVAILABLE`, không tính quota).

---

## 1. Tổng quan và cách dùng chung

| Mục | Giá trị |
| :--- | :--- |
| Base URL | `https://openapi.tiktoday.vn` |
| Xác thực | Header `Authorization: Bearer <API_KEY>` (hoặc `X-Api-Key`). Key dạng `ttk_live_...`. Không đặt key trên query string |
| CORS | Không hỗ trợ, phải gọi từ backend |
| Version | `v1`. Nhóm creator/product/video là `beta`, health là `stable` |
| Gói hiện tại | Free, tối đa 5 API key |
| Quota gói Free | 100 lượt/ngày (reset 00:00) và 1.000 lượt/chu kỳ 30 ngày |
| Rate limit | 2 lượt/giây, 60 lượt/phút mỗi key |
| Chi phí | Mỗi endpoint dữ liệu tốn 1 quota, `health.check` tốn 0 |

Khung response chung:

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "request_id": "0193a1b2-0000-7000-8000-000000000000"
}
```

Khi lỗi: `data` là `null`, có thêm `doc_url`. Hãy log `request_id` để gửi hỗ trợ.

Quy ước dữ liệu:

- Thời gian là unix time tính bằng **giây** (nhân 1000 khi dùng trong JavaScript).
- Link ảnh/video (`avatar_url`, `image_urls`, `image_url`, `play_url`) **có hạn dùng**, không lưu lâu dài.
- Handle gửi có hoặc không có `@`, tối đa 24 ký tự gồm chữ, số, `_` và `.`, không phân biệt hoa thường.
- Các endpoint search trả tối đa 50 kết quả, không phân trang.

Ví dụ gọi (cURL):

```bash
curl -X GET 'https://openapi.tiktoday.vn/health/v1/check' \
  -H "Authorization: Bearer $TIKTODAY_API_KEY"
```

---

## 2. Bảng tóm tắt endpoint

| Endpoint | Method | Đường dẫn | Mã | Timeout | Trạng thái |
| :--- | :---: | :--- | :--- | :---: | :--- |
| Kiểm tra key | GET | `/health/v1/check` | `health.check` | 2s | Mở, 0 quota |
| Hồ sơ TikTok creator | GET | `/creator/v1/creators/{username}/profile` | `creator.profile` | 30s | Mở |
| Hồ sơ affiliate creator | GET | `/creator/v1/creators/{username}/affiliate` | `creator.affiliate` | 55s | Mở |
| Tìm creator affiliate | POST | `/creator/v1/creators/search` | `creator.search` | 55s | Mở |
| Video mới nhất của creator | GET | `/creator/v1/creators/{username}/videos` | `creator.videos` | 55s | Mở |
| Chi tiết sản phẩm | GET | `/product/v1/products/{id}/details` | `product.details` | 55s | Mở |
| Tìm sản phẩm | POST | `/product/v1/products/search` | `product.search` | 55s | Mở |
| Thông tin video | GET | `/video/v1/videos/{id}` | `video.details` | 30s | Mở |
| Tìm video theo từ khoá | POST | `/video/v1/videos/search` | `video.search` | 55s | Mở |
| Affiliate của sản phẩm | GET | `/product/v1/products/{id}/affiliate` | `product.affiliate` | 55s | Chưa mở |
| Tìm sản phẩm affiliate | POST | `/product/v1/products/affiliate/search` | `product.affiliate_search` | 55s | Chưa mở |
| Lấy link phát video | POST | `/video/v1/videos/play-url` | `video.play_url` | 55s | Chưa mở |

---

## 3. Nhóm Creator (`v1 · beta`)

### 3.1. Hồ sơ TikTok của creator

`GET /creator/v1/creators/{username}/profile` · mã `creator.profile` · 1 quota · 30s

Hồ sơ công khai của creator ở **mọi quốc gia**. Tài khoản riêng tư hoặc bị TikTok giới hạn trả `404 NOT_FOUND`.

Tham số:

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
| :--- | :---: | :---: | :---: | :--- |
| `username` | path | string | Có | Handle TikTok |

Dữ liệu trả về (`data`, object):

| Trường | Kiểu | Mô tả |
| :--- | :---: | :--- |
| `id` | string | Id tài khoản TikTok |
| `handle` | string | Handle, không có `@` |
| `nickname` | string | Tên hiển thị |
| `bio` | string | Tiểu sử |
| `avatar_url` | string | Ảnh đại diện (có hạn dùng) |
| `follower_count` | integer | Số người theo dõi |
| `following_count` | integer | Số tài khoản đang theo dõi |
| `heart_count` | integer | Tổng lượt thích |
| `recent_videos` | array<object> | Vài video gần đây trên trang hồ sơ |

```bash
curl -X GET 'https://openapi.tiktoday.vn/creator/v1/creators/example.creator/profile' \
  -H "Authorization: Bearer $TIKTODAY_API_KEY"
```

### 3.2. Hồ sơ affiliate của creator

`GET /creator/v1/creators/{username}/affiliate` · mã `creator.affiliate` · 1 quota · 55s

Hồ sơ affiliate TikTok Shop mới nhất. **Ưu tiên dữ liệu VN**: creator ngoài VN có thể trả rỗng hoặc `404 NOT_FOUND` và vẫn bị tính quota.

Tham số: `username` (path, string, bắt buộc), như mục 3.1.

Dữ liệu trả về (`data`, object):

| Trường | Kiểu | Mô tả |
| :--- | :---: | :--- |
| `handle` | string | Handle TikTok |
| `nickname` | string | Tên hiển thị |
| `oecuid` | string | Id affiliate TikTok Shop |
| `avatar_url` | string | Ảnh đại diện (có hạn dùng) |
| `region` | string | Mã quốc gia, ví dụ `VN` |
| `follower_count` | integer | Số người theo dõi |
| `categories` | array<string> | Ngành hàng creator bán |
| `level` | integer | Cấp creator trên TikTok Shop |
| `units_sold_range` | string | Khoảng số sản phẩm đã bán, ví dụ `1K-10K` |
| `gmv_range` | string | Khoảng doanh thu, ví dụ `1M₫+` |
| `gpm_range` | string | Khoảng doanh thu trên 1.000 lượt xem |
| `units_sold` | integer | Số sản phẩm đã bán |
| `gmv` | number | Doanh thu (₫). `null` khi creator không công khai, xem `gmv_range` |
| `video_gmv` | number | Doanh thu từ video (₫). `null` khi không công khai |
| `live_gmv` | number | Doanh thu từ live (₫). `null` khi không công khai |
| `gmv_share` | object | Tỉ trọng doanh thu theo kênh, 0 đến 1 (`video`, `live`) |
| `video_gpm_range` | string | Khoảng doanh thu trên 1.000 lượt xem video |
| `live_gpm_range` | string | Khoảng doanh thu trên 1.000 lượt xem live |
| `commission_rate_range` | string | Khoảng tỉ lệ hoa hồng, ví dụ `0%-5%`. `null` khi không công khai |
| `category_shares` | array<object> | Tỉ trọng doanh thu theo ngành hàng. Phần chưa phân loại có `name` là `null` |
| `agency` | string | Agency (MCN) quản lý creator |
| `fast_growing` | boolean | Creator đang tăng trưởng nhanh |
| `video_avg_views` | integer | Lượt xem trung bình mỗi video |
| `video_median_views` | integer | Lượt xem trung vị mỗi video |
| `stats_until` | integer | Số liệu bán hàng tính đến thời điểm này (unix time, giây) |
| `top_videos` | array<object> | Video bán hàng nổi bật |
| `bio` | string | Tiểu sử |
| `follower_genders` | array<object> | Tỉ lệ người theo dõi theo giới tính |
| `follower_ages` | array<object> | Tỉ lệ người theo dõi theo độ tuổi |
| `follower_regions` | array<object> | Số người theo dõi theo tỉnh/thành |

Ví dụ response rút gọn:

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "handle": "example.creator",
    "nickname": "Example Creator",
    "oecuid": "7494000000000000123",
    "region": "VN",
    "follower_count": 152300,
    "categories": ["Beauty & Personal Care"],
    "level": 3,
    "units_sold_range": "1K-10K",
    "gmv_range": "1M₫+",
    "units_sold": 25296,
    "gmv": 1253946213.49,
    "commission_rate_range": "0%-5%",
    "gmv_share": { "video": 0.0171, "live": 0.9829 },
    "agency": "Example Agency",
    "stats_until": 1794873600
  },
  "request_id": "0193a1b2-0000-7000-8000-000000000000"
}
```

### 3.3. Tìm creator affiliate trên TikTok Shop

`POST /creator/v1/creators/search` · mã `creator.search` · 1 quota · 55s

Tìm creator affiliate tại VN, tối đa 50 kết quả, không phân trang. Mọi trường trong body đều tuỳ chọn.

Body (JSON):

| Tên | Kiểu | Mô tả |
| :--- | :---: | :--- |
| `keyword` | string | Handle hoặc từ khoá, tối đa 200 ký tự |
| `count` | integer | Số creator. Mặc định 20, tối đa 50 |

```bash
curl -X POST 'https://openapi.tiktoday.vn/creator/v1/creators/search' \
  -H "Authorization: Bearer $TIKTODAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"beauty","count":20}'
```

Dữ liệu trả về: `data` là **mảng**, mỗi phần tử có các trường giống mục 3.2 (từ `handle` đến `top_videos`, trừ `bio`, `follower_genders`, `follower_regions`), cộng thêm:

| Trường | Kiểu | Mô tả |
| :--- | :---: | :--- |
| `tiktok_user_id` | string | Id tài khoản TikTok |
| `shop_video_avg_views` | integer | Lượt xem trung bình mỗi video có gắn sản phẩm |
| `live_avg_viewers` | integer | Người xem trung bình mỗi phiên live bán hàng |
| `follower_ages` | array<object> | Tỉ lệ người theo dõi theo độ tuổi |

Mã lỗi riêng: thêm `413 PAYLOAD_TOO_LARGE`.

### 3.4. Video mới nhất của creator

`GET /creator/v1/creators/{username}/videos` · mã `creator.videos` · 1 quota · 55s

Video mới nhất theo handle, video mới đăng xếp trước.

Tham số:

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
| :--- | :---: | :---: | :---: | :--- |
| `username` | path | string | Có | Handle TikTok |
| `limit` | query | integer | Không | Số video. Mặc định 20, tối đa 50 |
| `since` | query | integer | Không | Chỉ lấy video đăng từ thời điểm này trở đi (unix time, giây) |

Dữ liệu trả về: `data` là **mảng** các video:

| Trường | Kiểu | Mô tả |
| :--- | :---: | :--- |
| `id` | string | Id video |
| `description` | string | Mô tả video |
| `create_time` | integer | Thời điểm đăng (unix time, giây) |
| `language` | string | Mã ngôn ngữ, ví dụ `vi` |
| `is_ad` | boolean | Video quảng cáo |
| `hashtags` | array<string> | Hashtag, không có `#` |
| `author` | object | Người đăng |
| `author_stats` | object | Số liệu người đăng lúc lấy dữ liệu |
| `stats` | object | Số liệu tương tác lúc lấy dữ liệu |
| `video` | object | Thông tin file video |
| `music` | object | Nhạc nền |

---

## 4. Nhóm Product (`v1 · beta`)

### 4.1. Chi tiết mới nhất của sản phẩm

`GET /product/v1/products/{id}/details` · mã `product.details` · 1 quota · 55s

Tham số: `id` (path, string, bắt buộc): id sản phẩm TikTok Shop, chỉ gồm chữ số.

Dữ liệu trả về (`data`, object):

| Trường | Kiểu | Mô tả |
| :--- | :---: | :--- |
| `product_id` | string | Id sản phẩm |
| `title` | string | Tên sản phẩm |
| `image_urls` | array<string> | Ảnh sản phẩm (có hạn dùng) |
| `description` | array<string> | Các đoạn mô tả |
| `price` | object | Giá hiển thị trên trang sản phẩm. Giá từng SKU nằm trong `skus` |
| `sold_count` | integer | Tổng số đã bán |
| `rating` | number | Điểm đánh giá, 0 đến 5 |
| `review_count` | integer | Số đánh giá |
| `skus` | array<object> | Các phiên bản sản phẩm |
| `specifications` | array<object> | Thông số sản phẩm |
| `shipping` | object | Giao hàng tới Việt Nam |
| `shop` | object | Shop bán sản phẩm |
| `reviews` | array<object> | Một số đánh giá gần đây |

Ví dụ `price` và `shop` (từ response mẫu):

```json
{
  "price": {
    "currency": "VND",
    "sale_price_text": "14.799₫",
    "original_price_text": "18.000₫",
    "discount": "18%"
  },
  "shop": {
    "seller_id": "7494000000000000001",
    "name": "Shop A",
    "rating": 4.8,
    "follower_count": 9247
  }
}
```

### 4.2. Tìm sản phẩm trên TikTok Shop

`POST /product/v1/products/search` · mã `product.search` · 1 quota · 55s

Tìm sản phẩm tại VN theo từ khoá, tối đa 50 kết quả, không phân trang.

Body (JSON):

| Tên | Kiểu | Bắt buộc | Mô tả |
| :--- | :---: | :---: | :--- |
| `query` | string | Có | Từ khoá, tối đa 200 ký tự |
| `limit` | integer | Không | Số sản phẩm. Mặc định 20, tối đa 50 |

Dữ liệu trả về: `data` là **mảng**:

| Trường | Kiểu | Mô tả |
| :--- | :---: | :--- |
| `product_id` | string | Id sản phẩm |
| `title` | string | Tên sản phẩm |
| `image_url` | string | Ảnh chính (có hạn dùng) |
| `price` | object | Giá đang bán |
| `rating` | number | Điểm đánh giá, 0 đến 5 |
| `review_count` | integer | Số đánh giá |
| `sold_count` | integer | Số đã bán |
| `seller` | object | Shop bán |

Mã lỗi riêng: thêm `413 PAYLOAD_TOO_LARGE`.

### 4.3. Endpoint chưa mở

Gọi lúc này nhận `501 NOT_AVAILABLE` (không tính quota). Chưa có tài liệu về dữ liệu trả về.

| Endpoint | Đường dẫn | Tham số đã biết |
| :--- | :--- | :--- |
| Thông tin affiliate của sản phẩm (`product.affiliate`) | `GET /product/v1/products/{id}/affiliate` | `id` (path, bắt buộc) |
| Tìm sản phẩm affiliate (`product.affiliate_search`) | `POST /product/v1/products/affiliate/search` | Chưa rõ |

---

## 5. Nhóm Video (`v1 · beta`) và Health

### 5.1. Thông tin một video

`GET /video/v1/videos/{id}` · mã `video.details` · 1 quota · 30s

Thông tin và số liệu tương tác của một video theo id, ở **mọi quốc gia**, kèm người đăng. Video đã xoá hoặc riêng tư trả `404 NOT_FOUND`.

Tham số: `id` (path, string, bắt buộc): chỉ gồm chữ số, tối đa 20 ký tự (số cuối trong link video).

Dữ liệu trả về (`data`, object):

| Trường | Kiểu | Mô tả |
| :--- | :---: | :--- |
| `id` | string | Id video |
| `description` | string | Mô tả video |
| `location` | string | Mã quốc gia gắn với video, ví dụ `VN` |
| `is_ad` | boolean | Video quảng cáo |
| `is_ecommerce` | boolean | Video có gắn sản phẩm TikTok Shop |
| `music` | object | Nhạc nền |
| `stats` | object | Tương tác: `play_count`, `like_count`, `comment_count`, `share_count` |
| `author` | object | Người đăng: `id`, `handle`, `nickname` |
| `author_stats` | object | Số liệu người đăng: `follower_count`, `heart_count`, `video_count` |

### 5.2. Tìm video theo từ khoá

`POST /video/v1/videos/search` · mã `video.search` · 1 quota · 55s

Tìm video tại VN theo từ khoá, tối đa 50 kết quả, không phân trang.

Body (JSON):

| Tên | Kiểu | Bắt buộc | Mô tả |
| :--- | :---: | :---: | :--- |
| `query` | string | Có | Từ khoá, tối đa 200 ký tự |
| `limit` | integer | Không | Số video. Mặc định 20, tối đa 50 |

Dữ liệu trả về: `data` là **mảng** video, cùng cấu trúc với mục 3.4 (`id`, `description`, `create_time`, `language`, `is_ad`, `hashtags`, `author`, `author_stats`, `stats`, `video`, `music`).

Mã lỗi riêng: thêm `413 PAYLOAD_TOO_LARGE`.

### 5.3. Lấy link phát video (chưa mở)

`POST /video/v1/videos/play-url` · mã `video.play_url` · trả `501 NOT_AVAILABLE`.

Dự kiến nhận body `{"url": "<link video TikTok, kể cả link rút gọn, tối đa 500 ký tự>"}` và trả `data.play_url` (link có hạn dùng).

### 5.4. Kiểm tra key và kết nối

`GET /health/v1/check` · mã `health.check` · **0 quota** (vẫn chịu rate limit) · 2s · `v1 · stable`

Trả `data.status = "ok"` khi key hợp lệ. Key sai trả `401 UNAUTHENTICATED`. Dùng để kiểm tra kết nối khi khởi động backend, không tốn quota.

---

## 6. Mã lỗi và chính sách retry

Mọi lỗi có dạng `{"code", "message", "data": null, "request_id", "doc_url"}`.

| HTTP | Code | Tính quota | Nên retry | Xử lý |
| :---: | :--- | :---: | :---: | :--- |
| 400 | `INVALID_ARGUMENT` | Không | Không | Kiểm tra tham số/body theo `message` |
| 401 | `UNAUTHENTICATED` | Không | Không | Kiểm tra API key |
| 403 | `PERMISSION_DENIED` | Không | Không | Liên hệ hỗ trợ, gửi `request_id` |
| 403 | `SUBJECT_SUSPENDED` | Không | Không | Tài khoản đang tạm khoá, liên hệ hỗ trợ |
| 404 | `NOT_FOUND` | Chỉ khi không có dữ liệu bạn hỏi | Không | Sai đường dẫn không tính quota; không có dữ liệu hoặc ngoài VN thì có tính |
| 413 | `PAYLOAD_TOO_LARGE` | Không | Không | Chỉ ở các endpoint POST search |
| 429 | `RATE_LIMITED` | Không | Có | Chờ đủ số giây ở header `Retry-After` |
| 429 | `QUOTA_EXCEEDED` | Không | Không | Chờ kỳ mới hoặc mua thêm gói |
| 500 | `INTERNAL` | Không | Có | Lỗi hệ thống tạm thời |
| 501 | `NOT_AVAILABLE` | Không | Không | Endpoint chưa mở |
| 503 | `UNAVAILABLE` | Không | Có | Chờ `Retry-After` |
| 503 | `UPSTREAM_ERROR` | Không | Có | Lỗi từ hệ thống nguồn |
| 503 | `DEADLINE_EXCEEDED` | Không | Có | Quá thời gian xử lý |

---

## 7. Lưu ý khi dựng web

1. **Cần backend proxy.** API không có CORS và key không được lộ ra trình duyệt. Lưu key trong biến môi trường (`TIKTODAY_API_KEY`).
2. **Cache kết quả.** Gói Free chỉ có 100 lượt/ngày. Lưu response kèm thời điểm lấy (và `stats_until` với affiliate), chỉ gọi lại khi dữ liệu cũ.
3. **Giới hạn tốc độ phía client.** Tối đa 2 lượt/giây, 60 lượt/phút. Dùng hàng đợi, và với `429 RATE_LIMITED` chờ theo `Retry-After`.
4. **Chỉ retry** `429 RATE_LIMITED`, `500`, `503`. Không retry `400`, `401`, `403`, `404`, `413`, `501`, `QUOTA_EXCEEDED`.
5. **Tránh tốn quota vô ích.** `creator.affiliate` cho creator ngoài VN vẫn bị tính quota khi 404. Có thể gọi `creator.profile` hoặc `creator.search` trước để biết creator có thuộc VN không.
6. **Xử lý `null` và rỗng.** `gmv`, `video_gmv`, `live_gmv`, `commission_rate_range` có thể `null` (hiển thị `gmv_range`); `category_shares[].name` có thể `null` (nhãn "Chưa phân loại"); các mảng như `follower_genders` có thể rỗng.
7. **Không lưu link ảnh/video lâu dài.** `avatar_url`, `image_urls`, `play_url` hết hạn; lưu dữ liệu số và tải lại ảnh khi cần.
8. **Dữ liệu doanh thu là khoảng/ước tính** (`gmv_range`, `gpm_range`, `units_sold_range`). Hiển thị đúng bản chất, không trình bày như số chính xác.
9. **Dùng `health.check` khi khởi động** để kiểm tra key mà không tốn quota.

Điểm chưa rõ, cần kiểm tra khi gọi thử:

- Cấu trúc thật của `top_videos`, `follower_genders`, `follower_ages`, `follower_regions`, `recent_videos`, `stats`, `author`, `video`, `music`, `skus`, `shipping`, `reviews` (ví dụ trong docs để trống `{}`).
- `profile` trả `404` cho cả tài khoản riêng tư lẫn không tồn tại, chưa rõ có phân biệt được không.
- Mức quota/rate limit của các gói trả phí (xem trang "Bảng gói").
