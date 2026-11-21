import "server-only";
import { db } from "@/lib/db/supabase";

export type ReserveArgs = {
  userId: string | null;
  endpoint: string;
  cacheKey: string | null;
  cost: number;
};

export type ReserveResult =
  | { ok: true; usageId: number; usedToday: number; usedCycle: number }
  | {
      ok: false;
      reason: "RATE_SECOND" | "RATE_MINUTE" | "QUOTA_DAY" | "QUOTA_CYCLE";
      retryAfterMs: number;
      usedToday: number;
      usedCycle: number;
    };

export type FinishArgs = {
  usageId: number;
  httpStatus: number;
  code: string;
  requestId?: string;
  counted: boolean;
  durationMs: number;
};

export interface QuotaStore {
  reserve(args: ReserveArgs): Promise<ReserveResult>;
  finish(args: FinishArgs): Promise<void>;
}

type ReserveRow = {
  ok: boolean;
  usage_id: number | null;
  reason: string | null;
  retry_after_ms: number;
  used_today: number;
  used_cycle: number;
};

export const supabaseQuota: QuotaStore = {
  async reserve(a) {
    const { data, error } = await db().rpc("reserve_quota", {
      p_user: a.userId,
      p_endpoint: a.endpoint,
      p_cache_key: a.cacheKey,
      p_cost: a.cost,
    });
    if (error) throw new Error(`reserve_quota lỗi: ${error.message}`);
    const row = (data as ReserveRow[])[0];
    if (!row) throw new Error("reserve_quota không trả về dòng nào");
    if (row.ok && row.usage_id !== null) {
      return { ok: true, usageId: Number(row.usage_id), usedToday: row.used_today, usedCycle: row.used_cycle };
    }
    return {
      ok: false,
      reason: row.reason as Extract<ReserveResult, { ok: false }>["reason"],
      retryAfterMs: row.retry_after_ms,
      usedToday: row.used_today,
      usedCycle: row.used_cycle,
    };
  },

  async finish(a) {
    const { error } = await db().rpc("finish_usage", {
      p_id: a.usageId,
      p_http_status: a.httpStatus,
      p_code: a.code,
      p_request_id: a.requestId ?? null,
      p_counted: a.counted,
      p_duration_ms: a.durationMs,
    });
    if (error) throw new Error(`finish_usage lỗi: ${error.message}`);
  },
};

export type QuotaStatus = {
  usedToday: number;
  usedCycle: number;
  limitDay: number;
  limitCycle: number;
  limitSecond: number;
  limitMinute: number;
  dayResetsAt: string;
  cycleResetsAt: string;
};

export async function getQuotaStatus(): Promise<QuotaStatus> {
  const { data, error } = await db().rpc("get_quota_status");
  if (error) throw new Error(`get_quota_status lỗi: ${error.message}`);
  const r = (data as Record<string, number | string>[])[0];
  return {
    usedToday: Number(r.used_today),
    usedCycle: Number(r.used_cycle),
    limitDay: Number(r.limit_day),
    limitCycle: Number(r.limit_cycle),
    limitSecond: Number(r.limit_second),
    limitMinute: Number(r.limit_minute),
    dayResetsAt: String(r.day_resets_at),
    cycleResetsAt: String(r.cycle_resets_at),
  };
}
