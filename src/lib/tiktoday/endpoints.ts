import type { z } from "zod";
import { normalizeKeyword } from "@/lib/cache/keys";
import {
  creatorSearchInput,
  creatorVideosInput,
  handleInput,
  noInput,
  productDetailsInput,
  querySearchInput,
  videoDetailsInput,
} from "./schemas";

const HOUR = 60 * 60 * 1000;

export type EndpointKey =
  | "health.check"
  | "creator.profile"
  | "creator.affiliate"
  | "creator.search"
  | "creator.videos"
  | "product.details"
  | "product.search"
  | "video.details"
  | "video.search"
  | "product.affiliate"
  | "product.affiliate_search"
  | "video.play_url";

export type RequestShape = {
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export interface EndpointSpec<S extends z.ZodType = z.ZodType> {
  key: EndpointKey;
  method: "GET" | "POST";
  /** Quota tính cho một lượt gọi thành công. */
  cost: 0 | 1;
  /** Thời gian xử lý tối đa theo tài liệu TikToday. */
  timeoutMs: number;
  /** null = không cache. */
  ttlMs: number | null;
  /** false = TikToday chưa mở, trả NOT_AVAILABLE mà không gọi. */
  available: boolean;
  input: S;
  /** null = không cache. */
  cacheKey: ((input: z.output<S>) => string) | null;
  /** Số lượng tối đa yêu cầu (limit/count), dùng để cắt bản cache lớn hơn. */
  requestedCount?: (input: z.output<S>) => number;
  request: (input: z.output<S>) => RequestShape;
}

type CacheKeyFn<S extends z.ZodType> = ((input: z.output<S>) => string) | null;
type Declared<S extends z.ZodType, K extends CacheKeyFn<S>> = Omit<EndpointSpec<S>, "cacheKey"> & { cacheKey: K };

// Giữ nguyên kiểu chính xác của cacheKey (hàm hoặc null) để chỗ dùng không phải kiểm tra null khi endpoint có cache.
function spec<S extends z.ZodType, K extends CacheKeyFn<S>>(s: Declared<S, K>): Declared<S, K> {
  return s;
}

const h = (handle: string) => encodeURIComponent(handle);

export const ENDPOINTS = {
  "health.check": spec({
    key: "health.check",
    method: "GET",
    cost: 0,
    timeoutMs: 2_000,
    ttlMs: null,
    available: true,
    input: noInput,
    cacheKey: null,
    request: () => ({ path: "/health/v1/check" }),
  }),

  "creator.profile": spec({
    key: "creator.profile",
    method: "GET",
    cost: 1,
    timeoutMs: 30_000,
    ttlMs: 24 * HOUR,
    available: true,
    input: handleInput,
    cacheKey: (i) => `creator.profile:${i.handle}`,
    request: (i) => ({ path: `/creator/v1/creators/${h(i.handle)}/profile` }),
  }),

  "creator.affiliate": spec({
    key: "creator.affiliate",
    method: "GET",
    cost: 1,
    timeoutMs: 55_000,
    ttlMs: 24 * HOUR,
    available: true,
    input: handleInput,
    cacheKey: (i) => `creator.affiliate:${i.handle}`,
    request: (i) => ({ path: `/creator/v1/creators/${h(i.handle)}/affiliate` }),
  }),

  "creator.search": spec({
    key: "creator.search",
    method: "POST",
    cost: 1,
    timeoutMs: 55_000,
    ttlMs: 6 * HOUR,
    available: true,
    input: creatorSearchInput,
    cacheKey: (i) => `creator.search:${normalizeKeyword(i.keyword)}`,
    requestedCount: (i) => i.count,
    request: (i) => ({
      path: "/creator/v1/creators/search",
      body: { ...(i.keyword ? { keyword: i.keyword } : {}), count: i.count },
    }),
  }),

  "creator.videos": spec({
    key: "creator.videos",
    method: "GET",
    cost: 1,
    timeoutMs: 55_000,
    ttlMs: 6 * HOUR,
    available: true,
    input: creatorVideosInput,
    cacheKey: (i) => `creator.videos:${i.handle}:${i.since ?? ""}`,
    requestedCount: (i) => i.limit,
    request: (i) => ({
      path: `/creator/v1/creators/${h(i.handle)}/videos`,
      query: { limit: i.limit, since: i.since },
    }),
  }),

  "product.details": spec({
    key: "product.details",
    method: "GET",
    cost: 1,
    timeoutMs: 55_000,
    ttlMs: 12 * HOUR,
    available: true,
    input: productDetailsInput,
    cacheKey: (i) => `product.details:${i.id}`,
    request: (i) => ({ path: `/product/v1/products/${encodeURIComponent(i.id)}/details` }),
  }),

  "product.search": spec({
    key: "product.search",
    method: "POST",
    cost: 1,
    timeoutMs: 55_000,
    ttlMs: 6 * HOUR,
    available: true,
    input: querySearchInput,
    cacheKey: (i) => `product.search:${normalizeKeyword(i.query)}`,
    requestedCount: (i) => i.limit,
    request: (i) => ({ path: "/product/v1/products/search", body: { query: i.query, limit: i.limit } }),
  }),

  "video.details": spec({
    key: "video.details",
    method: "GET",
    cost: 1,
    timeoutMs: 30_000,
    ttlMs: 24 * HOUR,
    available: true,
    input: videoDetailsInput,
    cacheKey: (i) => `video.details:${i.id}`,
    request: (i) => ({ path: `/video/v1/videos/${encodeURIComponent(i.id)}` }),
  }),

  "video.search": spec({
    key: "video.search",
    method: "POST",
    cost: 1,
    timeoutMs: 55_000,
    ttlMs: 6 * HOUR,
    available: true,
    input: querySearchInput,
    cacheKey: (i) => `video.search:${normalizeKeyword(i.query)}`,
    requestedCount: (i) => i.limit,
    request: (i) => ({ path: "/video/v1/videos/search", body: { query: i.query, limit: i.limit } }),
  }),

  // Chưa mở: gọi sẽ nhận 501 NOT_AVAILABLE. Khai báo sẵn để khi mở chỉ cần đổi `available`.
  "product.affiliate": spec({
    key: "product.affiliate",
    method: "GET",
    cost: 1,
    timeoutMs: 55_000,
    ttlMs: 12 * HOUR,
    available: false,
    input: productDetailsInput,
    cacheKey: (i) => `product.affiliate:${i.id}`,
    request: (i) => ({ path: `/product/v1/products/${encodeURIComponent(i.id)}/affiliate` }),
  }),

  "product.affiliate_search": spec({
    key: "product.affiliate_search",
    method: "POST",
    cost: 1,
    timeoutMs: 55_000,
    ttlMs: 6 * HOUR,
    available: false,
    input: noInput,
    cacheKey: null,
    request: () => ({ path: "/product/v1/products/affiliate/search", body: {} }),
  }),

  "video.play_url": spec({
    key: "video.play_url",
    method: "POST",
    cost: 1,
    timeoutMs: 55_000,
    ttlMs: null,
    available: false,
    input: noInput,
    cacheKey: null,
    request: () => ({ path: "/video/v1/videos/play-url", body: {} }),
  }),
} as const;

export type AnyEndpoint = EndpointSpec<z.ZodType>;
