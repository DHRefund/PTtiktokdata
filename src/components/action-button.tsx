"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Ack } from "@/lib/result";

/**
 * Nút gọi một Server Action rồi làm mới trang (trang đọc lại dữ liệu vừa được lưu vào cache).
 * Chỉ nhận action đã gắn sẵn tham số từ Server Component, ví dụ loadCreatorSection.bind(null, handle, "videos").
 */
export function ActionButton({
  action,
  label,
  pendingLabel = "Đang tải...",
  variant = "primary",
}: {
  action: () => Promise<Ack>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "ghost";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="lg"
      variant={variant === "primary" ? "default" : "outline"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await action();
          if (r.ok) {
            toast.success("Đã cập nhật dữ liệu");
            router.refresh();
          } else {
            toast.error(r.message);
          }
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}
