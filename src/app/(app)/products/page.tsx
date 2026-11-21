import { Suspense } from "react";
import { searchProducts } from "@/actions/products";
import { ProductCard } from "@/components/entities";
import { EmptyState, ErrorNote, FormSelect, PageHeader, SearchForm, SourceNote } from "@/components/common";
import { requireUser } from "@/lib/auth/session";
import { oneOf, str } from "@/lib/params";
import { asList, type ProductListItem } from "@/lib/tiktoday/types";

async function Results({ q, limit }: { q: string; limit: number }) {
  const r = await searchProducts({ query: q, limit });
  if (!r.ok) {
    return (
      <ErrorNote error={r.error}>
        <a href={`/products?q=${encodeURIComponent(q)}&limit=${limit}`} className="underline">
          Thử lại
        </a>
      </ErrorNote>
    );
  }
  const rows = asList<ProductListItem>(r.data);
  return (
    <div className="flex flex-col gap-3">
      <SourceNote meta={r.meta} />
      {rows.length === 0 ? (
        <EmptyState>Không có sản phẩm nào khớp.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {rows.map((p) => (
            <ProductCard key={p.product_id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function ProductsPage(props: PageProps<"/products">) {
  await requireUser();
  const sp = await props.searchParams;
  const q = str(sp, "q");
  const limit = oneOf(sp, "limit", [10, 20, 50] as const, 20);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Tìm sản phẩm TikTok Shop" subtitle="Mỗi lần tìm tốn 1 lượt, kết quả được lưu 6 giờ." />
      <SearchForm action="/products" name="q" defaultValue={q} placeholder="Từ khoá, ví dụ: serum, áo thun" cost={1}>
        <FormSelect
          name="limit"
          defaultValue={limit}
          label="Số kết quả"
          options={[10, 20, 50].map((n) => ({ value: n, label: `${n} kết quả` }))}
        />
      </SearchForm>
      {q ? (
        <Suspense key={`${q}|${limit}`} fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
          <Results q={q} limit={limit} />
        </Suspense>
      ) : (
        <EmptyState>Nhập từ khoá rồi bấm Tìm.</EmptyState>
      )}
    </div>
  );
}
