'use client';
import { useState } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { useBusiness } from '../../context/BusinessContext';

export default function DemoReviewForm({ onCreated }) {
  const { selectedBusiness, fetchBusinesses } = useBusiness();
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState('The service was slow and my order arrived cold.');
  const [busy, setBusy] = useState(false);
  if (!selectedBusiness?.isDemo) return null;
  const submit = async event => {
    event.preventDefault(); setBusy(true);
    try {
      const { data } = await api.post(`/reviews/${selectedBusiness._id}/demo-review`, { rating, comment });
      await fetchBusinesses(); onCreated(data.review);
      toast.success(data.message);
    } catch (error) { toast.error(error.response?.data?.message || 'Could not simulate review'); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="card p-5 mb-5 space-y-3">
    <h2 className="font-semibold">Test a new customer review</h2>
    <p className="text-sm text-gray-600">Your alert threshold is {selectedBusiness.alertOnRating} stars or below. This test prepares an AI draft and a simulated alert. It sends no WhatsApp messages.</p>
    <label className="block text-sm">Customer rating
      <select aria-label="Simulated rating" value={rating} onChange={e => setRating(Number(e.target.value))} className="input-field mt-1">
        {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} stars</option>)}
      </select>
    </label>
    <label className="block text-sm">Customer comment
      <textarea aria-label="Simulated comment" maxLength={4096} value={comment} onChange={e => setComment(e.target.value)} className="input-field mt-1" />
    </label>
    <button disabled={busy} className="btn-secondary" type="submit">{busy ? 'Simulating…' : 'Simulate new review'}</button>
  </form>;
}
