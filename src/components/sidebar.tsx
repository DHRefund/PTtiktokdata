"use client";

import {
  BookOpenIcon,
  BotMessageSquareIcon,
  ClapperboardIcon,
  FlameIcon,
  FlaskConicalIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  ScaleIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type Item = { href: string; label: string; icon: LucideIcon };

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Tra cứu",
    items: [
      { href: "/", label: "Tổng quan", icon: LayoutDashboardIcon },
      { href: "/creators", label: "Creator", icon: UsersIcon },
      { href: "/products", label: "Sản phẩm", icon: ShoppingBagIcon },
      { href: "/videos", label: "Video", icon: ClapperboardIcon },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/ask", label: "Hỏi AI", icon: BotMessageSquareIcon },
      { href: "/compare", label: "So sánh creator", icon: ScaleIcon },
      { href: "/hot", label: "Sản phẩm hot", icon: FlameIcon },
    ],
  },
  {
    label: "Công cụ",
    items: [
      { href: "/history", label: "Lịch sử", icon: HistoryIcon },
      { href: "/guide", label: "Hướng dẫn", icon: BookOpenIcon },
      { href: "/explore", label: "Thử nghiệm", icon: FlaskConicalIcon },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <>
      {GROUPS.map((g) => (
        <SidebarGroup key={g.label}>
          <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {g.items.map((it) => {
                const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
                return (
                  <SidebarMenuItem key={it.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={it.label}>
                      {/* prefetch tắt: trang đích có thể gọi API tốn quota */}
                      <Link href={it.href} prefetch={false}>
                        <it.icon />
                        <span>{it.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
