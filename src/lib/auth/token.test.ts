import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { signSession, verifySession } from "./token";

const SECRET = "x".repeat(40);

beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});

describe("session token", () => {
  it("ký rồi xác thực lại được", async () => {
    const t = await signSession({ userId: "u1", username: "tinh" });
    expect(await verifySession(t)).toEqual({ userId: "u1", username: "tinh" });
  });

  it("token rỗng, sai định dạng hoặc bị sửa thì bị từ chối", async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("abc.def.ghi")).toBeNull();
    const t = await signSession({ userId: "u1", username: "tinh" });
    expect(await verifySession(t.slice(0, -2) + "xx")).toBeNull();
  });

  it("token ký bằng secret khác thì bị từ chối", async () => {
    const forged = await new SignJWT({ username: "tinh" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("y".repeat(40)));
    expect(await verifySession(forged)).toBeNull();
  });

  it("token hết hạn thì bị từ chối", async () => {
    const expired = await new SignJWT({ username: "tinh" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(expired)).toBeNull();
  });
});
