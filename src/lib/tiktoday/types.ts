// Kiểu mô tả response thật của TikToday (đã quan sát ngày 21/11/2026, xem Docs/ui-design.md).
// Mọi trường đều tuỳ chọn: API còn beta và nhiều trường có thể null hoặc vắng.

export type Share = { group: string; share: number };
export type ProductRef = { id: string; name?: string; min_price?: number | null; max_price?: number | null };

export type TopVideo = {
  id: string;
  description?: string;
  create_time?: number; // giây
  duration?: number; // giây
  views?: number;
  likes?: number;
  comments?: number;
  products?: ProductRef[];
};

/** Dùng chung cho creator.search (từng phần tử) và creator.affiliate. */
export type CreatorAffiliate = {
  handle?: string;
  nickname?: string;
  oecuid?: string;
  avatar_url?: string;
  region?: string;
  bio?: string | null;
  follower_count?: number;
  categories?: string[];
  level?: number | null;
  units_sold?: number | null;
  units_sold_range?: string | null;
  gmv?: number | null;
  gmv_range?: string | null;
  video_gmv?: number | null;
  live_gmv?: number | null;
  gpm_range?: string | null;
  video_gpm_range?: string | null;
  live_gpm_range?: string | null;
  gmv_share?: { video?: number | null; live?: number | null } | null;
  commission_rate_range?: string | null;
  category_shares?: { name: string; share: number }[];
  agency?: string | null;
  fast_growing?: boolean | null;
  video_avg_views?: number | null;
  video_median_views?: number | null;
  shop_video_avg_views?: number | null;
  live_avg_viewers?: number | null;
  stats_until?: number | null; // giây
  top_videos?: TopVideo[];
  follower_genders?: Share[];
  follower_ages?: Share[];
  follower_regions?: { region: string; count: number }[];
};

export type CreatorProfile = {
  id?: string;
  handle?: string;
  nickname?: string;
  bio?: string | null;
  avatar_url?: string;
  follower_count?: number;
  following_count?: number;
  heart_count?: number;
  recent_videos?: { id: string; description?: string }[];
};

export type VideoItem = {
  id: string;
  description?: string;
  create_time?: number; // giây
  language?: string;
  /** Chỉ có ở video.details */
  location?: string;
  is_ecommerce?: boolean;
  is_ad?: boolean;
  hashtags?: string[];
  author?: { id?: string; handle?: string; nickname?: string; verified?: boolean; avatar_url?: string };
  author_stats?: { follower_count?: number; heart_count?: number; video_count?: number };
  stats?: { play_count?: number; like_count?: number; comment_count?: number; share_count?: number; save_count?: number };
  video?: { duration?: number; width?: number; height?: number; cover_url?: string };
  music?: { id?: string; title?: string; author_name?: string; original?: boolean };
};

export type ProductListItem = {
  product_id: string;
  title?: string;
  image_url?: string;
  price?: { currency?: string; sale_price?: number; original_price?: number; discount?: string };
  rating?: number;
  review_count?: number;
  sold_count?: number;
  seller?: { seller_id?: string; shop_name?: string };
};

export type ProductDetails = {
  product_id: string;
  title?: string;
  image_urls?: string[];
  description?: string[];
  price?: { currency?: string; sale_price_text?: string; original_price_text?: string; discount?: string };
  sold_count?: number;
  rating?: number;
  review_count?: number;
  skus?: {
    sku_id: string;
    stock?: number;
    sale_price?: number;
    original_price?: number;
    properties?: { name: string; value: string }[];
  }[];
  specifications?: { name: string; value: string }[];
  shipping?: { fee?: number; free_shipping?: boolean; min_days?: number; max_days?: number };
  shop?: {
    seller_id?: string;
    name?: string;
    rating?: number;
    follower_count?: number;
    sold_count?: number;
    product_count?: number;
    url?: string;
  };
  reviews?: {
    review_id: string;
    rating?: number;
    text?: string;
    create_time?: number; // mili giây
    sku_specification?: string;
    verified_purchase?: boolean;
  }[];
};

/** Ép kiểu ở biên. Không validate chặt, xem Docs/ui-design.md mục 6. */
export function asData<T>(data: unknown): T {
  return data as T;
}
export function asList<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}
