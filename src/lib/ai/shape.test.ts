import { describe, expect, it } from "vitest";
import { hashInput, slimAffiliate, slimVideo, stableJson } from "./shape";

describe("hashInput", () => {
  it("không phụ thuộc thứ tự khoá", () => {
    expect(hashInput({ a: 1, b: { c: 2, d: 3 } })).toBe(hashInput({ b: { d: 3, c: 2 }, a: 1 }));
  });
  it("dữ liệu khác thì mã khác", () => {
    expect(hashInput({ a: 1 })).not.toBe(hashInput({ a: 2 }));
  });
  it("giữ nguyên thứ tự mảng", () => {
    expect(stableJson([1, 2])).not.toBe(stableJson([2, 1]));
  });
});

describe("slimAffiliate", () => {
  it("bỏ link ảnh và cắt văn bản dài, giữ số liệu", () => {
    const r = slimAffiliate({
      handle: "a",
      avatar_url: "https://cdn/x?sig=abc",
      bio: "x".repeat(500),
      units_sold: 10,
      gmv: null,
      gmv_range: "1M₫+",
      stats_until: 1794960000,
      top_videos: [{ id: "1", description: "mô tả", create_time: 1794247262, views: 5, products: [{ id: "p", name: "Sản phẩm" }] }],
    });
    expect(JSON.stringify(r)).not.toContain("cdn/x");
    expect(r.bio?.length).toBe(301);
    expect(r.units_sold).toBe(10);
    expect(r.gmv_vnd).toBeUndefined();
    expect(r.gmv_range).toBe("1M₫+");
    expect(r.stats_until).toBe("2026-11-18");
    // 18:01 UTC ngày 09/11 là 01:01 ngày 10/11 giờ Việt Nam
    expect(r.top_videos?.[0].posted).toBe("2026-11-10");
  });
});

describe("slimVideo", () => {
  it("rút gọn video và bỏ ảnh bìa", () => {
    const r = slimVideo({
      id: "1",
      description: "Review son #son",
      create_time: 1779269580,
      hashtags: ["son"],
      video: { duration: 31, cover_url: "https://cdn/cover?sig=1" },
      stats: { play_count: 100, like_count: 5 },
      author: { handle: "h" },
      music: { original: true, title: "âm thanh gốc - A" },
    });
    expect(JSON.stringify(r)).not.toContain("cover");
    expect(r).toMatchObject({ id: "1", plays: 100, likes: 5, author: "h", duration_sec: 31, music: "âm thanh gốc" });
  });
});
