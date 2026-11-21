import { describe, expect, it } from "vitest";
import { answerText } from "./web";

describe("answerText", () => {
  it("lấy đoạn cuối khi hai đoạn mở đầu giống nhau", () => {
    const a = "TikTok Shop Việt Nam cuối năm 2026 đang sôi động. Bản nháp.";
    const b = "TikTok Shop Việt Nam cuối năm 2026 đang sôi động. Bản chính đầy đủ hơn.";
    expect(answerText([{ text: a }, { text: b }], "")).toBe(b);
  });
  it("nối các đoạn khác nhau và bỏ phần suy nghĩ", () => {
    expect(answerText([{ text: "ý nghĩ", thought: true }, { text: "Phần một" }, { text: "Phần hai" }], "")).toBe("Phần một\n\nPhần hai");
  });
  it("không có phần nào thì dùng văn bản dự phòng", () => {
    expect(answerText(undefined, " x ")).toBe("x");
  });
});
