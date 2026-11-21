import { cookies } from "next/headers";
import { HeaderBreadcrumb } from "@/components/header-breadcrumb";
import { AppSidebar } from "@/components/nav";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  // shadcn lưu trạng thái đóng/mở thanh bên vào cookie để lần sau không bị nhấp nháy
  const open = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={open}>
      <AppSidebar username={user.username} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <HeaderBreadcrumb />
        </header>
        <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
