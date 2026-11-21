type SP = Record<string, string | string[] | undefined>;

/** Lấy tham số truy vấn dạng chuỗi (bỏ khoảng trắng thừa, chỉ lấy giá trị đầu tiên). */
export function str(sp: SP, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** Lấy số nguyên trong danh sách cho phép, sai thì dùng giá trị mặc định. */
export function oneOf<T extends number>(sp: SP, key: string, allowed: readonly T[], fallback: T): T {
  const n = Number(str(sp, key));
  return (allowed as readonly number[]).includes(n) ? (n as T) : fallback;
}
