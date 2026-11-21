"use server";

import { getUser } from "@/lib/auth/session";
import { getQuotaStatus, type QuotaStatus } from "@/lib/cache/quota";
import { db } from "@/lib/db/supabase";
import { bucketUsageByDay, type UsagePoint } from "@/lib/usage";
import { ENDPOINTS } from "@/lib/tiktoday/endpoints";
import { runEndpoint } from "@/lib/tiktoday/run";
import { fail, type ActionResult } from "@/lib/result";

/** Kiểm tra key và kết nối. Không tốn quota, chỉ chịu rate limit. */
export async function checkConnection() {
  return runEndpoint(ENDPOINTS["health.check"], {});
}

export type UsageRow = {
  id: number;
  called_at: string;
  endpoint: string;
  code: string | null;
  http_status: number | null;
  cost: number;
  request_id: string | null;
  duration_ms: number | null;
};

export async function getUsageLog(limit = 50): Promise<ActionResult<UsageRow[]>> {
  const user = await getUser();
  if (!user) return fail("UNAUTHORIZED");
  const n = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
  const { data, error } = await db()
    .from("api_usage")
    .select("id, called_at, endpoint, code, http_status, cost, request_id, duration_ms")
    .order("called_at", { ascending: false })
    .limit(n);
  if (error) return fail("UNKNOWN", { message: "Không đọc được nhật ký API." });
  const now = new Date().toISOString();
  return { ok: true, data: data as UsageRow[], meta: { source: "cache", fetchedAt: now, expiresAt: now, stale: false } };
}

/** Lượt quota đã dùng mỗi ngày trong `days` ngày gần nhất (giờ Việt Nam). */
export async function getUsageByDay(days = 14): Promise<ActionResult<UsagePoint[]>> {
  const user = await getUser();
  if (!user) return fail("UNAUTHORIZED");
  const n = Number.isInteger(days) ? Math.min(Math.max(days, 1), 60) : 14;
  const now = new Date();
  // lấy dư một ngày để không mất lượt ở rìa múi giờ
  const since = new Date(now.getTime() - (n + 1) * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db()
    .from("api_usage")
    .select("called_at, cost")
    .gte("called_at", since)
    .gt("cost", 0)
    .limit(5000);
  if (error) return fail("UNKNOWN", { message: "Không đọc được nhật ký API." });
  const iso = now.toISOString();
  return {
    ok: true,
    data: bucketUsageByDay(data as { called_at: string; cost: number }[], n, now),
    meta: { source: "cache", fetchedAt: iso, expiresAt: iso, stale: false },
  };
}

export async function getDashboardStats(): Promise<ActionResult<QuotaStatus>> {
  const user = await getUser();
  if (!user) return fail("UNAUTHORIZED");
  try {
    const status = await getQuotaStatus();
    const now = new Date().toISOString();
    return { ok: true, data: status, meta: { source: "cache", fetchedAt: now, expiresAt: now, stale: false } };
  } catch (e) {
    console.error("[tiktoday] getDashboardStats lỗi", e instanceof Error ? e.message : e);
    return fail("UNKNOWN", { message: "Không đọc được quota. Kiểm tra cấu hình Supabase và migration." });
  }
}
