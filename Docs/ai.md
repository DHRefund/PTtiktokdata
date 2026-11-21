# Tính năng AI

Tài liệu về các tính năng dùng Claude (Anthropic) trong ứng dụng. Các tài liệu khác: [overview.md](overview.md), [tech-stack.md](tech-stack.md), [ui-design.md](ui-design.md).

## 1. Nguyên tắc

1. **AI chỉ đọc dữ liệu đã lưu trong cache, không bao giờ gọi TikToday.** Vì vậy AI không tốn hạn mức TikToday (100 lượt/ngày) và không thể làm cạn nó. Khi cần dữ liệu mới, AI chỉ *đề xuất* (xem `suggest_fetch`), người dùng tự bấm.
2. **Bám dữ liệu, dẫn căn cứ.** Câu lệnh hệ thống buộc AI chỉ dùng dữ liệu được đưa, dẫn đúng con số, gọi đúng là "khoảng" khi dữ liệu là khoảng, và ghi "không có dữ liệu" thay vì đoán. Kết quả có cấu trúc luôn có trường `evidence` hoặc `data_gaps`.
3. **Nội dung từ TikTok là dữ liệu, không phải mệnh lệnh.** Tiểu sử, mô tả video, tên sản phẩm do người khác viết có thể chứa câu giả làm chỉ thị (prompt injection). Câu lệnh hệ thống dặn bỏ qua, các công cụ chỉ đọc, và đề xuất lấy dữ liệu do app tự dựng đường dẫn từ giá trị đã kiểm tra.
4. **Có trần chi phí.** Mỗi lượt gọi model được ghi vào bảng `ai_usage` kèm chi phí ước tính. Trước mỗi lượt, app kiểm tra tổng chi phí hôm nay (giờ Việt Nam) so với `AI_DAILY_BUDGET_USD` (mặc định 1 USD). Hết trần thì dừng tới 00:00 hôm sau.
5. **Không tốn tiền hai lần cho cùng dữ liệu.** Kết quả có cấu trúc lưu ở `ai_results` theo mã băm của dữ liệu đầu vào cộng tuỳ chọn cộng `PROMPT_VERSION`. Bấm lại khi dữ liệu không đổi thì dùng bản đã lưu (miễn phí). Dữ liệu đổi (ví dụ làm mới số liệu) thì tạo bản mới.

## 2. Các tính năng

| Tính năng | Ở đâu | Model mặc định | Nguồn dữ liệu |
| :--- | :--- | :--- | :--- |
| **Phân tích creator**: kết luận (nên thử, cân nhắc, không phù hợp), điểm mạnh và rủi ro kèm căn cứ, hợp sản phẩm nào, tệp người theo dõi, ý tưởng nội dung, câu hỏi nên hỏi, dữ liệu còn thiếu | Hồ sơ creator | `claude-haiku-5-5` | Hồ sơ, số liệu bán hàng (hoặc dòng của creator đó trong kết quả tìm), video đã lưu |
| **Soạn tin nhắn mời hợp tác**: tin ngắn (Zalo, DM) và email, cá nhân hoá theo video và sản phẩm creator từng làm | Hồ sơ creator | `claude-haiku-5-5` | Như trên, cộng mô tả sản phẩm của người dùng |
| **So sánh 2-3 creator**: tóm tắt, điểm mạnh yếu, xếp hạng, khuyến nghị | `/compare`, tick chọn ở bảng creator | `claude-sonnet-5-5` | Như trên cho từng creator |
| **Rút quy luật nội dung từ video**: quy luật kèm bằng chứng, hashtag, độ dài, brief video | Trang Video | `claude-sonnet-5-5` | Đúng nhóm video đang hiển thị (đọc lại từ cache theo từ khoá, không nhận dữ liệu từ trình duyệt) |
| **Hỏi AI**: hỏi đáp tiếng Việt, tra cứu bằng công cụ, trả lời streaming | `/ask` | `claude-sonnet-5-5` | Toàn bộ cache: mọi creator, sản phẩm, video đã lưu |

### Sản phẩm hot (tìm web)

Trang `/hot`. Khác các tính năng trên: **không đọc dữ liệu đã lưu**, mà dùng Google Search grounding của Gemini (`src/lib/ai/web.ts`) để tìm web rồi trả văn bản markdown kèm nguồn. Cần `GEMINI_API_KEY` (kể cả khi `AI_PROVIDER=anthropic`). Không dùng chung được với công cụ tra cứu của "Hỏi AI" trong một lượt và không kết hợp với đầu ra JSON (Gemini 2.5), nên là một lời gọi riêng. Không lưu cache (kết quả web đổi theo ngày). Prompt đưa ngày hiện tại (giờ Việt Nam) vào để model không tìm theo năm cũ. Số liệu chỉ tham khảo: số đơn bán thật phải kiểm tra ở trang Sản phẩm. Từ khoá người dùng nhập được gửi tới Google. Gói miễn phí giới hạn số lượt tìm Google mỗi ngày.

### Công cụ của "Hỏi AI"

Tất cả chỉ đọc. Đầu vào do model sinh nên luôn được kiểm tra lại bằng Zod trước khi chạy.

| Công cụ | Việc làm |
| :--- | :--- |
| `search_creators` | Lọc và xếp creator đã lưu (từ khoá, ngành, tối thiểu người theo dõi, tối thiểu đơn bán) |
| `get_creator` | Toàn bộ dữ liệu đã lưu về một creator |
| `search_products`, `get_product_details` | Sản phẩm đã lưu, và chi tiết nếu đã tải |
| `search_videos` | Video đã lưu (chữ trong mô tả, tác giả, hashtag, có gắn sản phẩm, xếp theo lượt xem, tim hoặc tỷ lệ tương tác) |
| `list_saved_searches` | Các lần tìm gần đây, để biết dữ liệu bao phủ gì |
| `suggest_fetch` | **Không lấy dữ liệu.** Hiện nút trên giao diện để người dùng tự mở trang tương ứng (mỗi lần tốn 1 lượt) |

Vòng lặp tối đa 8 bước mỗi câu hỏi. Lịch sử hội thoại do trình duyệt giữ, gửi lên mỗi lần dưới dạng chữ thuần (tối đa 20 tin).

## 3. Cấu hình

**Hai nhà cung cấp.** `AI_PROVIDER=gemini` hoặc `anthropic`. Bỏ trống thì có `GEMINI_API_KEY` mà chưa có `ANTHROPIC_API_KEY` sẽ dùng Gemini, còn lại dùng Claude. Gemini có gói miễn phí (giới hạn lượt/ngày, và Google có thể dùng dữ liệu gửi lên gói miễn phí để cải thiện sản phẩm, nên chỉ dùng thử nghiệm). Lấy khoá Gemini tại https://aistudio.google.com/apikey. Mã nằm ở `src/lib/ai/gemini.ts`, dùng chung sổ chi phí, bộ nhớ đệm kết quả và công cụ với nhánh Claude. Bảng dưới nói về Claude; với Gemini, model mặc định là `gemini-2.5-flash` cho cả hai vai (đổi bằng `AI_MODEL_FAST/SMART`), chi phí ghi 0.

Thêm vào `.env.local` (xem `.env.example`):

| Biến | Ý nghĩa |
| :--- | :--- |
| `ANTHROPIC_API_KEY` | Bắt buộc để dùng AI. Tạo ở console.anthropic.com. Không đặt tiền tố `NEXT_PUBLIC_`. Khởi động lại server sau khi thêm |
| `AI_MODEL_FAST` | Tuỳ chọn. Mặc định `claude-haiku-5-5` |
| `AI_MODEL_SMART` | Tuỳ chọn. Mặc định `claude-sonnet-5-5`. Đổi sang `claude-opus-5-5` nếu muốn chất lượng cao hơn (đắt hơn) |
| `AI_DAILY_BUDGET_USD` | Trần chi phí mỗi ngày, mặc định 1 |

Bảng giá dùng để ước tính chi phí nằm ở `src/lib/ai/pricing.ts` (cập nhật 03/11/2026). Model chưa có trong bảng sẽ ghi chi phí 0, nên khi đổi sang model khác hãy thêm giá vào đó.

## 4. Dữ liệu và quyền riêng tư

- Dữ liệu creator, sản phẩm, video (đã rút gọn: bỏ link ảnh có chữ ký, cắt văn bản dài) được gửi tới API của Anthropic để phân tích. Đây là dữ liệu công khai trên TikTok nhưng vẫn là dữ liệu bạn lấy qua TikToday: hãy kiểm tra điều khoản của TikToday về việc xử lý và chia sẻ dữ liệu.
- Mô tả sản phẩm bạn gõ vào ô "Sản phẩm hoặc thương hiệu của bạn" cũng được gửi đi.
- Khoá API chỉ nằm ở server, không bao giờ gửi xuống trình duyệt.

## 5. Cấu trúc mã

```
src/lib/ai/
  config.ts       # đọc biến môi trường
  client.ts       # client Anthropic dùng chung (server-only)
  pricing.ts      # ước tính chi phí
  ledger.ts       # sổ chi phí ai_usage, trần mỗi ngày
  prompts.ts      # câu lệnh hệ thống (tiếng Việt), PROMPT_VERSION
  schemas.ts      # Zod: dạng kết quả có cấu trúc của từng tính năng
  shape.ts        # rút gọn dữ liệu trước khi gửi, mã băm đầu vào
  dossier.ts      # gom dữ liệu một creator, kết quả tìm video, từ cache
  run.ts          # runStructured: gọi model, ép đúng schema, ghi sổ, ánh xạ lỗi
  results.ts      # kho kết quả ai_results
  ask-queries.ts  # truy vấn thuần cho "Hỏi AI" (có test)
  tools.ts        # định nghĩa và chạy công cụ
  ask-data.ts     # nguồn dữ liệu thật của công cụ (đọc api_cache)
  chat.ts         # vòng lặp hội thoại, nhận mọi phụ thuộc qua tham số (có test với model giả)
src/actions/ai.ts           # Server Actions: phân tích, soạn tin, so sánh, phân tích video
src/app/api/ask/route.ts    # hỏi đáp streaming (NDJSON)
supabase/migrations/0002_ai.sql
```

## 6. Giới hạn và việc còn mở

- **Chưa kiểm chứng với model thật** khi viết (chưa có `ANTHROPIC_API_KEY`). Đã kiểm thử bằng model giả (vòng lặp công cụ, từ chối, cắt giữa chừng, hết trần chi phí, đề xuất lấy dữ liệu) và gọi thật tới Anthropic bằng khoá giả để kiểm tra đường lỗi. Chất lượng câu trả lời, độ dài và chi phí thực tế cần xem khi chạy lần đầu, và có thể phải chỉnh `prompts.ts` (nhớ tăng `PROMPT_VERSION`).
- **Chưa bật `fallbacks` phía server** (chuyển sang model khác khi bị từ chối). Hiện nếu model từ chối, giao diện báo "AI từ chối xử lý yêu cầu này". Với dữ liệu thương mại công khai, từ chối hiếm gặp.
- Hỏi AI chỉ nhớ hội thoại trong tab đang mở (không lưu lịch sử chat vào database).
- Chưa có báo cáo ngách tự động và theo dõi theo thời gian (đề xuất giai đoạn 3).
- Chi phí chỉ là ước tính từ số token và bảng giá. Hoá đơn thật nằm ở Anthropic Console.
