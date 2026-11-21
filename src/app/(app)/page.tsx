import { CalendarDaysIcon, CalendarRangeIcon, ClapperboardIcon, SearchIcon, ShoppingBagIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { getDashboardStats, getUsageByDay, getUsageLog } from "@/actions/system";
import { UsageBarChart } from "@/components/charts";
import { CheckConnection } from "@/components/check-connection";
import { EmptyState, ErrorNote, PageHeader, Pill } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { ago } from "@/lib/format";
import { recentSearches } from "@/lib/history";

const fmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "medium",
});

function Meter({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function QuotaCard({
  title,
  icon,
  used,
  limit,
  resetsAt,
}: {
  title: string;
  icon: ReactNode;
  used: number;
  limit: number;
  resetsAt: string;
}) {
  const left = Math.max(0, limit - used);
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {icon}
          {title}
        </CardDescription>
        <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">
          {used}
          <span className="text-lg font-normal text-muted-foreground"> / {limit} lượt</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Meter used={used} limit={limit} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Còn {left} lượt</span>
          <span>Đặt lại {fmt.format(new Date(resetsAt))}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Mỗi khối tự lấy dữ liệu và được stream riêng, khối nào xong trước hiện trước.
async function QuotaCards() {
  const stats = await getDashboardStats();
  if (!stats.ok) return <ErrorNote error={stats.error} />;
  const s = stats.data;
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <QuotaCard title="Hôm nay" icon={<CalendarDaysIcon className="size-4" />} used={s.usedToday} limit={s.limitDay} resetsAt={s.dayResetsAt} />
      <QuotaCard
        title="Chu kỳ 30 ngày"
        icon={<CalendarRangeIcon className="size-4" />}
        used={s.usedCycle}
        limit={s.limitCycle}
        resetsAt={s.cycleResetsAt}
      />
    </section>
  );
}

async function UsageChartCard() {
  const [usage, stats] = await Promise.all([getUsageByDay(14), getDashboardStats()]);
  if (!usage.ok) return <ErrorNote error={usage.error} />;
  const limit = stats.ok ? stats.data.limitDay : 100;
  const total = usage.data.reduce((sum, p) => sum + p.used, 0);
  return (
    <Card>
      <CardHeader>
        <CardDescription>Lượt đã dùng mỗi ngày (14 ngày gần nhất)</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {total} <span className="text-base font-normal text-muted-foreground">lượt</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <UsageBarChart data={usage.data} limit={limit} />
      </CardContent>
    </Card>
  );
}

const KIND = {
  creator: { label: "Creator", href: "/creators?q=", icon: UsersIcon },
  product: { label: "Sản phẩm", href: "/products?q=", icon: ShoppingBagIcon },
  video: { label: "Video", href: "/videos?q=", icon: ClapperboardIcon },
} as const;

async function RecentSearches() {
  const rows = await recentSearches(6);
  if (rows.length === 0) {
    return <EmptyState>Chưa có lần tìm nào. Thử tìm một creator, sản phẩm hoặc video.</EmptyState>;
  }
  return (
    <Card className="gap-0 py-0">
      <ul className="divide-y">
        {rows.map((r) => {
          const k = KIND[r.kind];
          return (
            <li key={r.id}>
              <Link
                href={k.href + encodeURIComponent(r.query)}
                prefetch={false}
                className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <k.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.query}</span>
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{ago(r.created_at)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ResultBadge({ code }: { code: string | null }) {
  if (!code) return <Pill>đang chờ</Pill>;
  if (code === "OK") return <Pill tone="good">OK</Pill>;
  return (
    <Badge variant="destructive" className="font-normal">
      {code}
    </Badge>
  );
}

async function UsageTable() {
  const usage = await getUsageLog(12);
  if (!usage.ok) return <ErrorNote error={usage.error} />;
  if (usage.data.length === 0) return <EmptyState>Chưa có lượt gọi API nào.</EmptyState>;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Endpoint</TableHead>
            <TableHead>Kết quả</TableHead>
            <TableHead className="text-right">Quota</TableHead>
            <TableHead className="text-right">Thời gian xử lý</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usage.data.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{fmt.format(new Date(u.called_at))}</TableCell>
              <TableCell className="font-mono text-xs">{u.endpoint}</TableCell>
              <TableCell>
                <ResultBadge code={u.code} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{u.cost}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {u.duration_ms != null ? `${u.duration_ms} ms` : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default async function DashboardPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tổng quan" subtitle="Hạn mức API, các lần tìm gần đây và nhật ký gọi API." />

      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        }
      >
        <QuotaCards />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-72" />}>
        <UsageChartCard />
      </Suspense>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <SearchIcon className="size-4 text-muted-foreground" /> Tìm kiếm gần đây
            </h2>
            <Link href="/history" prefetch={false} className="text-sm text-muted-foreground hover:text-foreground">
              Xem tất cả
            </Link>
          </div>
          <Suspense fallback={<Skeleton className="h-64" />}>
            <RecentSearches />
          </Suspense>
          <p className="text-xs text-muted-foreground">Mở lại một lần tìm đọc từ cache nên không tốn lượt (trong thời hạn lưu).</p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Kết nối TikToday</h2>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Kiểm tra API key và kết nối tới TikToday. Lệnh này không tốn quota, chỉ chịu giới hạn tốc độ.
              </p>
              <CheckConnection />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Các lượt gọi API gần đây</h2>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <UsageTable />
        </Suspense>
      </section>
    </div>
  );
}
