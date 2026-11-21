// Gom lượt quota đã dùng theo ngày (múi giờ Việt Nam) để vẽ biểu đồ.

export type UsagePoint = { day: string; used: number };

const TZ = "Asia/Ho_Chi_Minh";
const DAY_MS = 24 * 60 * 60 * 1000;
// en-CA cho định dạng yyyy-mm-dd, tiện làm khoá
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

function key(d: Date): string {
  return keyFmt.format(d);
}

/** "2026-11-21" -> "21/11". */
function label(k: string): string {
  const [, m, d] = k.split("-");
  return `${d}/${m}`;
}

/**
 * Trả đúng `days` điểm, từ cũ đến mới, ngày không có lượt nào vẫn có điểm 0.
 * `rows` là các lượt đã gọi: thời điểm gọi và số quota bị tính (cost).
 */
export function bucketUsageByDay(rows: { called_at: string; cost: number }[], days: number, now: Date): UsagePoint[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(key(new Date(now.getTime() - i * DAY_MS)));
  const totals = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const r of rows) {
    const k = key(new Date(r.called_at));
    if (totals.has(k)) totals.set(k, (totals.get(k) ?? 0) + r.cost);
  }
  return keys.map((k) => ({ day: label(k), used: totals.get(k) ?? 0 }));
}
