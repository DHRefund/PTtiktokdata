import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { MAX_ITERATIONS, normalizeHistory, runChat, type ChatDeps, type ChatEvent } from "./chat";
import { executeTool, type AskData } from "./tools";

const usage = { input_tokens: 100, output_tokens: 50 } as Anthropic.Usage;

function msg(stop: Anthropic.Message["stop_reason"], content: Anthropic.ContentBlock[]): Anthropic.Message {
  return { id: "m", type: "message", role: "assistant", model: "x", content, stop_reason: stop, stop_sequence: null, usage } as unknown as Anthropic.Message;
}
const text = (t: string) => ({ type: "text", text: t, citations: null }) as unknown as Anthropic.ContentBlock;
const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input }) as unknown as Anthropic.ContentBlock;

const fakeData: AskData = {
  creators: async () => [{ handle: "a", nickname: "A", units_sold: 5 }],
  creatorDossier: async (h) => (h === "a" ? ({ handle: "a", data_as_of: {} } as never) : null),
  products: async () => [],
  productDetails: async () => null,
  videos: async () => [],
  searches: async () => [],
};

function setup(script: Anthropic.Message[], opts: { budgetError?: Error } = {}) {
  const requests: Anthropic.MessageStreamParams[] = [];
  const records: string[] = [];
  const events: ChatEvent[] = [];
  let i = 0;
  const deps: ChatDeps = {
    model: "claude-sonnet-5-5",
    stream: (params) => {
      requests.push(JSON.parse(JSON.stringify(params)));
      const m = script[Math.min(i++, script.length - 1)];
      return {
        onText: (cb) => {
          for (const b of m.content) if (b.type === "text") cb(b.text);
        },
        final: async () => m,
      };
    },
    runTool: (name, input) => executeTool(name, input, fakeData),
    record: async (_u, status) => {
      records.push(status);
      return 0.01;
    },
    assertBudget: async () => {
      if (opts.budgetError) throw opts.budgetError;
    },
  };
  return { deps, requests, records, events, emit: (e: ChatEvent) => events.push(e) };
}

describe("runChat", () => {
  it("câu trả lời thẳng: phát chữ rồi báo xong, ghi sổ một lần", async () => {
    const t = setup([msg("end_turn", [text("Xin chào")])]);
    await runChat({ history: [{ role: "user", content: "hi" }], deps: t.deps, emit: t.emit });
    expect(t.events).toEqual([
      { t: "text", v: "Xin chào" },
      { t: "done", costUsd: 0.01 },
    ]);
    expect(t.records).toEqual(["ok"]);
  });

  it("gọi công cụ rồi trả lời: gửi kết quả trong MỘT tin nhắn và giữ nguyên nội dung model trả về", async () => {
    const first = msg("tool_use", [text("Để tôi tra cứu."), toolUse("t1", "search_creators", { keyword: "a" }), toolUse("t2", "get_creator", { handle: "@a" })]);
    const t = setup([first, msg("end_turn", [text("Có 1 creator.")])]);
    await runChat({ history: [{ role: "user", content: "tìm" }], deps: t.deps, emit: t.emit });

    expect(t.requests).toHaveLength(2);
    const second = t.requests[1].messages;
    expect(second).toHaveLength(3);
    expect(second[1].role).toBe("assistant");
    expect(second[1].content).toEqual(first.content);
    const results = second[2].content as Anthropic.ToolResultBlockParam[];
    expect(second[2].role).toBe("user");
    expect(results.map((r) => r.tool_use_id)).toEqual(["t1", "t2"]);
    expect(results.every((r) => !r.is_error)).toBe(true);

    const kinds = t.events.map((e) => e.t);
    expect(kinds).toEqual(["text", "tool", "tool", "text", "text", "done"]);
    // đoạn văn ở vòng sau được tách bằng dòng trống
    expect(t.events.filter((e) => e.t === "text").map((e) => (e as { v: string }).v)).toEqual(["Để tôi tra cứu.", "\n\n", "Có 1 creator."]);
    expect(t.records).toEqual(["ok", "ok"]);
    expect(t.events.at(-1)).toEqual({ t: "done", costUsd: 0.02 });
  });

  it("công cụ lỗi (không có dữ liệu) trả is_error cho model chứ không làm sập vòng lặp", async () => {
    const t = setup([msg("tool_use", [toolUse("t1", "get_creator", { handle: "khong_co" })]), msg("end_turn", [text("Chưa có dữ liệu.")])]);
    await runChat({ history: [{ role: "user", content: "x" }], deps: t.deps, emit: t.emit });
    const r = (t.requests[1].messages[2].content as Anthropic.ToolResultBlockParam[])[0];
    expect(r.is_error).toBe(true);
    expect(t.events.at(-1)?.t).toBe("done");
  });

  it("suggest_fetch phát đề xuất cho giao diện, không tự lấy dữ liệu", async () => {
    const t = setup([
      msg("tool_use", [toolUse("t1", "suggest_fetch", { action: "creator_search", target: "son môi", reason: "chưa có dữ liệu" })]),
      msg("end_turn", [text("Bạn nên tìm thêm.")]),
    ]);
    await runChat({ history: [{ role: "user", content: "x" }], deps: t.deps, emit: t.emit });
    const p = t.events.find((e) => e.t === "proposal") as Extract<ChatEvent, { t: "proposal" }>;
    expect(p.p).toMatchObject({ cost: 1, href: "/creators?q=son%20m%C3%B4i&count=20" });
  });

  it("model từ chối: báo REFUSED và ghi sổ trạng thái refused", async () => {
    const t = setup([msg("refusal", [])]);
    await runChat({ history: [{ role: "user", content: "x" }], deps: t.deps, emit: t.emit });
    expect(t.events).toEqual([{ t: "error", code: "REFUSED", message: expect.any(String) }]);
    expect(t.records).toEqual(["refused"]);
  });

  it("câu trả lời bị cắt (max_tokens): báo TRUNCATED", async () => {
    const t = setup([msg("max_tokens", [text("dở dang")])]);
    await runChat({ history: [{ role: "user", content: "x" }], deps: t.deps, emit: t.emit });
    expect(t.events.at(-1)).toMatchObject({ t: "error", code: "TRUNCATED" });
  });

  it("dừng sau số vòng tối đa nếu model cứ gọi công cụ mãi", async () => {
    const t = setup([msg("tool_use", [toolUse("t", "list_saved_searches", {})])]);
    await runChat({ history: [{ role: "user", content: "x" }], deps: t.deps, emit: t.emit });
    expect(t.requests).toHaveLength(MAX_ITERATIONS);
    expect(t.events.at(-1)).toMatchObject({ t: "error" });
  });

  it("hết trần chi phí: ném lỗi trước khi gọi model", async () => {
    const t = setup([msg("end_turn", [text("x")])], { budgetError: new Error("het tran") });
    await expect(runChat({ history: [{ role: "user", content: "x" }], deps: t.deps, emit: t.emit })).rejects.toThrow("het tran");
    expect(t.requests).toHaveLength(0);
  });

  it("không gửi tham số lấy mẫu (temperature...) vì model đời mới từ chối", async () => {
    const t = setup([msg("end_turn", [text("x")])]);
    await runChat({ history: [{ role: "user", content: "x" }], deps: t.deps, emit: t.emit });
    const p = t.requests[0] as unknown as Record<string, unknown>;
    expect(p).not.toHaveProperty("temperature");
    expect(p).not.toHaveProperty("top_p");
    expect(p).not.toHaveProperty("tool_choice");
  });
});

describe("normalizeHistory", () => {
  it("bỏ tin nhắn trợ lý ở đầu và tin nhắn rỗng", () => {
    expect(
      normalizeHistory([
        { role: "assistant", content: "chào" },
        { role: "user", content: "hỏi" },
        { role: "assistant", content: "  " },
        { role: "user", content: "hỏi tiếp" },
      ]),
    ).toEqual([
      { role: "user", content: "hỏi" },
      { role: "user", content: "hỏi tiếp" },
    ]);
  });
});

describe("executeTool", () => {
  it("công cụ không tồn tại hoặc tham số sai thì trả lỗi", async () => {
    expect((await executeTool("xoa_het", {}, fakeData)).isError).toBe(true);
    expect((await executeTool("search_creators", { limit: 999 }, fakeData)).isError).toBe(true);
    expect((await executeTool("get_product_details", { id: "abc" }, fakeData)).isError).toBe(true);
  });

  it("search_creators trả dữ liệu rút gọn kèm tổng số đã lưu", async () => {
    const out = await executeTool("search_creators", { keyword: "a" }, fakeData);
    expect(out.isError).toBeUndefined();
    expect(JSON.parse(out.content)).toMatchObject({ total_saved: 1, shown: 1 });
  });

  it("suggest_fetch dựng đường dẫn an toàn từ mục tiêu (mã hoá URL, chuẩn hoá handle)", async () => {
    const out = await executeTool("suggest_fetch", { action: "creator_profile", target: "@A.B", reason: "r" }, fakeData);
    expect(out.proposal?.href).toBe("/creators/a.b");
    const evil = await executeTool("suggest_fetch", { action: "product_search", target: "x&limit=1#<script>", reason: "r" }, fakeData);
    expect(evil.proposal?.href).toBe("/products?q=x%26limit%3D1%23%3Cscript%3E&limit=20");
  });
});
