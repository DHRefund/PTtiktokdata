import { getFastmossView } from "@/lib/fastmoss/store";
import { ProductThumbnail } from "@/components/product-thumbnail";
import { Table,TableHeader,TableHead,TableBody,TableRow,TableCell } from "@/components/ui/table";
export async function FastmossProducts() {
  const view=await getFastmossView();
  if(!view) return <p>Chưa có dữ liệu FastMoss hợp lệ.</p>;
  const {batch}=view;
  return <section className="flex flex-col gap-3 rounded-xl border p-4">
    <h2 className="text-lg font-semibold">Sản phẩm từ FastMoss</h2>
    <p className="text-sm text-muted-foreground">VN · Ngày {batch.periodStart} · {batch.currency} · Thu thập {batch.collectedOn} · {view.origin==="db"?"Database":"File dự phòng"}</p>
    <p className="text-xs text-muted-foreground">Kỳ một ngày, khác bảng Kalodata 30 ngày. Số liệu nguồn làm tròn/ước tính, chưa xác minh cách xếp hạng. Các listing đóng gói, thư cảm ơn cần kiểm tra trước khi lựa chọn; chưa phải khuyến nghị bán hàng.</p>
    <Table><TableHeader><TableRow>
      {["#","Sản phẩm / shop","Giá nguồn","Lượt bán ngày","GMV ngày","Tăng trưởng đơn nguồn","Hoa hồng","Tổng lượt bán","Tổng GMV"].map(h=><TableHead key={h}>{h}</TableHead>)}
    </TableRow></TableHeader><TableBody>{batch.rows.map(r=><TableRow key={r.sourceProductId}>
      <TableCell>{r.rank}</TableCell><TableCell className="min-w-64 max-w-md whitespace-normal">
        <ProductThumbnail src={r.imageUrl} name={r.name} />
        <a className="underline" href={`https://www.fastmoss.com/e-commerce/detail/${r.sourceProductId}`} target="_blank" rel="noreferrer">{r.name}</a>
        <p className="text-xs text-muted-foreground">{r.shop} · {r.category}</p>
        {r.needsReview && <p className="text-xs text-amber-700">Cần duyệt listing đóng gói / thư cảm ơn</p>}
      </TableCell><TableCell>{r.price}</TableCell><TableCell>{r.sold}</TableCell><TableCell>{r.gmv}</TableCell>
      <TableCell>{r.growth}</TableCell><TableCell>{r.commission??"Chưa có"}</TableCell><TableCell>{r.totalSold}</TableCell><TableCell>{r.totalGmv}</TableCell>
    </TableRow>)}</TableBody></Table>
    <a className="text-sm underline" href={batch.sourceUrl} target="_blank" rel="noreferrer">Xem nguồn FastMoss</a>
  </section>;
}
