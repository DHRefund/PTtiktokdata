import "server-only";
import snapshot from "@/data/fastmoss-latest.json";
import { db } from "@/lib/db/supabase";
import { fastmossBatchSchema } from "./schema";
export async function getFastmossView() {
  try {
    const {data,error}=await db().from("fastmoss_batches").select("payload").order("collected_on",{ascending:false}).order("imported_at",{ascending:false}).limit(1);
    if(!error && data?.length) {
      const parsed=fastmossBatchSchema.safeParse(data[0].payload);
      if(parsed.success) return {batch:parsed.data,origin:"db" as const};
    }
  } catch { /* Use validated bundled fallback when DB unavailable. */ }
  const parsed=fastmossBatchSchema.safeParse(snapshot);
  return parsed.success?{batch:parsed.data,origin:"file" as const}:null;
}
