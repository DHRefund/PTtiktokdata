// Ước tính chi phí gọi Claude từ số token. Giá lấy từ bảng giá Anthropic (cập nhật 03/11/2026), USD trên 1 triệu token.
// Giá có thể đổi: đây chỉ là ước tính để đặt trần chi tiêu, hoá đơn thật nằm ở Anthropic Console.

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

type Price = { input: number; output: number; cacheRead: number };

const PRICES: Record<string, Price> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
};

// Haiku 5.5 tính giá cao hơn cho prompt trên 100K token
const HAIKU_LONG = { input: 0.5, output: 2.5, cacheRead: 0.05 };
const HAIKU_LONG_THRESHOLD = 100_000;

/** Ghi cache tốn 1,25 lần giá đầu vào. */
const CACHE_WRITE_MULTIPLIER = 1.25;

/** Chi phí ước tính (USD), hoặc null nếu chưa biết giá của model này. */
export function estimateCostUsd(model: string, usage: Usage): number | null {
  let price = PRICES[model];
  if (!price) return null;
  const read = usage.cache_read_input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  const promptTokens = usage.input_tokens + read + write;
  if (model === "claude-haiku-5-5" && promptTokens > HAIKU_LONG_THRESHOLD) price = HAIKU_LONG;

  const usd =
    (usage.input_tokens * price.input +
      write * price.input * CACHE_WRITE_MULTIPLIER +
      read * price.cacheRead +
      usage.output_tokens * price.output) /
    1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}
