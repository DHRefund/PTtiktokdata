import { AlertCircleIcon, InboxIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as UiCard, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { dateTimeIso, pct } from "@/lib/format";
import type { ActionError, Meta } from "@/lib/result";
import { cn } from "@/lib/utils";

// Lớp mỏng trên shadcn/ui giữ nguyên tên cũ (Card, Pill, Stat...) để các trang không phải đổi.
// Không có state hay hook nên dùng được ở cả Server lẫn Client Component.

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="max-w-3xl text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  children,
  right,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <UiCard className={className}>
      {title || right ? (
        <CardHeader>
          {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
          {right ? <CardAction>{right}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </UiCard>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-lg font-semibold tracking-tight tabular-nums">{value}</div>
      {hint ? <div className="truncate text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

const TONES = {
  neutral: "",
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
} as const;

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <Badge variant="secondary" className={cn("h-auto max-w-full py-0.5 font-normal", TONES[tone])}>
      {children}
    </Badge>
  );
}

/** Ảnh từ CDN TikTok: link có chữ ký, hạn dùng và nhiều tên miền nên không để Next tối ưu lại. */
export function Img({
  src,
  alt,
  width,
  height,
  className,
  rounded = "rounded-md",
}: {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  rounded?: string;
}) {
  if (!src) {
    return <div className={cn(rounded, "bg-muted", className)} style={{ width, height }} aria-hidden />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      referrerPolicy="no-referrer"
      className={cn(rounded, "bg-muted object-cover", className)}
      style={{ width, height }}
    />
  );
}

export function ErrorNote({
  error,
  children,
}: {
  error: Pick<ActionError, "message" | "retryAfterMs" | "requestId">;
  children?: ReactNode;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertDescription className="flex flex-col items-start gap-2">
        <p>
          {error.message}
          {error.retryAfterMs ? ` Thử lại sau ${Math.ceil(error.retryAfterMs / 1000)} giây.` : ""}
        </p>
        {error.requestId ? <p className="text-xs opacity-70">request_id: {error.requestId}</p> : null}
        {children}
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <InboxIcon className="size-5" />
      </span>
      <div className="max-w-md">{children}</div>
    </div>
  );
}

/** Dòng nhỏ cho biết dữ liệu lấy từ đâu và cập nhật lúc nào. */
export function SourceNote({ meta }: { meta?: Meta }) {
  if (!meta) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <Pill tone={meta.source === "api" ? "good" : "neutral"}>{meta.source === "api" ? "Vừa gọi API" : "Từ cache"}</Pill>
      <span>Cập nhật {dateTimeIso(meta.fetchedAt)}</span>
      {meta.stale ? <Pill tone="warn">đã quá hạn</Pill> : null}
      {meta.warning ? <span className="text-amber-600 dark:text-amber-400">{meta.warning}</span> : null}
    </div>
  );
}

/** Thanh ngang thể hiện tỷ lệ (0 đến 1). */
export function ShareBars({ items }: { items: { label: string; share: number }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  const max = Math.max(...items.map((i) => i.share), 0.0001);
  return (
    <ul className="flex flex-col gap-2">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-sm">
          <span className="truncate text-muted-foreground">{i.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span className="block h-2 rounded-full bg-chart-1" style={{ width: `${Math.max(2, (i.share / max) * 100)}%` }} />
          </span>
          <span className="text-right tabular-nums">{pct(i.share)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ô chọn có nhãn, dùng được trong form GET (select gốc nên gửi giá trị bình thường). */
export function FormSelect({
  name,
  defaultValue,
  label,
  options,
}: {
  name: string;
  defaultValue: string | number;
  label: string;
  options: { value: string | number; label: string }[];
}) {
  return (
    <NativeSelect name={name} defaultValue={String(defaultValue)} aria-label={label} className="[&_select]:h-9">
      {options.map((o) => (
        <NativeSelectOption key={o.value} value={String(o.value)}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** Form tìm kiếm dùng GET: đường dẫn chia sẻ được, tải lại trang đọc từ cache. */
export function SearchForm({
  action,
  name,
  defaultValue,
  placeholder,
  cost,
  children,
}: {
  action: string;
  name: string;
  defaultValue?: string;
  placeholder: string;
  cost: number;
  children?: ReactNode;
}) {
  return (
    <form action={action} method="GET" className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required
          maxLength={200}
          className="h-9 pl-9"
        />
      </div>
      {children}
      <Button type="submit" size="lg">
        Tìm ({cost} lượt)
      </Button>
    </form>
  );
}
