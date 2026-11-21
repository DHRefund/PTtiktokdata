"use client";

import { ExternalLinkIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getCreatorOverview, previewCreatorOverviewCost, searchCreators } from "@/actions/creators";
import { Card } from "@/components/common";
import { JsonResult } from "@/components/result-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/result";

type Overview = { profile: ActionResult<unknown>; affiliate: ActionResult<unknown> };

export function Explorer() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [handle, setHandle] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewErr, setOverviewErr] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [count, setCount] = useState(20);
  const [search, setSearch] = useState<ActionResult<unknown> | null>(null);

  const load = (force: boolean) =>
    start(async () => {
      setOverviewErr(null);
      const r = await getCreatorOverview({ handle, forceRefresh: force });
      if (!r.ok) {
        setOverview(null);
        setOverviewErr(r.error.message);
        return;
      }
      setOverview(r.data);
    });

  return (
    <div className="flex flex-col gap-6">
      <Card title="Hồ sơ creator (profile + affiliate)">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-9 max-w-xs"
            placeholder="handle, ví dụ example.creator"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setPreview(null);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={pending || !handle.trim()}
            onClick={() =>
              start(async () => {
                setOverviewErr(null);
                const p = await previewCreatorOverviewCost({ handle });
                if (!p.ok) {
                  setOverviewErr(p.error.message);
                  return;
                }
                setPreview(
                  p.data.cost === 0
                    ? "Đã có trong cache, không tốn lượt nào."
                    : `Sẽ tốn ${p.data.cost} lượt (chưa có: ${p.data.missing.join(", ")}).`,
                );
              })
            }
          >
            Xem trước chi phí
          </Button>
          <Button type="button" size="lg" disabled={pending || !handle.trim()} onClick={() => load(false)}>
            {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
            Tải hồ sơ
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending || !handle.trim()}
            title="Bỏ qua cache, tốn quota"
            onClick={() => load(true)}
          >
            <RefreshCwIcon data-icon="inline-start" /> Làm mới
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={!handle.trim()}
            title="Mở trang hồ sơ render ở server (có URL riêng)"
            onClick={() => router.push(`/creators/${encodeURIComponent(handle.trim().replace(/^@/, ""))}`)}
          >
            <ExternalLinkIcon data-icon="inline-start" /> Mở trang hồ sơ
          </Button>
        </div>
        {preview ? <p className="text-sm text-muted-foreground">{preview}</p> : null}
        {overviewErr ? <p className="text-sm text-destructive">{overviewErr}</p> : null}
        {overview ? (
          <div className="flex flex-col gap-6">
            <JsonResult title="creator.profile" r={overview.profile} />
            <JsonResult title="creator.affiliate" r={overview.affiliate} />
          </div>
        ) : null}
      </Card>

      <Card title="Tìm creator affiliate">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-9 max-w-xs"
            placeholder="từ khoá (có thể để trống)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Input
            className="h-9 w-24"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setSearch(await searchCreators({ keyword, count }));
              })
            }
          >
            {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
            Tìm (1 lượt)
          </Button>
        </div>
        {search ? <JsonResult title="creator.search" r={search} /> : null}
      </Card>
    </div>
  );
}
