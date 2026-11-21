# Bàn giao Codex ↔ Claude Code: dữ liệu Kalodata theo yêu cầu

Cập nhật 21/11/2026. Đọc file này trước khi tiếp tục phần collector. Đây là trạng thái thực hiện, ưu tiên hơn lộ trình worker tự động trước đó.

## Cập nhật ảnh sản phẩm — Codex 21/11/2026

Đã đọc lại DOM của cả hai nguồn để lấy ảnh gắn với tên/thứ tự sản phẩm. Kalodata dùng CSS background `https://img.kalocdn.com/tiktok.product/.../cover.png`; FastMoss dùng img trong link chi tiết, host `s.500fd.com`. Không lấy nhầm ảnh video hoặc shop. Không suy productId TikTok từ đường dẫn ảnh; các productId đã biết giữ nguyên.

- Hai file latest nâng `schemaVersion=2`, mỗi dòng thêm `imageUrl`. Schema chấp nhận v1 (thiếu ảnh → null) và v2, chỉ nhận HTTPS đúng host nguồn. Hash v1 giữ cách tính không có imageUrl để tránh nhập lại batch cũ do default null.
- Migration `0005_market_images.sql` đã chạy, thêm `market_batch_rows.image_url` nullable. Reader/import Kalodata đã nối cột mới. FastMoss giữ ảnh trong JSON payload nên không đổi cấu trúc bảng.
- Đã import batch mới bất biến có ảnh: Kalodata `6da96848-d4fa-4f5f-8bf6-0e84d266b9da`; FastMoss `93dad62c-5a91-4321-8222-c97bf6229b59`. Không sửa batch cũ. Đây là bổ sung ảnh cùng kỳ/ngày, không phải quan sát tăng trưởng mới.
- Component chung `src/components/product-thumbnail.tsx` hiển thị ảnh 64px, lazy, no-referrer, alt tên sản phẩm và fallback khi lỗi. Hai bảng trên `/hot` đã dùng component. Dùng img trực tiếp, không tạo proxy tải URL ở server, không tải ảnh về Storage.
- Đã kiểm tra HEAD không có Referer cho cả 20 URL: tất cả HTTP 200 và Content-Type image/png, image/webp hoặc image/jpeg. 10 ảnh FastMoss cũng báo loaded trong trang nguồn. Chưa xác nhận render ảnh trên trang web local; URL vẫn có thể hết hạn/chặn về sau, UI có fallback.
- Không gọi Gemini/TikToday, không tiêu lượt chi tiết hoặc export. Lần sau cần lấy lại URL thực từ DOM, không dựng URL theo ID suy đoán.

Typecheck đã qua; lint phần ảnh không có lỗi, cảnh báo biến tạm ở schema đã được sửa và kiểm tra lại. Dry-run hai batch và diff check đã qua. Production cần deploy code/schema reader mới lần đầu để hiện ảnh. Các đoạn v1 không ảnh bên dưới là lịch sử.

## Cập nhật Codex: FastMoss đã tích hợp (21/11/2026)

Mục này thay thế trạng thái “chưa tích hợp FastMoss” bên dưới. Dùng mẫu DOM thật đã khảo sát cùng ngày, không lấy lại dữ liệu nguồn hoặc gọi Gemini/TikToday trong lượt tích hợp.

- File `src/data/fastmoss-latest.json`: 10 sản phẩm VN, VND, daily 20/11/2026; ghi rõ thu thập 21/11. Giữ chuỗi giá/khoảng giá, GMV, sold, growth, tổng sold/GMV, commission nullable, shop/category và ID nguồn. Không trộn với kỳ Kalodata 30 ngày.
- Schema riêng `src/lib/fastmoss/schema.ts` version 1, strict; không sửa schema Kalodata. `sourceProductId` là ID trong URL FastMoss, chưa phải productId TikTok được xác minh. `needsReview` là cờ duyệt thủ công theo tên thư cảm ơn/đóng gói, không phải kết luận sai phạm; false cũng không chứng nhận chất lượng sản phẩm.
- Migration `0004_fastmoss_batches.sql` đã chạy: bảng `fastmoss_batches` lưu nguyên payload hợp lệ, hash chống trùng, collected_on/imported_at, RLS bật, không có policy cho client. Chọn bảng riêng vì schema market_batch_rows hiện yêu cầu rating/average_price/creators không có ở FastMoss; tránh điền dữ liệu giả hoặc đổi contract Claude đang dùng.
- Import: `node --experimental-strip-types scripts/import-fastmoss.mjs [file.json] [--dry-run]`. Mặc định file latest, parse Zod trước khi ghi, một insert atomic với hash duy nhất. Đã dry-run và nhập thật batch `a8849993-becf-46f9-b7f0-6f57e425fa4e` (10 dòng); không tạo lại batch nếu cùng nội dung.
- Reader `src/lib/fastmoss/store.ts` lấy mới nhất theo ngày thu thập rồi imported_at; fallback file khi DB lỗi/trống/payload sai. UI báo Database hoặc File dự phòng.
- `src/components/fastmoss-products.tsx` đã gắn vào `/hot` sau Kalodata và trước Gemini. Link chi tiết dẫn FastMoss, chưa dẫn TikToday. Không xếp điểm, không gộp sản phẩm trùng tên hai nguồn. Sáu dòng đóng gói/thư cảm ơn được gắn cần duyệt; giữ nguyên dữ liệu nguồn để kiểm tra.
- Không triển khai production; nếu app chưa deploy code mới cần deploy lần đầu để có component/reader này. Sau đó batch cập nhật trong cùng schema có thể import DB mà không build lại.

Quy trình cập nhật FastMoss: đọc lại bảng với market/kỳ/tiền tệ rõ ràng → cập nhật JSON giữ nguyên số nguồn → dry-run → import → báo cáo hash/batch ID và kiểm tra. Schema thay đổi phải có version và kế hoạch tương thích payload cũ. Không nhập qua script Kalodata.

Kiểm tra: dry-run, import thật, typecheck, ESLint phần FastMoss/route và diff check đã thành công. Chạy import lần hai xác nhận bỏ qua batch trùng. Chưa kiểm chứng UI local hoặc production build.

## Sửa tiền tệ sau bàn giao

Đã đọc lại bảng Kalodata khi nguồn hiển thị VND (Revenue (₫), Avg. Unit Price (₫)), cùng 10 sản phẩm và kỳ 22/10–20/11/2026. Cập nhật `currency=VND`, toàn bộ `revenue` và `averagePrice` trong latest bằng chuỗi nguồn mới, không quy đổi từ số JPY đã làm tròn. Ví dụ hạng 1 là `₫83.87b`, giá trung bình `₫509.16k`; hạng 10 là `₫13.85b`, giá trung bình `₫3.48m`. `b` là tỷ, `m` triệu, `k` nghìn; vẫn là số hiển thị làm tròn. Các chỉ số phi tiền tệ khớp bản trước. UI đọc nhãn tiền tệ từ snapshot thay vì hardcode JPY.

Bản JPY cũ được lưu ở `Docs/collector/experiments/archive/kalodata-2026-11-21-jpy.json`. Các biên bản/mẫu Gemini JPY trước đó là lịch sử thử nghiệm, không sửa thành VND và không dùng làm nguồn current. Không gọi API hoặc DB trong lần sửa này. Nội dung bên dưới mô tả lần tích hợp ban đầu; tiền tệ current theo mục cập nhật này.

## Quyết định mới của người dùng

Khảo sát nguồn tiếp theo: đã đọc 10 dòng FastMoss VN ở chế độ Visitor, kỳ Daily 20/11/2026, tiền VND. Xem [biên bản FastMoss](experiments/2026-11-21-fastmoss.md). Chưa tích hợp UI/DB, chưa gọi API, chưa xác minh full access; nhiều listing mang tên thư cảm ơn nên cần duyệt chất lượng. Không trộn số liệu một ngày với batch Kalodata 30 ngày.

Tạm dừng phát triển crawler tự chạy. Người dùng sẽ yêu cầu Codex thu thập trực tiếp bằng trình duyệt khi cần, sau đó cung cấp dữ liệu cho web. Claude Code phát triển web có thể dùng hợp đồng file dưới đây. Không có scheduler hoặc tiến trình thu thập nền đang được thiết lập.

## Đã làm trong lượt bàn giao

- Mở trang Product Kalodata bằng trình duyệt Codex, dùng phiên đăng nhập hiện có.
- Đọc lại 10 dòng đầu bằng DOM từng ô, thị trường VN, kỳ 22/10–20/11/2026, tiền JPY. Dữ liệu trùng mẫu đã thấy trước đó.
- Chuyển có kiểm tra các cột cần cho UI vào `src/data/kalodata-latest.json`. Đây là batch đọc thật nhưng bước ghi file là chép có kiểm tra từ kết quả công cụ, chưa tự động truyền DOM sang repo.
- Tạo `src/components/kalodata-products.tsx`, import snapshot tĩnh và hiển thị bảng có nguồn, kỳ, ngày thu thập, tiền tệ và giới hạn dữ liệu.
- Gắn component vào `src/app/(app)/hot/page.tsx`, phía trên phần Gemini Search hiện có. Route vẫn có requireUser. Không sửa trang chủ dashboard.
- Chỉ sản phẩm Ensure có `productId` xác minh từ trang chi tiết và link TikTok ở lần thử trước: `1737844036294575550`. Tạo link `/products/{id}` cho dòng đó, `prefetch=false`. Mở trang chi tiết sẽ theo logic cache/quota TikToday hiện có; render bảng không gọi TikToday.
- Không gọi lại Gemini, không gọi TikToday, không ghi Supabase, không mua gói, không đổi tài khoản trong lượt này.

## Hợp đồng file cho agent làm web

File: `src/data/kalodata-latest.json`, schemaVersion 1. Batch có source/sourceUrl, collectedOn (ngày thu thập; không giả lập timestamp chính xác), collectionMethod, market, currency, periodStart/End, sortVerified, precision và rows.

Mỗi row: rank, name, revenue, sold, growth, rating, averagePrice, commission nullable, creators, productId nullable. Các metric giữ chuỗi nguồn: `k`, `m`, `円`, `%`, `>`; không tự coi là số chính xác. Commission thiếu là null. Product ID luôn string để tránh mất chính xác số lớn. Chưa có ảnh, chuỗi biểu đồ, shop hay chi tiết của cả 10 sản phẩm trong file này.

Rank là thứ tự nguồn, không phải định danh bền vững. Không ghép lịch sử theo rank/tên. Không suy ID từ dãy số trong tên. Một productId có chứng cứ từ lượt thử trước, không có nghĩa 9 ID khác được suy ra.

Snapshot được import vào bundle server và build. Dev có thể cập nhật khi thay file; production cần build/deploy lại để cập nhật. Chưa có endpoint upload/import và chưa đồng bộ DB. Không hứa cập nhật production bằng việc ghi file local. Khi chuyển DB, giữ provenance và dùng migration riêng được review; không âm thầm ghi vào api_cache như response TikToday.

## Quy trình cập nhật lần sau

1. Người dùng yêu cầu thu thập; kiểm tra phiên và phạm vi nguồn được mở.
2. Ghi market, kỳ, tiền tệ, bộ lọc và thứ tự nguồn thực tế; không dùng dữ liệu cũ giả làm dữ liệu mới.
3. Đọc từng ô, kiểm tra đủ tối đa 10 dòng và không có placeholder khóa. Nếu lỗi giữ bản tốt hiện tại.
4. Lưu bản batch cũ khi bắt đầu cần lịch sử, rồi cập nhật latest cùng schemaVersion. Không ghi secret/cookie vào dữ liệu.
5. Kiểm tra JSON, typecheck/lint phần đổi, ghi kết quả và gaps vào báo cáo mới, build/deploy theo môi trường web.

## Những giới hạn đã xác minh

Trial đọc được 10 sản phẩm trang đầu. Trang 2 yêu cầu Professional; export Excel yêu cầu nâng gói. Chi tiết có hạn 10 lượt/ngày theo thông báo, một số mục chuyên sâu vẫn khóa. Chưa xác minh quy tắc reset, thời gian phiên và độ chính xác doanh số nguồn. Bảng có revenue giảm dần nhưng chưa xác nhận control sort nên `sortVerified=false`. Không gọi đây là top 10 tốt nhất/toàn thị trường hoặc khuyến nghị lợi nhuận.

## Crawler cũ và dependency

`collector/kalodata.mjs` là POC trước quyết định mới; đã cài Playwright vào devDependencies và lockfile. Google đã từ chối đăng nhập trong cửa sổ tự động; chưa có lần chạy crawler lấy dữ liệu thành công. Lượt chờ đã dừng. Giữ mã làm tham khảo, không nối vào web hoặc lên lịch. `.collector/` được gitignore vì profile có thể chứa thông tin phiên. Không chuyển cookie từ Codex sang worker.

Script `scripts/test-kalodata-normalize.mjs` là thử Gemini riêng, gọi thật và ghi đè mẫu; không chạy mặc định và không đi qua ledger của app. Không dùng để cập nhật batch 10 sản phẩm hiện tại.

## Phối hợp hai agent

Codex ngoài web phụ trách lấy dữ liệu theo yêu cầu và ghi batch/provenance; Claude Code có thể phát triển UI, reader/DB và enrichment từ hợp đồng này. Kiểm tra git status trước sửa vì cùng workspace, không reset/revert thay đổi agent khác. Mọi thay đổi schema cần tăng version và cập nhật báo cáo. Chưa gửi message trực tiếp cho Claude Code; file này là kênh bàn giao để người dùng/agent kia đọc.

## Kiểm tra

`npm run typecheck` thành công; ESLint trên component mới và route `/hot` thành công; `git diff --check` thành công trước thay đổi văn bản subtitle cuối cùng. Chưa chạy production build hoặc xác nhận UI bằng phiên đăng nhập local của web; không đồng nhất typecheck với kiểm tra hiển thị thực tế.

## Cập nhật từ Claude Code: batch đã vào database (21/11/2026)

Các đoạn trên nói "chưa đồng bộ DB, chưa có import" là trạng thái lúc bàn giao; phần dưới thay thế chúng.

- Migration `supabase/migrations/0003_market_batches.sql` (đã chạy): bảng `market_batches` (một dòng mỗi lần thu thập, bất biến, có nguồn, kỳ, tiền tệ, `collected_on`, `payload_hash`) và `market_batch_rows` (các dòng, giữ nguyên chuỗi của nguồn, `product_id` là text). Không dùng `api_cache`. RLS bật, chỉ server đọc/ghi.
- Hợp đồng được kiểm bằng zod tại `src/lib/kalodata/schema.ts`: từ chối giá trị còn `****`, rank hoặc productId trùng, productId không phải chuỗi số, kỳ ngược, ngày sai dạng, commission rỗng (phải là null).
- Nhập batch: `node --experimental-strip-types scripts/import-kalodata.mjs [file.json] [--dry-run]`. Mặc định đọc `src/data/kalodata-latest.json`. Kiểm tra hợp lệ trước, nhập trong một transaction, nhập lại cùng nội dung thì bỏ qua (khoá theo `payload_hash`). Mỗi batch mới là một dòng mới nên lịch sử tự được giữ.
- Web (`/hot`) đọc batch mới nhất trong DB (`src/lib/kalodata/store.ts`, sắp theo `collected_on` rồi thời điểm nhập). DB trống hoặc lỗi thì dùng file `kalodata-latest.json` đi kèm bản build, và giao diện ghi rõ đang dùng nguồn nào. Cập nhật production không cần build lại: chỉ cần nhập batch mới.
- Batch đã nhập: `c03e0081-…`, 10 dòng, VN, tiền VND, kỳ 22/10 đến 20/11/2026, thu thập 21/11/2026.

Quy trình cho Codex lần sau: thu thập, ghi `src/data/kalodata-latest.json` theo hợp đồng schemaVersion 1, chạy `--dry-run` để kiểm tra, rồi báo người dùng (hoặc Claude Code) chạy nhập thật. Mọi thay đổi trường phải tăng `schemaVersion` và cập nhật `schema.ts` cùng migration.

Chưa làm: tính tăng trưởng giữa các batch (cần ít nhất hai lần thu thập cùng bộ lọc), cột số đã chuyển từ chuỗi `k/m/b` sang số, ghép các dòng chưa có `productId` với TikToday.
