// Định dạng số liệu hiển thị (tiếng Việt, múi giờ Việt Nam). Không phụ thuộc server hay client.

const dec1 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const dtf = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const df = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short" });

export const EMPTY = "Chưa có";

type N = number | null | undefined;

/** 512630 -> "512,6 nghìn", 1996889 -> "2 triệu". */
export function compact(n: N): string {
  if (n == null || !Number.isFinite(n)) return EMPTY;
  const a = Math.abs(n);
  if (a >= 1e9) return `${dec1.format(n / 1e9)} tỷ`;
  if (a >= 1e6) return `${dec1.format(n / 1e6)} triệu`;
  if (a >= 1e3) return `${dec1.format(n / 1e3)} nghìn`;
  return int.format(n);
}

export function num(n: N): string {
  return n == null || !Number.isFinite(n) ? EMPTY : int.format(n);
}

/** 52689 -> "52.689₫". Tiền lớn rút gọn: 2500000 -> "2,5 triệu₫". */
export function vnd(n: N): string {
  if (n == null || !Number.isFinite(n)) return EMPTY;
  return Math.abs(n) >= 1e6 ? `${compact(n)}₫` : `${int.format(n)}₫`;
}

/** 0.4862 -> "48,6%". */
export function pct(share: N): string {
  return share == null || !Number.isFinite(share) ? EMPTY : `${dec1.format(share * 100)}%`;
}

export function dateTimeSec(sec: N): string {
  return sec == null || !Number.isFinite(sec) ? EMPTY : dtf.format(new Date(sec * 1000));
}
export function dateSec(sec: N): string {
  return sec == null || !Number.isFinite(sec) ? EMPTY : df.format(new Date(sec * 1000));
}
export function dateTimeMs(ms: N): string {
  return ms == null || !Number.isFinite(ms) ? EMPTY : dtf.format(new Date(ms));
}
export function dateTimeIso(iso: string): string {
  return dtf.format(new Date(iso));
}

/** 18.667 -> "0:19", 95 -> "1:35". */
export function duration(sec: N): string {
  if (sec == null || !Number.isFinite(sec)) return EMPTY;
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "5 phút trước", "3 giờ trước", "2 ngày trước". */
export function ago(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  if (m < 60 * 24) return `${Math.round(m / 60)} giờ trước`;
  return `${Math.round(m / 1440)} ngày trước`;
}

export function tiktokVideoUrl(handle: string | undefined, id: string): string {
  return handle ? `https://www.tiktok.com/@${handle}/video/${id}` : `https://www.tiktok.com/video/${id}`;
}

/** "còn 3 giờ", "còn 25 phút", "đã hết hạn". */
export function until(iso: string, now = Date.now()): string {
  const m = Math.round((new Date(iso).getTime() - now) / 60000);
  if (m <= 0) return "đã hết hạn";
  if (m < 60) return `còn ${m} phút`;
  if (m < 60 * 24) return `còn ${Math.round(m / 60)} giờ`;
  return `còn ${Math.round(m / 1440)} ngày`;
}

/** Số liệu có thể là con số chính xác, một khoảng ("1M₫+") hoặc null. */
export function moneyOrRange(exact: number | null | undefined, range: string | null | undefined): string {
  if (exact != null) return vnd(exact);
  return range ?? EMPTY;
}
export function countOrRange(exact: number | null | undefined, range: string | null | undefined): string {
  if (exact != null) return num(exact);
  return range ?? EMPTY;
}
