import fs from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { fastmossBatchSchema } from '../src/lib/fastmoss/schema.ts';
const args=process.argv.slice(2);
const file=args.find(a=>!a.startsWith('--'))??'src/data/fastmoss-latest.json';
const batch=fastmossBatchSchema.parse(JSON.parse(fs.readFileSync(file,'utf8')));
// Schema parsing produces a consistent key order before hashing.
const payload=JSON.stringify(batch.schemaVersion===1?{...batch,rows:batch.rows.map(({imageUrl:_image,...row})=>row)}:batch);
const hash=createHash('sha256').update(payload).digest('hex');
console.log(`FastMoss: ${batch.rows.length} rows, ${batch.periodStart}, ${batch.currency}, hash ${hash}`);
if(!args.includes('--dry-run')) {
  const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).map(l=>l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].trim()]));
  if(!env.SUPABASE_DB_URL) throw Error('Missing SUPABASE_DB_URL');
  const client=new pg.Client({connectionString:env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false}});
  try {
    await client.connect();
    const result=await client.query('insert into fastmoss_batches(payload,payload_hash,collected_on) values($1,$2,$3) on conflict(payload_hash) do nothing returning id',[payload,hash,batch.collectedOn]);
    console.log(result.rowCount?`Imported ${result.rows[0].id}`:'Already imported; skipped');
  } finally { await client.end(); }
}
