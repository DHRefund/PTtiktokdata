"use client";

import { ExternalLinkIcon, FlameIcon, Loader2Icon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { findHotProducts } from "@/actions/ai";
import { AiErrorNote, AiMetaLine } from "@/components/ai-views";
import { Card } from "@/components/common";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiMeta } from "@/lib/ai/errors";
import type { HotProductsResult } from "@/lib/ai/web";

const SUGGESTIONS = ["son môi", "serum dưỡng da", "đồ gia dụng thông minh", "thời trang nữ"];

export function HotProducts({ configured }: { configured: boolean }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState<{ q: string; data: HotProductsResult; meta: AiMeta } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (q: string) => {
    const text = q.trim();
    if (pending || (text && text.length < 2)) return;
    start(async () => {
      setError(null);
      const r = await findHotProducts(text);
      if (r.ok) setShown({ q: text, data: r.data, meta: r.meta });
      else setError(r.error.message);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {!configured ? <AiErrorNote message="Chưa có GEMINI_API_KEY trong .env.local. Tính năng này dùng công cụ tìm Google của Gemini." /> : null}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={80}
          placeholder="Nhập ngách hoặc từ khoá (ví dụ: son môi, đồ chơi trẻ em), hoặc bấm nút bên dưới để xem chung"
          className="h-9 min-w-0 flex-1 basis-64"
          aria-label="Ngách hoặc từ khoá"
        />
        <Button type="submit" size="lg" disabled={pending || !configured || query.trim().length < 2}>
          {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SearchIcon data-icon="inline-start" />}
          Tìm sản phẩm hot
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button type="button" variant="secondary" disabled={pending || !configured} onClick={() => run("")}>
          <FlameIcon data-icon="inline-start" />
          Sản phẩm hot trên TikTok nói chung (mọi ngành)
        </Button>
        <span className="text-muted-foreground">hoặc thử nhanh:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || !configured}
            onClick={() => {
              setQuery(s);
              run(s);
            }}
            className="rounded-full border bg-card px-3 py-1 transition-colors hover:bg-muted disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {pending ? <p className="text-sm text-muted-foreground">Gemini đang tìm trên web, có thể mất 10-40 giây...</p> : null}
      {error ? <AiErrorNote message={error} /> : null}

      {shown ? (
        <Card title={<span className="flex items-center gap-2"><FlameIcon className="size-4 text-primary" /> {shown.q ? `Sản phẩm đang được nhắc nhiều: ${shown.q}` : "Sản phẩm hot trên TikTok nói chung"}</span>}>
          <AiMetaLine meta={shown.meta} />
          <div className="text-sm">
            <Markdown>{shown.data.text}</Markdown>
          </div>

          {shown.data.sources.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <h4 className="text-sm font-semibold">Nguồn ({shown.data.sources.length})</h4>
              <ul className="flex flex-col gap-1 text-sm">
                {shown.data.sources.map((s) => (
                  <li key={s.uri}>
                    <a href={s.uri} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                      <ExternalLinkIcon className="size-3.5 shrink-0" />
                      <span className="break-all">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
              {shown.data.queries.length > 0 ? <p className="text-xs text-muted-foreground">Gemini đã tìm: {shown.data.queries.join(" · ")}</p> : null}
            </div>
          ) : (
            <p className="border-t pt-3 text-sm text-amber-700 dark:text-amber-400">Gemini không trả về nguồn nào, hãy xem kết quả này như gợi ý chưa kiểm chứng.</p>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
            <span className="text-muted-foreground">
              {shown.q ? "Muốn có số đã bán thật từ TikTok Shop?" : "Muốn kiểm tra số đã bán thật? Gõ tên một sản phẩm ở trang Sản phẩm (tốn 1 lượt)."}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href={shown.q ? `/products?q=${encodeURIComponent(shown.q)}&limit=20` : "/products"} prefetch={false}>
                {shown.q ? `Tìm “${shown.q}” ở trang Sản phẩm (tốn 1 lượt)` : "Mở trang Sản phẩm"}
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Kết quả do AI tổng hợp từ web, chỉ mang tính tham khảo và có thể sai hoặc lỗi thời. Số đơn bán thường không công khai trên web, hãy đối chiếu ở trang Sản phẩm trước khi quyết định.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
