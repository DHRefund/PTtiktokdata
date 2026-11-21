import type { CacheRow, CacheStore } from "@/lib/cache/store";
import type { QuotaStore, ReserveResult } from "@/lib/cache/quota";
import { fail, ERROR_MESSAGES, type ActionResult, type ErrorCode, type Meta } from "@/lib/result";
import type { RawResult } from "./client";
import type { AnyEndpoint } from "./endpoints";
import { isRetryable, TikTodayError, toErrorCode } from "./errors";

const MAX_ATTEMPTS = 3;
/** Chờ tối đa bấy nhiêu mili giây cho rate limit hoặc Retry-After, lâu hơn thì trả lỗi cho người dùng. */
const MAX_AUTO_WAIT_MS = 10_000;
const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const PARSER_VERSION = 1;

export type LogEntry = {
  endpoint: string;
  cacheKey: string | null;
  source: "cache" | "api" | "none";
  httpStatus?: number;
  code?: string;
  requestId?: string;
  durationMs?: number;
  note?: string;
};

export interface Deps {
  cache: CacheStore;
  quota: QuotaStore;
  call: (spec: AnyEndpoint, input: unknown) => Promise<RawResult>;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  log: (e: LogEntry) => void;
}

export type FetchOpts = {
  userId: string | null;
  forceRefresh?: boolean;
  /** Chỉ đọc cache (kể cả bản đã quá hạn), không bao giờ gọi API, không tốn quota. */
  cacheOnly?: boolean;
};

function metaFromRow(row: CacheRow, nowMs: number, extra: Partial<Meta> = {}): Meta {
  return {
    source: "cache",
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
    stale: new Date(row.expires_at).getTime() <= nowMs,
    requestId: row.request_id ?? undefined,
    ...extra,
  };
}

function sliceData(data: unknown, count: number | undefined): unknown {
  return count !== undefined && Array.isArray(data) ? data.slice(0, count) : data;
}

export function createFetcher(deps: Deps) {
  /** Giữ chỗ quota, tự chờ khi chỉ vướng rate limit ngắn. */
  async function reserveWithWait(
    userId: string | null,
    spec: AnyEndpoint,
    cacheKey: string | null,
  ): Promise<ReserveResult> {
    let last: ReserveResult | null = null;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const r = await deps.quota.reserve({ userId, endpoint: spec.key, cacheKey, cost: spec.cost });
      if (r.ok) return r;
      last = r;
      const isRate = r.reason === "RATE_SECOND" || r.reason === "RATE_MINUTE";
      if (!isRate || r.retryAfterMs > MAX_AUTO_WAIT_MS) return r;
      await deps.sleep(r.retryAfterMs);
    }
    return last as ReserveResult;
  }

  async function fetchWithCache(
    spec: AnyEndpoint,
    input: unknown,
    opts: FetchOpts,
  ): Promise<ActionResult<unknown>> {
    if (!spec.available) {
      deps.log({ endpoint: spec.key, cacheKey: null, source: "none", code: "NOT_AVAILABLE" });
      return fail("NOT_AVAILABLE");
    }

    const key = spec.cacheKey ? spec.cacheKey(input) : null;
    const wantCount = spec.requestedCount?.(input);
    const cached = key ? await deps.cache.get(key) : null;
    const nowMs = deps.now().getTime();

    if (opts.cacheOnly) {
      const usable =
        cached && (cached.status === "not_found" || wantCount === undefined || (cached.requested_count ?? 0) >= wantCount);
      return usable ? resultFromCache(cached, wantCount, nowMs) : fail("NOT_CACHED");
    }

    // 1. Cache còn hạn thì trả luôn
    if (cached && !opts.forceRefresh) {
      const fresh = new Date(cached.expires_at).getTime() > nowMs;
      const enough =
        cached.status === "not_found" || wantCount === undefined || (cached.requested_count ?? 0) >= wantCount;
      if (fresh && enough) {
        deps.log({ endpoint: spec.key, cacheKey: key, source: "cache" });
        return resultFromCache(cached, wantCount, nowMs);
      }
    }

    const staleOk =
      cached && cached.status === "ok"
        ? { data: sliceData(cached.response, wantCount), meta: metaFromRow(cached, nowMs, { stale: true }) }
        : undefined;

    // 2. Gọi API, có giữ chỗ quota và thử lại
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const reserve = await reserveWithWait(opts.userId, spec, key);

      if (!reserve.ok) {
        const code: ErrorCode =
          reserve.reason === "QUOTA_DAY"
            ? "QUOTA_DAY"
            : reserve.reason === "QUOTA_CYCLE"
              ? "QUOTA_CYCLE"
              : "RATE_LIMITED";
        deps.log({ endpoint: spec.key, cacheKey: key, source: "none", code, note: reserve.reason });
        if ((code === "QUOTA_DAY" || code === "QUOTA_CYCLE") && staleOk) {
          return {
            ok: true,
            data: staleOk.data,
            meta: {
              ...staleOk.meta,
              warning: `${ERROR_MESSAGES[code]} Đang hiển thị dữ liệu đã lưu.`,
              quota: { usedToday: reserve.usedToday, usedCycle: reserve.usedCycle },
            },
          };
        }
        return { ...fail(code, { retryAfterMs: reserve.retryAfterMs }), ...(staleOk ? { staleData: staleOk } : {}) };
      }

      const started = Date.now();
      try {
        const raw = await deps.call(spec, input);
        const durationMs = Date.now() - started;
        await deps.quota.finish({
          usageId: reserve.usageId,
          httpStatus: raw.httpStatus,
          code: raw.code,
          requestId: raw.requestId,
          counted: true,
          durationMs,
        });
        deps.log({
          endpoint: spec.key,
          cacheKey: key,
          source: "api",
          httpStatus: raw.httpStatus,
          code: raw.code,
          requestId: raw.requestId,
          durationMs,
        });

        const fetchedAt = deps.now();
        const expiresAt = new Date(fetchedAt.getTime() + (spec.ttlMs ?? 0));
        if (key && spec.ttlMs !== null) {
          await deps.cache.put({
            cache_key: key,
            endpoint: spec.key,
            params: input,
            status: "ok",
            response: raw.data,
            requested_count: wantCount ?? null,
            request_id: raw.requestId ?? null,
            parser_version: PARSER_VERSION,
            fetched_at: fetchedAt.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
        }
        return {
          ok: true,
          data: raw.data,
          meta: {
            source: "api",
            fetchedAt: fetchedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            stale: false,
            requestId: raw.requestId,
            quota: { usedToday: reserve.usedToday, usedCycle: reserve.usedCycle },
          },
        };
      } catch (e) {
        const durationMs = Date.now() - started;
        const err =
          e instanceof TikTodayError ? e : new TikTodayError(0, "NETWORK", e instanceof Error ? e.message : "lỗi lạ");
        // 404 vẫn bị TikToday tính quota, các lỗi khác thì không
        const counted = err.httpStatus === 404;
        await deps.quota.finish({
          usageId: reserve.usageId,
          httpStatus: err.httpStatus,
          code: err.apiCode,
          requestId: err.requestId,
          counted,
          durationMs,
        });
        deps.log({
          endpoint: spec.key,
          cacheKey: key,
          source: "api",
          httpStatus: err.httpStatus,
          code: err.apiCode,
          requestId: err.requestId,
          durationMs,
        });

        if (err.httpStatus === 404) {
          const fetchedAt = deps.now();
          const expiresAt = new Date(fetchedAt.getTime() + NOT_FOUND_TTL_MS);
          if (key) {
            await deps.cache.put({
              cache_key: key,
              endpoint: spec.key,
              params: input,
              status: "not_found",
              response: null,
              requested_count: wantCount ?? null,
              request_id: err.requestId ?? null,
              parser_version: PARSER_VERSION,
              fetched_at: fetchedAt.toISOString(),
              expires_at: expiresAt.toISOString(),
            });
          }
          return {
            ...fail("NOT_FOUND", { requestId: err.requestId }),
            meta: {
              source: "api",
              fetchedAt: fetchedAt.toISOString(),
              expiresAt: expiresAt.toISOString(),
              stale: false,
              requestId: err.requestId,
            },
          };
        }

        if (isRetryable(err) && attempt < MAX_ATTEMPTS) {
          const waitMs = err.retryAfterSec !== undefined ? err.retryAfterSec * 1000 : 1000 * 2 ** (attempt - 1);
          if (waitMs <= MAX_AUTO_WAIT_MS) {
            await deps.sleep(waitMs);
            continue;
          }
          return {
            ...fail("RATE_LIMITED", { retryAfterMs: waitMs, requestId: err.requestId }),
            ...(staleOk ? { staleData: staleOk } : {}),
          };
        }

        const code = toErrorCode(err);
        return {
          ...fail(code, { requestId: err.requestId, ...(code === "INVALID_INPUT" ? { message: err.message } : {}) }),
          ...(staleOk ? { staleData: staleOk } : {}),
        };
      }
    }

    return fail("UNKNOWN");
  }

  function resultFromCache(row: CacheRow, wantCount: number | undefined, nowMs: number): ActionResult<unknown> {
    if (row.status === "not_found") {
      return { ...fail("NOT_FOUND"), meta: metaFromRow(row, nowMs) };
    }
    return { ok: true, data: sliceData(row.response, wantCount), meta: metaFromRow(row, nowMs) };
  }

  return fetchWithCache;
}
