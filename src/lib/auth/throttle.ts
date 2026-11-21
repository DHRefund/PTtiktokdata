// Giới hạn số lần đăng nhập sai, lưu trong bộ nhớ của tiến trình server.
// Đủ cho chạy một máy. Nếu triển khai nhiều instance/serverless thì cần chuyển sang lưu ở Supabase.

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

type Entry = { count: number; first: number };
const attempts = new Map<string, Entry>();

function live(key: string, now: number): Entry | undefined {
  const e = attempts.get(key);
  if (e && now - e.first > WINDOW_MS) {
    attempts.delete(key);
    return undefined;
  }
  return e;
}

/** Số mili giây còn bị khoá, 0 nếu được phép thử. */
export function lockedForMs(key: string, now = Date.now()): number {
  const e = live(key, now);
  return e && e.count >= MAX_FAILURES ? e.first + WINDOW_MS - now : 0;
}

export function recordFailure(key: string, now = Date.now()): void {
  const e = live(key, now);
  if (e) e.count++;
  else attempts.set(key, { count: 1, first: now });
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}
