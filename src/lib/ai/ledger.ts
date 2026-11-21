import "server-only";
import { db } from "@/lib/db/supabase";
import { aiConfig } from "./config";
import { estimateCostUsd, type Usage } from "./pricing";

export class AiBudgetExceededError extends Error {
  constructor(
    public readonly spentUsd: number,
    public readonly budgetUsd: number,
  ) {
    super(`Đã hết trần chi phí AI hôm nay (${spentUsd.toFixed(4)} / ${budgetUsd.toFixed(2)} USD)`);
    this.name = "AiBudgetExceededError";
  }
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });

/** 00:00 hôm nay theo giờ Việt Nam (UTC+7, không có giờ mùa hè), dạng ISO. */
export function vnDayStartIso(now: Date): string {
  return new Date(`${dayKey.format(now)}T00:00:00+07:00`).toISOString();
}

export function isOverBudget(spentUsd: number, budgetUsd: number): boolean {
  return spentUsd >= budgetUsd;
}

/** Tổng chi phí AI hôm nay (USD) và số lượt gọi. */
export async function aiSpendToday(now = new Date()): Promise<{ usd: number; calls: number }> {
  const { data, error } = await db()
    .from("ai_usage")
    .select("cost_usd")
    .gte("created_at", vnDayStartIso(now))
    .limit(5000);
  if (error) throw new Error(`Đọc ai_usage lỗi: ${error.message}`);
  const rows = data as { cost_usd: number | string | null }[];
  return { usd: rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0), calls: rows.length };
}

/** Ném AiBudgetExceededError nếu hôm nay đã chi quá trần. Gọi trước mỗi lượt dùng model. */
export async function assertAiBudget(): Promise<void> {
  const budget = aiConfig().dailyBudgetUsd;
  const { usd } = await aiSpendToday();
  if (isOverBudget(usd, budget)) throw new AiBudgetExceededError(usd, budget);
}

/** Ghi một lượt gọi model vào sổ. Lỗi ghi sổ không được làm hỏng kết quả cho người dùng. */
export async function recordAiUsage(args: {
  userId: string | null;
  feature: string;
  model: string;
  usage: Usage | null;
  status: "ok" | "error" | "refused";
  durationMs: number;
}): Promise<number> {
  const cost = args.usage ? estimateCostUsd(args.model, args.usage) : 0;
  try {
    const { error } = await db().from("ai_usage").insert({
      user_id: args.userId,
      feature: args.feature,
      model: args.model,
      input_tokens: args.usage?.input_tokens ?? 0,
      output_tokens: args.usage?.output_tokens ?? 0,
      cache_read_tokens: args.usage?.cache_read_input_tokens ?? 0,
      cache_write_tokens: args.usage?.cache_creation_input_tokens ?? 0,
      cost_usd: cost,
      status: args.status,
      duration_ms: args.durationMs,
    });
    if (error) console.error("[ai] ghi ai_usage lỗi", error.message);
  } catch (e) {
    console.error("[ai] ghi ai_usage lỗi", e instanceof Error ? e.message : e);
  }
  return cost ?? 0;
}
