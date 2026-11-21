import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./pricing";

describe("estimateCostUsd", () => {
  it("tính theo giá đầu vào và đầu ra của từng model", () => {
    // Sonnet 5.5: 2$ vào, 10$ ra mỗi triệu token
    expect(estimateCostUsd("claude-sonnet-5-5", { input_tokens: 10_000, output_tokens: 2_000 })).toBe(0.04);
    // Haiku 5.5: 0,1$ vào, 0,5$ ra
    expect(estimateCostUsd("claude-haiku-5-5", { input_tokens: 10_000, output_tokens: 2_000 })).toBe(0.002);
  });

  it("tính riêng phần đọc cache và ghi cache", () => {
    const usd = estimateCostUsd("claude-sonnet-5-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
    });
    // đọc cache 0,10 + ghi cache 2 x 1,25 = 2,50
    expect(usd).toBe(2.6);
  });

  it("Haiku dùng giá cao hơn khi prompt trên 100K token", () => {
    const usd = estimateCostUsd("claude-haiku-5-5", { input_tokens: 200_000, output_tokens: 0 });
    expect(usd).toBe(0.1);
  });

  it("model chưa biết giá thì trả null", () => {
    expect(estimateCostUsd("claude-khong-ton-tai", { input_tokens: 1, output_tokens: 1 })).toBeNull();
  });
});
