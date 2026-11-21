import { HotProducts } from "@/components/hot-products";
import { PageHeader } from "@/components/common";
import { requireUser } from "@/lib/auth/session";
import { KalodataProducts } from "@/components/kalodata-products";
import { FastmossProducts } from "@/components/fastmoss-products";

export default async function HotPage() {
  await requireUser();
  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sản phẩm hot"
        subtitle="Xem bản dữ liệu Kalodata thu thập theo yêu cầu hoặc dùng Gemini tìm thêm sản phẩm đang được nhắc đến trên web. Mỗi phần có nguồn và thời điểm riêng."
      />
      <KalodataProducts />
      <FastmossProducts />
      <HotProducts configured={configured} />
    </div>
  );
}
