import "server-only";
import { db } from "@/lib/db/supabase";
import { supabaseCache } from "@/lib/cache/store";
import { asData, asList, type CreatorAffiliate, type ProductDetails, type ProductListItem, type VideoItem } from "@/lib/tiktoday/types";
import { loadCreatorDossier } from "./dossier";
import type { AskData } from "./tools";

// Nguồn dữ liệu thật cho "Hỏi AI": đọc từ bảng cache của app. Không gọi TikToday.

type CacheRow = { endpoint: string; response: unknown; fetched_at: string };

async function rows(endpoints: string[]): Promise<CacheRow[]> {
  const { data, error } = await db()
    .from("api_cache")
    .select("endpoint, response, fetched_at")
    .in("endpoint", endpoints)
    .eq("status", "ok")
    .order("fetched_at", { ascending: true }) // bản mới ghi đè bản cũ khi gộp
    .limit(400);
  if (error) throw new Error(`Đọc api_cache lỗi: ${error.message}`);
  return (data ?? []) as CacheRow[];
}

export function makeAskData(): AskData {
  return {
    async creators() {
      const merged = new Map<string, CreatorAffiliate>();
      for (const r of await rows(["creator.search", "creator.affiliate"])) {
        const items = r.endpoint === "creator.search" ? asList<CreatorAffiliate>(r.response) : [asData<CreatorAffiliate>(r.response)];
        for (const c of items) if (c?.handle) merged.set(c.handle.toLowerCase(), { ...merged.get(c.handle.toLowerCase()), ...c });
      }
      return [...merged.values()];
    },

    creatorDossier: (handle) => loadCreatorDossier(handle),

    async products() {
      const merged = new Map<string, ProductListItem>();
      for (const r of await rows(["product.search"])) for (const p of asList<ProductListItem>(r.response)) if (p?.product_id) merged.set(p.product_id, p);
      return [...merged.values()];
    },

    async productDetails(id) {
      const row = await supabaseCache.get(`product.details:${id}`);
      if (!row || row.status !== "ok") return null;
      const p = asData<ProductDetails>(row.response);
      // Rút gọn: bỏ ảnh, cắt mô tả và đánh giá
      return {
        id: p.product_id,
        title: p.title,
        price: p.price,
        sold_count: p.sold_count,
        rating: p.rating,
        review_count: p.review_count,
        skus: p.skus?.slice(0, 10),
        specifications: p.specifications?.slice(0, 10),
        shipping: p.shipping,
        shop: p.shop ? { name: p.shop.name, rating: p.shop.rating, follower_count: p.shop.follower_count, product_count: p.shop.product_count } : undefined,
        reviews: p.reviews?.slice(0, 3).map((r) => ({ rating: r.rating, text: r.text?.slice(0, 200) })),
        data_as_of: row.fetched_at,
      };
    },

    async videos() {
      const merged = new Map<string, VideoItem>();
      for (const r of await rows(["video.search", "creator.videos"])) for (const v of asList<VideoItem>(r.response)) if (v?.id) merged.set(v.id, v);
      return [...merged.values()];
    },

    async searches(limit) {
      const { data, error } = await db()
        .from("search_history")
        .select("kind, query, requested_count, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Đọc search_history lỗi: ${error.message}`);
      return data as { kind: string; query: string; requested_count: number | null; created_at: string }[];
    },
  };
}
