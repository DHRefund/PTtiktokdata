// Lỗi của tính năng AI và thông báo tiếng Việt cho từng loại. Không phụ thuộc server nên dùng được ở client.

export type AiErrorCode =
  | "NOT_CONFIGURED"
  | "BUDGET"
  | "NO_DATA"
  | "INVALID_INPUT"
  | "REFUSED"
  | "TRUNCATED"
  | "BAD_OUTPUT"
  | "RATE_LIMIT"
  | "AUTH"
  | "UPSTREAM"
  | "UNKNOWN";

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  NOT_CONFIGURED: "Chưa cấu hình khoá AI (GEMINI_API_KEY hoặc ANTHROPIC_API_KEY) trong .env.local nên chưa dùng được AI.",
  BUDGET: "Đã hết trần chi phí AI của hôm nay.",
  NO_DATA: "Chưa có dữ liệu đã lưu để phân tích. Hãy tải dữ liệu trước.",
  INVALID_INPUT: "Dữ liệu nhập vào không hợp lệ.",
  REFUSED: "AI từ chối xử lý yêu cầu này.",
  TRUNCATED: "Câu trả lời bị cắt giữa chừng, hãy thử lại.",
  BAD_OUTPUT: "AI trả về kết quả sai định dạng, hãy thử lại.",
  RATE_LIMIT: "Dịch vụ AI đang giới hạn tốc độ, hãy thử lại sau ít giây.",
  AUTH: "Khoá AI (GEMINI_API_KEY hoặc ANTHROPIC_API_KEY) không hợp lệ hoặc không có quyền.",
  UPSTREAM: "Dịch vụ AI đang tạm lỗi, hãy thử lại sau.",
  UNKNOWN: "Có lỗi không xác định khi gọi AI.",
};

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message?: string,
  ) {
    super(message ?? AI_ERROR_MESSAGES[code]);
    this.name = "AiError";
  }
}

export type AiMeta = { cached: boolean; model: string; createdAt: string; costUsd: number };

export type AiResult<T> =
  | { ok: true; data: T; meta: AiMeta }
  | { ok: false; error: { code: AiErrorCode; message: string } };

export function aiFail<T = never>(code: AiErrorCode, message?: string): AiResult<T> {
  return { ok: false, error: { code, message: message ?? AI_ERROR_MESSAGES[code] } };
}
