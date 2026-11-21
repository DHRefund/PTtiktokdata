import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { anthropic, AiNotConfiguredError } from "./client";
import { AiError, type AiErrorCode } from "./errors";
import { aiConfig } from "./config";
import { geminiStructured, geminiToAiError } from "./gemini";
import type { Usage } from "./pricing";
import { assertAiBudget, AiBudgetExceededError, recordAiUsage } from "./ledger";

/** Chuyển lỗi bất kỳ thành AiError với mã và thông báo tiếng Việt. Lỗi lạ chỉ ghi log, không lộ chi tiết ra giao diện. */
export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof AiNotConfiguredError) return new AiError("NOT_CONFIGURED");
  if (e instanceof AiBudgetExceededError) return new AiError("BUDGET", `${e.message}. Tăng AI_DAILY_BUDGET_USD nếu muốn dùng tiếp.`);
  const g = geminiToAiError(e);
  if (g) return g;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new AiError("AUTH");
  if (e instanceof Anthropic.RateLimitError) return new AiError("RATE_LIMIT");
  if (e instanceof Anthropic.BadRequestError) {
    console.error("[ai] yêu cầu bị từ chối:", e.message);
    return new AiError("INVALID_INPUT", `Yêu cầu AI không hợp lệ: ${e.message}`);
  }
  if (e instanceof Anthropic.APIError) {
    console.error("[ai] lỗi API", e.status, e.message);
    return new AiError(e.status && e.status >= 500 ? "UPSTREAM" : "UNKNOWN");
  }
  if (e instanceof Anthropic.APIConnectionError) return new AiError("UPSTREAM");
  console.error("[ai] lỗi không rõ", e instanceof Error ? e.message : e);
  return new AiError("UNKNOWN");
}

export type StructuredArgs<S extends z.ZodType> = {
  feature: string;
  model: string;
  system: string;
  user: string;
  schema: S;
  userId: string | null;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
};

/**
 * Gọi Claude và ép kết quả đúng schema (structured outputs). Kiểm tra trần chi phí trước, ghi sổ sau.
 * Không gửi sampling params (temperature...) vì các model đời mới từ chối. Không prefill.
 */
export async function runStructured<S extends z.ZodType>(args: StructuredArgs<S>): Promise<{ data: z.infer<S>; costUsd: number }> {
  await assertAiBudget();
  const started = Date.now();
  let usage: Usage | null = null;
  try {
    if (aiConfig().provider === "gemini") {
      const r = await geminiStructured({ model: args.model, system: args.system, user: args.user, schema: args.schema, maxTokens: args.maxTokens });
      usage = r.usage;
      if (r.code || r.data == null) {
        const code = r.code ?? "BAD_OUTPUT";
        await recordAiUsage({ userId: args.userId, feature: args.feature, model: args.model, usage, status: code === "REFUSED" ? "refused" : "error", durationMs: Date.now() - started });
        throw new AiError(code);
      }
      const costUsd = await recordAiUsage({ userId: args.userId, feature: args.feature, model: args.model, usage, status: "ok", durationMs: Date.now() - started });
      return { data: r.data as z.infer<S>, costUsd };
    }
    const res = await anthropic().messages.parse({
      model: args.model,
      max_tokens: args.maxTokens ?? 16000,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
      output_config: { effort: args.effort ?? "medium", format: zodOutputFormat(args.schema) },
    });
    usage = res.usage;

    let code: AiErrorCode | null = null;
    if (res.stop_reason === "refusal") code = "REFUSED";
    else if (res.stop_reason === "max_tokens") code = "TRUNCATED";
    else if (res.parsed_output == null) code = "BAD_OUTPUT";
    if (code) {
      await recordAiUsage({ userId: args.userId, feature: args.feature, model: args.model, usage, status: code === "REFUSED" ? "refused" : "error", durationMs: Date.now() - started });
      throw new AiError(code);
    }

    const costUsd = await recordAiUsage({ userId: args.userId, feature: args.feature, model: args.model, usage, status: "ok", durationMs: Date.now() - started });
    return { data: res.parsed_output as z.infer<S>, costUsd };
  } catch (e) {
    if (!(e instanceof AiError) && !(e instanceof AiBudgetExceededError) && !(e instanceof AiNotConfiguredError)) {
      await recordAiUsage({ userId: args.userId, feature: args.feature, model: args.model, usage, status: "error", durationMs: Date.now() - started });
    }
    throw toAiError(e);
  }
}
