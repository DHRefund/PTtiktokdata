"use server";

import { logSearch } from "@/lib/history";
import { ENDPOINTS } from "@/lib/tiktoday/endpoints";
import { runEndpoint } from "@/lib/tiktoday/run";
import type { Ack } from "@/lib/result";

export async function searchProducts(input: unknown) {
  const result = await runEndpoint(ENDPOINTS["product.search"], input);
  if (result.ok && Array.isArray(result.data)) {
    const parsed = ENDPOINTS["product.search"].input.safeParse(input ?? {});
    if (parsed.success) {
      await logSearch({
        kind: "product",
        query: parsed.data.query,
        count: parsed.data.limit,
        resultIds: result.data
          .map((r) => (r as { product_id?: unknown }).product_id)
          .filter((x): x is string => typeof x === "string"),
        cacheKey: ENDPOINTS["product.search"].cacheKey(parsed.data),
      });
    }
  }
  return result;
}

export async function getProductDetails(input: unknown) {
  return runEndpoint(ENDPOINTS["product.details"], input);
}

export async function refreshProduct(id: string): Promise<Ack> {
  const r = await runEndpoint(ENDPOINTS["product.details"], { id, forceRefresh: true });
  return r.ok ? { ok: true } : { ok: false, message: r.error.message };
}
