import { describe, expect, it } from "vitest";
import snapshot from "@/data/kalodata-latest.json";
import { batchHash, kalodataBatchSchema } from "./schema";

const row = (rank: number, over: object = {}) => ({
  rank, name: `SP ${rank}`, revenue: "₫1.2b", sold: "10k", growth: "5%", rating: "4.8", averagePrice: "₫100k", commission: null, creators: "12", productId: null, ...over,
});
const batch = (rows: unknown[], over: object = {}) => ({
  schemaVersion: 1, source: "kalodata", sourceUrl: "https://www.kalodata.com/product", collectedOn: "2026-11-21", collectionMethod: "x",
  market: "VN", currency: "VND", periodStart: "2026-10-22", periodEnd: "2026-11-20", sortVerified: false, precision: "display-rounded", rows, ...over,
});

describe("kalodataBatchSchema", () => {
  it("nhận file snapshot đang dùng", () => {
    expect(kalodataBatchSchema.safeParse(snapshot).success).toBe(true);
  });
  it("từ chối giá trị bị che ****", () => {
    expect(kalodataBatchSchema.safeParse(batch([row(1, { revenue: "****" })])).success).toBe(false);
  });
  it("từ chối rank trùng và productId trùng", () => {
    expect(kalodataBatchSchema.safeParse(batch([row(1), row(1)])).success).toBe(false);
    expect(kalodataBatchSchema.safeParse(batch([row(1, { productId: "1737844036294575550" }), row(2, { productId: "1737844036294575550" })])).success).toBe(false);
  });
  it("productId phải là chuỗi số, không nhận số (mất chính xác)", () => {
    expect(kalodataBatchSchema.safeParse(batch([row(1, { productId: 1737844036294575550 })])).success).toBe(false);
    expect(kalodataBatchSchema.safeParse(batch([row(1, { productId: "abc" })])).success).toBe(false);
  });
  it("từ chối kỳ ngược và ngày sai dạng", () => {
    expect(kalodataBatchSchema.safeParse(batch([row(1)], { periodStart: "2026-12-01" })).success).toBe(false);
    expect(kalodataBatchSchema.safeParse(batch([row(1)], { collectedOn: "21/11/2026" })).success).toBe(false);
  });
  it("hoa hồng thiếu là null, không phải chuỗi rỗng", () => {
    expect(kalodataBatchSchema.safeParse(batch([row(1, { commission: "" })])).success).toBe(false);
    expect(kalodataBatchSchema.safeParse(batch([row(1, { commission: null })])).success).toBe(true);
  });
});

describe("batchHash", () => {
  it("không phụ thuộc thứ tự khoá, đổi nội dung thì đổi mã", () => {
    const a = kalodataBatchSchema.parse(batch([row(1)]));
    const reordered = kalodataBatchSchema.parse(Object.fromEntries(Object.entries(batch([row(1)])).reverse()));
    expect(batchHash(a)).toBe(batchHash(reordered));
    expect(batchHash(a)).not.toBe(batchHash(kalodataBatchSchema.parse(batch([row(1, { sold: "11k" })]))));
  });
});
