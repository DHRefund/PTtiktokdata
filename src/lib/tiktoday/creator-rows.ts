import type { CreatorRow } from "@/components/creator-data-table";
import type { CreatorAffiliate } from "./types";

/** Rút gọn kết quả tìm creator thành đúng các trường bảng cần, bỏ creator không có handle. */
export function toCreatorRows(list: CreatorAffiliate[]): CreatorRow[] {
  const rows: CreatorRow[] = [];
  for (const c of list) {
    if (!c.handle) continue;
    rows.push({
      handle: c.handle,
      nickname: c.nickname ?? "",
      avatar_url: c.avatar_url,
      agency: c.agency ?? undefined,
      categories: c.categories ?? [],
      follower_count: c.follower_count,
      units_sold: c.units_sold ?? undefined,
      units_sold_range: c.units_sold_range ?? undefined,
      gmv: c.gmv ?? undefined,
      gmv_range: c.gmv_range ?? undefined,
      video_avg_views: c.video_avg_views ?? undefined,
    });
  }
  return rows;
}
