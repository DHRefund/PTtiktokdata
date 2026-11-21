"use client";

import { ArrowUpIcon, BotIcon, ExternalLinkIcon, Loader2Icon, SquareIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AiErrorNote } from "@/components/ai-views";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatEvent } from "@/lib/ai/chat";
import { usd } from "@/lib/format";

type Proposal = Extract<ChatEvent, { t: "proposal" }>["p"];
type Msg = { role: "user" | "assistant"; content: string; proposals?: Proposal[]; tools?: string[]; costUsd?: number; error?: string };

const TOOL_LABELS: Record<string, string> = {
  search_creators: "Tra cứu creator đã lưu",
  get_creator: "Đọc hồ sơ creator",
  search_products: "Tra cứu sản phẩm đã lưu",
  get_product_details: "Đọc chi tiết sản phẩm",
  search_videos: "Tra cứu video đã lưu",
  list_saved_searches: "Xem các lần tìm kiếm",
  suggest_fetch: "Đề xuất lấy thêm dữ liệu",
};

const STARTERS = [
  "Creator nào trong dữ liệu đã lưu bán được nhiều đơn nhất so với số người theo dõi?",
  "So sánh 3 creator bán nhiều nhất trong ngành làm đẹp",
  "Sản phẩm nào đã lưu có nhiều lượt bán mà giá dưới 100 nghìn?",
  "Video nào có tỷ lệ tương tác cao nhất và có điểm chung gì?",
  "Dữ liệu tôi đã lưu bao phủ những gì? Tôi nên tìm thêm gì?",
];

/** Đọc luồng NDJSON, gọi onEvent cho từng dòng đã nhận đủ. */
async function readEvents(res: Response, onEvent: (e: ChatEvent) => void) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        onEvent(JSON.parse(line) as ChatEvent);
      } catch {
        // bỏ qua dòng hỏng
      }
    }
  }
}

export function AskChat({ configured, coverage }: { configured: boolean; coverage: { creators: number; products: number; videos: number } }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const update = (fn: (last: Msg) => Msg) =>
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = [...messages, { role: "user" as const, content: question }];
    setMessages([...history, { role: "assistant", content: "", tools: [], proposals: [] }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        update((m) => ({ ...m, error: j?.error?.message ?? "Không gọi được trợ lý, hãy thử lại." }));
        return;
      }
      await readEvents(res, (e) => {
        if (e.t === "text") update((m) => ({ ...m, content: m.content + e.v }));
        else if (e.t === "tool") update((m) => ({ ...m, tools: [...(m.tools ?? []), e.name] }));
        else if (e.t === "proposal") update((m) => ({ ...m, proposals: [...(m.proposals ?? []), e.p] }));
        else if (e.t === "done") update((m) => ({ ...m, costUsd: e.costUsd }));
        else if (e.t === "error") update((m) => ({ ...m, error: e.message }));
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) update((m) => ({ ...m, error: "Mất kết nối tới trợ lý, hãy thử lại." }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!configured ? <AiErrorNote message="Chưa cấu hình khoá AI (GEMINI_API_KEY hoặc ANTHROPIC_API_KEY) trong .env.local nên chưa dùng được AI. Thêm khoá rồi khởi động lại server." /> : null}

      <p className="text-xs text-muted-foreground">
        Trợ lý chỉ đọc dữ liệu đã lưu: {coverage.creators} creator, {coverage.products} sản phẩm, {coverage.videos} video. Không tốn hạn mức TikToday. Muốn dữ liệu rộng hơn, hãy tìm kiếm thêm ở các trang Creator, Sản phẩm, Video.
      </p>

      <div className="flex min-h-64 flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Thử hỏi:</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!configured || busy}
                  onClick={() => send(s)}
                  className="rounded-full border bg-card px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-3"}>
            {m.role === "assistant" ? (
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <BotIcon className="size-4" />
              </span>
            ) : null}
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground" : "min-w-0 flex-1 text-sm"}>
              {m.role === "user" ? (
                <span className="flex items-start gap-2">
                  <UserIcon className="mt-0.5 size-3.5 shrink-0 opacity-70" />
                  <span className="whitespace-pre-line">{m.content}</span>
                </span>
              ) : (
                <>
                  {m.tools && m.tools.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {[...new Set(m.tools)].map((t) => (
                        <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {TOOL_LABELS[t] ?? t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {m.content ? <Markdown>{m.content}</Markdown> : busy && i === messages.length - 1 && !m.error ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2Icon className="size-4 animate-spin" /> Đang suy nghĩ...
                    </span>
                  ) : null}
                  {m.proposals && m.proposals.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-2">
                      {m.proposals.map((p, j) => (
                        <div key={j} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3">
                          <div className="min-w-0 text-sm">
                            <div className="font-medium">{p.label}</div>
                            <div className="text-xs text-muted-foreground">{p.reason} · tốn {p.cost} lượt hạn mức</div>
                          </div>
                          <Button asChild size="sm" variant="outline">
                            <Link href={p.href} prefetch={false}>
                              Mở <ExternalLinkIcon data-icon="inline-end" />
                            </Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {m.error ? <div className="mt-2"><AiErrorNote message={m.error} /></div> : null}
                  {m.costUsd != null ? <p className="mt-2 text-xs text-muted-foreground">Chi phí ước tính: {usd(m.costUsd)}</p> : null}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-0 flex items-end gap-2 rounded-xl border bg-background p-2 shadow-sm"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          maxLength={2000}
          disabled={!configured}
          placeholder="Hỏi về creator, sản phẩm, video đã lưu... (Enter để gửi, Shift+Enter xuống dòng)"
          className="min-h-9 resize-none border-0 shadow-none focus-visible:ring-0"
          aria-label="Câu hỏi"
        />
        {busy ? (
          <Button type="button" size="icon-lg" variant="outline" onClick={() => abortRef.current?.abort()} aria-label="Dừng">
            <SquareIcon />
          </Button>
        ) : (
          <Button type="submit" size="icon-lg" disabled={!configured || !input.trim()} aria-label="Gửi">
            <ArrowUpIcon />
          </Button>
        )}
      </form>
    </div>
  );
}
