// Cấu hình AI đọc từ biến môi trường. Chỉ dùng ở server.

export type AiProvider = "gemini" | "anthropic";

export const DEFAULT_MODELS: Record<AiProvider, { fast: string; smart: string }> = {
  // Gemini có gói miễn phí (có giới hạn lượt/ngày), hợp để thử nghiệm
  gemini: { fast: "gemini-2.5-flash", smart: "gemini-2.5-flash" },
  anthropic: { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5" },
};
export const DEFAULT_DAILY_BUDGET_USD = 1;

export type AiConfig = {
  provider: AiProvider;
  configured: boolean;
  /** Model rẻ, cho tóm tắt và soạn tin nhắn. */
  fast: string;
  /** Model mạnh hơn, cho hỏi đáp có công cụ và so sánh. */
  smart: string;
  /** Trần chi phí mỗi ngày (USD). Gemini gói miễn phí tính 0 nên không chạm trần. */
  dailyBudgetUsd: number;
  /** Tên biến môi trường chứa khoá của nhà cung cấp đang dùng. */
  keyVar: string;
};

/**
 * AI_PROVIDER chọn nhà cung cấp. Không đặt thì: có GEMINI_API_KEY (và chưa có ANTHROPIC_API_KEY) dùng Gemini, còn lại dùng Claude.
 */
export function aiProvider(env: NodeJS.ProcessEnv = process.env): AiProvider {
  const forced = env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "gemini" || forced === "anthropic") return forced;
  if (env.GEMINI_API_KEY?.trim() && !env.ANTHROPIC_API_KEY?.trim()) return "gemini";
  return "anthropic";
}

export function aiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const provider = aiProvider(env);
  const budget = Number(env.AI_DAILY_BUDGET_USD);
  const keyVar = provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
  return {
    provider,
    configured: Boolean(env[keyVar]?.trim()),
    fast: env.AI_MODEL_FAST?.trim() || DEFAULT_MODELS[provider].fast,
    smart: env.AI_MODEL_SMART?.trim() || DEFAULT_MODELS[provider].smart,
    dailyBudgetUsd: Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_DAILY_BUDGET_USD,
    keyVar,
  };
}
