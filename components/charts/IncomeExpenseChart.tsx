'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatMoney } from '@/lib/enums';

type Row = { month: string; income: number; expense: number };

export default function IncomeExpenseChart({ data }: { data: Row[] }) {
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);
  if (!hasData) {
    return <div className="grid h-64 place-items-center text-sm text-slate-400">No income or expenses yet</div>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
          />
          <Tooltip
            formatter={(v: any, name: any) => [formatMoney(Number(v), 'CAD'), name === 'income' ? 'Income' : 'Expenses']}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
            cursor={{ fill: '#f8fafc' }}
          />
          <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="expense" name="expense" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
