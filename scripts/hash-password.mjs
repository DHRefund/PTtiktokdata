// Tạo câu SQL thêm tài khoản đăng nhập, để dán vào Supabase SQL Editor.
// Cách dùng:  node scripts/hash-password.mjs <username>
// Mật khẩu được nhập trực tiếp (không hiện trên màn hình), không truyền qua tham số dòng lệnh
// để tránh lưu vào lịch sử shell.
import bcrypt from "bcryptjs";

const username = process.argv[2];
if (!username || !/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
  console.error("Cách dùng: node scripts/hash-password.mjs <username>  (3-32 ký tự: chữ, số, _ . -)");
  process.exit(1);
}

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Cần chạy trong terminal tương tác để nhập mật khẩu."));
      return;
    }
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n" || c === "\u0004") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    process.stdin.on("data", onData);
  });
}

const pw1 = await readHidden("Mật khẩu: ");
const pw2 = await readHidden("Nhập lại:  ");
if (pw1 !== pw2) {
  console.error("Hai lần nhập không khớp.");
  process.exit(1);
}
if (pw1.length < 8) {
  console.error("Mật khẩu cần ít nhất 8 ký tự.");
  process.exit(1);
}

const hash = await bcrypt.hash(pw1, 12);
console.log("\nDán câu SQL sau vào Supabase SQL Editor:\n");
console.log(
  `insert into users (username, password_hash) values ('${username}', '${hash}')\n` +
    `on conflict (username) do update set password_hash = excluded.password_hash;`,
);
