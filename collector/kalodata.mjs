import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const login = process.argv.includes('--login');
const help = process.argv.includes('--help');
if (help) {
  console.log('node collector/kalodata.mjs --login  # sign in and choose VN manually\nnode collector/kalodata.mjs          # collect first visible page, maximum 10 rows');
  process.exit(0);
}
const root = resolve('.collector');
await mkdir(root, { recursive: true });
let context;
try {
  // Separate profile; never attach to or copy the Codex browser session.
  context = await chromium.launchPersistentContext(resolve(root, 'kalodata-profile'), {
    channel: 'msedge', headless: !login, viewport: { width: 1440, height: 1000 },
  });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('https://www.kalodata.com/product', { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (login) {
    console.log('Trong cửa sổ Edge vừa mở: đăng nhập Kalodata, chọn Việt Nam và bộ lọc mong muốn. Không đóng cửa sổ.');
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    await prompt.question('Khi bảng sản phẩm đã hiện, nhấn Enter tại đây để kiểm tra và lưu mẫu: ');
    prompt.close();
  }
  await page.locator('table').first().waitFor({ state: 'visible', timeout: 45000 });
  const body = await page.locator('body').innerText();
  if (/Membership Required|Upgrade to Professional or above to view the data/i.test(body)) throw new Error('ACCESS_BLOCKED: trang yêu cầu nâng gói.');
  if (await page.getByRole('button', { name: /Log in \/ Sign up/i }).count()) throw new Error('AUTH_REQUIRED: chạy lại với --login.');
  const title = await page.title();
  if (!/Vietnam/i.test(title)) throw new Error('MARKET_MISMATCH: chọn Việt Nam bằng --login trước khi thu thập.');
  const tables = await page.locator('table').evaluateAll(tables => tables.map(table =>
    Array.from(table.querySelectorAll('tr')).map(row => Array.from(row.querySelectorAll('th,td')).map(cell => cell.innerText.trim()))));
  const header = tables.flat().find(row => row.some(cell => /Product Info/.test(cell)) && row.some(cell => /Revenue/.test(cell)));
  if (!header) throw new Error('SCHEMA_CHANGED: không nhận diện được tiêu đề bảng.');
  const rows = tables.flat().filter(row => /^\d+$/.test(row[0] ?? '') && row.length === header.length).slice(0, 10);
  if (!rows.length) throw new Error('INVALID_DATA: không có dòng sản phẩm hợp lệ.');
  if (rows.some(row => row.some(cell => /\*{3,}/.test(cell)))) throw new Error('ACCESS_BLOCKED: số liệu đang bị che.');
  // Fail closed rather than silently recording another page or misaligned columns.
  if (rows.some((row, i) => Number(row[0]) !== i + 1)) throw new Error('PAGE_MISMATCH: yêu cầu trang đầu, thứ hạng bắt đầu từ 1.');
  const dateLabel = body.match(/Last 30 [Dd]ays\s*\([^)]*\)/)?.[0] ?? null;
  const output = {
    source: 'kalodata', adapter_version: 1, fetched_at: new Date().toISOString(),
    url: page.url(), title, market: 'VN', date_label: dateLabel,
    // Keep display strings: rounded amounts, currencies and inequalities are evidence.
    headers: header, rows, row_count: rows.length,
    warnings: ['Display values may be rounded or estimated.', 'Sort criterion and source update time are not verified.', 'No details, pagination, Gemini or TikToday calls.'],
  };
  const directory = resolve(root, 'output');
  await mkdir(directory, { recursive: true });
  const file = resolve(directory, `kalodata-${output.fetched_at.replace(/[:.]/g, '-')}.json`);
  await writeFile(file, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Đã lưu ${rows.length} sản phẩm: ${file}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Collector failed');
  process.exitCode = 1;
} finally {
  await context?.close();
}
