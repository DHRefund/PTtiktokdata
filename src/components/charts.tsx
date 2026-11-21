"use client";

import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

// Biểu đồ Recharts bọc bởi ChartContainer của shadcn (màu lấy từ biến --chart-1..5 theo chủ đề sáng/tối).
// Dữ liệu truyền vào luôn là tỷ lệ 0..1 hoặc số đếm, đã chuẩn bị ở server.

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const pct1 = (n: number) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n * 100)}%`;

export type ShareDatum = { label: string; share: number };

/** Cột dọc: tỷ lệ theo nhóm (ví dụ độ tuổi). */
export function ShareColumnChart({ data, title }: { data: ShareDatum[]; title: string }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  const config = { share: { label: title, color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <BarChart data={data} margin={{ top: 16, left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => `${item.payload.label}: ${pct1(Number(value))}`} />}
        />
        <Bar dataKey="share" fill="var(--color-share)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/** Thanh ngang: danh sách có nhãn dài (ví dụ khu vực). `valueIsShare` false thì hiển thị số đếm. */
export function HorizontalBarChart({
  data,
  title,
  valueIsShare = true,
}: {
  data: ShareDatum[];
  title: string;
  valueIsShare?: boolean;
}) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  const config = { share: { label: title, color: "var(--chart-2)" } } satisfies ChartConfig;
  const fmt = (n: number) => (valueIsShare ? pct1(n) : new Intl.NumberFormat("vi-VN").format(n));
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: 28 * data.length + 24 }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
        <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={96} />
        <XAxis dataKey="share" type="number" hide />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => `${item.payload.label}: ${fmt(Number(value))}`} />}
        />
        <Bar dataKey="share" fill="var(--color-share)" radius={6} />
      </BarChart>
    </ChartContainer>
  );
}

/** Biểu đồ tròn rỗng ruột: phần trăm theo nhóm (video/live, giới tính, ngành hàng). */
export function ShareDonut({
  data,
  centerLabel,
  className = "h-48",
}: {
  data: ShareDatum[];
  centerLabel?: string;
  className?: string;
}) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  const rows = data.map((d, i) => ({ name: d.label, value: d.share, fill: PALETTE[i % PALETTE.length] }));
  const config = Object.fromEntries(rows.map((r) => [r.name, { label: r.name, color: r.fill }])) satisfies ChartConfig;
  return (
    <ChartContainer config={config} className={`aspect-auto w-full ${className}`}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" formatter={(value, name) => `${name}: ${pct1(Number(value))}`} />} />
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" strokeWidth={2} paddingAngle={2}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.fill} />
          ))}
          {centerLabel ? (
            <Label
              position="center"
              content={({ viewBox }) =>
                viewBox && "cx" in viewBox ? (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-xs">
                    {centerLabel}
                  </text>
                ) : null
              }
            />
          ) : null}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
      </PieChart>
    </ChartContainer>
  );
}

export type UsageDatum = { day: string; used: number };

/** Cột: số lượt quota đã dùng mỗi ngày. */
export function UsageBarChart({ data, limit }: { data: UsageDatum[]; limit: number }) {
  const config = { used: { label: "Lượt đã dùng", color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-52 w-full">
      <BarChart data={data} margin={{ top: 8, left: -16, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={6} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} domain={[0, Math.max(limit, 1)]} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => `${value} / ${limit} lượt`} />} />
        <Bar dataKey="used" fill="var(--color-used)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
