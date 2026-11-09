'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = Object.fromEntries([1, 2, 3, 4, 5].map(star => [star, `rgb(var(--chart-${star}))`]));

export default function RatingChart({ ratingBreakdown = [] }) {
  const data = [5, 4, 3, 2, 1].map((star) => ({
    name: `${star}★`,
    count: ratingBreakdown.find((r) => r._id === star)?.count || 0,
    star,
  }));

  return (
    <div className="card min-w-0 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-ink mb-4">Rating breakdown</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={32}>
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} width={30} />
          <Tooltip
            contentStyle={{ background: 'rgb(var(--raised))', border: '1px solid rgb(var(--line))', borderRadius: '8px', color: 'rgb(var(--ink))', fontSize: '13px' }}
            itemStyle={{ color: 'rgb(var(--ink))' }}
            cursor={{ fill: 'rgb(var(--raised))' }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((entry) => <Cell key={entry.star} fill={COLORS[entry.star]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
