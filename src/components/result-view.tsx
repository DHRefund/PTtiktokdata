import type { ActionResult } from "@/lib/result";

// Không có state hay hook nên dùng được ở cả Server lẫn Client Component.

const fmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "medium",
});

export function MetaLine({ r }: { r: ActionResult<unknown> }) {
  const meta = r.ok ? r.meta : r.meta;
  if (!meta) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>Nguồn: {meta.source === "cache" ? "cache" : "API (vừa gọi)"}</span>
      <span>Cập nhật: {fmt.format(new Date(meta.fetchedAt))}</span>
      {meta.stale ? <span className="text-amber-600">đã quá hạn</span> : null}
      {meta.quota ? (
        <span>
          Đã dùng: {meta.quota.usedToday} hôm nay, {meta.quota.usedCycle} trong chu kỳ
        </span>
      ) : null}
      {meta.requestId ? <span>request_id: {meta.requestId}</span> : null}
    </div>
  );
}

export function JsonResult({ title, r }: { title: string; r: ActionResult<unknown> }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">{title}</h3>
      <MetaLine r={r} />
      {r.ok ? (
        <>
          {r.meta.warning ? <p className="text-sm text-amber-600">{r.meta.warning}</p> : null}
          <pre className="max-h-[28rem] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(r.data, null, 2)}
          </pre>
        </>
      ) : (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {r.error.message}
          {r.error.retryAfterMs ? ` (thử lại sau ${Math.ceil(r.error.retryAfterMs / 1000)} giây)` : ""}
        </p>
      )}
    </section>
  );
}
