import "server-only";
import { TikTodayError } from "./errors";
import type { AnyEndpoint } from "./endpoints";

export type RawResult = {
  httpStatus: number;
  code: string; // "OK", ...
  data: unknown; // trường `data` của response
  requestId?: string;
};

export type ClientConfig = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_BASE_URL = "https://openapi.tiktoday.vn";
const TIMEOUT_MARGIN_MS = 5_000;

function parseRetryAfter(h: string | null): number | undefined {
  if (!h) return undefined;
  const n = Number(h);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Gọi HTTP thô tới TikToday. Không biết gì về cache hay quota.
 * Mọi phản hồi lỗi được chuyển thành TikTodayError. Không bao giờ log API key.
 */
export async function callApi(
  spec: AnyEndpoint,
  input: unknown,
  config: ClientConfig = { apiKey: process.env.TIKTODAY_API_KEY ?? "" },
): Promise<RawResult> {
  if (!config.apiKey) {
    throw new TikTodayError(401, "UNAUTHENTICATED", "Chưa cấu hình TIKTODAY_API_KEY");
  }

  const { path, query, body } = spec.request(input);
  const url = new URL((config.baseUrl ?? DEFAULT_BASE_URL) + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), spec.timeoutMs + TIMEOUT_MARGIN_MS);

  let res: Response;
  try {
    res = await (config.fetchImpl ?? fetch)(url, {
      method: spec.method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new TikTodayError(
      0,
      aborted ? "TIMEOUT" : "NETWORK",
      aborted ? "Quá thời gian chờ phản hồi" : "Không kết nối được tới TikToday",
    );
  } finally {
    clearTimeout(timer);
  }

  let json: { code?: string; message?: string; data?: unknown; request_id?: string } | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new TikTodayError(
      res.status,
      json?.code ?? "UNKNOWN",
      json?.message ?? `HTTP ${res.status}`,
      json?.request_id,
      parseRetryAfter(res.headers.get("Retry-After")),
    );
  }

  return {
    httpStatus: res.status,
    code: json?.code ?? "OK",
    data: json?.data ?? null,
    requestId: json?.request_id,
  };
}
