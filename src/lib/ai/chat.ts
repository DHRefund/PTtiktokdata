import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AiErrorCode } from "./errors";
import { ASK_SYSTEM } from "./prompts";
import { ASK_TOOLS, type Proposal, type ToolOutcome } from "./tools";

// Vòng lặp trợ lý "Hỏi AI": model gọi công cụ đọc dữ liệu đã lưu, ta chạy rồi trả kết quả, lặp tới khi model trả lời xong.
// Mọi thứ bên ngoài (gọi model, chạy công cụ, ghi sổ chi phí) được truyền vào qua `deps` nên kiểm thử được bằng đồ giả.

export type ChatEvent =
  | { t: "text"; v: string }
  | { t: "tool"; name: string }
  | { t: "proposal"; p: Proposal }
  | { t: "done"; costUsd: number }
  | { t: "error"; code: AiErrorCode; message: string };

export type StreamHandle = {
  onText(cb: (delta: string) => void): void;
  final(): Promise<Anthropic.Message>;
};

export type ChatDeps = {
  model: string;
  stream(params: Anthropic.MessageStreamParams, signal?: AbortSignal): StreamHandle;
  runTool(name: string, input: unknown): Promise<ToolOutcome>;
  /** Ghi sổ một lượt gọi model, trả chi phí ước tính (USD). */
  record(usage: Anthropic.Usage, status: "ok" | "error" | "refused"): Promise<number>;
  /** Ném lỗi nếu đã hết trần chi phí. */
  assertBudget(): Promise<void>;
};

export const MAX_ITERATIONS = 8;

export const chatBodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) }))
    .min(1)
    .max(20),
});

/** API yêu cầu tin nhắn đầu là của người dùng và tin cuối cũng vậy. Bỏ phần thừa ở đầu. */
export function normalizeHistory(messages: { role: "user" | "assistant"; content: string }[]): Anthropic.MessageParam[] {
  const trimmed = [...messages];
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  return trimmed.filter((m) => m.content.trim()).map((m) => ({ role: m.role, content: m.content }));
}

export async function runChat(args: {
  history: Anthropic.MessageParam[];
  deps: ChatDeps;
  emit: (e: ChatEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { deps, emit } = args;
  const convo: Anthropic.MessageParam[] = [...args.history];
  let totalCost = 0;
  let wroteText = false;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (args.signal?.aborted) return;
    await deps.assertBudget();

    const stream = deps.stream(
      {
        model: deps.model,
        max_tokens: 16000,
        system: ASK_SYSTEM,
        tools: ASK_TOOLS,
        messages: convo,
        output_config: { effort: "medium" },
      },
      args.signal,
    );
    // Tách đoạn văn ở các vòng sau bằng dòng trống
    let first = true;
    stream.onText((delta) => {
      if (first && wroteText) emit({ t: "text", v: "\n\n" });
      first = false;
      wroteText = true;
      emit({ t: "text", v: delta });
    });
    const message = await stream.final();

    if (message.stop_reason === "refusal") {
      totalCost += await deps.record(message.usage, "refused");
      emit({ t: "error", code: "REFUSED", message: "AI từ chối trả lời câu hỏi này." });
      return;
    }
    totalCost += await deps.record(message.usage, "ok");

    if (message.stop_reason === "max_tokens") {
      emit({ t: "error", code: "TRUNCATED", message: "Câu trả lời bị cắt giữa chừng, hãy hỏi gọn hơn hoặc thử lại." });
      return;
    }

    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
      emit({ t: "done", costUsd: totalCost });
      return;
    }

    // Giữ nguyên toàn bộ nội dung model trả về (kể cả khối suy nghĩ) khi gửi lại trong cùng một yêu cầu
    convo.push({ role: "assistant", content: message.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      emit({ t: "tool", name: use.name });
      const out = await deps.runTool(use.name, use.input);
      if (out.proposal) emit({ t: "proposal", p: out.proposal });
      results.push({ type: "tool_result", tool_use_id: use.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
    }
    // Mọi kết quả công cụ của một lượt gửi trong MỘT tin nhắn duy nhất
    convo.push({ role: "user", content: results });
  }

  emit({ t: "error", code: "UNKNOWN", message: "Trợ lý cần quá nhiều bước để trả lời. Hãy chia nhỏ câu hỏi." });
}
