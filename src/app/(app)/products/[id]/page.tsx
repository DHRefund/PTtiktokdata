import Link from "next/link";
import { getProductDetails, refreshProduct } from "@/actions/products";
import { ActionButton } from "@/components/action-button";
import { Card, ErrorNote, Img, PageHeader, Pill, SourceNote, Stat } from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { compact, dateTimeMs, num, vnd } from "@/lib/format";
import { productIdSchema } from "@/lib/tiktoday/schemas";
import { asData, type ProductDetails } from "@/lib/tiktoday/types";

export default async function ProductPage(props: PageProps<"/products/[id]">) {
  await requireUser();
  const { id: raw } = await props.params;
  const parsed = productIdSchema.safeParse(raw);
  if (!parsed.success) return <PageHeader title="Id sản phẩm không hợp lệ" subtitle="Id chỉ gồm chữ số." />;
  const id = parsed.data;

  const r = await getProductDetails({ id });
  if (!r.ok) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/products" prefetch={false} className="text-sm text-muted-foreground hover:underline">
          ← Tìm sản phẩm
        </Link>
        <PageHeader title={`Sản phẩm ${id}`} />
        <ErrorNote error={r.error}>
          <a href={`/products/${id}`} className="underline">
            Thử lại
          </a>
        </ErrorNote>
      </div>
    );
  }
  const p = asData<ProductDetails>(r.data);
  const images = p.image_urls ?? [];
  const price = p.price;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/products" prefetch={false} className="text-sm text-muted-foreground hover:underline">
        ← Tìm sản phẩm
      </Link>
      <PageHeader
        title={<span className="line-clamp-2 whitespace-normal text-xl">{p.title}</span>}
        actions={<ActionButton action={refreshProduct.bind(null, id)} label="Làm mới (1 lượt)" variant="ghost" />}
      />
      <SourceNote meta={r.meta} />

      <div className="grid gap-5 md:grid-cols-[22rem_1fr]">
        <div className="flex flex-col gap-2">
          <Img src={images[0]} alt="" width={352} height={352} className="aspect-square w-full" />
          {images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto">
              {images.slice(1, 7).map((u) => (
                <Img key={u} src={u} alt="" width={56} height={56} className="shrink-0" />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-semibold">{price?.sale_price_text ?? "Chưa có giá"}</span>
            {price?.original_price_text && price.original_price_text !== price.sale_price_text ? (
              <span className="text-muted-foreground/70 line-through">{price.original_price_text}</span>
            ) : null}
            {price?.discount ? <Pill tone="warn">-{price.discount.replace("-", "")}</Pill> : null}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Đã bán" value={compact(p.sold_count)} />
            <Stat label="Đánh giá" value={p.rating ? `★ ${p.rating.toFixed(1)}` : "Chưa có"} hint={`${num(p.review_count)} lượt`} />
            <Stat
              label="Vận chuyển"
              value={p.shipping?.free_shipping ? "Miễn phí" : vnd(p.shipping?.fee)}
              hint={p.shipping?.min_days ? `${p.shipping.min_days}-${p.shipping.max_days ?? p.shipping.min_days} ngày` : undefined}
            />
            <Stat label="Biến thể" value={num(p.skus?.length)} />
          </div>

          {p.shop ? (
            <Card title="Cửa hàng">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{p.shop.name}</div>
                  <div className="text-xs text-muted-foreground">
                    ★ {p.shop.rating?.toFixed(1) ?? "–"} · {compact(p.shop.follower_count)} theo dõi · {num(p.shop.product_count)} sản phẩm
                  </div>
                </div>
                {p.shop.url ? (
                  <a href={p.shop.url} target="_blank" rel="noreferrer" className="text-sm underline">
                    Mở cửa hàng
                  </a>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {(p.skus ?? []).length > 0 ? (
        <Card title="Biến thể và tồn kho">
          <div className="overflow-x-auto">
            <Table className="min-w-[28rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Phân loại</TableHead>
                  <TableHead className="text-right">Giá bán</TableHead>
                  <TableHead className="text-right">Giá gốc</TableHead>
                  <TableHead className="text-right">Kho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(p.skus ?? []).map((s) => (
                  <TableRow key={s.sku_id}>
                    <TableCell>{(s.properties ?? []).map((x) => `${x.name}: ${x.value}`).join(" · ") || "Mặc định"}</TableCell>
                    <TableCell className="text-right tabular-nums">{vnd(s.sale_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{vnd(s.original_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(s.stock)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {(p.specifications ?? []).length > 0 ? (
          <Card title="Thông số">
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              {(p.specifications ?? []).map((s) => (
                <div key={s.name} className="contents">
                  <dt className="text-muted-foreground">{s.name}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}
        {(p.description ?? []).length > 0 ? (
          <Card title="Mô tả">
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              {(p.description ?? []).map((d, i) => (
                <p key={i} className="whitespace-pre-line">
                  {d}
                </p>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      {(p.reviews ?? []).length > 0 ? (
        <Card title="Đánh giá gần đây">
          <ul className="flex flex-col divide-y divide-border">
            {(p.reviews ?? []).map((v) => (
              <li key={v.review_id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-amber-500">{"★".repeat(Math.round(v.rating ?? 0))}</span>
                  {v.verified_purchase ? <Pill tone="good">Đã mua hàng</Pill> : null}
                  <span>{dateTimeMs(v.create_time)}</span>
                  {v.sku_specification ? <span>{v.sku_specification}</span> : null}
                </div>
                <p className="text-sm">{v.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
