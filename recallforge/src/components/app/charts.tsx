"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; reviews: number; minutes: number; recall: number | null };

const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--fg)" };
const short = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function ReviewsChart({ data }: { data: Point[] }) {
  return (
    <div className="h-56" role="img" aria-label="Reviews per day, last 30 days">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          <XAxis dataKey="date" tickFormatter={short} {...axis} interval={6} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={tooltipStyle} labelFormatter={(l) => short(String(l))} formatter={(v) => [v, "Reviews"]} />
          <Bar dataKey="reviews" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RecallChart({ data }: { data: Point[] }) {
  const pts = data.map((d) => ({ ...d, recallPct: d.recall == null ? null : Math.round(d.recall * 100) }));
  return (
    <div className="h-56" role="img" aria-label="Recall rate per day, last 30 days">
      <ResponsiveContainer>
        <LineChart data={pts} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={short} {...axis} interval={6} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...axis} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => short(String(l))} formatter={(v) => [`${v}%`, "Recall rate"]} />
          <Line type="monotone" dataKey="recallPct" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: "var(--surface)" }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
