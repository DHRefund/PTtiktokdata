import { describe, expect, it } from "vitest";
import { isOverBudget, vnDayStartIso } from "./ledger";

describe("vnDayStartIso", () => {
  it("trả 00:00 giờ Việt Nam của ngày hiện tại", () => {
    // 21/11/2026 10:00 giờ VN
    expect(vnDayStartIso(new Date("2026-11-21T03:00:00Z"))).toBe("2026-11-20T17:00:00.000Z");
  });
  it("lúc 23:30 giờ VN vẫn thuộc ngày đó, còn 00:30 hôm sau là ngày mới", () => {
    expect(vnDayStartIso(new Date("2026-11-21T16:30:00Z"))).toBe("2026-11-20T17:00:00.000Z");
    expect(vnDayStartIso(new Date("2026-11-21T17:30:00Z"))).toBe("2026-11-21T17:00:00.000Z");
  });
});

describe("isOverBudget", () => {
  it("chạm trần là hết, dưới trần là còn", () => {
    expect(isOverBudget(1, 1)).toBe(true);
    expect(isOverBudget(0.99, 1)).toBe(false);
  });
});
