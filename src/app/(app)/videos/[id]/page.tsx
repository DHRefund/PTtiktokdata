import Link from "next/link";
import { getVideoDetails, refreshVideo } from "@/actions/videos";
import { ActionButton } from "@/components/action-button";
import { Card, ErrorNote, PageHeader, Pill, SourceNote, Stat } from "@/components/common";
import { requireUser } from "@/lib/auth/session";
import { compact, num, pct, tiktokVideoUrl } from "@/lib/format";
import { videoIdSchema } from "@/lib/tiktoday/schemas";
import { asData, type VideoItem } from "@/lib/tiktoday/types";

/** Tỷ lệ so với lượt xem, "Chưa có" khi thiếu số hoặc lượt xem bằng 0. */
function rate(part: number | undefined, plays: number | undefined): string {
  if (part == null || !plays) return "Chưa có";
  return pct(part / plays);
}

export default async function VideoPage(props: PageProps<"/videos/[id]">) {
  await requireUser();
  const { id: raw } = await props.params;
  const parsed = videoIdSchema.safeParse(raw);
  if (!parsed.success) return <PageHeader title="Id video không hợp lệ" subtitle="Id chỉ gồm chữ số, tối đa 20 ký tự." />;
  const id = parsed.data;

  const r = await getVideoDetails({ id });

  const back = (
    <Link href="/videos" prefetch={false} className="text-sm text-muted-foreground hover:underline">
      ← Tìm video
    </Link>
  );

  if (!r.ok) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <PageHeader title={`Video ${id}`} />
        <ErrorNote error={r.error}>
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/videos/${id}`} className="underline">
              Thử lại
            </a>
            <a href={tiktokVideoUrl(undefined, id)} target="_blank" rel="noreferrer" className="underline">
              Mở video trên TikTok
            </a>
          </div>
        </ErrorNote>
        {r.error.code === "UPSTREAM" ? (
          <p className="text-sm text-muted-foreground">
            Lỗi phía TikToday, không phải do id. Lượt gọi lỗi không bị tính quota. Ảnh bìa và số liệu cơ bản của video vẫn xem được ở thẻ video trong trang tìm kiếm.
          </p>
        ) : null}
      </div>
    );
  }

  const v = asData<VideoItem>(r.data);
  const s = v.stats ?? {};
  const a = v.author;
  const url = tiktokVideoUrl(a?.handle, id);

  return (
    <div className="flex flex-col gap-5">
      {back}
      <PageHeader
        title={<span className="line-clamp-3 whitespace-normal text-xl">{v.description || "(không có mô tả)"}</span>}
        actions={<ActionButton action={refreshVideo.bind(null, id)} label="Làm mới (1 lượt)" variant="ghost" />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {v.is_ecommerce ? <Pill tone="good">Có gắn sản phẩm TikTok Shop</Pill> : <Pill>Không gắn sản phẩm</Pill>}
        {v.is_ad ? <Pill tone="warn">Quảng cáo</Pill> : null}
        {v.location ? <Pill>Quốc gia: {v.location}</Pill> : null}
        <a href={url} target="_blank" rel="noreferrer" className="text-sm underline">
          Mở trên TikTok
        </a>
      </div>
      <SourceNote meta={r.meta} />

      <Card title="Tương tác">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Lượt xem" value={compact(s.play_count)} hint={num(s.play_count)} />
          <Stat label="Tim" value={compact(s.like_count)} hint={`${rate(s.like_count, s.play_count)} lượt xem`} />
          <Stat label="Bình luận" value={compact(s.comment_count)} hint={`${rate(s.comment_count, s.play_count)} lượt xem`} />
          <Stat label="Chia sẻ" value={compact(s.share_count)} hint={`${rate(s.share_count, s.play_count)} lượt xem`} />
        </div>
        {s.save_count != null ? <p className="text-sm text-muted-foreground">Lưu: {compact(s.save_count)}</p> : null}
        <p className="text-xs text-muted-foreground">
          Tỷ lệ nhỏ dưới mỗi số là phần trăm so với lượt xem, tự tính. Xem giải thích ở{" "}
          <Link href="/guide#engagement" prefetch={false} className="underline">
            Hướng dẫn
          </Link>
          .
        </p>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        {a ? (
          <Card title="Người đăng">
            <div className="flex flex-col gap-3">
              <div>
                <div className="font-medium">{a.nickname || a.handle}</div>
                {a.handle ? (
                  <Link href={`/creators/${encodeURIComponent(a.handle)}`} prefetch={false} className="text-sm text-muted-foreground hover:underline">
                    @{a.handle} · xem hồ sơ
                  </Link>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Theo dõi" value={compact(v.author_stats?.follower_count)} />
                <Stat label="Tổng tim" value={compact(v.author_stats?.heart_count)} />
                <Stat label="Số video" value={compact(v.author_stats?.video_count)} />
              </div>
            </div>
          </Card>
        ) : null}

        {v.music ? (
          <Card title="Nhạc nền">
            <div className="text-sm">
              <div className="font-medium">{v.music.title || "Không rõ"}</div>
              <div className="text-muted-foreground">
                {v.music.author_name}
                {v.music.original ? " · âm thanh gốc" : ""}
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
