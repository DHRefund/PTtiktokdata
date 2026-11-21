import "server-only";
import { getUser } from "@/lib/auth/session";
import { fail, type ActionResult } from "@/lib/result";
import type { EndpointSpec } from "./endpoints";
import { fetchWithCache } from "./fetch";
import type { z } from "zod";

/**
 * Khuôn chung cho mọi Server Action gọi TikToday:
 * 1. kiểm tra đăng nhập, 2. validate input bằng Zod, 3. fetchWithCache.
 * Không ném lỗi, luôn trả ActionResult (lỗi ném ra từ Server Action bị Next.js che nội dung ở production).
 */
export async function runEndpoint<S extends z.ZodType>(
  spec: EndpointSpec<S>,
  rawInput: unknown,
  extra: { cacheOnly?: boolean } = {},
): Promise<ActionResult<unknown>> {
  const user = await getUser();
  if (!user) return fail("UNAUTHORIZED");

  const parsed = spec.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return fail("INVALID_INPUT", { message: parsed.error.issues[0]?.message ?? "Dữ liệu nhập vào không hợp lệ." });
  }

  const forceRefresh =
    typeof rawInput === "object" && rawInput !== null && (rawInput as { forceRefresh?: unknown }).forceRefresh === true;

  try {
    return await fetchWithCache(spec, parsed.data, { userId: user.userId, forceRefresh, cacheOnly: extra.cacheOnly });
  } catch (e) {
    // Lỗi hạ tầng (Supabase hỏng, thiếu biến môi trường...): ghi log, không lộ chi tiết ra giao diện
    console.error("[tiktoday] lỗi nội bộ", e instanceof Error ? e.message : e);
    return fail("UNKNOWN", { message: "Lỗi nội bộ. Kiểm tra cấu hình Supabase và log của server." });
  }
}
