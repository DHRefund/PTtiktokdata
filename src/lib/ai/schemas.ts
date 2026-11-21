import { z } from "zod";

// Dạng kết quả có cấu trúc của từng tính năng AI. Dùng được ở cả server (ép model trả đúng dạng) lẫn client (hiển thị).
// Schema cho structured outputs không dùng ràng buộc min/max, nên độ dài chỉ được hướng dẫn bằng mô tả.

const evidencePoint = z.object({
  point: z.string().describe("Nhận định ngắn gọn, một câu"),
  evidence: z.string().describe("Con số hoặc dữ kiện cụ thể trong dữ liệu làm căn cứ, ví dụ: 'trung vị 148,8 nghìn so với trung bình 512,6 nghìn'"),
});

export const creatorBriefSchema = z.object({
  headline: z.string().describe("Một câu tóm tắt creator này là ai và mạnh ở đâu"),
  verdict: z.enum(["recommend", "consider", "skip"]).describe("recommend: nên thử hợp tác; consider: cân nhắc kỹ; skip: không phù hợp"),
  verdict_reason: z.string().describe("Lý do cho kết luận, dẫn số liệu"),
  strengths: z.array(evidencePoint).describe("Điểm mạnh, tối đa 4"),
  risks: z.array(evidencePoint).describe("Rủi ro và điểm cần lưu ý, tối đa 4"),
  best_for: z.array(z.string()).describe("Loại sản phẩm hoặc ngành hàng hợp với creator này"),
  audience_fit: z.string().describe("Tệp người theo dõi (tuổi, giới tính, khu vực) hợp với khách hàng nào"),
  content_ideas: z.array(z.string()).describe("2 đến 4 ý tưởng nội dung dựa trên video và sản phẩm creator đã làm"),
  questions_to_ask: z.array(z.string()).describe("Câu hỏi nên hỏi creator hoặc MCN trước khi hợp tác"),
  data_gaps: z.array(z.string()).describe("Dữ liệu còn thiếu hoặc chỉ là khoảng, khiến kết luận kém chắc chắn"),
});
export type CreatorBrief = z.infer<typeof creatorBriefSchema>;

export const outreachSchema = z.object({
  short_message: z.string().describe("Tin nhắn ngắn gửi qua Zalo hoặc tin nhắn riêng TikTok, tối đa khoảng 600 ký tự"),
  email_subject: z.string(),
  email_body: z.string().describe("Nội dung email đầy đủ hơn, giọng lịch sự"),
  personalization_points: z.array(z.string()).describe("Những chi tiết cá nhân hoá đã dùng và lấy từ đâu trong dữ liệu"),
});
export type Outreach = z.infer<typeof outreachSchema>;

export const compareSchema = z.object({
  summary: z.string().describe("Kết luận tổng quát trong 2-3 câu"),
  creators: z.array(
    z.object({
      handle: z.string(),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      best_use: z.string().describe("Nên dùng creator này cho việc gì"),
    }),
  ),
  ranking: z.array(z.object({ handle: z.string(), reason: z.string() })).describe("Xếp hạng từ tốt nhất, kèm lý do dẫn số liệu"),
  recommendation: z.string().describe("Khuyến nghị cụ thể nên chọn ai và vì sao"),
  caveats: z.array(z.string()).describe("Điểm cần thận trọng: dữ liệu thiếu, chỉ là khoảng, chênh lệch thời điểm"),
});
export type Comparison = z.infer<typeof compareSchema>;

export const videoInsightsSchema = z.object({
  summary: z.string().describe("Nhận xét chung về nhóm video này"),
  patterns: z.array(evidencePoint).describe("Quy luật rút ra (độ dài, kiểu mở đầu qua mô tả, hashtag, tỷ lệ quảng cáo, tương tác), mỗi quy luật kèm bằng chứng"),
  hashtags: z.array(z.object({ tag: z.string(), note: z.string() })).describe("Hashtag đáng dùng và vì sao"),
  duration_advice: z.string().describe("Độ dài video nên dùng, dựa trên dữ liệu"),
  briefs: z.array(
    z.object({
      angle: z.string().describe("Góc tiếp cận nội dung"),
      outline: z.array(z.string()).describe("Các bước chính của video"),
      cta: z.string().describe("Lời kêu gọi hành động"),
    }),
  ).describe("2 đến 3 brief video gợi ý"),
  caveats: z.array(z.string()).describe("Giới hạn của kết luận, ví dụ mẫu nhỏ"),
});
export type VideoInsights = z.infer<typeof videoInsightsSchema>;

export type AiKind = "creator_brief" | "outreach" | "compare" | "video_insights";
