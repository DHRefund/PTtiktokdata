import "server-only";
import snapshot from "@/data/kalodata-latest.json";
import { db } from "@/lib/db/supabase";
import { kalodataBatchSchema, type KalodataBatch } from "./schema";

export type KalodataView = { batch: KalodataBatch; origin: "db" | "file"; importedAt?: string; batchCount?: number };

/** Batch mới nhất trong database. Trả null nếu chưa có hoặc đọc lỗi (trang sẽ dùng file dự phòng). */
async function latestFromDb(): Promise<KalodataView | null> {
  try {
    const { data: head, error } = await db()
      .from("market_batches")
      .select("*")
      .eq("source", "kalodata")
      .order("collected_on", { ascending: false })
      .order("imported_at", { ascending: false })
      .limit(1);
    if (error || !head?.length) return null;
    const h = head[0];
    const { data: rows, error: e2 } = await db().from("market_batch_rows").select("*").eq("batch_id", h.id).order("rank");
    if (e2 || !rows?.length) return null;
    const { count } = await db().from("market_batches").select("id", { count: "exact", head: true }).eq("source", "kalodata");

    const batch = kalodataBatchSchema.safeParse({
      schemaVersion: h.schema_version,
      source: h.source,
      sourceUrl: h.source_url,
      collectedOn: h.collected_on,
      collectionMethod: h.collection_method,
      market: h.market,
      currency: h.currency,
      periodStart: h.period_start,
      periodEnd: h.period_end,
      sortVerified: h.sort_verified,
      precision: h.precision,
      rows: rows.map((r) => ({
        rank: r.rank,
        name: r.name,
        revenue: r.revenue,
        sold: r.sold,
        growth: r.growth,
        rating: r.rating,
        averagePrice: r.average_price,
        commission: r.commission,
        creators: r.creators,
        productId: r.product_id,
        imageUrl: r.image_url ?? null,
      })),
    });
    if (!batch.success) {
      console.error("[kalodata] batch trong DB không hợp lệ:", batch.error.issues[0]?.message);
      return null;
    }
    return { batch: batch.data, origin: "db", importedAt: String(h.imported_at), batchCount: count ?? undefined };
  } catch (e) {
    console.error("[kalodata] đọc DB lỗi:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Dữ liệu Kalodata để hiển thị: ưu tiên batch mới nhất trong DB, không có thì dùng file snapshot đi kèm bản build.
 * Không bao giờ gọi nguồn ngoài.
 */
export async function getKalodataView(): Promise<KalodataView | null> {
  const fromDb = await latestFromDb();
  if (fromDb) return fromDb;
  const fallback = kalodataBatchSchema.safeParse(snapshot);
  return fallback.success ? { batch: fallback.data, origin: "file" } : null;
}
