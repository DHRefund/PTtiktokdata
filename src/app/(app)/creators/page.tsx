import { Suspense } from "react";
import { searchCreators } from "@/actions/creators";
import { CreatorDataTable } from "@/components/creator-data-table";
import { EmptyState, ErrorNote, FormSelect, PageHeader, SearchForm, SourceNote } from "@/components/common";
import { requireUser } from "@/lib/auth/session";
import { oneOf, str } from "@/lib/params";
import { toCreatorRows } from "@/lib/tiktoday/creator-rows";
import { asList, type CreatorAffiliate } from "@/lib/tiktoday/types";

async function Results({ q, count }: { q: string; count: number }) {
  const r = await searchCreators({ keyword: q, count });
  if (!r.ok) {
    return (
      <ErrorNote error={r.error}>
        <a href={`/creators?q=${encodeURIComponent(q)}&count=${count}`} className="underline">
          Thử lại
        </a>
      </ErrorNote>
    );
  }
  const rows = asList<CreatorAffiliate>(r.data);
  return (
    <div className="flex flex-col gap-3">
      <SourceNote meta={r.meta} />
      {rows.length === 0 ? <EmptyState>Không có creator nào khớp. Thử từ khoá khác.</EmptyState> : <CreatorDataTable rows={toCreatorRows(rows)} />}
    </div>
  );
}

export default async function CreatorsPage(props: PageProps<"/creators">) {
  await requireUser();
  const sp = await props.searchParams;
  const q = str(sp, "q");
  const count = oneOf(sp, "count", [10, 20, 50] as const, 20);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tìm creator affiliate"
        subtitle="Kết quả có sẵn số liệu bán hàng. Mỗi lần tìm tốn 1 lượt, kết quả được lưu 6 giờ nên tìm lại cùng từ khoá không tốn thêm."
      />
      <SearchForm action="/creators" name="q" defaultValue={q} placeholder="Từ khoá, ví dụ: skincare, thời trang nữ" cost={1}>
        <FormSelect
          name="count"
          defaultValue={count}
          label="Số kết quả"
          options={[10, 20, 50].map((n) => ({ value: n, label: `${n} kết quả` }))}
        />
      </SearchForm>

      {q ? (
        <Suspense key={`${q}|${count}`} fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
          <Results q={q} count={count} />
        </Suspense>
      ) : (
        <EmptyState>Nhập từ khoá rồi bấm Tìm. Hoặc mở thẳng một hồ sơ qua đường dẫn /creators/ten.handle.</EmptyState>
      )}
    </div>
  );
}
