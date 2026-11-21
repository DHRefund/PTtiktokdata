"use server";

import { z } from "zod";
import { getUser } from "@/lib/auth/session";
import { aiConfig } from "@/lib/ai/config";
import { loadCachedVideoSearch, loadCreatorDossier, type CreatorDossier } from "@/lib/ai/dossier";
import { aiFail, type AiResult } from "@/lib/ai/errors";
import { aiSpendToday } from "@/lib/ai/ledger";
import {
  COMPARE_SYSTEM,
  CREATOR_BRIEF_SYSTEM,
  OUTREACH_SYSTEM,
  PROMPT_VERSION,
  VIDEO_INSIGHTS_SYSTEM,
} from "@/lib/ai/prompts";
import { getAiResult, latestAiResult, saveAiResult, type StoredResult } from "@/lib/ai/results";
import { runStructured, toAiError } from "@/lib/ai/run";
import {
  compareSchema,
  creatorBriefSchema,
  outreachSchema,
  videoInsightsSchema,
  type AiKind,
  type Comparison,
  type CreatorBrief,
  type Outreach,
  type VideoInsights,
} from "@/lib/ai/schemas";
import { hashInput } from "@/lib/ai/shape";
import { searchHotProducts, type HotProductsResult } from "@/lib/ai/web";
import { handleSchema } from "@/lib/tiktoday/schemas";

const productSchema = z.string().trim().max(600).default("");
const toneSchema = z.enum(["than_thien", "chuyen_nghiep"]).default("than_thien");

/** Dùng lại kết quả đã lưu nếu dữ liệu đầu vào không đổi, ngược lại gọi model rồi lưu. */
async function cachedOrRun<T>(args: {
  kind: AiKind;
  subject: string;
  hash: string;
  force: boolean;
  model: string;
  userId: string;
  produce: () => Promise<{ data: T; costUsd: number }>;
}): Promise<AiResult<T>> {
  if (!args.force) {
    const hit = await getAiResult<T>(args.kind, args.subject, args.hash);
    if (hit) return { ok: true, data: hit.result, meta: { cached: true, model: hit.model, createdAt: hit.createdAt, costUsd: 0 } };
  }
  const { data, costUsd } = await args.produce();
  await saveAiResult({ userId: args.userId, kind: args.kind, subject: args.subject, hash: args.hash, model: args.model, result: data });
  return { ok: true, data, meta: { cached: false, model: args.model, createdAt: new Date().toISOString(), costUsd } };
}

/** Kiểm tra chung: đã đăng nhập và đã cấu hình khoá AI. */
async function gate(): Promise<{ userId: string } | AiResult<never>> {
  const user = await getUser();
  if (!user) return aiFail("INVALID_INPUT", "Bạn chưa đăng nhập hoặc phiên đã hết hạn.");
  if (!aiConfig().configured) return aiFail("NOT_CONFIGURED");
  return { userId: user.userId };
}

const wrap = (label: string, payload: unknown) => `${label}:\n<du_lieu>\n${JSON.stringify(payload)}\n</du_lieu>`;

// ---------- Phân tích creator ----------

export async function analyzeCreator(handleIn: unknown, productIn?: unknown, forceIn?: unknown): Promise<AiResult<CreatorBrief>> {
  const g = await gate();
  if ("ok" in g) return g;
  const handle = handleSchema.safeParse(handleIn);
  const product = productSchema.safeParse(productIn ?? "");
  if (!handle.success || !product.success) return aiFail("INVALID_INPUT");

  try {
    const dossier = await loadCreatorDossier(handle.data);
    if (!dossier) return aiFail("NO_DATA");
    const model = aiConfig().fast;
    return await cachedOrRun<CreatorBrief>({
      kind: "creator_brief",
      subject: handle.data,
      hash: hashInput({ v: PROMPT_VERSION, dossier, product: product.data }),
      force: forceIn === true,
      model,
      userId: g.userId,
      produce: () =>
        runStructured({
          feature: "creator_brief",
          model,
          system: CREATOR_BRIEF_SYSTEM,
          user: `${wrap("Dữ liệu creator (JSON)", dossier)}\n\nSản phẩm hoặc thương hiệu của tôi: ${product.data || "(chưa nêu, hãy đánh giá chung)"}\n\nHãy đánh giá creator này.`,
          schema: creatorBriefSchema,
          userId: g.userId,
        }),
    });
  } catch (e) {
    const err = toAiError(e);
    return aiFail(err.code, err.message);
  }
}

// ---------- Soạn tin nhắn mời hợp tác ----------

export async function draftOutreach(handleIn: unknown, productIn: unknown, toneIn?: unknown, forceIn?: unknown): Promise<AiResult<Outreach>> {
  const g = await gate();
  if ("ok" in g) return g;
  const handle = handleSchema.safeParse(handleIn);
  const product = productSchema.safeParse(productIn ?? "");
  const tone = toneSchema.safeParse(toneIn ?? undefined);
  if (!handle.success || !product.success || !tone.success) return aiFail("INVALID_INPUT");
  if (!product.data) return aiFail("INVALID_INPUT", "Hãy mô tả sản phẩm hoặc thương hiệu của bạn để AI viết tin nhắn.");

  try {
    const dossier = await loadCreatorDossier(handle.data);
    if (!dossier) return aiFail("NO_DATA");
    const model = aiConfig().fast;
    const toneText = tone.data === "chuyen_nghiep" ? "chuyên nghiệp, trang trọng vừa phải" : "thân thiện, gần gũi";
    return await cachedOrRun<Outreach>({
      kind: "outreach",
      subject: handle.data,
      hash: hashInput({ v: PROMPT_VERSION, dossier, product: product.data, tone: tone.data }),
      force: forceIn === true,
      model,
      userId: g.userId,
      produce: () =>
        runStructured({
          feature: "outreach",
          model,
          system: OUTREACH_SYSTEM,
          user: `${wrap("Dữ liệu creator (JSON)", dossier)}\n\nSản phẩm hoặc thương hiệu của tôi: ${product.data}\nGiọng văn: ${toneText}\n\nHãy soạn tin nhắn mời hợp tác.`,
          schema: outreachSchema,
          userId: g.userId,
          effort: "low",
        }),
    });
  } catch (e) {
    const err = toAiError(e);
    return aiFail(err.code, err.message);
  }
}

// ---------- So sánh creator ----------

const handlesSchema = z.array(handleSchema).min(2).max(3);

export async function compareCreators(handlesIn: unknown, productIn?: unknown, forceIn?: unknown): Promise<AiResult<Comparison>> {
  const g = await gate();
  if ("ok" in g) return g;
  const parsed = handlesSchema.safeParse(handlesIn);
  const product = productSchema.safeParse(productIn ?? "");
  if (!parsed.success || !product.success) return aiFail("INVALID_INPUT", "Chọn từ 2 đến 3 creator để so sánh.");
  const handles = [...new Set(parsed.data)].sort();
  if (handles.length < 2) return aiFail("INVALID_INPUT", "Chọn từ 2 đến 3 creator khác nhau để so sánh.");

  try {
    const dossiers = await Promise.all(handles.map((h) => loadCreatorDossier(h)));
    const missing = handles.filter((_, i) => !dossiers[i]);
    if (missing.length) return aiFail("NO_DATA", `Chưa có dữ liệu đã lưu cho: ${missing.map((m) => "@" + m).join(", ")}. Hãy mở hồ sơ của họ trước.`);
    const have = dossiers as CreatorDossier[];
    const model = aiConfig().smart;
    return await cachedOrRun<Comparison>({
      kind: "compare",
      subject: handles.join("|"),
      hash: hashInput({ v: PROMPT_VERSION, have, product: product.data }),
      force: forceIn === true,
      model,
      userId: g.userId,
      produce: () =>
        runStructured({
          feature: "compare",
          model,
          system: COMPARE_SYSTEM,
          user: `${wrap("Dữ liệu các creator (JSON)", have)}\n\nSản phẩm hoặc thương hiệu của tôi: ${product.data || "(chưa nêu, hãy so sánh chung)"}\n\nHãy so sánh và xếp hạng.`,
          schema: compareSchema,
          userId: g.userId,
        }),
    });
  } catch (e) {
    const err = toAiError(e);
    return aiFail(err.code, err.message);
  }
}

// ---------- Phân tích video ----------

const videoQuerySchema = z.object({ query: z.string().trim().min(1).max(200), limit: z.number().int().min(1).max(50).default(20) });

export async function analyzeVideos(queryIn: unknown, limitIn?: unknown, forceIn?: unknown): Promise<AiResult<VideoInsights>> {
  const g = await gate();
  if ("ok" in g) return g;
  const parsed = videoQuerySchema.safeParse({ query: queryIn, limit: limitIn ?? 20 });
  if (!parsed.success) return aiFail("INVALID_INPUT");

  try {
    const set = await loadCachedVideoSearch(parsed.data.query, parsed.data.limit);
    if (!set) return aiFail("NO_DATA", "Chưa có kết quả tìm video đã lưu cho từ khoá này. Hãy tìm video trước.");
    const model = aiConfig().smart;
    return await cachedOrRun<VideoInsights>({
      kind: "video_insights",
      subject: parsed.data.query.toLowerCase(),
      hash: hashInput({ v: PROMPT_VERSION, set }),
      force: forceIn === true,
      model,
      userId: g.userId,
      produce: () =>
        runStructured({
          feature: "video_insights",
          model,
          system: VIDEO_INSIGHTS_SYSTEM,
          user: `${wrap(`Các video tìm được cho từ khoá "${set.query}" (JSON)`, set.videos)}\n\nHãy rút quy luật nội dung và đề xuất brief video.`,
          schema: videoInsightsSchema,
          userId: g.userId,
        }),
    });
  } catch (e) {
    const err = toAiError(e);
    return aiFail(err.code, err.message);
  }
}

// ---------- Đọc kết quả đã lưu (không tốn tiền) ----------

export type SavedAi<T> = StoredResult<T> | null;

export async function getSavedCreatorBrief(handle: string): Promise<SavedAi<CreatorBrief>> {
  if (!(await getUser())) return null;
  return latestAiResult<CreatorBrief>("creator_brief", handle);
}

export async function getSavedOutreach(handle: string): Promise<SavedAi<Outreach>> {
  if (!(await getUser())) return null;
  return latestAiResult<Outreach>("outreach", handle);
}

export async function getSavedComparison(handles: string[]): Promise<SavedAi<Comparison>> {
  if (!(await getUser())) return null;
  return latestAiResult<Comparison>("compare", [...new Set(handles)].sort().join("|"));
}

export async function getSavedVideoInsights(query: string): Promise<SavedAi<VideoInsights>> {
  if (!(await getUser())) return null;
  return latestAiResult<VideoInsights>("video_insights", query.trim().toLowerCase());
}

/** Chi phí AI hôm nay và trần, cho Tổng quan. */
export async function getAiSpend(): Promise<{ configured: boolean; usd: number; calls: number; budgetUsd: number } | null> {
  if (!(await getUser())) return null;
  const cfg = aiConfig();
  try {
    const { usd, calls } = await aiSpendToday();
    return { configured: cfg.configured, usd, calls, budgetUsd: cfg.dailyBudgetUsd };
  } catch {
    return { configured: cfg.configured, usd: 0, calls: 0, budgetUsd: cfg.dailyBudgetUsd };
  }
}

// ---------- Sản phẩm hot (tìm web bằng Gemini) ----------

// Rỗng = tìm chung trên TikTok, không giới hạn ngách
const hotQuerySchema = z.string().trim().max(80, "Tối đa 80 ký tự").refine((v) => v === "" || v.length >= 2, "Nhập ít nhất 2 ký tự");

/** Không lưu cache: kết quả web thay đổi theo ngày và mỗi lượt tìm Google tính vào hạn mức của Gemini. */
export async function findHotProducts(queryIn: unknown = ""): Promise<AiResult<HotProductsResult>> {
  const user = await getUser();
  if (!user) return aiFail("INVALID_INPUT", "Bạn chưa đăng nhập hoặc phiên đã hết hạn.");
  const q = hotQuerySchema.safeParse(queryIn);
  if (!q.success) return aiFail("INVALID_INPUT", q.error.issues[0]?.message);
  try {
    const data = await searchHotProducts({ query: q.data, userId: user.userId });
    return { ok: true, data, meta: { cached: false, model: data.model, createdAt: new Date().toISOString(), costUsd: data.costUsd } };
  } catch (e) {
    const err = toAiError(e);
    return aiFail(err.code, err.message);
  }
}
