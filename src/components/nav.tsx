import { MusicIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getDashboardStats } from "@/actions/system";
import { SidebarNav } from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";

function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {used}/{limit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sidebar-border">
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

async function QuotaCard() {
  const s = await getDashboardStats();
  if (!s.ok) return <p className="text-xs text-amber-600 dark:text-amber-400">Không đọc được quota</p>;
  const d = s.data;
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-sidebar-accent/40 p-3">
      <div className="text-xs font-medium">Hạn mức API</div>
      <QuotaBar label="Hôm nay" used={d.usedToday} limit={d.limitDay} />
      <QuotaBar label="Chu kỳ 30 ngày" used={d.usedCycle} limit={d.limitCycle} />
    </div>
  );
}

export function AppSidebar({ username }: { username: string }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="TikTok Data">
              <Link href="/" prefetch={false}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MusicIcon className="size-4" />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">TikTok Data</span>
                  <span className="truncate text-xs text-muted-foreground">TikToday API</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarNav />
      </SidebarContent>

      <SidebarFooter>
        <div className="group-data-[collapsible=icon]:hidden">
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <QuotaCard />
          </Suspense>
        </div>
        <UserMenu username={username} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
