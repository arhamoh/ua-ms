'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

type Slice = { name: string; value: number; color: string };

export default function DonutChart({ data }: { data: Slice[] }) {
  const shown = data.filter((d) => d.value > 0);
  const total = shown.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <div className="grid h-44 place-items-center text-sm text-slate-400">No data yet</div>;
  }

  return (
    <div className="flex w-full items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={shown} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none">
              {shown.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-xl font-bold leading-none">{total}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">total</div>
          </div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 pr-1 text-sm">
        {shown.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-600">{d.name}</span>
            <span className="shrink-0 pl-2 font-medium tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
