"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlertIcon className="size-5" />
      </span>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Có lỗi xảy ra</h2>
        <p className="text-sm text-muted-foreground">
          Không tải được trang. Kiểm tra kết nối Supabase và log của server rồi thử lại.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={reset}>
        <RotateCcwIcon data-icon="inline-start" /> Thử lại
      </Button>
    </div>
  );
}
