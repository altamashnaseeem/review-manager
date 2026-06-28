'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = { 5: '#22c55e', 4: '#84cc16', 3: '#f59e0b', 2: '#f97316', 1: '#ef4444' };

export default function RatingChart({ ratingBreakdown = [] }) {
  const data = [5, 4, 3, 2, 1].map((star) => ({
    name: `${star}★`,
    count: ratingBreakdown.find((r) => r._id === star)?.count || 0,
    star,
  }));

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Rating breakdown</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={32}>
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '13px' }}
            cursor={{ fill: '#f1f5f9' }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((entry) => <Cell key={entry.star} fill={COLORS[entry.star]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
