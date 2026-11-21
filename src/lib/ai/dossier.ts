import "server-only";
import { supabaseCache } from "@/lib/cache/store";
import { normalizeHandle, normalizeKeyword } from "@/lib/cache/keys";
import { db } from "@/lib/db/supabase";
import { asData, asList, type CreatorAffiliate, type CreatorProfile, type VideoItem } from "@/lib/tiktoday/types";
import { slimAffiliate, slimProfile, slimVideo } from "./shape";

// Đọc dữ liệu AI cần từ cache (api_cache), không bao giờ gọi TikToday nên không tốn quota.

export type CreatorDossier = {
  handle: string;
  profile?: ReturnType<typeof slimProfile>;
  affiliate?: ReturnType<typeof slimAffiliate>;
  videos?: ReturnType<typeof slimVideo>[];
  /** Thời điểm lấy từng phần dữ liệu, để người dùng biết AI dựa trên dữ liệu cũ hay mới. */
  data_as_of: { profile?: string; affiliate?: string; videos?: string };
};

const CREATOR_VIDEOS_LIMIT = 20;

async function creatorSearchItem(handle: string): Promise<{ item: CreatorAffiliate; fetchedAt: string } | null> {
  // Kết quả tìm creator cũng chứa số liệu bán hàng, dùng làm nguồn dự phòng khi chưa tải creator.affiliate
  const { data, error } = await db()
    .from("api_cache")
    .select("response, fetched_at")
    .eq("endpoint", "creator.search")
    .eq("status", "ok")
    .contains("response", [{ handle }])
    .order("fetched_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  const item = asList<CreatorAffiliate>(data[0].response).find((c) => c.handle?.toLowerCase() === handle);
  return item ? { item, fetchedAt: String(data[0].fetched_at) } : null;
}

/** Gom mọi dữ liệu đã lưu về một creator. Trả null nếu hoàn toàn chưa có gì. */
export async function loadCreatorDossier(rawHandle: string): Promise<CreatorDossier | null> {
  const handle = normalizeHandle(rawHandle);
  const [profileRow, affiliateRow, videosRow] = await Promise.all([
    supabaseCache.get(`creator.profile:${handle}`),
    supabaseCache.get(`creator.affiliate:${handle}`),
    supabaseCache.get(`creator.videos:${handle}:`),
  ]);

  const dossier: CreatorDossier = { handle, data_as_of: {} };

  if (profileRow?.status === "ok" && profileRow.response) {
    const p = asData<CreatorProfile>(profileRow.response);
    if (p.handle?.toLowerCase() === handle) {
      dossier.profile = slimProfile(p);
      dossier.data_as_of.profile = profileRow.fetched_at;
    }
  }

  // TikToday từng trả hồ sơ của người khác khi creator không có dữ liệu affiliate: chỉ nhận nếu handle khớp
  if (affiliateRow?.status === "ok" && affiliateRow.response) {
    const a = asData<CreatorAffiliate>(affiliateRow.response);
    if (a.handle?.toLowerCase() === handle) {
      dossier.affiliate = slimAffiliate(a);
      dossier.data_as_of.affiliate = affiliateRow.fetched_at;
    }
  }
  if (!dossier.affiliate) {
    const fromSearch = await creatorSearchItem(handle);
    if (fromSearch) {
      dossier.affiliate = slimAffiliate(fromSearch.item);
      dossier.data_as_of.affiliate = fromSearch.fetchedAt;
    }
  }

  if (videosRow?.status === "ok" && videosRow.response) {
    dossier.videos = asList<VideoItem>(videosRow.response).slice(0, CREATOR_VIDEOS_LIMIT).map(slimVideo);
    dossier.data_as_of.videos = videosRow.fetched_at;
  }

  return dossier.profile || dossier.affiliate ? dossier : null;
}

export type VideoSet = { query: string; videos: ReturnType<typeof slimVideo>[]; data_as_of: string };

/** Kết quả tìm video đã lưu cho một từ khoá (đúng thứ thấy trên trang Video). */
export async function loadCachedVideoSearch(query: string, limit: number): Promise<VideoSet | null> {
  const row = await supabaseCache.get(`video.search:${normalizeKeyword(query)}`);
  if (!row || row.status !== "ok") return null;
  const videos = asList<VideoItem>(row.response).slice(0, limit).map(slimVideo);
  return videos.length ? { query, videos, data_as_of: row.fetched_at } : null;
}
