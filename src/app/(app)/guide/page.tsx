import type { ReactNode } from "react";
import { Card, PageHeader, Pill } from "@/components/common";
import { requireUser } from "@/lib/auth/session";

// Trang tĩnh giải thích thuật ngữ và cách phân tích. Ví dụ số lấy từ dữ liệu thật đã gọi ngày 21/11/2026.
// Mục "quy tắc thực hành" là gợi ý kinh nghiệm, không phải thông tin từ API.

type Term = {
  id: string;
  name: string;
  field: string; // trường trong JSON
  plain: string; // giải thích bằng lời thường
  note?: ReactNode; // lưu ý, cách đọc
};

const SALES: Term[] = [
  {
    id: "gmv",
    name: "GMV (doanh thu bán ra)",
    field: "gmv, gmv_range",
    plain:
      "Tổng giá trị hàng bán ra nhờ creator này, tính bằng đồng. Ví dụ bán 100 món, mỗi món 200.000₫ thì GMV là 20 triệu. Đây là doanh số, không phải tiền creator bỏ túi.",
    note: "Chưa trừ hàng hoàn trả và chưa trừ hoa hồng. Nhiều creator không công khai số chính xác nên chỉ có khoảng, ví dụ “1M₫+” nghĩa là từ 1 triệu trở lên.",
  },
  {
    id: "units",
    name: "Đơn đã bán",
    field: "units_sold, units_sold_range",
    plain: "Số sản phẩm creator đã bán qua affiliate trên TikTok Shop. Đây là số lượng sản phẩm, một đơn hàng có thể gồm nhiều sản phẩm.",
    note: "Đây là chỉ số khó “làm màu” nhất, nên thường đáng tin hơn số người theo dõi khi tìm người bán được hàng.",
  },
  {
    id: "gpm",
    name: "GPM",
    field: "gpm_range, video_gpm_range, live_gpm_range",
    plain:
      "Doanh thu trên mỗi 1.000 lượt xem. Ví dụ GPM 50.000₫ nghĩa là cứ 1.000 lượt xem thì tạo khoảng 50.000₫ doanh số. Chỉ số này đo khả năng biến lượt xem thành tiền.",
    note: "Hai creator cùng 500 nghìn lượt xem nhưng GPM khác nhau thì người GPM cao bán tốt hơn nhiều. API chỉ trả theo khoảng, ví dụ “0-50K₫”.",
  },
  {
    id: "commission",
    name: "Hoa hồng",
    field: "commission_rate_range",
    plain: "Tỷ lệ phần trăm creator được hưởng trên mỗi đơn bán được, do người bán (shop) đặt cho từng sản phẩm.",
    note: "Có thể là khoảng (“0%-5%”) hoặc để trống. Hoa hồng ước tính ≈ GMV × tỷ lệ hoa hồng, chỉ là ước chừng vì cả hai đều là khoảng.",
  },
  {
    id: "share",
    name: "Tỷ trọng doanh thu video và live",
    field: "gmv_share.video, gmv_share.live",
    plain: "Phần trăm doanh thu đến từ video ngắn và phần trăm từ livestream. Hai con số cộng lại bằng 100%.",
    note: "Cho biết creator mạnh ở kênh nào. Ví dụ HannahOlala: video 5,8%, live 94,2%, tức là chủ yếu bán qua live.",
  },
  {
    id: "level",
    name: "Cấp độ (level)",
    field: "level",
    plain: "Cấp bậc của creator trên TikTok Shop, số càng cao thì càng được TikTok xếp mức cao. Trong dữ liệu đã gọi, giá trị từ 0 đến 8.",
  },
  {
    id: "mcn",
    name: "MCN / agency",
    field: "agency",
    plain:
      "Công ty quản lý creator, đứng ra nhận việc, đàm phán giá và hỗ trợ sản xuất. Nếu creator có MCN, thường phải liên hệ qua công ty thay vì nhắn trực tiếp.",
  },
  {
    id: "growing",
    name: "Tăng trưởng nhanh",
    field: "fast_growing",
    plain: "Cờ TikTok gắn cho creator đang tăng nhanh. Có thể là cơ hội hợp tác sớm khi giá còn thấp, nhưng số liệu còn ít nên rủi ro cao hơn.",
  },
];

const REACH: Term[] = [
  {
    id: "followers",
    name: "Người theo dõi",
    field: "follower_count",
    plain: "Số tài khoản đang theo dõi kênh. Cho biết độ nổi tiếng, không cho biết khả năng bán hàng.",
    note: "Tô Tuyết Trâm có 729 nghìn người theo dõi nhưng bán 217.695 sản phẩm, nhiều hơn Viên Vibi (9,5 triệu theo dõi, 27.460 sản phẩm).",
  },
  {
    id: "avg",
    name: "Lượt xem trung bình",
    field: "video_avg_views",
    plain: "Tổng lượt xem chia cho số video. Một video viral kéo con số này lên rất cao.",
  },
  {
    id: "median",
    name: "Lượt xem trung vị",
    field: "video_median_views",
    plain:
      "Lượt xem của video “ở giữa” khi xếp tất cả video từ thấp đến cao. Phản ánh video điển hình, ít bị vài video viral làm lệch. Nên xem cùng lượt xem trung bình.",
    note: "HannahOlala: trung bình 512 nghìn nhưng trung vị chỉ 148 nghìn, tức là vài video rất lớn kéo cao con số trung bình.",
  },
  {
    id: "shopviews",
    name: "Lượt xem video bán hàng",
    field: "shop_video_avg_views",
    plain: "Lượt xem trung bình của riêng những video có gắn sản phẩm. Gần với thực tế bán hàng hơn lượt xem chung.",
  },
  {
    id: "live",
    name: "Người xem live trung bình",
    field: "live_avg_viewers",
    plain: "Số người xem cùng lúc trong các buổi livestream, tính trung bình. Quan trọng nếu bạn định bán qua live.",
  },
  {
    id: "engagement",
    name: "Tỷ lệ tương tác",
    field: "(tự tính từ stats)",
    plain:
      "Tim, bình luận, chia sẻ chia cho lượt xem, tính bằng phần trăm. Cho biết người xem có thật sự phản ứng với video hay chỉ lướt qua.",
    note: "Tỷ lệ tim thường vài phần trăm. Chia sẻ và lưu cao so với lượt xem là dấu hiệu nội dung hữu ích. So sánh trong cùng ngành hàng mới có ý nghĩa, mình không đặt ngưỡng cố định.",
  },
  {
    id: "ecommerce",
    name: "Video bán hàng",
    field: "is_ecommerce",
    plain: "Video có gắn sản phẩm TikTok Shop (giỏ hàng vàng). Chỉ trang chi tiết video mới cho biết trường này.",
  },
  {
    id: "hearts",
    name: "Tổng tim",
    field: "heart_count",
    plain: "Tổng lượt thích mọi video của kênh từ trước tới nay. Chỉ cho thấy kênh lâu năm hay được yêu thích, ít giá trị khi so sánh bán hàng.",
  },
  {
    id: "audience",
    name: "Người theo dõi: tuổi, giới tính, khu vực",
    field: "follower_ages, follower_genders, follower_regions",
    plain: "Phân bố người theo dõi theo độ tuổi, giới tính, tỉnh thành. Dùng để biết creator có đúng tệp khách hàng của sản phẩm không.",
    note: "Ví dụ son môi hợp với tệp nữ 18-34. Khu vực cho biết khách ở thành phố lớn hay tỉnh.",
  },
];

const OTHER: Term[] = [
  {
    id: "oecuid",
    name: "oecuid",
    field: "oecuid",
    plain: "Mã định danh creator trên hệ thống affiliate của TikTok Shop. Dùng khi cần tra cứu hoặc gửi lời mời hợp tác qua công cụ của TikTok Shop.",
  },
  {
    id: "statsuntil",
    name: "Số liệu tính đến",
    field: "stats_until",
    plain: "Mốc thời gian số liệu bán hàng được chốt. Số liệu không phải thời gian thực, thường chậm vài ngày.",
  },
  {
    id: "cache",
    name: "Từ cache / Vừa gọi API",
    field: "(của ứng dụng này)",
    plain:
      "“Vừa gọi API” nghĩa là app vừa hỏi TikToday và tốn 1 lượt quota. “Từ cache” nghĩa là dùng lại bản đã lưu, không tốn lượt. Bản lưu có hạn 6 đến 24 giờ tuỳ loại dữ liệu.",
  },
];

const FORMULAS: { title: string; formula: string; use: string; example?: string }[] = [
  {
    title: "Đơn bán trên mỗi người theo dõi",
    formula: "đơn đã bán ÷ số người theo dõi",
    use: "So sánh khả năng bán hàng của các creator có quy mô khác nhau. Cao là người theo dõi “chịu mua”.",
    example: "Tô Tuyết Trâm: 217.695 ÷ 729.000 ≈ 0,30. Viên Vibi: 27.460 ÷ 9.500.000 ≈ 0,003. Chênh nhau khoảng 100 lần.",
  },
  {
    title: "Giá trị trung bình mỗi sản phẩm",
    formula: "GMV ÷ đơn đã bán",
    use: "Biết creator bán hàng giá rẻ hay đắt. Chỉ tính được khi creator công khai GMV chính xác.",
    example: "bonnie_unbox: 1,646 tỷ ÷ 9.057 ≈ 182.000₫ mỗi sản phẩm.",
  },
  {
    title: "Độ lệch giữa trung bình và trung vị",
    formula: "lượt xem trung bình ÷ lượt xem trung vị",
    use: "Gần 1 nghĩa là video đều tay. Lớn hơn nhiều (ví dụ trên 3) nghĩa là thành tích dựa vào vài video viral, khó lặp lại.",
    example: "HannahOlala: 512.630 ÷ 148.789 ≈ 3,4.",
  },
  {
    title: "Hoa hồng ước tính",
    formula: "GMV × tỷ lệ hoa hồng",
    use: "Ước chừng creator kiếm được bao nhiêu, hoặc bạn phải trả bao nhiêu nếu là người bán. Chỉ là ước chừng vì dữ liệu là khoảng.",
  },
];

const STEPS = [
  "Tìm bằng từ khoá ngành hàng (ví dụ “son môi”), xếp theo Đơn đã bán, không xếp theo người theo dõi.",
  "Loại những creator có ngành hàng không khớp sản phẩm của bạn (cột Ngành hàng).",
  "Mở hồ sơ vài người đáng chú ý và bấm “Tải số liệu bán hàng”. Xem tỷ trọng video và live để biết họ bán qua kênh nào, nhớ chỉ tải cho người đã lọt vào danh sách ngắn để tiết kiệm quota.",
  "Kiểm tra tệp người theo dõi (tuổi, giới tính, khu vực) có đúng khách hàng của bạn không.",
  "So sánh lượt xem trung bình với trung vị để biết kết quả có ổn định không.",
  "Xem video nổi bật và sản phẩm họ từng bán: có sản phẩm tương tự bạn không, giá ra sao.",
  "Liên hệ qua MCN nếu có, hoặc qua thông tin liên hệ trong bio.",
];

const PITFALLS = [
  "Nhiều số liệu chỉ là khoảng hoặc ước tính. Đừng trình bày “1M₫+” như một con số chính xác.",
  "Số người theo dõi lớn không đồng nghĩa bán được hàng. Hãy nhìn đơn đã bán và GPM.",
  "Dữ liệu chỉ phủ creator affiliate tại Việt Nam. Tài khoản riêng tư hoặc ngoài phạm vi có thể không có dữ liệu.",
  "Dữ liệu đến từ bên thứ ba và còn thử nghiệm: cấu trúc có thể đổi, thỉnh thoảng có lỗi (ví dụ trả nhầm hồ sơ), app đã chặn trường hợp này.",
  "Số liệu có độ trễ (xem “Số liệu tính đến”). Creator mới nổi gần đây có thể chưa phản ánh đúng.",
  "Kết quả tìm kiếm tối đa 50 creator và không có trang tiếp theo. Muốn thêm kết quả, đổi từ khoá.",
];

function TermList({ terms }: { terms: Term[] }) {
  return (
    <div className="flex flex-col gap-3">
      {terms.map((t) => (
        <article
          key={t.id}
          id={t.id}
          className="scroll-mt-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition target:ring-2 target:ring-primary"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">{t.name}</h3>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{t.field}</code>
          </div>
          <p className="mt-2 text-sm">{t.plain}</p>
          {t.note ? <p className="mt-2 text-sm text-muted-foreground">{t.note}</p> : null}
        </article>
      ))}
    </div>
  );
}

const TOC = [
  ["sales", "Doanh số và bán hàng"],
  ["reach", "Tiếp cận và người theo dõi"],
  ["other", "Khác"],
  ["analysis", "Cách phân tích"],
  ["pitfalls", "Lưu ý khi đọc số liệu"],
] as const;

export default async function GuidePage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Hướng dẫn đọc số liệu"
        subtitle="Giải thích các thuật ngữ affiliate TikTok Shop bằng lời thường, và cách dùng chúng để chọn creator, sản phẩm."
      />

      <nav className="flex flex-wrap gap-2" aria-label="Mục lục">
        {TOC.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border bg-card px-3 py-1 text-sm transition-colors hover:bg-muted">
            {label}
          </a>
        ))}
      </nav>

      <Card title="Hiểu nhanh trong 30 giây">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>
            <b>Affiliate</b> (tiếp thị liên kết): creator quảng bá sản phẩm của shop khác và nhận <b>hoa hồng</b> trên mỗi đơn bán được.
          </li>
          <li>
            <b>GMV</b> là doanh số bán ra, <b>đơn đã bán</b> là số sản phẩm, <b>GPM</b> là doanh thu trên mỗi 1.000 lượt xem.
          </li>
          <li>
            Để biết ai <b>bán được hàng</b>, nhìn đơn đã bán và GPM. Số người theo dõi chỉ cho biết độ nổi tiếng.
          </li>
          <li>
            Nhiều con số chỉ là <b>khoảng</b> (ví dụ <Pill>1M₫+</Pill>), vì creator không công khai số chính xác.
          </li>
        </ul>
      </Card>

      <section id="sales" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="text-xl font-semibold">Doanh số và bán hàng</h2>
        <TermList terms={SALES} />
      </section>

      <section id="reach" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="text-xl font-semibold">Tiếp cận và người theo dõi</h2>
        <TermList terms={REACH} />
      </section>

      <section id="other" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="text-xl font-semibold">Khác</h2>
        <TermList terms={OTHER} />
      </section>

      <section id="analysis" className="flex scroll-mt-4 flex-col gap-4">
        <h2 className="text-xl font-semibold">Cách phân tích</h2>

        <Card title="Quy trình chọn creator">
          <p className="text-xs text-muted-foreground">Đây là gợi ý theo kinh nghiệm, không phải thông tin từ API.</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>

        <Card title="Các phép tính hữu ích">
          <p className="text-xs text-muted-foreground">Tự tính từ các số liệu có sẵn, không tốn thêm lượt gọi API. Ví dụ lấy từ dữ liệu thật ngày 21/11/2026.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {FORMULAS.map((f) => (
              <div key={f.title} className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
                <div className="font-medium">{f.title}</div>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{f.formula}</code>
                <p className="text-sm text-muted-foreground">{f.use}</p>
                {f.example ? <p className="text-xs text-muted-foreground">{f.example}</p> : null}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Phân tích sản phẩm và video">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            <li>
              <b>Đã bán và đánh giá</b>: sản phẩm bán nhiều và điểm cao (từ khoảng 4,5 sao) là dấu hiệu nhu cầu thật. Đã bán nhiều mà đánh giá ít có thể là hàng mới.
            </li>
            <li>
              <b>Giá và giảm giá</b>: so giá bán với giá gốc và với các sản phẩm cùng loại trong kết quả tìm kiếm để biết mức giá phổ biến.
            </li>
            <li>
              <b>Biến thể và tồn kho</b>: kho thấp ở biến thể bán chạy cho thấy sản phẩm sắp hết hàng.
            </li>
            <li>
              <b>Cửa hàng</b>: điểm đánh giá shop, số người theo dõi, số sản phẩm cho biết shop mới hay lâu năm.
            </li>
            <li>
              <b>Video</b>: so lượt xem với lượt tim, bình luận, chia sẻ. Chia sẻ và lưu nhiều cho thấy nội dung hữu ích. Nhãn “Quảng cáo” là video có đánh dấu quảng cáo.
            </li>
          </ul>
        </Card>
      </section>

      <section id="pitfalls" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="text-xl font-semibold">Lưu ý khi đọc số liệu</h2>
        <Card>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {PITFALLS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
