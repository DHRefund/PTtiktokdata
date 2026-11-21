"use server";

import { logSearch } from "@/lib/history";
import { ENDPOINTS } from "@/lib/tiktoday/endpoints";
import { runEndpoint } from "@/lib/tiktoday/run";
import type { Ack } from "@/lib/result";

export async function getVideoDetails(input: unknown) {
  return runEndpoint(ENDPOINTS["video.details"], input);
}

export async function refreshVideo(id: string): Promise<Ack> {
  const r = await runEndpoint(ENDPOINTS["video.details"], { id, forceRefresh: true });
  return r.ok ? { ok: true } : { ok: false, message: r.error.message };
}

export async function searchVideos(input: unknown) {
  const result = await runEndpoint(ENDPOINTS["video.search"], input);
  if (result.ok && Array.isArray(result.data)) {
    const parsed = ENDPOINTS["video.search"].input.safeParse(input ?? {});
    if (parsed.success) {
      await logSearch({
        kind: "video",
        query: parsed.data.query,
        count: parsed.data.limit,
        resultIds: result.data
          .map((r) => (r as { id?: unknown }).id)
          .filter((x): x is string => typeof x === "string"),
        cacheKey: ENDPOINTS["video.search"].cacheKey(parsed.data),
      });
    }
  }
  return result;
}
