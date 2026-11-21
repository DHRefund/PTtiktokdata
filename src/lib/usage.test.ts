import { describe, expect, it } from "vitest";
import { bucketUsageByDay } from "./usage";

describe("bucketUsageByDay", () => {
  // 21/11/2026 03:00 UTC = 10:00 giờ Việt Nam
  const now = new Date("2026-11-21T03:00:00Z");

  it("trả đủ số ngày, ngày không có lượt là 0, cũ đến mới", () => {
    const r = bucketUsageByDay([], 3, now);
    expect(r).toEqual([
      { day: "19/11", used: 0 },
      { day: "20/11", used: 0 },
      { day: "21/11", used: 0 },
    ]);
  });

  it("cộng cost theo ngày giờ Việt Nam, không theo UTC", () => {
    const rows = [
      { called_at: "2026-11-21T02:00:00Z", cost: 1 }, // 09:00 21/11 VN
      { called_at: "2026-11-21T01:00:00Z", cost: 2 }, // 08:00 21/11 VN
      // 20/11 18:00 UTC = 01:00 21/11 giờ VN: thuộc ngày 21
      { called_at: "2026-11-20T18:00:00Z", cost: 4 },
      // 20/11 10:00 UTC = 17:00 20/11 VN
      { called_at: "2026-11-20T10:00:00Z", cost: 3 },
    ];
    const r = bucketUsageByDay(rows, 2, now);
    expect(r).toEqual([
      { day: "20/11", used: 3 },
      { day: "21/11", used: 7 },
    ]);
  });

  it("bỏ qua lượt nằm ngoài khoảng ngày", () => {
    const r = bucketUsageByDay([{ called_at: "2026-10-01T00:00:00Z", cost: 9 }], 2, now);
    expect(r.every((p) => p.used === 0)).toBe(true);
  });
});
