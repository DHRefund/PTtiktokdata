import { SignJWT, jwtVerify } from "jose";

// Dùng được cả trong proxy.ts lẫn Server Actions (không import gì của next/headers ở đây).

export const SESSION_COOKIE = "tt_session";
export const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60; // 7 ngày

export type SessionUser = { userId: string; username: string };

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET chưa đặt hoặc quá ngắn (cần ít nhất 32 ký tự)");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(secretKey());
}

/** Trả null nếu token sai chữ ký, hết hạn hoặc thiếu trường. */
export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.username !== "string") return null;
    return { userId: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}
