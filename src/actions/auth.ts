"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/supabase";
import { endSession, startSession } from "@/lib/auth/session";
import { lockedForMs, recordFailure, recordSuccess } from "@/lib/auth/throttle";

export type LoginState = { error?: string };

// Hash giả để so sánh khi không tìm thấy tài khoản, giữ thời gian xử lý gần như nhau.
const DUMMY_HASH = bcrypt.hashSync("khong-phai-mat-khau-that", 12);

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const generic: LoginState = { error: "Sai tên đăng nhập hoặc mật khẩu." };

  if (!username || !password || username.length > 64 || password.length > 200) return generic;

  const throttleKey = username.toLowerCase();
  const locked = lockedForMs(throttleKey);
  if (locked > 0) {
    return { error: `Sai quá nhiều lần. Thử lại sau ${Math.ceil(locked / 60000)} phút.` };
  }

  const { data, error } = await db()
    .from("users")
    .select("id, username, password_hash")
    .eq("username", username)
    .maybeSingle();
  if (error) return { error: "Không đọc được dữ liệu tài khoản. Kiểm tra cấu hình Supabase." };

  const ok = await bcrypt.compare(password, data?.password_hash ?? DUMMY_HASH);
  if (!data || !ok) {
    recordFailure(throttleKey);
    await new Promise((r) => setTimeout(r, 600)); // làm chậm việc dò mật khẩu
    return generic;
  }

  recordSuccess(throttleKey);
  await startSession({ userId: data.id, username: data.username });
  redirect("/");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
