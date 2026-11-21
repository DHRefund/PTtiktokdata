import { getAiSpend } from "@/actions/ai";
import { AskChat } from "@/components/ask-chat";
import { PageHeader, Pill } from "@/components/common";
import { makeAskData } from "@/lib/ai/ask-data";
import { aiConfig } from "@/lib/ai/config";
import { requireUser } from "@/lib/auth/session";
import { usd } from "@/lib/format";

export default async function AskPage() {
  await requireUser();
  const cfg = aiConfig();
  const data = makeAskData();
  const [creators, products, videos, spend] = await Promise.all([
    data.creators().catch(() => []),
    data.products().catch(() => []),
    data.videos().catch(() => []),
    getAiSpend(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Hỏi AI"
        subtitle="Đặt câu hỏi bằng tiếng Việt về creator, sản phẩm, video bạn đã lưu. AI tra cứu dữ liệu rồi trả lời, và chỉ đề xuất lấy thêm dữ liệu chứ không tự tiêu hạn mức."
        actions={
          spend ? (
            <Pill tone={spend.usd >= spend.budgetUsd ? "warn" : "neutral"}>
              Hôm nay {usd(spend.usd)} / {usd(spend.budgetUsd)}
            </Pill>
          ) : null
        }
      />
      <AskChat configured={cfg.configured} coverage={{ creators: creators.length, products: products.length, videos: videos.length }} />
    </div>
  );
}
