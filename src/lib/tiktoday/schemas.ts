import { z } from "zod";

/** Handle TikTok: bỏ @ đầu, chữ thường, tối đa 24 ký tự gồm chữ, số, _ và . */
export const handleSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/^@/, "").toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9_.]{1,24}$/, "Handle chỉ gồm chữ, số, _ và ., tối đa 24 ký tự"));

export const productIdSchema = z
  .string()
  .trim()
  .regex(/^\d{1,30}$/, "Id sản phẩm chỉ gồm chữ số");

export const videoIdSchema = z
  .string()
  .trim()
  .regex(/^\d{1,20}$/, "Id video chỉ gồm chữ số, tối đa 20 ký tự");

const countSchema = z.number().int().min(1).max(50);

export const noInput = z.object({});
export const handleInput = z.object({ handle: handleSchema });

export const creatorSearchInput = z.object({
  keyword: z.string().trim().max(200).default(""),
  count: countSchema.default(20),
});

export const creatorVideosInput = z.object({
  handle: handleSchema,
  limit: countSchema.default(20),
  since: z.number().int().positive().optional(),
});

export const productDetailsInput = z.object({ id: productIdSchema });
export const videoDetailsInput = z.object({ id: videoIdSchema });

export const querySearchInput = z.object({
  query: z.string().trim().min(1, "Cần nhập từ khoá").max(200),
  limit: countSchema.default(20),
});
