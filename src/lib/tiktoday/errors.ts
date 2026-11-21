import type { ErrorCode } from "@/lib/result";

/** Lỗi từ TikToday (hoặc lỗi mạng/timeout phía mình, khi httpStatus = 0). */
export class TikTodayError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly apiCode: string,
    message: string,
    public readonly requestId?: string,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "TikTodayError";
  }
}

/** Ánh xạ lỗi TikToday sang mã lỗi của web (bảng trong Docs/api-layer.md). */
export function toErrorCode(e: TikTodayError): ErrorCode {
  if (e.httpStatus === 0) return e.apiCode === "TIMEOUT" ? "TIMEOUT" : "NETWORK";
  switch (e.httpStatus) {
    case 400:
    case 413:
      return "INVALID_INPUT";
    case 401:
      return "API_KEY_INVALID";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 429:
      return e.apiCode === "QUOTA_EXCEEDED" ? "QUOTA_PROVIDER" : "RATE_LIMITED";
    case 501:
      return "NOT_AVAILABLE";
    case 500:
    case 503:
      return "UPSTREAM";
    default:
      return "UNKNOWN";
  }
}

/** Chỉ thử lại với: 429 RATE_LIMITED, 500, 503 (theo bảng retry của TikToday). */
export function isRetryable(e: TikTodayError): boolean {
  if (e.httpStatus === 429) return e.apiCode === "RATE_LIMITED";
  return e.httpStatus === 500 || e.httpStatus === 503;
}
