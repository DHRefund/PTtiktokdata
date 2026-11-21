import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

// Next.js 16: `proxy` thay cho `middleware`. Đây chỉ là lớp chặn đầu tiên.
// Mỗi Server Action vẫn tự kiểm tra đăng nhập, vì action có thể bị gọi trực tiếp.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    // Đã đăng nhập thì không cần vào trang login nữa
    return user ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (!user) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Bỏ qua file tĩnh và ảnh tối ưu
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
