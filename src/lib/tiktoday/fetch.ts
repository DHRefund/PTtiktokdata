import "server-only";
import { supabaseCache } from "@/lib/cache/store";
import { supabaseQuota } from "@/lib/cache/quota";
import { callApi } from "./client";
import { createFetcher } from "./core";

/** Điểm duy nhất trong dự án được phép gọi TikToday (cache + quota + retry + sổ). */
export const fetchWithCache = createFetcher({
  cache: supabaseCache,
  quota: supabaseQuota,
  call: (spec, input) => callApi(spec, input),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => new Date(),
  // Một dòng log mỗi lượt. Không bao giờ log API key, mật khẩu, token.
  log: (e) => console.info("[tiktoday]", JSON.stringify(e)),
});
