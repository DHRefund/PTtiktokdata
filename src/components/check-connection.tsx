"use client";

import { CheckCircle2Icon, Loader2Icon, PlugZapIcon, XCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { checkConnection } from "@/actions/system";
import { Button } from "@/components/ui/button";

export function CheckConnection() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await checkConnection();
            setResult(
              r.ok
                ? { ok: true, message: "Key hợp lệ, kết nối tốt (không tốn quota)." }
                : { ok: false, message: r.error.message },
            );
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <PlugZapIcon data-icon="inline-start" />}
        {pending ? "Đang kiểm tra..." : "Kiểm tra key và kết nối"}
      </Button>
      {result ? (
        <span
          className={`flex items-center gap-1.5 text-sm ${result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
        >
          {result.ok ? <CheckCircle2Icon className="size-4" /> : <XCircleIcon className="size-4" />}
          {result.message}
        </span>
      ) : null}
    </div>
  );
}
