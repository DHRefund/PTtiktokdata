import { describe, expect, it } from "vitest";
import { normalizeKeyword } from "@/lib/cache/keys";
import { ENDPOINTS } from "./endpoints";
import { creatorSearchInput, handleInput, videoDetailsInput } from "./schemas";

describe("handleInput", () => {
  it("bỏ @ đầu và chuyển chữ thường", () => {
    expect(handleInput.parse({ handle: "  @Example.Creator " }).handle).toBe("example.creator");
  });
  it("từ chối handle quá 24 ký tự hoặc có ký tự lạ", () => {
    expect(handleInput.safeParse({ handle: "a".repeat(25) }).success).toBe(false);
    expect(handleInput.safeParse({ handle: "a b" }).success).toBe(false);
    expect(handleInput.safeParse({ handle: "a/../b" }).success).toBe(false);
    expect(handleInput.safeParse({ handle: "" }).success).toBe(false);
  });
});

describe("creatorSearchInput", () => {
  it("mặc định count = 20, keyword rỗng", () => {
    expect(creatorSearchInput.parse({})).toEqual({ keyword: "", count: 20 });
  });
  it("count phải từ 1 đến 50", () => {
    expect(creatorSearchInput.safeParse({ count: 51 }).success).toBe(false);
    expect(creatorSearchInput.safeParse({ count: 0 }).success).toBe(false);
  });
});

describe("videoDetailsInput", () => {
  it("id chỉ gồm chữ số, tối đa 20", () => {
    expect(videoDetailsInput.safeParse({ id: "7400000000000000001" }).success).toBe(true);
    expect(videoDetailsInput.safeParse({ id: "abc" }).success).toBe(false);
    expect(videoDetailsInput.safeParse({ id: "1".repeat(21) }).success).toBe(false);
  });
});

describe("cache key", () => {
  it("chuẩn hoá từ khoá search", () => {
    expect(normalizeKeyword("  Beauty   Care ")).toBe("beauty care");
    const spec = ENDPOINTS["creator.search"];
    expect(spec.cacheKey({ keyword: "Beauty ", count: 50 })).toBe(spec.cacheKey({ keyword: "beauty", count: 20 }));
  });
  it("video của creator có cache key theo since", () => {
    const spec = ENDPOINTS["creator.videos"];
    expect(spec.cacheKey({ handle: "a", limit: 20 })).toBe("creator.videos:a:");
    expect(spec.cacheKey({ handle: "a", limit: 20, since: 100 })).toBe("creator.videos:a:100");
  });
});

describe("request builder", () => {
  it("creator.videos đưa limit và since vào query", () => {
    const r = ENDPOINTS["creator.videos"].request({ handle: "a", limit: 10, since: 5 });
    expect(r).toEqual({ path: "/creator/v1/creators/a/videos", query: { limit: 10, since: 5 } });
  });
  it("creator.search không gửi keyword khi để trống", () => {
    expect(ENDPOINTS["creator.search"].request({ keyword: "", count: 20 }).body).toEqual({ count: 20 });
  });
});
