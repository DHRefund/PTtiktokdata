import { Suspense } from "react";
import {
  getCreatorAffiliateCached,
  getCreatorProfile,
  getCreatorVideosCached,
  loadCreatorSection,
} from "@/actions/creators";
import { getSavedCreatorBrief, getSavedOutreach } from "@/actions/ai";
import { ActionButton } from "@/components/action-button";
import { AiCreatorPanel } from "@/components/ai-creator-panel";
import { AffiliatePanel, VideoGrid } from "@/components/entities";
import { Card, EmptyState, ErrorNote, Img, PageHeader, SourceNote, Stat } from "@/components/common";
import { aiConfig } from "@/lib/ai/config";
import { loadCreatorDossier } from "@/lib/ai/dossier";
import { requireUser } from "@/lib/auth/session";
import { compact } from "@/lib/format";
import { handleSchema } from "@/lib/tiktoday/schemas";
import { asData, asList, type CreatorAffiliate, type CreatorProfile, type VideoItem } from "@/lib/tiktoday/types";

// Mở trang tốn tối đa 1 lượt (creator.profile). Số liệu bán hàng và video chỉ tải khi bấm nút.
// Liên kết tới trang này dùng prefetch={false} để không tự tiêu quota.

const skeleton = <div className="h-40 animate-pulse rounded-xl bg-muted" />;

async function AffiliateSection({ handle }: { handle: string }) {
  const r = await getCreatorAffiliateCached({ handle });

  if (r.ok) {
    const a = asData<CreatorAffiliate>(r.data);
    // TikToday từng trả hồ sơ của người khác khi creator không có dữ liệu affiliate: kiểm tra handle khớp
    if (a.handle?.toLowerCase() !== handle) {
      return (
        <Card title="Số liệu bán hàng">
          <p className="text-sm text-muted-foreground">
            TikToday không có số liệu affiliate cho @{handle} (API trả về hồ sơ của @{a.handle}, đã bỏ qua).
          </p>
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Số liệu bán hàng</h2>
          <div className="flex items-center gap-3">
            <SourceNote meta={r.meta} />
            <ActionButton
              action={loadCreatorSection.bind(null, handle, "affiliate", true)}
              label="Làm mới (1 lượt)"
              variant="ghost"
            />
          </div>
        </div>
        <AffiliatePanel a={a} />
      </div>
    );
  }

  if (r.error.code === "NOT_CACHED") {
    return (
      <Card title="Số liệu bán hàng">
        <p className="text-sm text-muted-foreground">
          GMV, đơn đã bán, hoa hồng, độ tuổi và khu vực người theo dõi, video nổi bật. Chưa tải cho creator này.
        </p>
        <div>
          <ActionButton action={loadCreatorSection.bind(null, handle, "affiliate", false)} label="Tải số liệu bán hàng (1 lượt)" />
        </div>
      </Card>
    );
  }
  if (r.error.code === "NOT_FOUND") {
    return (
      <Card title="Số liệu bán hàng">
        <p className="text-sm text-muted-foreground">
          Creator này không có dữ liệu affiliate (không phải creator affiliate tại Việt Nam hoặc tài khoản riêng tư).
        </p>
      </Card>
    );
  }
  return <ErrorNote error={r.error} />;
}

async function VideosSection({ handle, recent }: { handle: string; recent: CreatorProfile["recent_videos"] }) {
  const r = await getCreatorVideosCached({ handle });

  if (r.ok) {
    const videos = asList<VideoItem>(r.data);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Video gần đây</h2>
          <div className="flex items-center gap-3">
            <SourceNote meta={r.meta} />
            <ActionButton action={loadCreatorSection.bind(null, handle, "videos", true)} label="Làm mới (1 lượt)" variant="ghost" />
          </div>
        </div>
        {videos.length === 0 ? <EmptyState>Không có video nào.</EmptyState> : <VideoGrid videos={videos} />}
      </div>
    );
  }

  if (r.error.code === "NOT_CACHED") {
    return (
      <Card title="Video gần đây">
        {recent && recent.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {recent.slice(0, 6).map((v) => (
              <li key={v.id} className="line-clamp-1">
                {v.description || "(không có mô tả)"}
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <ActionButton action={loadCreatorSection.bind(null, handle, "videos", false)} label="Tải video gần đây (1 lượt)" />
        </div>
      </Card>
    );
  }
  return <ErrorNote error={r.error} />;
}

async function AiSection({ handle }: { handle: string }) {
  const [dossier, brief, outreach] = await Promise.all([
    loadCreatorDossier(handle).catch(() => null),
    getSavedCreatorBrief(handle),
    getSavedOutreach(handle),
  ]);
  return <AiCreatorPanel handle={handle} configured={aiConfig().configured} hasData={dossier !== null} savedBrief={brief} savedOutreach={outreach} />;
}

async function Overview({ handle }: { handle: string }) {
  const r = await getCreatorProfile({ handle });
  if (!r.ok) {
    return (
      <div className="flex flex-col gap-6">
        <ErrorNote error={r.error}>
          <a href={`/creators/${encodeURIComponent(handle)}`} className="underline">
            Thử lại
          </a>
        </ErrorNote>
        <Suspense fallback={skeleton}>
          <AffiliateSection handle={handle} />
        </Suspense>
      </div>
    );
  }
  const p = asData<CreatorProfile>(r.data);
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <Img src={p.avatar_url} alt="" width={80} height={80} rounded="rounded-full" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold">{p.nickname || p.handle}</div>
            <div className="text-sm text-muted-foreground">@{p.handle}</div>
            {p.bio ? <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{p.bio}</p> : null}
          </div>
          <ActionButton action={loadCreatorSection.bind(null, handle, "profile", true)} label="Làm mới hồ sơ (1 lượt)" variant="ghost" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Người theo dõi" value={compact(p.follower_count)} />
          <Stat label="Đang theo dõi" value={compact(p.following_count)} />
          <Stat label="Tổng tim" value={compact(p.heart_count)} />
        </div>
        <SourceNote meta={r.meta} />
      </Card>

      <Suspense fallback={skeleton}>
        <AiSection handle={handle} />
      </Suspense>
      <Suspense fallback={skeleton}>
        <AffiliateSection handle={handle} />
      </Suspense>
      <Suspense fallback={skeleton}>
        <VideosSection handle={handle} recent={p.recent_videos} />
      </Suspense>
    </div>
  );
}

export default async function CreatorPage(props: PageProps<"/creators/[handle]">) {
  await requireUser();
  const { handle: raw } = await props.params;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // giữ nguyên, schema bên dưới sẽ từ chối
  }
  const parsed = handleSchema.safeParse(decoded);
  if (!parsed.success) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Handle không hợp lệ" subtitle="Handle chỉ gồm chữ, số, dấu _ và ., tối đa 24 ký tự." />
      </div>
    );
  }
  const handle = parsed.data;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={`@${handle}`} subtitle="Hồ sơ creator" />
      <Suspense fallback={skeleton}>
        <Overview handle={handle} />
      </Suspense>
    </div>
  );
}
