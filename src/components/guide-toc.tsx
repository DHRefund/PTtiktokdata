"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

export type TocItem = { id: string; label: string; children?: { id: string; label: string }[] };

/**
 * Mục lục dính bên trái trang Hướng dẫn. Đánh dấu mục đang đọc theo vị trí cuộn,
 * và chỉ mở danh sách con của nhóm đang đọc để mục lục gọn.
 */
export function GuideToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");
  const visible = useRef(new Set<string>());

  useEffect(() => {
    const ids = items.flatMap((i) => [i.id, ...(i.children?.map((c) => c.id) ?? [])]);
    const order = new Map(ids.map((id, n) => [id, n]));
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.current.add(e.target.id);
          else visible.current.delete(e.target.id);
        }
        // Chọn phần tử nằm cao nhất trong vùng nhìn thấy. Không có thì giữ mục cũ.
        const first = [...visible.current].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))[0];
        if (first) setActive(first);
      },
      // Vùng đọc: từ dưới thanh tiêu đề dính tới khoảng 1/3 chiều cao màn hình
      { rootMargin: "-72px 0px -65% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    const seen = visible.current;
    return () => {
      obs.disconnect();
      seen.clear();
    };
  }, [items]);

  const link = (on: boolean) =>
    cn(
      "block rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted hover:text-foreground",
      on ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
    );

  return (
    <nav aria-label="Mục lục" className="flex flex-col gap-0.5">
      <p className="px-2.5 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Trong trang này</p>
      {items.map((item) => {
        const open = active === item.id || Boolean(item.children?.some((c) => c.id === active));
        return (
          <div key={item.id}>
            <a href={`#${item.id}`} className={link(active === item.id)} aria-current={active === item.id ? "location" : undefined}>
              {item.label}
            </a>
            {open && item.children?.length ? (
              <div className="my-0.5 ml-3 flex flex-col gap-0.5 border-l pl-1.5">
                {item.children.map((c) => (
                  <a key={c.id} href={`#${c.id}`} className={cn(link(active === c.id), "py-1 text-[13px]")} aria-current={active === c.id ? "location" : undefined}>
                    {c.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
