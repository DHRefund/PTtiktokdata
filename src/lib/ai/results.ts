import "server-only";
import { db } from "@/lib/db/supabase";
import type { AiKind } from "./schemas";

export type StoredResult<T> = { result: T; model: string; createdAt: string };

type Row = { result: unknown; model: string; created_at: string };

const toStored = <T>(r: Row): StoredResult<T> => ({ result: r.result as T, model: r.model, createdAt: r.created_at });

/** Kết quả AI đã lưu cho đúng dữ liệu đầu vào này (cùng mã băm). */
export async function getAiResult<T>(kind: AiKind, subject: string, hash: string): Promise<StoredResult<T> | null> {
  const { data, error } = await db()
    .from("ai_results")
    .select("result, model, created_at")
    .eq("kind", kind)
    .eq("subject", subject)
    .eq("input_hash", hash)
    .maybeSingle();
  if (error || !data) return null;
  return toStored<T>(data as Row);
}

/** Kết quả mới nhất cho một đối tượng, dù dữ liệu đầu vào có đổi hay không. Dùng để hiển thị sẵn khi mở trang. */
export async function latestAiResult<T>(kind: AiKind, subject: string): Promise<StoredResult<T> | null> {
  const { data, error } = await db()
    .from("ai_results")
    .select("result, model, created_at")
    .eq("kind", kind)
    .eq("subject", subject)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return toStored<T>(data[0] as Row);
}

export async function saveAiResult(args: {
  userId: string | null;
  kind: AiKind;
  subject: string;
  hash: string;
  model: string;
  result: unknown;
}): Promise<void> {
  const { error } = await db()
    .from("ai_results")
    .upsert(
      { user_id: args.userId, kind: args.kind, subject: args.subject, input_hash: args.hash, model: args.model, result: args.result },
      { onConflict: "kind,subject,input_hash" },
    );
  if (error) console.error("[ai] lưu ai_results lỗi", error.message);
}
