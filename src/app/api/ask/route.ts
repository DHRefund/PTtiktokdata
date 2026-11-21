import { getUser } from "@/lib/auth/session";
import { anthropic, gemini } from "@/lib/ai/client";
import { GEMINI_TOOLS, runGeminiChat } from "@/lib/ai/gemini";
import type { Usage } from "@/lib/ai/pricing";
import { ASK_SYSTEM } from "@/lib/ai/prompts";
import { aiConfig } from "@/lib/ai/config";
import { makeAskData } from "@/lib/ai/ask-data";
import { chatBodySchema, normalizeHistory, runChat, type ChatEvent } from "@/lib/ai/chat";
import { aiFail } from "@/lib/ai/errors";
import { assertAiBudget, recordAiUsage } from "@/lib/ai/ledger";
import { toAiError } from "@/lib/ai/run";
import { executeTool } from "@/lib/ai/tools";

// Hỏi đáp có streaming. Trả về các dòng JSON (NDJSON), mỗi dòng là một ChatEvent.
export const maxDuration = 120;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  // proxy.ts đã chặn người chưa đăng nhập, đây là lớp kiểm tra thứ hai ngay tại điểm dùng
  const user = await getUser();
  if (!user) return json(401, aiFail("INVALID_INPUT", "Bạn chưa đăng nhập hoặc phiên đã hết hạn."));
  const cfg = aiConfig();
  if (!cfg.configured) return json(503, aiFail("NOT_CONFIGURED"));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, aiFail("INVALID_INPUT"));
  }
  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) return json(400, aiFail("INVALID_INPUT"));
  const history = normalizeHistory(parsed.data.messages);
  if (history.length === 0 || history[history.length - 1].role !== "user") return json(400, aiFail("INVALID_INPUT"));

  const data = makeAskData();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // người dùng đã đóng kết nối
        }
      };
      const started = Date.now();
      try {
        const record = (usage: Usage, status: "ok" | "error" | "refused") =>
          recordAiUsage({ userId: user.userId, feature: "ask", model: cfg.smart, usage, status, durationMs: Date.now() - started });
        if (cfg.provider === "gemini") {
          await runGeminiChat({
            history: history.map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: typeof m.content === "string" ? m.content : "" })),
            emit,
            signal: request.signal,
            deps: {
              generate: async (params, signal) =>
                gemini().models.generateContentStream({
                  model: cfg.smart,
                  contents: params.contents,
                  config: { systemInstruction: ASK_SYSTEM, tools: [{ functionDeclarations: GEMINI_TOOLS }], maxOutputTokens: 16000, abortSignal: signal },
                }),
              runTool: (name, input) => executeTool(name, input, data),
              record,
              assertBudget: assertAiBudget,
            },
          });
          return;
        }
        await runChat({
          history,
          emit,
          signal: request.signal,
          deps: {
            model: cfg.smart,
            stream: (params, signal) => {
              const s = anthropic().messages.stream(params, { signal });
              return { onText: (cb) => void s.on("text", cb), final: () => s.finalMessage() };
            },
            runTool: (name, input) => executeTool(name, input, data),
            record,
            assertBudget: assertAiBudget,
          },
        });
      } catch (e) {
        const err = toAiError(e);
        emit({ t: "error", code: err.code, message: err.message });
      } finally {
        try {
          controller.close();
        } catch {
          // đã đóng
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
