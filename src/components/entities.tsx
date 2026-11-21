import Link from "next/link";
import { compact, countOrRange, dateSec, dateTimeSec, duration, moneyOrRange, tiktokVideoUrl, vnd } from "@/lib/format";
import type { CreatorAffiliate, ProductListItem, VideoItem } from "@/lib/tiktoday/types";
import { HorizontalBarChart, ShareColumnChart, ShareDonut } from "./charts";
import { Card, Img, Pill, Stat } from "./common";

// ---------- Creator ----------

/** Số liệu bán hàng đầy đủ của một creator (từ creator.affiliate). */
export function AffiliatePanel({ a }: { a: CreatorAffiliate }) {
  const ages = (a.follower_ages ?? []).map((x) => ({ label: x.group, share: x.share }));
  const genders = (a.follower_genders ?? []).map((x) => ({
    label: x.group === "male" ? "Nam" : x.group === "female" ? "Nữ" : x.group,
    share: x.share,
  }));
  const regions = (a.follower_regions ?? []).slice(0, 5).map((r) => ({ label: r.region, share: r.count }));
  const cats = (a.category_shares ?? []).filter((x) => x.name).map((x) => ({ label: x.name, share: x.share }));
  const channels = [
    { label: "Video", share: a.gmv_share?.video ?? 0 },
    { label: "Live", share: a.gmv_share?.live ?? 0 },
  ].filter((c) => c.share > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card title="Doanh số">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="GMV" value={moneyOrRange(a.gmv, a.gmv_range)} hint={a.gmv != null ? a.gmv_range : undefined} />
          <Stat label="Đơn đã bán" value={countOrRange(a.units_sold, a.units_sold_range)} />
          <Stat label="GPM" value={a.gpm_range ?? "Chưa có"} />
          <Stat label="Hoa hồng" value={a.commission_rate_range ?? "Chưa có"} />
          <Stat label="Cấp độ" value={a.level ?? "Chưa có"} />
          <Stat label="Xem video TB" value={compact(a.video_avg_views)} hint={`Trung vị ${compact(a.video_median_views)}`} />
          <Stat label="Xem video bán hàng TB" value={compact(a.shop_video_avg_views)} />
          <Stat label="Người xem live TB" value={compact(a.live_avg_viewers)} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {a.agency ? <Pill>MCN: {a.agency}</Pill> : null}
          {a.fast_growing ? <Pill tone="good">Tăng trưởng nhanh</Pill> : null}
          {a.stats_until ? <span className="text-xs">Số liệu tới {dateSec(a.stats_until)}</span> : null}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {channels.length > 0 ? (
          <Card title="Doanh thu theo kênh">
            <ShareDonut data={channels} />
          </Card>
        ) : null}
        {cats.length > 0 ? (
          <Card title="Ngành hàng">
            <ShareDonut data={cats.slice(0, 5)} />
          </Card>
        ) : null}
        {ages.length > 0 ? (
          <Card title="Độ tuổi người theo dõi">
            <ShareColumnChart data={ages} title="Độ tuổi" />
          </Card>
        ) : null}
        {genders.length > 0 ? (
          <Card title="Giới tính người theo dõi">
            <ShareDonut data={genders} />
          </Card>
        ) : null}
        {regions.length > 0 ? (
          <Card title="Khu vực người theo dõi (top 5)" className="md:col-span-2">
            <HorizontalBarChart data={regions} title="Người theo dõi" valueIsShare={false} />
          </Card>
        ) : null}
      </div>

      {(a.top_videos ?? []).length > 0 ? (
        <Card title="Video nổi bật">
          <ul className="flex flex-col divide-y divide-border">
            {(a.top_videos ?? []).map((v) => (
              <li key={v.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <a
                  href={tiktokVideoUrl(a.handle, v.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-2 text-sm font-medium hover:underline"
                >
                  {v.description || "(không có mô tả)"}
                </a>
                <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  <span>{compact(v.views)} lượt xem</span>
                  <span>{compact(v.likes)} tim</span>
                  <span>{compact(v.comments)} bình luận</span>
                  <span>{duration(v.duration)}</span>
                  <span>{dateTimeSec(v.create_time)}</span>
                </div>
                {(v.products ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(v.products ?? []).map((p) => (
                      <Link key={p.id} href={`/products/${p.id}`} prefetch={false} className="max-w-full">
                        <Pill>
                          <span className="inline-block max-w-[18rem] truncate align-bottom">
                            {p.name} · {vnd(p.min_price)}
                          </span>
                        </Pill>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

// ---------- Video ----------

export function VideoCard({ v }: { v: VideoItem }) {
  const s = v.stats ?? {};
  return (
    <article className="group/card flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition hover:shadow-lg hover:ring-primary/30">
      <a href={tiktokVideoUrl(v.author?.handle, v.id)} target="_blank" rel="noreferrer" className="relative block overflow-hidden">
        <Img src={v.video?.cover_url} alt="" width={320} height={420} rounded="rounded-none" className="aspect-3/4 w-full transition duration-300 group-hover/card:scale-[1.03]" />
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
          {duration(v.video?.duration)}
        </span>
        {v.is_ad ? <span className="absolute left-2 top-2 rounded bg-amber-500 px-1.5 py-0.5 text-xs text-white">Quảng cáo</span> : null}
      </a>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm">{v.description || "(không có mô tả)"}</p>
        {v.author?.handle ? (
          <Link href={`/creators/${encodeURIComponent(v.author.handle)}`} prefetch={false} className="truncate text-xs text-muted-foreground hover:underline">
            @{v.author.handle} · {compact(v.author_stats?.follower_count)} theo dõi
          </Link>
        ) : null}
        <div className="mt-auto grid grid-cols-2 gap-x-2 text-xs text-muted-foreground">
          <span>{compact(s.play_count)} xem</span>
          <span>{compact(s.like_count)} tim</span>
          <span>{compact(s.comment_count)} bình luận</span>
          <span>{compact(s.share_count)} chia sẻ</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground/70">
          <span>{dateTimeSec(v.create_time)}</span>
          <Link href={`/videos/${v.id}`} prefetch={false} className="text-muted-foreground hover:underline">
            Chi tiết (1 lượt)
          </Link>
        </div>
      </div>
    </article>
  );
}

export function VideoGrid({ videos }: { videos: VideoItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {videos.map((v) => (
        <VideoCard key={v.id} v={v} />
      ))}
    </div>
  );
}

// ---------- Sản phẩm ----------

export function ProductCard({ p }: { p: ProductListItem }) {
  const price = p.price;
  return (
    <Link
      href={`/products/${p.product_id}`}
      prefetch={false}
      className="group/card flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition hover:shadow-lg hover:ring-primary/30"
    >
      <div className="overflow-hidden"><Img src={p.image_url} alt="" width={320} height={320} rounded="rounded-none" className="aspect-square w-full transition duration-300 group-hover/card:scale-[1.03]" /></div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{vnd(price?.sale_price)}</span>
          {price?.original_price && price.original_price !== price.sale_price ? (
            <span className="text-xs text-muted-foreground/70 line-through">{vnd(price.original_price)}</span>
          ) : null}
          {price?.discount ? <Pill tone="warn">-{price.discount.replace("-", "")}</Pill> : null}
        </div>
        <div className="mt-auto flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>Đã bán {compact(p.sold_count)}</span>
          <span>
            ★ {p.rating ? p.rating.toFixed(1) : "–"} ({compact(p.review_count)})
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground/70">{p.seller?.shop_name}</div>
      </div>
    </Link>
  );
}
