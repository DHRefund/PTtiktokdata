import "server-only";
import { getUser } from "@/lib/auth/session";
import { db } from "@/lib/db/supabase";

const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

/** Ghi lịch sử tìm kiếm. Lỗi ghi lịch sử không bao giờ được làm hỏng kết quả tìm kiếm. */
export async function logSearch(args: {
  kind: "creator" | "product" | "video";
  query: string;
  count: number;
  resultIds: string[];
  cacheKey: string | null;
}): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;

    // Trang tìm kiếm được vẽ lại nhiều lần (tải lại, quay về, chế độ dev vẽ hai lần): chỉ ghi một dòng
    // cho cùng người, loại, từ khoá và số kết quả trong 10 phút.
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    const { data: dup } = await db()
      .from("search_history")
      .select("id")
      .eq("user_id", user.userId)
      .eq("kind", args.kind)
      .eq("query", args.query)
      .eq("requested_count", args.count)
      .gte("created_at", since)
      .limit(1);
    if (dup && dup.length > 0) return;

    const { error } = await db().from("search_history").insert({
      user_id: user.userId,
      kind: args.kind,
      query: args.query,
      requested_count: args.count,
      result_ids: args.resultIds,
      cache_key: args.cacheKey,
    });
    if (error) console.error("[tiktoday] ghi search_history lỗi", error.message);
  } catch (e) {
    console.error("[tiktoday] ghi search_history lỗi", e instanceof Error ? e.message : e);
  }
}

export type SearchKind = "creator" | "product" | "video";

export type SearchRow = {
  id: number;
  kind: SearchKind;
  query: string;
  requested_count: number | null;
  result_ids: string[];
  cache_key: string | null;
  created_at: string;
  username: string | null;
};

export type CacheState = { expiresAt: string; requestedCount: number | null };

/** Một trang lịch sử, mới nhất trước, kèm tổng số dòng. */
export async function listSearches(args: {
  kind?: SearchKind;
  page: number;
  pageSize: number;
}): Promise<{ rows: SearchRow[]; total: number }> {
  const from = (args.page - 1) * args.pageSize;
  let q = db()
    .from("search_history")
    .select("id, kind, query, requested_count, result_ids, cache_key, created_at, users(username)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + args.pageSize - 1);
  if (args.kind) q = q.eq("kind", args.kind);
  const { data, error, count } = await q;
  if (error) throw new Error(`Đọc search_history lỗi: ${error.message}`);
  const rows = (data ?? []).map((r) => {
    const u = (r as { users?: { username: string } | { username: string }[] | null }).users;
    const username = Array.isArray(u) ? (u[0]?.username ?? null) : (u?.username ?? null);
    return { ...(r as unknown as SearchRow), username };
  });
  return { rows, total: count ?? rows.length };
}

/** Trạng thái cache hiện tại của các khoá tìm kiếm, để biết mở lại có tốn quota hay không. */
export async function cacheStates(keys: string[]): Promise<Map<string, CacheState>> {
  const out = new Map<string, CacheState>();
  const unique = [...new Set(keys)];
  if (unique.length === 0) return out;
  const { data, error } = await db()
    .from("api_cache")
    .select("cache_key, expires_at, requested_count")
    .in("cache_key", unique);
  if (error) return out;
  for (const r of data as { cache_key: string; expires_at: string; requested_count: number | null }[]) {
    out.set(r.cache_key, { expiresAt: r.expires_at, requestedCount: r.requested_count });
  }
  return out;
}

export type ReopenState = { free: boolean; expiresAt: string | null };

/**
 * Mở lại một lần tìm có miễn phí không: cache của nó phải còn hạn và đủ số kết quả cần hiển thị.
 * `countFor` trả số kết quả sẽ được yêu cầu khi mở lại (đã quy về số cho phép trên giao diện).
 */
export async function reopenStates(
  rows: SearchRow[],
  countFor: (r: SearchRow) => number,
): Promise<Map<number, ReopenState>> {
  const states = await cacheStates(rows.map((r) => r.cache_key).filter((k): k is string => !!k));
  const now = Date.now();
  const out = new Map<number, ReopenState>();
  for (const r of rows) {
    const st = r.cache_key ? states.get(r.cache_key) : undefined;
    const free = !!st && new Date(st.expiresAt).getTime() > now && (st.requestedCount ?? 0) >= countFor(r);
    out.set(r.id, { free, expiresAt: st?.expiresAt ?? null });
  }
  return out;
}

export type HistoryRow = { id: number; kind: "creator" | "product" | "video"; query: string; created_at: string };

export async function recentSearches(limit = 8): Promise<HistoryRow[]> {
  const { data, error } = await db()
    .from("search_history")
    .select("id, kind, query, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data as HistoryRow[];
}
