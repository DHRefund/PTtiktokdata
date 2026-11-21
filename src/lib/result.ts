// Kiểu kết quả dùng chung giữa Server Actions và giao diện. Không import gì của server, dùng được ở client.

export type ErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "QUOTA_DAY"
  | "QUOTA_CYCLE"
  | "QUOTA_PROVIDER" // TikToday báo QUOTA_EXCEEDED
  | "API_KEY_INVALID"
  | "FORBIDDEN"
  | "UPSTREAM"
  | "TIMEOUT"
  | "NETWORK"
  | "NOT_AVAILABLE"
  | "NOT_CACHED" // chỉ đọc cache mà chưa có
  | "UNKNOWN";

export type Meta = {
  source: "cache" | "api";
  fetchedAt: string; // ISO
  expiresAt: string; // ISO
  stale: boolean; // đã quá hạn nhưng vẫn hiển thị
  requestId?: string;
  warning?: string;
  quota?: { usedToday: number; usedCycle: number };
};

export type ActionError = {
  code: ErrorCode;
  message: string; // tiếng Việt, hiển thị được ngay
  retryAfterMs?: number;
  requestId?: string;
};

export type ActionResult<T> =
  | { ok: true; data: T; meta: Meta }
  | { ok: false; error: ActionError; meta?: Meta; staleData?: { data: T; meta: Meta } };

/** Kết quả gọn cho các nút bấm (tải thêm, làm mới): trang tự đọc lại dữ liệu từ cache. */
export type Ack = { ok: true } | { ok: false; message: string };

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "Bạn chưa đăng nhập hoặc phiên đã hết hạn.",
  INVALID_INPUT: "Dữ liệu nhập vào không hợp lệ.",
  NOT_FOUND: "Không có dữ liệu (tài khoản riêng tư, ngoài phạm vi VN, hoặc không tồn tại).",
  RATE_LIMITED: "Đang gọi quá nhanh, hãy thử lại sau ít giây.",
  QUOTA_DAY: "Đã hết hạn mức hôm nay.",
  QUOTA_CYCLE: "Đã hết hạn mức của chu kỳ 30 ngày.",
  QUOTA_PROVIDER: "TikToday báo đã hết hạn mức.",
  API_KEY_INVALID: "API key TikToday không hợp lệ. Kiểm tra TIKTODAY_API_KEY.",
  FORBIDDEN: "TikToday từ chối truy cập. Liên hệ hỗ trợ TikToday kèm request_id.",
  UPSTREAM: "Dịch vụ TikToday đang tạm lỗi, hãy thử lại sau.",
  TIMEOUT: "Quá thời gian chờ phản hồi, hãy thử lại.",
  NETWORK: "Không kết nối được tới TikToday, hãy thử lại.",
  NOT_AVAILABLE: "Endpoint này TikToday chưa mở.",
  NOT_CACHED: "Chưa có dữ liệu đã lưu.",
  UNKNOWN: "Có lỗi không xác định.",
};

export function fail<T = never>(code: ErrorCode, extra: Partial<ActionError> = {}): ActionResult<T> {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code], ...extra } };
}
