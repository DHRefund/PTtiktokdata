import "server-only";
import { ApiError, FinishReason, type Content, type FunctionDeclaration, type GenerateContentResponse, type Part } from "@google/genai";
import { z } from "zod";
import type { ChatEvent } from "./chat";
import { gemini } from "./client";
import { AiError, type AiErrorCode } from "./errors";
import type { Usage } from "./pricing";
import { ASK_TOOLS, type ToolOutcome } from "./tools";

// Nhánh Gemini: gọi có cấu trúc và vòng hỏi đáp có công cụ. Cùng giao diện với nhánh Claude (kết quả, sự kiện, sổ chi phí).

export function geminiUsage(res: GenerateContentResponse | undefined): Usage {
  const u = res?.usageMetadata;
  return {
    input_tokens: u?.promptTokenCount ?? 0,
    // Token suy nghĩ cũng tính tiền như token đầu ra
    output_tokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
    cache_read_input_tokens: u?.cachedContentTokenCount ?? 0,
  };
}

/** Ánh xạ finishReason của Gemini sang mã lỗi của app (null nếu bình thường). */
export function finishToCode(reason: FinishReason | undefined, blocked?: boolean): AiErrorCode | null {
  if (blocked) return "REFUSED";
  switch (reason) {
    case FinishReason.MAX_TOKENS:
      return "TRUNCATED";
    case FinishReason.SAFETY:
    case FinishReason.PROHIBITED_CONTENT:
    case FinishReason.BLOCKLIST:
    case FinishReason.SPII:
    case FinishReason.RECITATION:
      return "REFUSED";
    case FinishReason.MALFORMED_FUNCTION_CALL:
    case FinishReason.OTHER:
      return "BAD_OUTPUT";
    default:
      return null;
  }
}

export function geminiToAiError(e: unknown): AiError | null {
  if (!(e instanceof ApiError)) return null;
  if (e.status === 401 || e.status === 403) return new AiError("AUTH");
  if (e.status === 429) return new AiError("RATE_LIMIT");
  if (e.status === 400) {
    // Khoá sai cũng trả 400 "API key not valid"
    if (/api key/i.test(e.message)) return new AiError("AUTH");
    console.error("[ai] yêu cầu bị từ chối:", e.message);
    return new AiError("INVALID_INPUT", `Yêu cầu AI không hợp lệ: ${e.message}`);
  }
  console.error("[ai] lỗi Gemini", e.status, e.message);
  return new AiError(e.status >= 500 ? "UPSTREAM" : "UNKNOWN");
}

function jsonSchemaOf(schema: z.ZodType): unknown {
  const out = { ...(z.toJSONSchema(schema) as Record<string, unknown>) };
  delete out.$schema;
  return out;
}

/** Gọi Gemini, ép JSON theo schema, kiểm lại bằng Zod. */
export async function geminiStructured<S extends z.ZodType>(args: {
  model: string;
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
}): Promise<{ data: z.infer<S> | null; usage: Usage; code: AiErrorCode | null }> {
  const res = await gemini().models.generateContent({
    model: args.model,
    contents: args.user,
    config: {
      systemInstruction: args.system,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchemaOf(args.schema),
      maxOutputTokens: args.maxTokens ?? 16000,
    },
  });
  const usage = geminiUsage(res);
  const code = finishToCode(res.candidates?.[0]?.finishReason, Boolean(res.promptFeedback?.blockReason));
  if (code) return { data: null, usage, code };
  let data: unknown;
  try {
    data = JSON.parse(res.text ?? "");
  } catch {
    return { data: null, usage, code: "BAD_OUTPUT" };
  }
  const parsed = args.schema.safeParse(data);
  if (!parsed.success) {
    console.error("[ai] Gemini trả sai schema:", parsed.error.message.slice(0, 500));
    return { data: null, usage, code: "BAD_OUTPUT" };
  }
  return { data: parsed.data, usage, code: null };
}

// ---------- Hỏi đáp có công cụ ----------

export const GEMINI_TOOLS: FunctionDeclaration[] = ASK_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.input_schema,
}));

export type GeminiChatDeps = {
  generate(params: { contents: Content[] }, signal?: AbortSignal): Promise<AsyncIterable<GenerateContentResponse>>;
  runTool(name: string, input: unknown): Promise<ToolOutcome>;
  record(usage: Usage, status: "ok" | "error" | "refused"): Promise<number>;
  assertBudget(): Promise<void>;
};

export const GEMINI_MAX_ITERATIONS = 8;

export async function runGeminiChat(args: {
  history: { role: "user" | "assistant"; content: string }[];
  deps: GeminiChatDeps;
  emit: (e: ChatEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { deps, emit } = args;
  const convo: Content[] = args.history.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }));
  let totalCost = 0;
  let wroteText = false;

  for (let i = 0; i < GEMINI_MAX_ITERATIONS; i++) {
    if (args.signal?.aborted) return;
    await deps.assertBudget();

    const parts: Part[] = [];
    const calls: { name: string; args: unknown }[] = [];
    let usage: Usage = { input_tokens: 0, output_tokens: 0 };
    let finish: FinishReason | undefined;
    let blocked = false;
    let first = true;

    for await (const chunk of await deps.generate({ contents: convo }, args.signal)) {
      if (chunk.usageMetadata) usage = geminiUsage(chunk);
      if (chunk.promptFeedback?.blockReason) blocked = true;
      const cand = chunk.candidates?.[0];
      if (cand?.finishReason) finish = cand.finishReason;
      for (const p of cand?.content?.parts ?? []) {
        parts.push(p);
        if (p.functionCall) calls.push({ name: p.functionCall.name ?? "", args: p.functionCall.args ?? {} });
        else if (p.text && !p.thought) {
          if (first && wroteText) emit({ t: "text", v: "\n\n" });
          first = false;
          wroteText = true;
          emit({ t: "text", v: p.text });
        }
      }
    }

    const code = finishToCode(finish, blocked);
    if (code === "REFUSED") {
      totalCost += await deps.record(usage, "refused");
      emit({ t: "error", code, message: "AI từ chối trả lời câu hỏi này." });
      return;
    }
    totalCost += await deps.record(usage, code ? "error" : "ok");
    if (code === "TRUNCATED") {
      emit({ t: "error", code, message: "Câu trả lời bị cắt giữa chừng, hãy hỏi gọn hơn hoặc thử lại." });
      return;
    }
    if (code) {
      emit({ t: "error", code, message: "AI trả về kết quả không hợp lệ, hãy thử lại." });
      return;
    }

    if (calls.length === 0) {
      emit({ t: "done", costUsd: totalCost });
      return;
    }

    // Giữ nguyên các phần model trả về (kể cả chữ ký suy nghĩ) khi gửi lại
    convo.push({ role: "model", parts });
    const responses: Part[] = [];
    for (const c of calls) {
      emit({ t: "tool", name: c.name });
      const out = await deps.runTool(c.name, c.args);
      if (out.proposal) emit({ t: "proposal", p: out.proposal });
      responses.push({ functionResponse: { name: c.name, response: out.isError ? { error: out.content } : { output: out.content } } });
    }
    convo.push({ role: "user", parts: responses });
  }

  emit({ t: "error", code: "UNKNOWN", message: "Trợ lý cần quá nhiều bước để trả lời. Hãy chia nhỏ câu hỏi." });
}
