import { HotProducts } from "@/components/hot-products";
import { PageHeader } from "@/components/common";
import { requireUser } from "@/lib/auth/session";

export default async function HotPage() {
  await requireUser();
  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sản phẩm hot"
        subtitle="Nhập một ngách hoặc từ khoá bất kỳ. Gemini tìm trên Google rồi liệt kê vài sản phẩm đang được nhắc nhiều ở Việt Nam, kèm số liệu cơ bản và nguồn. Không tốn hạn mức TikToday."
      />
      <HotProducts configured={configured} />
    </div>
  );
}
