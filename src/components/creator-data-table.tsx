"use client";

import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDownIcon, ScaleIcon, ArrowUpDownIcon, ArrowUpIcon, CircleHelpIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Pill, Img } from "@/components/common";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compact, countOrRange, moneyOrRange } from "@/lib/format";
import { cn } from "@/lib/utils";

// Bảng creator có sắp xếp (bấm tiêu đề cột) và lọc nhanh (gõ vào ô tìm) ngay trên dữ liệu đã tải, không gọi lại API.
// Chỉ nhận các trường cần hiển thị để không chuyển cả bản ghi lớn từ server sang trình duyệt.

export type CreatorRow = {
  handle: string;
  nickname: string;
  avatar_url?: string;
  agency?: string;
  categories: string[];
  follower_count?: number;
  units_sold?: number;
  units_sold_range?: string;
  gmv?: number;
  gmv_range?: string;
  video_avg_views?: number;
};

// Khai báo ở phạm vi module: TanStack Table v9 cần features và columns ổn định giữa các lần vẽ.
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { text: sortFn_text },
  filterFns: { includesString: filterFn_includesString },
});

const helper = createColumnHelper<typeof features, CreatorRow>();

function SortHeader({
  label,
  helpId,
  align,
  isSorted,
  onToggle,
}: {
  label: string;
  helpId?: string;
  align: "left" | "right";
  isSorted: false | "asc" | "desc";
  onToggle: (e: unknown) => void;
}) {
  const Icon = isSorted === "asc" ? ArrowUpIcon : isSorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <div className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:text-foreground",
          isSorted ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label={`Sắp xếp theo ${label}`}
      >
        {label}
        <Icon className={cn("size-3.5", !isSorted && "opacity-50")} />
      </button>
      {helpId ? (
        <Link href={`/guide#${helpId}`} prefetch={false} title="Xem giải thích" className="text-muted-foreground/60 hover:text-foreground">
          <CircleHelpIcon className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

const columns = helper.columns([
  helper.accessor((r) => `${r.nickname} ${r.handle} ${r.agency ?? ""}`, {
    id: "creator",
    sortFn: "text",
    header: ({ column }) => (
      <SortHeader label="Creator" align="left" isSorted={column.getIsSorted()} onToggle={(e) => column.getToggleSortingHandler()?.(e)} />
    ),
    cell: ({ row }) => {
      const c = row.original;
      return (
        <div className="flex items-center gap-3">
          <Img src={c.avatar_url} alt="" width={40} height={40} rounded="rounded-full" className="shrink-0" />
          <div className="min-w-0">
            <Link
              href={`/creators/${encodeURIComponent(c.handle)}`}
              prefetch={false}
              className="block truncate font-medium hover:text-primary hover:underline"
            >
              {c.nickname || c.handle}
            </Link>
            <div className="truncate text-xs text-muted-foreground">
              @{c.handle} {c.agency ? `· ${c.agency}` : ""}
            </div>
          </div>
        </div>
      );
    },
  }),
  helper.accessor((r) => r.follower_count, {
    id: "follower_count",
    sortUndefined: "last",
    header: ({ column }) => (
      <SortHeader label="Theo dõi" helpId="followers" align="right" isSorted={column.getIsSorted()} onToggle={(e) => column.getToggleSortingHandler()?.(e)} />
    ),
    cell: ({ row }) => <span className="tabular-nums">{compact(row.original.follower_count)}</span>,
  }),
  helper.accessor((r) => r.units_sold, {
    id: "units_sold",
    sortUndefined: "last",
    header: ({ column }) => (
      <SortHeader label="Đơn đã bán" helpId="units" align="right" isSorted={column.getIsSorted()} onToggle={(e) => column.getToggleSortingHandler()?.(e)} />
    ),
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{countOrRange(row.original.units_sold, row.original.units_sold_range)}</span>
    ),
  }),
  helper.accessor((r) => r.gmv, {
    id: "gmv",
    sortUndefined: "last",
    header: ({ column }) => (
      <SortHeader label="GMV" helpId="gmv" align="right" isSorted={column.getIsSorted()} onToggle={(e) => column.getToggleSortingHandler()?.(e)} />
    ),
    cell: ({ row }) => <span className="tabular-nums">{moneyOrRange(row.original.gmv, row.original.gmv_range)}</span>,
  }),
  helper.accessor((r) => r.categories.join(" "), {
    id: "categories",
    enableSorting: false,
    header: () => <span className="px-1">Ngành hàng</span>,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.categories.slice(0, 2).map((x) => (
          <Pill key={x}>{x}</Pill>
        ))}
      </div>
    ),
  }),
  helper.accessor((r) => r.video_avg_views, {
    id: "video_avg_views",
    sortUndefined: "last",
    header: ({ column }) => (
      <SortHeader label="Xem video TB" helpId="avg" align="right" isSorted={column.getIsSorted()} onToggle={(e) => column.getToggleSortingHandler()?.(e)} />
    ),
    cell: ({ row }) => <span className="tabular-nums">{compact(row.original.video_avg_views)}</span>,
  }),
]);

const MAX_COMPARE = 3;
const RIGHT = new Set(["follower_count", "units_sold", "gmv", "video_avg_views"]);

export function CreatorDataTable({ rows }: { rows: CreatorRow[] }) {
  const table = useTable({
    features,
    columns,
    data: rows,
    initialState: { sorting: [{ id: "follower_count", desc: true }] },
    globalFilterFn: "includesString",
    // chỉ lọc theo tên/handle/MCN và ngành hàng
    getColumnCanGlobalFilter: (column) => column.id === "creator" || column.id === "categories",
  });

  // Chọn tối đa 3 creator để so sánh bằng AI
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (handle: string) =>
    setSelected((prev) => (prev.includes(handle) ? prev.filter((h) => h !== handle) : prev.length >= MAX_COMPARE ? prev : [...prev, handle]));

  const filter = String(table.state.globalFilter ?? "");
  const visible = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder="Lọc theo tên, handle, MCN, ngành hàng..."
            className="h-9 pl-9"
            aria-label="Lọc kết quả"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {visible.length === rows.length ? `${rows.length} creator` : `${visible.length} / ${rows.length} creator`} · bấm tiêu đề cột để sắp xếp
        </p>
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-primary/5 px-3 py-2 text-sm">
          <span>
            Đã chọn {selected.length}/{MAX_COMPARE}: {selected.map((h) => `@${h}`).join(", ")}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelected([])} className="text-muted-foreground underline hover:text-foreground">
              Bỏ chọn
            </button>
            {selected.length >= 2 ? (
              <Link
                href={`/compare?handles=${selected.map(encodeURIComponent).join(",")}`}
                prefetch={false}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-primary-foreground"
              >
                <ScaleIcon className="size-4" /> So sánh bằng AI
              </Link>
            ) : (
              <span className="text-muted-foreground">Chọn thêm ít nhất 1 creator nữa</span>
            )}
          </div>
        </div>
      ) : null}

      <Card className="gap-0 overflow-hidden py-0">
        <Table className="min-w-[44rem]">
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                <TableHead className="w-10" aria-label="Chọn để so sánh" />
                {group.headers.map((header) => (
                  <TableHead key={header.id} className={cn(RIGHT.has(header.column.id) && "text-right")}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
                  Không có creator nào khớp “{filter}”.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={row.id} data-state={selected.includes(row.original.handle) ? "selected" : undefined}>
                  <TableCell className="w-10">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.includes(row.original.handle)}
                      disabled={!selected.includes(row.original.handle) && selected.length >= MAX_COMPARE}
                      onChange={() => toggle(row.original.handle)}
                      aria-label={`Chọn @${row.original.handle} để so sánh`}
                    />
                  </TableCell>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className={cn(RIGHT.has(cell.column.id) && "text-right")}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
