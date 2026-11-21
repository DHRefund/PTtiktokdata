"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { compareCreators, type SavedAi } from "@/actions/ai";
import { AiDisclaimer, AiErrorNote, AiMetaLine, CompareView } from "@/components/ai-views";
import { Card } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AiMeta } from "@/lib/ai/errors";
import type { Comparison } from "@/lib/ai/schemas";

export function ComparePanel({
  handles,
  configured,
  ready,
  saved,
}: {
  handles: string[];
  configured: boolean;
  /** Đủ 2-3 creator và đều có dữ liệu đã lưu. */
  ready: boolean;
  saved: SavedAi<Comparison>;
}) {
  const [product, setProduct] = useState("");
  const [shown, setShown] = useState<{ data: Comparison; meta: AiMeta } | null>(
    saved ? { data: saved.result, meta: { cached: true, model: saved.model, createdAt: saved.createdAt, costUsd: 0 } } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card title={<span className="flex items-center gap-2"><SparklesIcon className="size-4 text-primary" /> So sánh bằng AI</span>}>
      {!configured ? <AiErrorNote message="Chưa cấu hình khoá AI (GEMINI_API_KEY hoặc ANTHROPIC_API_KEY) trong .env.local nên chưa dùng được AI." /> : null}
      <div className="flex flex-col gap-2">
        <label htmlFor="cmp-product" className="text-sm font-medium">
          Sản phẩm hoặc thương hiệu của bạn <span className="font-normal text-muted-foreground">(không bắt buộc, giúp so sánh sát nhu cầu)</span>
        </label>
        <Textarea
          id="cmp-product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          maxLength={600}
          rows={2}
          placeholder="Ví dụ: serum dưỡng da giá 250k, tệp nữ 25-34"
        />
      </div>
      <div>
        <Button
          type="button"
          size="lg"
          disabled={pending || !configured || !ready}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await compareCreators(handles, product);
              if (r.ok) setShown({ data: r.data, meta: r.meta });
              else setError(r.error.message);
            })
          }
        >
          {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
          {shown ? "So sánh lại" : "So sánh"}
        </Button>
      </div>
      {pending ? <p className="text-sm text-muted-foreground">AI đang so sánh, có thể mất 10-30 giây...</p> : null}
      {error ? <AiErrorNote message={error} /> : null}
      {shown ? (
        <div className="flex flex-col gap-3 border-t pt-4">
          <AiMetaLine meta={shown.meta} />
          <CompareView c={shown.data} />
          <AiDisclaimer />
        </div>
      ) : null}
    </Card>
  );
}
