import { describe, expect, it } from "vitest";
import { lockedForMs, recordFailure, recordSuccess } from "./throttle";

describe("throttle đăng nhập", () => {
  it("khoá sau 5 lần sai, mở lại sau 15 phút", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) recordFailure("a", t0);
    expect(lockedForMs("a", t0)).toBe(0);
    recordFailure("a", t0);
    expect(lockedForMs("a", t0)).toBeGreaterThan(0);
    expect(lockedForMs("a", t0 + 15 * 60 * 1000 + 1)).toBe(0);
  });
  it("đăng nhập đúng thì xoá bộ đếm", () => {
    for (let i = 0; i < 5; i++) recordFailure("b");
    recordSuccess("b");
    expect(lockedForMs("b")).toBe(0);
  });
});
