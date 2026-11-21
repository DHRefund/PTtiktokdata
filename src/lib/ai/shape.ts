import { createHash } from "node:crypto";
import type { CreatorAffiliate, CreatorProfile, ProductListItem, VideoItem } from "@/lib/tiktoday/types";

// Rút gọn dữ liệu trước khi gửi cho model: bỏ link ảnh có chữ ký (tốn token, vô ích), cắt văn bản dài,
// đổi mốc thời gian sang ngày đọc được. Hàm thuần, không phụ thuộc server nên kiểm thử được.

const cut = (s: string | null | undefined, n: number): string | undefined => {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

// Ngày theo giờ Việt Nam (yyyy-mm-dd), cho khớp với cách app hiển thị thời gian
const vnDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });
const day = (sec: number | null | undefined): string | undefined => (sec == null ? undefined : vnDate.format(new Date(sec * 1000)));

export function slimAffiliate(a: CreatorAffiliate) {
  return {
    handle: a.handle,
    nickname: a.nickname,
    agency: a.agency ?? undefined,
    region: a.region,
    follower_count: a.follower_count,
    categories: a.categories,
    level: a.level ?? undefined,
    units_sold: a.units_sold ?? undefined,
    units_sold_range: a.units_sold_range ?? undefined,
    gmv_vnd: a.gmv ?? undefined,
    gmv_range: a.gmv_range ?? undefined,
    gpm_range: a.gpm_range ?? undefined,
    commission_rate_range: a.commission_rate_range ?? undefined,
    gmv_share: a.gmv_share ?? undefined,
    category_shares: a.category_shares?.slice(0, 5),
    video_avg_views: a.video_avg_views ?? undefined,
    video_median_views: a.video_median_views ?? undefined,
    shop_video_avg_views: a.shop_video_avg_views ?? undefined,
    live_avg_viewers: a.live_avg_viewers ?? undefined,
    fast_growing: a.fast_growing ?? undefined,
    stats_until: day(a.stats_until),
    follower_ages: a.follower_ages,
    follower_genders: a.follower_genders,
    follower_regions: a.follower_regions?.slice(0, 5),
    bio: cut(a.bio, 300),
    top_videos: a.top_videos?.slice(0, 3).map((v) => ({
      description: cut(v.description, 160),
      posted: day(v.create_time),
      duration_sec: v.duration != null ? Math.round(v.duration) : undefined,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      products: v.products?.slice(0, 3).map((p) => ({ name: cut(p.name, 80), min_price: p.min_price, max_price: p.max_price })),
    })),
  };
}

export function slimProfile(p: CreatorProfile) {
  return {
    handle: p.handle,
    nickname: p.nickname,
    bio: cut(p.bio, 300),
    follower_count: p.follower_count,
    following_count: p.following_count,
    heart_count: p.heart_count,
    recent_video_descriptions: p.recent_videos?.slice(0, 8).map((v) => cut(v.description, 120)),
  };
}

export function slimVideo(v: VideoItem) {
  return {
    id: v.id,
    description: cut(v.description, 200),
    posted: day(v.create_time),
    is_ad: v.is_ad,
    is_ecommerce: v.is_ecommerce,
    hashtags: v.hashtags?.slice(0, 8),
    duration_sec: v.video?.duration,
    plays: v.stats?.play_count,
    likes: v.stats?.like_count,
    comments: v.stats?.comment_count,
    shares: v.stats?.share_count,
    saves: v.stats?.save_count,
    author: v.author?.handle,
    author_followers: v.author_stats?.follower_count,
    music: v.music?.original ? "âm thanh gốc" : cut(v.music?.title, 60),
  };
}

export function slimProduct(p: ProductListItem) {
  return {
    id: p.product_id,
    title: cut(p.title, 100),
    sale_price_vnd: p.price?.sale_price,
    original_price_vnd: p.price?.original_price,
    discount: p.price?.discount,
    sold_count: p.sold_count,
    rating: p.rating,
    review_count: p.review_count,
    shop: p.seller?.shop_name,
  };
}

/** JSON có thứ tự khoá cố định, để cùng dữ liệu luôn cho cùng một chuỗi. */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );
}

/** Mã băm của dữ liệu đầu vào. Cùng dữ liệu thì cùng mã, nên dùng lại được kết quả AI đã lưu. */
export function hashInput(v: unknown): string {
  return createHash("sha256").update(stableJson(v)).digest("hex").slice(0, 32);
}
