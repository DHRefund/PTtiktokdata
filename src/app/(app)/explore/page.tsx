import { requireUser } from "@/lib/auth/session";
import { Explorer } from "./explorer";

export default async function ExplorePage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Thử nghiệm</h1>
        <p className="text-sm text-muted-foreground">
          Trang tạm của giai đoạn 1: hiển thị JSON thô để xem API thật trả về gì, trước khi thiết kế lại giao diện.
        </p>
      </div>
      <Explorer />
    </div>
  );
}
