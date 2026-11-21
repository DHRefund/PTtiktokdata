// Nhập một batch Kalodata (file JSON theo hợp đồng schemaVersion 1) vào Supabase.
// Cách dùng:
//   node --experimental-strip-types scripts/import-kalodata.mjs [file.json] [--dry-run]
// Mặc định đọc src/data/kalodata-latest.json. Kiểm tra hợp lệ trước; nhập lại cùng nội dung thì bỏ qua (không trùng).
// Đọc SUPABASE_DB_URL từ .env.local, không in chuỗi này ra.
import fs from "node:fs";
import pg from "pg";
import { batchHash, kalodataBatchSchema } from "../src/lib/kalodata/schema.ts";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--")) ?? "src/data/kalodata-latest.json";

let raw;
try {
  raw = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error(`Không đọc được ${file}:`, e instanceof Error ? e.message : e);
  process.exit(1);
}

const parsed = kalodataBatchSchema.safeParse(raw);
if (!parsed.success) {
  console.error("Batch không hợp lệ, không nhập gì cả:");
  for (const i of parsed.error.issues) console.error(` - ${i.path.join(".") || "(gốc)"}: ${i.message}`);
  process.exit(1);
}
const b = parsed.data;
const hash = batchHash(b);
console.log(`Batch hợp lệ: ${b.rows.length} dòng, ${b.market}, ${b.currency}, kỳ ${b.periodStart}..${b.periodEnd}, thu thập ${b.collectedOn}, mã ${hash}`);
if (dry) {
  console.log("--dry-run: không ghi vào database.");
  process.exit(0);
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

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query("begin");
  const ins = await client.query(
    `insert into market_batches (source, source_url, collected_on, collection_method, market, currency, period_start, period_end, sort_verified, precision, schema_version, payload_hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (source, payload_hash) do nothing
     returning id`,
    [b.source, b.sourceUrl, b.collectedOn, b.collectionMethod, b.market, b.currency, b.periodStart, b.periodEnd, b.sortVerified, b.precision, b.schemaVersion, hash],
  );
  if (ins.rowCount === 0) {
    await client.query("rollback");
    console.log("Batch này đã có trong database (cùng nội dung), bỏ qua.");
  } else {
    const id = ins.rows[0].id;
    for (const r of b.rows) {
      await client.query(
        `insert into market_batch_rows (batch_id, rank, name, revenue, sold, growth, rating, average_price, commission, creators, product_id, image_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, r.rank, r.name, r.revenue, r.sold, r.growth, r.rating, r.averagePrice, r.commission, r.creators, r.productId, r.imageUrl],
      );
    }
    await client.query("commit");
    console.log(`Đã nhập batch ${id} (${b.rows.length} dòng).`);
  }
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("Lỗi khi nhập:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
