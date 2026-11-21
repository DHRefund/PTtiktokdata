import { BotIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, Pill } from "@/components/common";
import { dateTimeIso, usd } from "@/lib/format";
import type { AiMeta } from "@/lib/ai/errors";
import type { Comparison, CreatorBrief, Outreach, VideoInsights } from "@/lib/ai/schemas";

// Hiển thị kết quả AI có cấu trúc. Thuần trình bày, dùng được ở Server lẫn Client Component.

export function AiMetaLine({ meta }: { meta: AiMeta }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <Pill tone={meta.cached ? "neutral" : "good"}>{meta.cached ? "Kết quả đã lưu, miễn phí" : `Vừa tạo · ${usd(meta.costUsd)}`}</Pill>
      <span>{dateTimeIso(meta.createdAt)}</span>
      <span className="font-mono">{meta.model}</span>
    </div>
  );
}

/** Nhắc rõ đây là phân tích tự động từ dữ liệu đã lưu, không phải sự thật tuyệt đối. */
export function AiDisclaimer() {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <BotIcon className="mt-0.5 size-3.5 shrink-0" />
      Phân tích tự động từ dữ liệu đã lưu trong ứng dụng, có thể sai. Hãy đối chiếu với số liệu gốc trước khi quyết định.
    </p>
  );
}

export function AiErrorNote({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function List({ items, empty }: { items: string[]; empty?: string }) {
  if (items.length === 0) return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function Evidence({ items }: { items: { point: string; evidence: string }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Không có.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((p, i) => (
        <li key={i}>
          <div className="font-medium">{p.point}</div>
          <div className="text-xs text-muted-foreground">Căn cứ: {p.evidence}</div>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </div>
  );
}

const VERDICT = {
  recommend: { label: "Nên thử hợp tác", tone: "good" as const },
  consider: { label: "Cân nhắc kỹ", tone: "warn" as const },
  skip: { label: "Không phù hợp", tone: "bad" as const },
};

export function BriefView({ b }: { b: CreatorBrief }) {
  const v = VERDICT[b.verdict];
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {v.tone === "bad" ? <Badge variant="destructive">{v.label}</Badge> : <Pill tone={v.tone}>{v.label}</Pill>}
        </div>
        <p className="font-medium">{b.headline}</p>
        <p className="text-sm text-muted-foreground">{b.verdict_reason}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Block title="Điểm mạnh">
          <Evidence items={b.strengths} />
        </Block>
        <Block title="Rủi ro cần lưu ý">
          <Evidence items={b.risks} />
        </Block>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Block title="Hợp với sản phẩm">
          <List items={b.best_for} />
        </Block>
        <Block title="Tệp người theo dõi">
          <p className="text-sm">{b.audience_fit}</p>
        </Block>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Block title="Ý tưởng nội dung">
          <List items={b.content_ideas} />
        </Block>
        <Block title="Câu hỏi nên hỏi trước khi hợp tác">
          <List items={b.questions_to_ask} />
        </Block>
      </div>
      {b.data_gaps.length > 0 ? (
        <Block title="Dữ liệu còn thiếu">
          <List items={b.data_gaps} />
        </Block>
      ) : null}
    </div>
  );
}

function CopyBtn({ text, copy }: { text: string; copy?: (text: string) => void }) {
  if (!copy) return null;
  return (
    <button type="button" onClick={() => copy(text)} className="text-xs text-muted-foreground underline hover:text-foreground">
      Sao chép
    </button>
  );
}

export function OutreachView({ o, copy }: { o: Outreach; copy?: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Block title="Tin nhắn ngắn (Zalo hoặc tin nhắn riêng TikTok)">
        <div className="rounded-lg bg-muted/60 p-3 text-sm whitespace-pre-line">{o.short_message}</div>
        <CopyBtn text={o.short_message} copy={copy} />
      </Block>
      <Block title="Email">
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <div className="mb-2 font-medium">{o.email_subject}</div>
          <div className="whitespace-pre-line">{o.email_body}</div>
        </div>
        <CopyBtn text={`${o.email_subject}\n\n${o.email_body}`} copy={copy} />
      </Block>
      {o.personalization_points.length > 0 ? (
        <Block title="Chi tiết đã cá nhân hoá">
          <List items={o.personalization_points} />
        </Block>
      ) : null}
    </div>
  );
}

export function CompareView({ c }: { c: Comparison }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{c.summary}</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {c.creators.map((x) => (
          <Card key={x.handle} title={`@${x.handle}`}>
            <Block title="Điểm mạnh">
              <List items={x.strengths} />
            </Block>
            <Block title="Điểm yếu">
              <List items={x.weaknesses} />
            </Block>
            <Block title="Nên dùng cho">
              <p className="text-sm">{x.best_use}</p>
            </Block>
          </Card>
        ))}
      </div>
      <Block title="Xếp hạng">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {c.ranking.map((r) => (
            <li key={r.handle}>
              <span className="font-medium">@{r.handle}</span>: {r.reason}
            </li>
          ))}
        </ol>
      </Block>
      <Block title="Khuyến nghị">
        <p className="text-sm">{c.recommendation}</p>
      </Block>
      {c.caveats.length > 0 ? (
        <Block title="Cần thận trọng">
          <List items={c.caveats} />
        </Block>
      ) : null}
    </div>
  );
}

export function VideoInsightsView({ v }: { v: VideoInsights }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{v.summary}</p>
      <Block title="Quy luật rút ra">
        <Evidence items={v.patterns} />
      </Block>
      <div className="grid gap-4 md:grid-cols-2">
        <Block title="Hashtag đáng dùng">
          <ul className="space-y-1 text-sm">
            {v.hashtags.map((h) => (
              <li key={h.tag}>
                <span className="font-medium">#{h.tag.replace(/^#/, "")}</span>: <span className="text-muted-foreground">{h.note}</span>
              </li>
            ))}
          </ul>
        </Block>
        <Block title="Độ dài video">
          <p className="text-sm">{v.duration_advice}</p>
        </Block>
      </div>
      <Block title="Brief video gợi ý">
        <div className="grid gap-3 md:grid-cols-2">
          {v.briefs.map((b, i) => (
            <div key={i} className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm">
              <div className="font-medium">{b.angle}</div>
              <ol className="list-decimal space-y-0.5 pl-5">
                {b.outline.map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ol>
              <div className="text-muted-foreground">Kêu gọi: {b.cta}</div>
            </div>
          ))}
        </div>
      </Block>
      {v.caveats.length > 0 ? (
        <Block title="Giới hạn của kết luận">
          <List items={v.caveats} />
        </Block>
      ) : null}
    </div>
  );
}
