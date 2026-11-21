import { describe, expect, it } from "vitest";
import { ago, until, compact, duration, pct, usd, vnd, EMPTY } from "./format";

describe("usd", () => {
  it("chi phí nhỏ hiện 4 chữ số thập phân, lớn hơn hiện 2", () => {
    expect(usd(0.0012)).toBe("$0,0012");
    expect(usd(1.5)).toBe("$1,50");
  });
});

describe("format", () => {
  it("compact rút gọn theo nghìn, triệu, tỷ", () => {
    expect(compact(512)).toBe("512");
    expect(compact(512630)).toBe("512,6 nghìn");
    expect(compact(1996889)).toBe("2 triệu");
    expect(compact(1646103845)).toBe("1,6 tỷ");
  });
  it("giá trị thiếu trả 'Chưa có'", () => {
    expect(compact(null)).toBe(EMPTY);
    expect(vnd(undefined)).toBe(EMPTY);
    expect(pct(null)).toBe(EMPTY);
    expect(duration(NaN)).toBe(EMPTY);
  });
  it("vnd, pct, duration", () => {
    expect(vnd(52689)).toBe("52.689₫");
    expect(vnd(2_500_000)).toBe("2,5 triệu₫");
    expect(pct(0.4862)).toBe("48,6%");
    expect(duration(18.667)).toBe("0:19");
    expect(duration(95)).toBe("1:35");
  });
  it("ago", () => {
    const now = Date.parse("2026-11-21T10:00:00Z");
    expect(ago("2026-11-21T09:59:40Z", now)).toBe("vừa xong");
    expect(ago("2026-11-21T09:30:00Z", now)).toBe("30 phút trước");
    expect(ago("2026-11-21T07:00:00Z", now)).toBe("3 giờ trước");
    expect(ago("2026-11-19T10:00:00Z", now)).toBe("2 ngày trước");
  });
  it("until", () => {
    const now = Date.parse("2026-11-21T10:00:00Z");
    expect(until("2026-11-21T09:00:00Z", now)).toBe("đã hết hạn");
    expect(until("2026-11-21T10:25:00Z", now)).toBe("còn 25 phút");
    expect(until("2026-11-21T13:00:00Z", now)).toBe("còn 3 giờ");
    expect(until("2026-11-23T10:00:00Z", now)).toBe("còn 2 ngày");
  });
});
