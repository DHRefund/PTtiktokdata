import { CheckCircle2Icon, CircleAlertIcon } from "lucide-react";
import Link from "next/link";
import { getSavedComparison } from "@/actions/ai";
import { LoadProfilesButton } from "@/components/load-profiles-button";
import { ComparePanel } from "@/components/compare-panel";
import { Card, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aiConfig } from "@/lib/ai/config";
import { loadCreatorDossier } from "@/lib/ai/dossier";
import { requireUser } from "@/lib/auth/session";
import { str } from "@/lib/params";
import { handleSchema } from "@/lib/tiktoday/schemas";

export default async function ComparePage(props: PageProps<"/compare">) {
  await requireUser();
  const sp = await props.searchParams;
  const raw = str(sp, "handles");

  // "a, b c" -> ["a","b","c"], bỏ trùng và handle sai, tối đa 3
  const handles = [
    ...new Set(
      raw
        .split(/[,\s]+/)
        .map((h) => handleSchema.safeParse(h))
        .flatMap((r) => (r.success ? [r.data] : [])),
    ),
  ].slice(0, 3);

  const dossiers = await Promise.all(handles.map((h) => loadCreatorDossier(h).catch(() => null)));
  const missing = handles.filter((_, i) => !dossiers[i]);
  const ready = handles.length >= 2 && dossiers.every(Boolean);
  const saved = handles.length >= 2 ? await getSavedComparison(handles) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="So sánh creator"
        subtitle="Chọn 2 đến 3 creator đã có dữ liệu lưu để AI so sánh và xếp hạng. Từ bảng kết quả tìm creator, tick chọn rồi bấm So sánh."
      />

      <form action="/compare" method="GET" className="flex flex-wrap items-center gap-2">
        <Input name="handles" defaultValue={handles.join(", ")} placeholder="handle, cách nhau bằng dấu phẩy. Ví dụ: hannaholala, tunpham97" className="h-9 min-w-0 flex-1 basis-64" />
        <Button type="submit" size="lg" variant="outline">
          Cập nhật danh sách
        </Button>
      </form>

      {handles.length > 0 ? (
        <Card title="Dữ liệu đã lưu">
          <ul className="flex flex-col gap-2 text-sm">
            {handles.map((h, i) => (
              <li key={h} className="flex flex-wrap items-center gap-2">
                {dossiers[i] ? <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" /> : <CircleAlertIcon className="size-4 text-amber-600" />}
                <Link href={`/creators/${encodeURIComponent(h)}`} prefetch={false} className="font-medium hover:underline">
                  @{h}
                </Link>
                <span className="text-muted-foreground">
                  {dossiers[i]
                    ? [dossiers[i]!.profile && "hồ sơ", dossiers[i]!.affiliate && "số liệu bán hàng", dossiers[i]!.videos && "video"].filter(Boolean).join(", ")
                    : "chưa có dữ liệu (cần tải hồ sơ, tối đa 2 lượt)"}
                </span>
              </li>
            ))}
          </ul>
          {missing.length > 0 ? <LoadProfilesButton handles={missing} /> : null}
        </Card>
      ) : null}

      {handles.length < 2 ? (
        <p className="text-sm text-muted-foreground">Cần ít nhất 2 creator để so sánh.</p>
      ) : (
        <ComparePanel handles={handles} configured={aiConfig().configured} ready={ready} saved={saved} />
      )}
    </div>
  );
}
