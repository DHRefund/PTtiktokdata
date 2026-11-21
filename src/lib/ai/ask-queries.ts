import type { CreatorAffiliate, ProductListItem, VideoItem } from "@/lib/tiktoday/types";
import { slimProduct, slimVideo } from "./shape";

// Truy vấn thuần trên dữ liệu đã lưu, dùng làm công cụ cho trợ lý "Hỏi AI". Không đụng database hay API nên kiểm thử được.

const norm = (s: string | null | undefined): string => (s ?? "").toLowerCase().normalize("NFC");

const num = (v: number | null | undefined): number => (v == null || !Number.isFinite(v) ? -Infinity : v);

function sortDesc<T>(rows: T[], key: (r: T) => number): T[] {
  // Giá trị thiếu xếp cuối
  return [...rows].sort((a, b) => key(b) - key(a));
}

// ---------- Creator ----------

export type CreatorQuery = {
  keyword?: string;
  category?: string;
  min_followers?: number;
  min_units_sold?: number;
  sort_by?: "follower_count" | "units_sold" | "gmv" | "video_avg_views" | "video_median_views";
  limit?: number;
};

export function creatorRow(c: CreatorAffiliate) {
  return {
    handle: c.handle,
    nickname: c.nickname,
    agency: c.agency ?? undefined,
    follower_count: c.follower_count,
    units_sold: c.units_sold ?? c.units_sold_range ?? undefined,
    gmv: c.gmv ?? c.gmv_range ?? undefined,
    categories: c.categories?.slice(0, 3),
    video_avg_views: c.video_avg_views ?? undefined,
    video_median_views: c.video_median_views ?? undefined,
    gmv_share: c.gmv_share ?? undefined,
    commission_rate_range: c.commission_rate_range ?? undefined,
  };
}

export function queryCreators(all: CreatorAffiliate[], q: CreatorQuery) {
  const kw = norm(q.keyword);
  const cat = norm(q.category);
  const matched = all.filter((c) => {
    if (kw && !norm(`${c.nickname} ${c.handle} ${c.agency ?? ""} ${(c.categories ?? []).join(" ")}`).includes(kw)) return false;
    if (cat && !(c.categories ?? []).some((x) => norm(x).includes(cat))) return false;
    if (q.min_followers != null && (c.follower_count ?? 0) < q.min_followers) return false;
    if (q.min_units_sold != null && (c.units_sold ?? 0) < q.min_units_sold) return false;
    return true;
  });
  const sortBy = q.sort_by ?? "units_sold";
  const sorted = sortDesc(matched, (c) => num(c[sortBy]));
  const limit = Math.min(Math.max(q.limit ?? 15, 1), 30);
  return { total_matching: matched.length, total_saved: all.length, shown: Math.min(limit, sorted.length), creators: sorted.slice(0, limit).map(creatorRow) };
}

// ---------- Sản phẩm ----------

export type ProductQuery = {
  text?: string;
  min_sold?: number;
  max_price?: number;
  min_rating?: number;
  sort_by?: "sold_count" | "sale_price" | "rating";
  limit?: number;
};

export function queryProducts(all: ProductListItem[], q: ProductQuery) {
  const t = norm(q.text);
  const matched = all.filter((p) => {
    if (t && !norm(`${p.title} ${p.seller?.shop_name ?? ""}`).includes(t)) return false;
    if (q.min_sold != null && (p.sold_count ?? 0) < q.min_sold) return false;
    if (q.max_price != null && (p.price?.sale_price ?? Infinity) > q.max_price) return false;
    if (q.min_rating != null && (p.rating ?? 0) < q.min_rating) return false;
    return true;
  });
  const sortBy = q.sort_by ?? "sold_count";
  const sorted = sortDesc(matched, (p) => (sortBy === "sale_price" ? -(p.price?.sale_price ?? Infinity) : num(sortBy === "rating" ? p.rating : p.sold_count)));
  const limit = Math.min(Math.max(q.limit ?? 15, 1), 30);
  return { total_matching: matched.length, total_saved: all.length, shown: Math.min(limit, sorted.length), products: sorted.slice(0, limit).map(slimProduct) };
}

// ---------- Video ----------

export type VideoQuery = {
  text?: string;
  author?: string;
  hashtag?: string;
  only_ecommerce?: boolean;
  sort_by?: "plays" | "likes" | "engagement_rate";
  limit?: number;
};

const engagement = (v: VideoItem): number => {
  const plays = v.stats?.play_count ?? 0;
  if (!plays) return -Infinity;
  return ((v.stats?.like_count ?? 0) + (v.stats?.comment_count ?? 0) + (v.stats?.share_count ?? 0)) / plays;
};

export function queryVideos(all: VideoItem[], q: VideoQuery) {
  const t = norm(q.text);
  const author = norm(q.author).replace(/^@/, "");
  const tag = norm(q.hashtag).replace(/^#/, "");
  const matched = all.filter((v) => {
    if (t && !norm(v.description).includes(t)) return false;
    if (author && norm(v.author?.handle) !== author) return false;
    if (tag && !(v.hashtags ?? []).some((h) => norm(h) === tag)) return false;
    if (q.only_ecommerce && v.is_ecommerce !== true) return false;
    return true;
  });
  const sortBy = q.sort_by ?? "plays";
  const sorted = sortDesc(matched, (v) => (sortBy === "engagement_rate" ? engagement(v) : num(sortBy === "likes" ? v.stats?.like_count : v.stats?.play_count)));
  const limit = Math.min(Math.max(q.limit ?? 15, 1), 30);
  const rows = sorted.slice(0, limit).map((v) => {
    const e = engagement(v);
    return { ...slimVideo(v), engagement_rate: Number.isFinite(e) ? Math.round(e * 10000) / 10000 : undefined };
  });
  return { total_matching: matched.length, total_saved: all.length, shown: rows.length, videos: rows };
}
