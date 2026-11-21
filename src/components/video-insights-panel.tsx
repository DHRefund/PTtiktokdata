"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { analyzeVideos, type SavedAi } from "@/actions/ai";
import { AiDisclaimer, AiErrorNote, AiMetaLine, VideoInsightsView } from "@/components/ai-views";
import { Card } from "@/components/common";
import { Button } from "@/components/ui/button";
import type { AiMeta } from "@/lib/ai/errors";
import type { VideoInsights } from "@/lib/ai/schemas";

/** Phân tích nhóm video đang hiển thị (đọc lại từ cache theo từ khoá, không nhận dữ liệu từ trình duyệt). */
export function VideoInsightsPanel({
  query,
  limit,
  configured,
  saved,
}: {
  query: string;
  limit: number;
  configured: boolean;
  saved: SavedAi<VideoInsights>;
}) {
  const [shown, setShown] = useState<{ data: VideoInsights; meta: AiMeta } | null>(
    saved ? { data: saved.result, meta: { cached: true, model: saved.model, createdAt: saved.createdAt, costUsd: 0 } } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card title={<span className="flex items-center gap-2"><SparklesIcon className="size-4 text-primary" /> Rút quy luật nội dung bằng AI</span>}>
      <p className="text-sm text-muted-foreground">AI đọc các video ở bên dưới (mô tả, hashtag, độ dài, tương tác) để tìm điểm chung của video đang chạy tốt và gợi ý brief.</p>
      {!configured ? <AiErrorNote message="Chưa cấu hình khoá AI (GEMINI_API_KEY hoặc ANTHROPIC_API_KEY) trong .env.local nên chưa dùng được AI." /> : null}
      <div>
        <Button
          type="button"
          size="lg"
          variant={shown ? "outline" : "default"}
          disabled={pending || !configured}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await analyzeVideos(query, limit);
              if (r.ok) setShown({ data: r.data, meta: r.meta });
              else setError(r.error.message);
            })
          }
        >
          {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
          {shown ? "Phân tích lại" : "Phân tích video"}
        </Button>
      </div>
      {pending ? <p className="text-sm text-muted-foreground">AI đang phân tích, có thể mất 10-30 giây...</p> : null}
      {error ? <AiErrorNote message={error} /> : null}
      {shown ? (
        <div className="flex flex-col gap-3 border-t pt-4">
          <AiMetaLine meta={shown.meta} />
          <VideoInsightsView v={shown.data} />
          <AiDisclaimer />
        </div>
      ) : null}
    </Card>
  );
}
