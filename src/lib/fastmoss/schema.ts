import { z } from "zod";
const text = z.string().trim().min(1).max(1000).refine(v => !v.includes("****"));
const id = z.string().regex(/^\d{10,25}$/);
export const fastmossBatchSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]), source: z.literal("fastmoss"), sourceUrl: z.string().url(),
  collectedOn: z.iso.date(), market: z.literal("VN"), currency: z.literal("VND"),
  periodStart: z.iso.date(), periodEnd: z.iso.date(), periodType: z.literal("daily"),
  collectionMethod: text, precision: z.literal("display-rounded"), sortVerified: z.boolean(),
  rows: z.array(z.object({
    rank: z.number().int().min(1).max(10), name: text, shop: text, category: text,
    price: text, sold: text, growth: text, gmv: text, totalSold: text, totalGmv: text,
    commission: text.nullable(), sourceProductId: id, shopId: id,
    needsReview: z.boolean(),
    imageUrl: z.string().url().startsWith("https://s.500fd.com/").nullable().optional().default(null),
  }).strict()).min(1).max(10),
}).strict().superRefine((b,c) => {
  if(b.periodStart!==b.periodEnd) c.addIssue({code:"custom",message:"Daily batch requires same start/end"});
  if(new Set(b.rows.map(r=>r.rank)).size!==b.rows.length || new Set(b.rows.map(r=>r.sourceProductId)).size!==b.rows.length)
    c.addIssue({code:"custom",message:"Duplicate rank or external ID"});
});
export type FastmossBatch = z.infer<typeof fastmossBatchSchema>;
