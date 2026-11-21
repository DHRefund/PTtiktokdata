"use client";

import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loadCreatorSection } from "@/actions/creators";
import { Button } from "@/components/ui/button";

/** Mỗi creator chưa có dữ liệu cần tối đa 2 lượt: hồ sơ TikTok và số liệu affiliate. */
export const QUOTA_PER_CREATOR = 2;

/**
 * Tải hồ sơ các creator chưa có dữ liệu để so sánh. Gọi tuần tự (rate limit 2 lượt/giây), dừng ngay khi gặp lỗi
 * (ví dụ hết quota) để không tốn thêm lượt vô ích. Xong thì tải lại trang để đọc từ cache.
 */
export function LoadProfilesButton({ handles }: { handles: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const cost = handles.length * QUOTA_PER_CREATOR;

  const run = () =>
    start(async () => {
      let done = 0;
      for (const h of handles) {
        for (const section of ["profile", "affiliate"] as const) {
          setProgress(`Đang tải @${h} (${done + 1}/${handles.length * QUOTA_PER_CREATOR})`);
          const r = await loadCreatorSection(h, section);
          if (!r.ok) {
            toast.error(`Dừng ở @${h}: ${r.message}`);
            setProgress(null);
            router.refresh();
            return;
          }
          done++;
        }
      }
      setProgress(null);
      toast.success(`Đã tải hồ sơ ${handles.length} creator`);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" disabled={pending} onClick={run}>
        {pending ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
        Tải hồ sơ {handles.length} creator chưa có dữ liệu
      </Button>
      <span className="text-xs text-muted-foreground">
        {progress ?? `Tốn tối đa ${cost} lượt TikToday (${QUOTA_PER_CREATOR} lượt mỗi người: hồ sơ và số liệu bán hàng). Phần đã có sẽ không tốn thêm.`}
      </span>
    </div>
  );
}
