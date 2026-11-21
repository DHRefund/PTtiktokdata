"use client";

import { Loader2Icon, MailIcon, SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { analyzeCreator, draftOutreach, type SavedAi } from "@/actions/ai";
import { AiDisclaimer, AiErrorNote, AiMetaLine, BriefView, OutreachView } from "@/components/ai-views";
import { Card } from "@/components/common";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { AiMeta } from "@/lib/ai/errors";
import type { CreatorBrief, Outreach } from "@/lib/ai/schemas";

type Shown<T> = { data: T; meta: AiMeta } | null;

const fromSaved = <T,>(s: SavedAi<T>): Shown<T> =>
  s ? { data: s.result, meta: { cached: true, model: s.model, createdAt: s.createdAt, costUsd: 0 } } : null;

export function AiCreatorPanel({
  handle,
  configured,
  hasData,
  savedBrief,
  savedOutreach,
}: {
  handle: string;
  configured: boolean;
  hasData: boolean;
  savedBrief: SavedAi<CreatorBrief>;
  savedOutreach: SavedAi<Outreach>;
}) {
  const [product, setProduct] = useState("");
  const [tone, setTone] = useState<"than_thien" | "chuyen_nghiep">("than_thien");
  const [brief, setBrief] = useState<Shown<CreatorBrief>>(fromSaved(savedBrief));
  const [outreach, setOutreach] = useState<Shown<Outreach>>(fromSaved(savedOutreach));
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<"brief" | "outreach" | null>(null);
  const [pending, start] = useTransition();

  const disabled = pending || !configured || !hasData;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Đã sao chép"),
      () => toast.error("Không sao chép được"),
    );
  };

  return (
    <Card title={<span className="flex items-center gap-2"><SparklesIcon className="size-4 text-primary" /> Phân tích bằng AI</span>}>
      {!configured ? (
        <AiErrorNote message="Chưa cấu hình khoá AI (GEMINI_API_KEY hoặc ANTHROPIC_API_KEY) trong .env.local nên chưa dùng được AI." />
      ) : !hasData ? (
        <p className="text-sm text-muted-foreground">Chưa có dữ liệu đã lưu về creator này để phân tích.</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="ai-product" className="text-sm font-medium">
          Sản phẩm hoặc thương hiệu của bạn <span className="font-normal text-muted-foreground">(không bắt buộc với phân tích, cần cho tin nhắn mời)</span>
        </label>
        <Textarea
          id="ai-product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          maxLength={600}
          rows={2}
          placeholder="Ví dụ: son kem lì giá 150k, tệp nữ 18-25, đang tìm KOC review"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="lg"
          disabled={disabled}
          onClick={() =>
            start(async () => {
              setError(null);
              setRunning("brief");
              const r = await analyzeCreator(handle, product);
              setRunning(null);
              if (r.ok) setBrief({ data: r.data, meta: r.meta });
              else setError(r.error.message);
            })
          }
        >
          {pending && running === "brief" ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
          {brief ? "Phân tích lại" : "Phân tích creator"}
        </Button>

        <NativeSelect value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} aria-label="Giọng văn" className="[&_select]:h-9">
          <NativeSelectOption value="than_thien">Giọng thân thiện</NativeSelectOption>
          <NativeSelectOption value="chuyen_nghiep">Giọng chuyên nghiệp</NativeSelectOption>
        </NativeSelect>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={disabled || !product.trim()}
          title={product.trim() ? undefined : "Hãy mô tả sản phẩm của bạn ở ô phía trên"}
          onClick={() =>
            start(async () => {
              setError(null);
              setRunning("outreach");
              const r = await draftOutreach(handle, product, tone);
              setRunning(null);
              if (r.ok) setOutreach({ data: r.data, meta: r.meta });
              else setError(r.error.message);
            })
          }
        >
          {pending && running === "outreach" ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <MailIcon data-icon="inline-start" />}
          Soạn tin nhắn mời hợp tác
        </Button>
      </div>

      {pending ? <p className="text-sm text-muted-foreground">AI đang xử lý, thường mất vài giây...</p> : null}
      {error ? <AiErrorNote message={error} /> : null}

      {brief ? (
        <div className="flex flex-col gap-3 border-t pt-4">
          <h3 className="font-semibold">Đánh giá creator</h3>
          <AiMetaLine meta={brief.meta} />
          <BriefView b={brief.data} />
        </div>
      ) : null}

      {outreach ? (
        <div className="flex flex-col gap-3 border-t pt-4">
          <h3 className="font-semibold">Tin nhắn mời hợp tác</h3>
          <AiMetaLine meta={outreach.meta} />
          <OutreachView o={outreach.data} copy={copy} />
        </div>
      ) : null}

      {brief || outreach ? <AiDisclaimer /> : null}
    </Card>
  );
}
