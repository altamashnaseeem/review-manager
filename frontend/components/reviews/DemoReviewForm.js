'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';
import { useBusiness } from '../../context/BusinessContext';

export default function DemoReviewForm({ onCreated }) {
  const { selectedBusiness, fetchBusinesses, demoWhatsAppEnabled } = useBusiness();
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState('The service was slow and my order arrived cold.');
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSendWhatsApp(false); }, [selectedBusiness?._id, demoWhatsAppEnabled]);
  if (!selectedBusiness?.isDemo) return null;
  const submit = async event => {
    event.preventDefault(); setBusy(true);
    try {
      const { data } = await api.post(`/reviews/${selectedBusiness._id}/demo-review`, {
        rating, comment, sendWhatsApp: demoWhatsAppEnabled && sendWhatsApp,
      });
      setSendWhatsApp(false);
      await fetchBusinesses(); onCreated(data.review);
      if (data.review.alertStatus === 'failed') toast.error(data.message);
      else toast.success(data.message);
    } catch (error) { toast.error(error.response?.data?.message || 'Could not simulate review'); }
    finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="card p-5 mb-5 space-y-3">
    <h2 className="font-semibold">Test a new customer review</h2>
    <p className="text-sm text-gray-600">Your alert threshold is {selectedBusiness.alertOnRating} stars or below. Reviews and AI drafts are synthetic. WhatsApp alerts stay simulated unless you select the real test option below.</p>
    <label className="block text-sm">Customer rating
      <select aria-label="Simulated rating" value={rating} onChange={e => setRating(Number(e.target.value))} className="input-field mt-1">
        {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} stars</option>)}
      </select>
    </label>
    <label className="block text-sm">Customer comment
      <textarea aria-label="Simulated comment" maxLength={4096} value={comment} onChange={e => setComment(e.target.value)} className="input-field mt-1" />
    </label>
    {demoWhatsAppEnabled ? <div className="p-3 bg-amber-50 rounded-lg space-y-2">
      <label className="flex items-start gap-2 text-sm text-amber-900">
        <input type="checkbox" checked={sendWhatsApp} onChange={e => setSendWhatsApp(e.target.checked)} disabled={busy} className="mt-1" />
        <span>Send a real WhatsApp test to {selectedBusiness.alertPhone}</span>
      </label>
      <p className="text-xs text-amber-900">Uses Twilio and may incur charges. The number must be eligible to receive messages. Failed sends may retry automatically. Google replies remain local.</p>
      {sendWhatsApp && rating > selectedBusiness.alertOnRating && <p className="text-xs text-amber-900">This rating exceeds your threshold, so no WhatsApp alert will be sent.</p>}
    </div> : <p className="text-xs text-gray-500">Real WhatsApp testing is disabled on the server.</p>}
    <button disabled={busy} className="btn-secondary" type="submit">{busy ? 'Submitting…' : sendWhatsApp ? 'Simulate review & test WhatsApp' : 'Simulate new review'}</button>
  </form>;
}
