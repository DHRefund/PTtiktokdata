import { createHash } from "node:crypto";
import { z } from "zod";

// Hợp đồng batch Kalodata (schemaVersion 1), xem Docs/collector/HANDOFF.md.
// File này không import alias "@/" và không phụ thuộc Next.js để script nhập (Node thuần) dùng chung được.

const text = z.string().trim().min(1).max(500);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải dạng YYYY-MM-DD");
// Nguồn che số chưa mở khoá bằng ****. Không nhận dòng như vậy.
const metric = text.refine((v) => !v.includes("*"), "Giá trị bị che (****), không dùng được");

export const kalodataRowSchema = z.object({
  rank: z.number().int().min(1).max(500),
  name: text,
  revenue: metric,
  sold: metric,
  growth: metric,
  rating: metric,
  averagePrice: metric,
  commission: metric.nullable(),
  creators: metric,
  productId: z.string().regex(/^\d{10,25}$/, "productId phải là chuỗi số").nullable(),
  imageUrl: z.string().url().startsWith("https://img.kalocdn.com/").nullable().optional().default(null),
});

export const kalodataBatchSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    source: z.literal("kalodata"),
    sourceUrl: z.string().url(),
    collectedOn: date,
    collectionMethod: text,
    market: text,
    currency: text,
    periodStart: date,
    periodEnd: date,
    sortVerified: z.boolean(),
    precision: text,
    rows: z.array(kalodataRowSchema).min(1).max(100),
  })
  .superRefine((b, ctx) => {
    const ranks = b.rows.map((r) => r.rank);
    if (new Set(ranks).size !== ranks.length) ctx.addIssue({ code: "custom", message: "Có rank trùng nhau", path: ["rows"] });
    const ids = b.rows.map((r) => r.productId).filter(Boolean);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Có productId trùng nhau", path: ["rows"] });
    if (b.periodStart > b.periodEnd) ctx.addIssue({ code: "custom", message: "periodStart sau periodEnd", path: ["periodStart"] });
  });

export type KalodataBatch = z.infer<typeof kalodataBatchSchema>;
export type KalodataRow = z.infer<typeof kalodataRowSchema>;

/** Chuỗi JSON ổn định (khoá sắp xếp) để cùng nội dung luôn cho cùng mã băm. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Mã băm nội dung batch. Nhập lại cùng file không tạo batch mới. */
export function batchHash(b: KalodataBatch): string {
  // Keep v1 hashes compatible with batches imported before imageUrl existed.
  const payload = b.schemaVersion === 1 ? { ...b, rows: b.rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "imageUrl"))) } : b;
  return createHash("sha256").update(stable(payload)).digest("hex").slice(0, 32);
}
