// Chạy một file migration SQL lên database Supabase.
// Cách dùng:  node scripts/migrate.mjs supabase/migrations/0002_ai.sql
// Đọc SUPABASE_DB_URL từ .env.local (chuỗi kết nối Postgres, dùng Session pooler). Không in chuỗi này ra.
import fs from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Cách dùng: node scripts/migrate.mjs <file.sql>");
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
if (!env.SUPABASE_DB_URL) {
  console.error("Thiếu SUPABASE_DB_URL trong .env.local");
  process.exit(1);
}

const sql = fs.readFileSync(file, "utf8");
const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  // Báo cho PostgREST (REST API của Supabase) tải lại schema để thấy bảng mới ngay
  await client.query("notify pgrst, 'reload schema'");
  console.log(`Đã chạy ${file}`);
} catch (e) {
  console.error("Lỗi khi chạy migration:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
