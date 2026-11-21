import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, ErrorNote, PageHeader, Pill } from "@/components/common";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { ago, dateTimeIso, until } from "@/lib/format";
import { listSearches, reopenStates, type SearchKind, type SearchRow } from "@/lib/history";
import { str } from "@/lib/params";

const PAGE_SIZE = 25;
const ALLOWED_COUNTS = [10, 20, 50];

const KINDS: { value: SearchKind | ""; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "creator", label: "Creator" },
  { value: "product", label: "Sản phẩm" },
  { value: "video", label: "Video" },
];
const KIND_LABEL: Record<SearchKind, string> = { creator: "Creator", product: "Sản phẩm", video: "Video" };

/** Đường dẫn mở lại một lần tìm. Số kết quả không nằm trong danh sách cho phép thì dùng 20. */
function reopenHref(r: SearchRow): { href: string; count: number } {
  const count = r.requested_count && ALLOWED_COUNTS.includes(r.requested_count) ? r.requested_count : 20;
  const q = encodeURIComponent(r.query);
  if (r.kind === "creator") return { href: `/creators?q=${q}&count=${count}`, count };
  if (r.kind === "product") return { href: `/products?q=${q}&limit=${count}`, count };
  return { href: `/videos?q=${q}&limit=${count}`, count };
}

function pageHref(kind: string, page: number): string {
  const p = new URLSearchParams();
  if (kind) p.set("kind", kind);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `/history?${s}` : "/history";
}

async function Rows({ kind, page }: { kind: SearchKind | ""; page: number }) {
  let data;
  try {
    data = await listSearches({ kind: kind || undefined, page, pageSize: PAGE_SIZE });
  } catch (e) {
    console.error("[history]", e instanceof Error ? e.message : e);
    return <ErrorNote error={{ message: "Không đọc được lịch sử tìm kiếm. Kiểm tra cấu hình Supabase." }} />;
  }
  const { rows, total } = data;
  if (rows.length === 0) {
    return <EmptyState>{kind ? "Chưa có lần tìm nào thuộc loại này." : "Chưa tìm kiếm nào. Thử tìm creator, sản phẩm hoặc video."}</EmptyState>;
  }

  const states = await reopenStates(rows, (r) => reopenHref(r).count);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-3">
      <Card className="gap-0 overflow-hidden py-0">
        <Table className="min-w-[46rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Loại</TableHead>
              <TableHead>Từ khoá</TableHead>
              <TableHead className="text-right">Kết quả</TableHead>
              <TableHead>Người tìm</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead>Mở lại</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const { href } = reopenHref(r);
              const st = states.get(r.id);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Pill>{KIND_LABEL[r.kind]}</Pill>
                  </TableCell>
                  <TableCell>
                    <Link href={href} prefetch={false} className="font-medium hover:text-primary hover:underline">
                      {r.query}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.result_ids.length}
                    {r.requested_count ? <span className="text-muted-foreground/70"> / {r.requested_count}</span> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.username ?? "—"}</TableCell>
                  <TableCell>
                    <span title={dateTimeIso(r.created_at)}>{ago(r.created_at)}</span>
                  </TableCell>
                  <TableCell>
                    {st?.free && st.expiresAt ? (
                      <Pill tone="good">Miễn phí, {until(st.expiresAt)}</Pill>
                    ) : (
                      <Pill tone="warn">Tốn 1 lượt</Pill>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} lần tìm · trang {page}/{pages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={pageHref(kind, page - 1)} prefetch={false} className="inline-flex h-8 items-center rounded-lg border bg-background px-3 text-sm hover:bg-muted">
              ← Mới hơn
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={pageHref(kind, page + 1)} prefetch={false} className="inline-flex h-8 items-center rounded-lg border bg-background px-3 text-sm hover:bg-muted">
              Cũ hơn →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default async function HistoryPage(props: PageProps<"/history">) {
  await requireUser();
  const sp = await props.searchParams;
  const kindParam = str(sp, "kind");
  const kind: SearchKind | "" = kindParam === "creator" || kindParam === "product" || kindParam === "video" ? kindParam : "";
  const page = Math.max(1, Math.min(1000, Math.floor(Number(str(sp, "page"))) || 1));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Lịch sử tìm kiếm"
        subtitle="Cột “Mở lại” cho biết mở lại lần tìm đó có tốn quota hay không: miễn phí nếu kết quả còn trong cache."
      />

      <nav className="flex flex-wrap gap-2" aria-label="Lọc theo loại">
        {KINDS.map((k) => {
          const active = k.value === kind;
          return (
            <Link
              key={k.value || "all"}
              href={pageHref(k.value, 1)}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {k.label}
            </Link>
          );
        })}
      </nav>

      <Suspense key={`${kind}|${page}`} fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Rows kind={kind} page={page} />
      </Suspense>
    </div>
  );
}
