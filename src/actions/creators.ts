"use server";

import { getUser } from "@/lib/auth/session";
import { supabaseCache } from "@/lib/cache/store";
import { logSearch } from "@/lib/history";
import { ENDPOINTS } from "@/lib/tiktoday/endpoints";
import { runEndpoint } from "@/lib/tiktoday/run";
import { handleInput } from "@/lib/tiktoday/schemas";
import { fail, type ActionResult, type Ack } from "@/lib/result";

/** Số video tải cho một creator. Dùng cố định để bản cache luôn khớp với lần tra cache. */
const CREATOR_VIDEOS_LIMIT = 20;

export async function getCreatorProfile(input: unknown) {
  return runEndpoint(ENDPOINTS["creator.profile"], input);
}

export async function getCreatorAffiliate(input: unknown) {
  return runEndpoint(ENDPOINTS["creator.affiliate"], input);
}

export async function getCreatorVideos(input: unknown) {
  return runEndpoint(ENDPOINTS["creator.videos"], input);
}

/** Chỉ đọc cache, không bao giờ tốn quota. Trả NOT_CACHED nếu chưa có. */
export async function getCreatorAffiliateCached(input: unknown) {
  return runEndpoint(ENDPOINTS["creator.affiliate"], input, { cacheOnly: true });
}

export async function getCreatorVideosCached(input: unknown) {
  const handle = (input as { handle?: unknown } | null)?.handle;
  return runEndpoint(ENDPOINTS["creator.videos"], { handle, limit: CREATOR_VIDEOS_LIMIT }, { cacheOnly: true });
}

function ack(r: ActionResult<unknown>): Ack {
  return r.ok ? { ok: true } : { ok: false, message: r.error.message };
}

/** Nút "Tải..." và "Làm mới" của trang creator. Chỉ trả kết quả gọn, trang tự đọc lại từ cache. */
export async function loadCreatorSection(
  handle: string,
  section: "profile" | "affiliate" | "videos",
  force = false,
): Promise<Ack> {
  const forceRefresh = force;
  if (section === "videos") {
    return ack(await runEndpoint(ENDPOINTS["creator.videos"], { handle, limit: CREATOR_VIDEOS_LIMIT, forceRefresh }));
  }
  const spec = section === "profile" ? ENDPOINTS["creator.profile"] : ENDPOINTS["creator.affiliate"];
  return ack(await runEndpoint(spec, { handle, forceRefresh }));
}

export async function searchCreators(input: unknown) {
  const result = await runEndpoint(ENDPOINTS["creator.search"], input);
  if (result.ok && Array.isArray(result.data)) {
    const parsed = ENDPOINTS["creator.search"].input.safeParse(input ?? {});
    if (parsed.success) {
      await logSearch({
        kind: "creator",
        query: parsed.data.keyword,
        count: parsed.data.count,
        resultIds: result.data
          .map((r) => (r as { handle?: unknown }).handle)
          .filter((h): h is string => typeof h === "string"),
        cacheKey: ENDPOINTS["creator.search"].cacheKey(parsed.data),
      });
    }
  }
  return result;
}

export type CreatorOverview = {
  profile: ActionResult<unknown>;
  affiliate: ActionResult<unknown>;
};

/**
 * Gộp hồ sơ TikTok và hồ sơ affiliate (tối đa 2 quota). Gọi tuần tự vì rate limit 2 lượt/giây.
 * Một bên lỗi vẫn trả bên còn lại. Dùng ở trang thử nghiệm /explore.
 */
export async function getCreatorOverview(input: unknown): Promise<ActionResult<CreatorOverview>> {
  const user = await getUser();
  if (!user) return fail("UNAUTHORIZED");
  const parsed = handleInput.safeParse(input ?? {});
  if (!parsed.success) {
    return fail("INVALID_INPUT", { message: parsed.error.issues[0]?.message });
  }
  const profile = await runEndpoint(ENDPOINTS["creator.profile"], input);
  const affiliate = await runEndpoint(ENDPOINTS["creator.affiliate"], input);

  const meta = profile.meta ?? affiliate.meta;
  if (!meta) {
    // Cả hai đều lỗi và không có meta (ví dụ hết quota, chưa có cache): trả lỗi của profile
    return profile.ok ? fail("UNKNOWN") : fail(profile.error.code, profile.error);
  }
  return { ok: true, data: { profile, affiliate }, meta };
}

/** Báo trước sẽ tốn bao nhiêu quota để xem hồ sơ đầy đủ. Chỉ đọc cache, không tốn quota. */
export async function previewCreatorOverviewCost(
  input: unknown,
): Promise<ActionResult<{ cost: number; cached: string[]; missing: string[] }>> {
  const user = await getUser();
  if (!user) return fail("UNAUTHORIZED");
  const parsed = handleInput.safeParse(input ?? {});
  if (!parsed.success) {
    return fail("INVALID_INPUT", { message: parsed.error.issues[0]?.message });
  }

  const keys = [ENDPOINTS["creator.profile"], ENDPOINTS["creator.affiliate"]] as const;
  const cached: string[] = [];
  const missing: string[] = [];
  const now = Date.now();
  try {
    for (const spec of keys) {
      const row = await supabaseCache.get(spec.cacheKey(parsed.data));
      const fresh = row && new Date(row.expires_at).getTime() > now;
      (fresh ? cached : missing).push(spec.key);
    }
  } catch {
    return fail("UNKNOWN", { message: "Không đọc được cache." });
  }
  const nowIso = new Date().toISOString();
  return {
    ok: true,
    data: { cost: missing.length, cached, missing },
    meta: { source: "cache", fetchedAt: nowIso, expiresAt: nowIso, stale: false },
  };
}
