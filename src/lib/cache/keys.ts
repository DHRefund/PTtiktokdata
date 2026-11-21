/** Chuẩn hoá từ khoá cho cache_key: cắt khoảng trắng thừa, chữ thường. */
export function normalizeKeyword(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Chuẩn hoá handle: bỏ @ đầu, chữ thường. */
export function normalizeHandle(s: string): string {
  return s.trim().replace(/^@/, "").toLowerCase();
}
