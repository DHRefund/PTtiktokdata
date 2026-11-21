"use client";
import { useState } from "react";
export function ProductThumbnail({src,name}:{src:string|null;name:string}) {
  const [failed,setFailed]=useState<string|null>(null);
  if(!src || failed===src) return <span className="flex size-16 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">Chưa có ảnh</span>;
  // Direct source image avoids a server-side fetch proxy; source URLs may expire.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} width={64} height={64} loading="lazy" referrerPolicy="no-referrer" className="size-16 rounded object-contain" onError={()=>setFailed(src)} />;
}
