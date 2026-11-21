import { FinishReason, type GenerateContentResponse } from "@google/genai";
import { describe, expect, it } from "vitest";
import type { ChatEvent } from "./chat";
import { aiConfig } from "./config";
import { finishToCode, GEMINI_TOOLS, geminiUsage, runGeminiChat } from "./gemini";
import { creatorBriefSchema } from "./schemas";
import { executeTool, type AskData } from "./tools";
import { z } from "zod";

const data: AskData = {
  creators: async () => [{ handle: "a", nickname: "A", units_sold: 5 }],
  creatorDossier: async () => null,
  products: async () => [],
  productDetails: async () => null,
  videos: async () => [],
  searches: async () => [],
};

const chunk = (parts: unknown[], finishReason: FinishReason = FinishReason.STOP, extra: object = {}) =>
  ({
    candidates: [{ content: { role: "model", parts }, finishReason }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 5 },
    ...extra,
  }) as unknown as GenerateContentResponse;

async function* gen(...cs: GenerateContentResponse[]) {
  for (const c of cs) yield c;
}

function run(script: GenerateContentResponse[][]) {
  const events: ChatEvent[] = [];
  const requests: unknown[] = [];
  const records: string[] = [];
  let i = 0;
  const p = runGeminiChat({
    history: [{ role: "user", content: "Ai bán nhiều nhất?" }],
    emit: (e) => events.push(e),
    deps: {
      generate: async (params) => {
        requests.push(JSON.parse(JSON.stringify(params)));
        return gen(...script[Math.min(i++, script.length - 1)]);
      },
      runTool: (n, input) => executeTool(n, input, data),
      record: async (_u, status) => {
        records.push(status);
        return 0;
      },
      assertBudget: async () => {},
    },
  });
  return { p, events, requests, records };
}

describe("runGeminiChat", () => {
  it("trả lời thẳng không cần công cụ", async () => {
    const r = run([[chunk([{ text: "Xin " }]), chunk([{ text: "chào" }])]]);
    await r.p;
    expect(r.events.filter((e) => e.t === "text").map((e) => (e as { v: string }).v).join("")).toBe("Xin chào");
    expect(r.events.at(-1)?.t).toBe("done");
  });

  it("gọi công cụ rồi trả lời, gửi lại functionResponse trong một tin nhắn", async () => {
    const r = run([
      [chunk([{ functionCall: { name: "search_creators", args: { keyword: "a" } } }, { functionCall: { name: "search_creators", args: {} } }])],
      [chunk([{ text: "Creator a bán nhiều nhất." }])],
    ]);
    await r.p;
    expect(r.events.filter((e) => e.t === "tool")).toHaveLength(2);
    const second = r.requests[1] as { contents: { role: string; parts: { functionResponse?: unknown }[] }[] };
    const last = second.contents.at(-1)!;
    expect(last.role).toBe("user");
    expect(last.parts.filter((p) => p.functionResponse)).toHaveLength(2);
    expect(second.contents.at(-2)!.role).toBe("model");
    expect(r.events.at(-1)?.t).toBe("done");
  });

  it("công cụ lạ trả lỗi chứ không làm vỡ vòng lặp", async () => {
    const r = run([[chunk([{ functionCall: { name: "xoa_het", args: {} } }])], [chunk([{ text: "ok" }])]]);
    await r.p;
    expect(r.events.at(-1)?.t).toBe("done");
  });

  it("báo từ chối và cắt giữa chừng", async () => {
    const a = run([[chunk([], FinishReason.SAFETY)]]);
    await a.p;
    expect(a.events.at(-1)).toMatchObject({ t: "error", code: "REFUSED" });
    expect(a.records).toEqual(["refused"]);
    const b = run([[chunk([{ text: "..." }], FinishReason.MAX_TOKENS)]]);
    await b.p;
    expect(b.events.at(-1)).toMatchObject({ t: "error", code: "TRUNCATED" });
  });

  it("dừng sau số bước tối đa", async () => {
    const r = run([[chunk([{ functionCall: { name: "list_saved_searches", args: {} } }])]]);
    await r.p;
    expect(r.events.at(-1)).toMatchObject({ t: "error" });
  });
});

describe("tiện ích Gemini", () => {
  it("tính token gồm cả token suy nghĩ", () => {
    expect(geminiUsage(chunk([]))).toMatchObject({ input_tokens: 100, output_tokens: 25 });
  });
  it("ánh xạ finishReason", () => {
    expect(finishToCode(FinishReason.STOP)).toBeNull();
    expect(finishToCode(FinishReason.MAX_TOKENS)).toBe("TRUNCATED");
    expect(finishToCode(undefined, true)).toBe("REFUSED");
  });
  it("khai báo đủ công cụ, schema là object", () => {
    expect(GEMINI_TOOLS.length).toBeGreaterThan(5);
    for (const t of GEMINI_TOOLS) expect((t.parametersJsonSchema as { type: string }).type).toBe("object");
  });
  it("Zod sinh được JSON Schema cho schema kết quả", () => {
    const js = z.toJSONSchema(creatorBriefSchema) as { type: string; properties: object };
    expect(js.type).toBe("object");
    expect(Object.keys(js.properties)).toContain("verdict");
  });
});

describe("chọn nhà cung cấp", () => {
  it("chỉ có khoá Gemini thì dùng Gemini", () => {
    const c = aiConfig({ GEMINI_API_KEY: "k" } as never);
    expect(c).toMatchObject({ provider: "gemini", configured: true, keyVar: "GEMINI_API_KEY" });
  });
  it("mặc định là Claude, AI_PROVIDER ghi đè", () => {
    expect(aiConfig({} as never)).toMatchObject({ provider: "anthropic", configured: false });
    expect(aiConfig({ GEMINI_API_KEY: "k", ANTHROPIC_API_KEY: "a" } as never).provider).toBe("anthropic");
    expect(aiConfig({ GEMINI_API_KEY: "k", ANTHROPIC_API_KEY: "a", AI_PROVIDER: "gemini" } as never).provider).toBe("gemini");
  });
});
