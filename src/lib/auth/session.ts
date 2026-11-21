import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC, signSession, verifySession, type SessionUser } from "./token";

/**
 * Người dùng hiện tại, hoặc null nếu chưa đăng nhập. cookies() là bất đồng bộ từ Next 16.
 * Bọc React.cache: trong một request chỉ giải mã JWT một lần dù gọi nhiều nơi.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
});

/**
 * Chốt chặn đăng nhập cho trang (Server Component). Gọi ở đầu MỖI trang, không chỉ ở layout,
 * vì layout không render lại khi chuyển trang trong cùng nhóm route.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function startSession(user: SessionUser): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
