import "server-only";
import { db } from "@/lib/db/supabase";

export type CacheRow = {
  cache_key: string;
  endpoint: string;
  params: unknown;
  status: "ok" | "not_found";
  response: unknown; // trường `data` của response TikToday (null khi not_found)
  requested_count: number | null;
  request_id: string | null;
  parser_version: number;
  fetched_at: string;
  expires_at: string;
};

export interface CacheStore {
  get(key: string): Promise<CacheRow | null>;
  put(row: CacheRow): Promise<void>;
}

export const supabaseCache: CacheStore = {
  async get(key) {
    const { data, error } = await db().from("api_cache").select("*").eq("cache_key", key).maybeSingle();
    if (error) throw new Error(`Đọc api_cache lỗi: ${error.message}`);
    return (data as CacheRow | null) ?? null;
  },
  async put(row) {
    const { error } = await db().from("api_cache").upsert(row, { onConflict: "cache_key" });
    if (error) throw new Error(`Ghi api_cache lỗi: ${error.message}`);
  },
};
