import { describe, expect, it } from "vitest";
import type { CacheRow, CacheStore } from "@/lib/cache/store";
import type { FinishArgs, QuotaStore, ReserveArgs, ReserveResult } from "@/lib/cache/quota";
import type { RawResult } from "./client";
import { createFetcher, type Deps } from "./core";
import { ENDPOINTS, type AnyEndpoint } from "./endpoints";
import { TikTodayError } from "./errors";

const NOW = new Date("2026-11-21T03:00:00.000Z");
const HOUR = 3600_000;

type CallOutcome = RawResult | TikTodayError;

function setup(opts: { reserves?: ReserveResult[]; calls?: CallOutcome[]; rows?: CacheRow[] } = {}) {
  const rows = new Map<string, CacheRow>((opts.rows ?? []).map((r) => [r.cache_key, r]));
  const reserveQueue = [...(opts.reserves ?? [])];
  const callQueue = [...(opts.calls ?? [])];
  const finishes: FinishArgs[] = [];
  const reserveCalls: ReserveArgs[] = [];
  const sleeps: number[] = [];
  let calls = 0;
  let nextId = 1;

  const cache: CacheStore = {
    get: async (k) => rows.get(k) ?? null,
    put: async (row) => void rows.set(row.cache_key, row),
  };
  const quota: QuotaStore = {
    reserve: async (a) => {
      reserveCalls.push(a);
      return reserveQueue.shift() ?? { ok: true, usageId: nextId++, usedToday: 1, usedCycle: 1 };
    },
    finish: async (a) => void finishes.push(a),
  };
  const deps: Deps = {
    cache,
    quota,
    call: async () => {
      calls++;
      const next = callQueue.shift();
      if (!next) throw new Error("test: hết kết quả giả cho call");
      if (next instanceof TikTodayError) throw next;
      return next;
    },
    sleep: async (ms) => void sleeps.push(ms),
    now: () => NOW,
    log: () => {},
  };
  return {
    fetch: createFetcher(deps),
    rows,
    finishes,
    reserveCalls,
    sleeps,
    callCount: () => calls,
  };
}

const ok = (data: unknown, requestId = "req-1"): RawResult => ({ httpStatus: 200, code: "OK", data, requestId });
const profile = ENDPOINTS["creator.profile"] as unknown as AnyEndpoint;
const search = ENDPOINTS["creator.search"] as unknown as AnyEndpoint;
const health = ENDPOINTS["health.check"] as unknown as AnyEndpoint;
const input = { handle: "example.creator" };
const user = { userId: "u1" };

function cachedRow(over: Partial<CacheRow> = {}): CacheRow {
  return {
    cache_key: "creator.profile:example.creator",
    endpoint: "creator.profile",
    params: input,
    status: "ok",
    response: { handle: "example.creator", from: "cache" },
    requested_count: null,
    request_id: "req-old",
    parser_version: 1,
    fetched_at: new Date(NOW.getTime() - HOUR).toISOString(),
    expires_at: new Date(NOW.getTime() + HOUR).toISOString(),
    ...over,
  };
}

describe("fetchWithCache", () => {
  it("cache còn hạn: không giữ chỗ quota, không gọi API", async () => {
    const t = setup({ rows: [cachedRow()] });
    const r = await t.fetch(profile, input, user);
    expect(r.ok && r.meta.source).toBe("cache");
    expect(t.reserveCalls).toHaveLength(0);
    expect(t.callCount()).toBe(0);
  });

  it("cache hết hạn: gọi lại API, ghi cache mới, quota giữ nguyên", async () => {
    const t = setup({
      rows: [cachedRow({ expires_at: new Date(NOW.getTime() - 1000).toISOString() })],
      calls: [ok({ handle: "example.creator", from: "api" })],
    });
    const r = await t.fetch(profile, input, user);
    expect(r.ok && r.meta.source).toBe("api");
    expect(t.finishes[0].counted).toBe(true);
    const row = t.rows.get("creator.profile:example.creator")!;
    expect((row.response as { from: string }).from).toBe("api");
    expect(new Date(row.expires_at).getTime()).toBe(NOW.getTime() + 24 * HOUR);
  });

  it("forceRefresh bỏ qua cache còn hạn", async () => {
    const t = setup({ rows: [cachedRow()], calls: [ok({ from: "api" })] });
    const r = await t.fetch(profile, input, { ...user, forceRefresh: true });
    expect(r.ok && r.meta.source).toBe("api");
    expect(t.callCount()).toBe(1);
  });

  it("search count=20 khi cache có count=50: cắt 20 phần tử, không gọi API", async () => {
    const list = Array.from({ length: 50 }, (_, i) => ({ handle: `h${i}` }));
    const t = setup({
      rows: [cachedRow({ cache_key: "creator.search:beauty", endpoint: "creator.search", response: list, requested_count: 50 })],
    });
    const r = await t.fetch(search, { keyword: "Beauty ", count: 20 }, user);
    expect(r.ok && (r.data as unknown[]).length).toBe(20);
    expect(t.callCount()).toBe(0);
  });

  it("search count lớn hơn bản cache: gọi lại API", async () => {
    const t = setup({
      rows: [cachedRow({ cache_key: "creator.search:beauty", endpoint: "creator.search", response: [], requested_count: 20 })],
      calls: [ok([])],
    });
    await t.fetch(search, { keyword: "beauty", count: 50 }, user);
    expect(t.callCount()).toBe(1);
  });

  it("404: cache not_found 24h, vẫn tính quota, lần sau không gọi lại", async () => {
    const t = setup({ calls: [new TikTodayError(404, "NOT_FOUND", "x", "req-404")] });
    const r1 = await t.fetch(profile, input, user);
    expect(!r1.ok && r1.error.code).toBe("NOT_FOUND");
    expect(t.finishes[0].counted).toBe(true);
    expect(t.rows.get("creator.profile:example.creator")?.status).toBe("not_found");

    const r2 = await t.fetch(profile, input, user);
    expect(!r2.ok && r2.error.code).toBe("NOT_FOUND");
    expect(t.callCount()).toBe(1);
  });

  it("429 RATE_LIMITED rồi thành công: chờ Retry-After, hoàn quota lượt hỏng, thử lại", async () => {
    const t = setup({
      calls: [new TikTodayError(429, "RATE_LIMITED", "x", "r", 2), ok({ ok: 1 })],
    });
    const r = await t.fetch(profile, input, user);
    expect(r.ok).toBe(true);
    expect(t.sleeps).toEqual([2000]);
    expect(t.reserveCalls).toHaveLength(2);
    expect(t.finishes.map((f) => f.counted)).toEqual([false, true]);
  });

  it("500 ba lần liên tiếp: trả UPSTREAM, cả ba lượt hoàn quota", async () => {
    const e = () => new TikTodayError(500, "INTERNAL", "x");
    const t = setup({ calls: [e(), e(), e()] });
    const r = await t.fetch(profile, input, user);
    expect(!r.ok && r.error.code).toBe("UPSTREAM");
    expect(t.callCount()).toBe(3);
    expect(t.finishes.every((f) => f.counted === false)).toBe(true);
    expect(t.sleeps).toEqual([1000, 2000]);
  });

  it("401: không thử lại, trả API_KEY_INVALID", async () => {
    const t = setup({ calls: [new TikTodayError(401, "UNAUTHENTICATED", "x")] });
    const r = await t.fetch(profile, input, user);
    expect(!r.ok && r.error.code).toBe("API_KEY_INVALID");
    expect(t.callCount()).toBe(1);
  });

  it("RATE_SECOND với thời gian chờ ngắn: chờ rồi gọi thành công", async () => {
    const t = setup({
      reserves: [{ ok: false, reason: "RATE_SECOND", retryAfterMs: 400, usedToday: 1, usedCycle: 1 }],
      calls: [ok({})],
    });
    const r = await t.fetch(profile, input, user);
    expect(r.ok).toBe(true);
    expect(t.sleeps).toEqual([400]);
  });

  it("RATE_MINUTE với thời gian chờ dài: trả RATE_LIMITED, không gọi API", async () => {
    const t = setup({
      reserves: [{ ok: false, reason: "RATE_MINUTE", retryAfterMs: 45_000, usedToday: 1, usedCycle: 1 }],
    });
    const r = await t.fetch(profile, input, user);
    expect(!r.ok && r.error.code).toBe("RATE_LIMITED");
    expect(!r.ok && r.error.retryAfterMs).toBe(45_000);
    expect(t.callCount()).toBe(0);
  });

  it("QUOTA_DAY khi có cache cũ: trả bản cũ, stale và có cảnh báo", async () => {
    const t = setup({
      rows: [cachedRow({ expires_at: new Date(NOW.getTime() - 1000).toISOString() })],
      reserves: [{ ok: false, reason: "QUOTA_DAY", retryAfterMs: 1000, usedToday: 100, usedCycle: 120 }],
    });
    const r = await t.fetch(profile, input, user);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.meta.stale).toBe(true);
      expect(r.meta.warning).toContain("hết hạn mức");
    }
    expect(t.callCount()).toBe(0);
  });

  it("QUOTA_DAY khi không có cache: trả lỗi QUOTA_DAY", async () => {
    const t = setup({
      reserves: [{ ok: false, reason: "QUOTA_DAY", retryAfterMs: 1000, usedToday: 100, usedCycle: 120 }],
    });
    const r = await t.fetch(profile, input, user);
    expect(!r.ok && r.error.code).toBe("QUOTA_DAY");
  });

  it("endpoint chưa mở: NOT_AVAILABLE, không giữ chỗ quota", async () => {
    const t = setup();
    const r = await t.fetch(ENDPOINTS["video.play_url"] as unknown as AnyEndpoint, {}, user);
    expect(!r.ok && r.error.code).toBe("NOT_AVAILABLE");
    expect(t.reserveCalls).toHaveLength(0);
  });

  it("health.check: cost 0, không cache", async () => {
    const t = setup({ calls: [ok({ status: "ok" })] });
    const r = await t.fetch(health, {}, user);
    expect(r.ok).toBe(true);
    expect(t.reserveCalls[0].cost).toBe(0);
    expect(t.rows.size).toBe(0);
  });
});

describe("cacheOnly", () => {
  it("có cache (kể cả quá hạn): trả cache, không giữ chỗ quota, không gọi API", async () => {
    const t = setup({ rows: [cachedRow({ expires_at: new Date(NOW.getTime() - 1000).toISOString() })] });
    const r = await t.fetch(profile, input, { ...user, cacheOnly: true });
    expect(r.ok && r.meta.stale).toBe(true);
    expect(t.reserveCalls).toHaveLength(0);
    expect(t.callCount()).toBe(0);
  });

  it("chưa có cache: NOT_CACHED, không gọi API", async () => {
    const t = setup();
    const r = await t.fetch(profile, input, { ...user, cacheOnly: true });
    expect(!r.ok && r.error.code).toBe("NOT_CACHED");
    expect(t.reserveCalls).toHaveLength(0);
    expect(t.callCount()).toBe(0);
  });
});
