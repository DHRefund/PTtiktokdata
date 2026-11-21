import Link from "next/link";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateTimeIso } from "@/lib/format";
import { getKalodataView } from "@/lib/kalodata/store";

/** Đọc batch đã lưu trong database (hoặc file dự phòng). Không gọi nguồn ngoài khi hiển thị. */
export async function KalodataProducts() {
  const view = await getKalodataView();
  if (!view) {
    return (
      <section className="rounded-xl border p-4 text-sm text-muted-foreground">
        Chưa có dữ liệu Kalodata. Nhập một batch bằng <code>node --experimental-strip-types scripts/import-kalodata.mjs</code>.
      </section>
    );
  }
  const { batch } = view;

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <h2 className="text-lg font-semibold">Sản phẩm từ Kalodata</h2>
        <p className="text-sm text-muted-foreground">
          {batch.rows.length} sản phẩm trang đầu · {batch.market} · kỳ {batch.periodStart} đến {batch.periodEnd}
        </p>
        <p className="text-xs text-muted-foreground">
          Thu thập ngày {batch.collectedOn} · Bản lưu theo yêu cầu, không tự cập nhật · Tiền tệ {batch.currency}. Số liệu nguồn có thể làm tròn hoặc ước tính;
          {batch.sortVerified ? " " : " thứ tự sắp xếp chưa xác minh, "}chưa phải khuyến nghị lợi nhuận.
        </p>
        <p className="text-xs text-muted-foreground">
          {view.origin === "db"
            ? `Đọc từ database${view.importedAt ? `, nhập lúc ${dateTimeIso(view.importedAt)}` : ""}${view.batchCount ? ` · ${view.batchCount} lần thu thập đã lưu` : ""}.`
            : "Đang dùng file đi kèm bản build vì database chưa có batch nào."}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Sản phẩm</TableHead>
            <TableHead>Doanh thu</TableHead>
            <TableHead>Lượt bán</TableHead>
            <TableHead>Tăng trưởng nguồn</TableHead>
            <TableHead>Giá TB</TableHead>
            <TableHead>Hoa hồng</TableHead>
            <TableHead>Creator</TableHead>
            <TableHead>Đánh giá</TableHead>
            <TableHead>Tra cứu</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batch.rows.map((row) => (
            <TableRow key={row.rank}>
              <TableCell>{row.rank}</TableCell>
              <TableCell className="min-w-64 max-w-md whitespace-normal"><div className="flex items-start gap-3"><ProductThumbnail src={row.imageUrl} name={row.name} /><span>{row.name}</span></div></TableCell>
              <TableCell>{row.revenue}</TableCell>
              <TableCell>{row.sold}</TableCell>
              <TableCell>{row.growth}</TableCell>
              <TableCell>{row.averagePrice}</TableCell>
              <TableCell>{row.commission ?? "Chưa có"}</TableCell>
              <TableCell>{row.creators}</TableCell>
              <TableCell>{row.rating}/5</TableCell>
              <TableCell>
                {row.productId ? (
                  <Link className="underline" prefetch={false} href={`/products/${row.productId}`}>
                    Chi tiết TikToday
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Chưa có ID</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <a className="text-sm underline" href={batch.sourceUrl} target="_blank" rel="noreferrer">
        Xem nguồn Kalodata
      </a>
    </section>
  );
}
