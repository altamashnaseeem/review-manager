'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../lib/axios';

export const formatPrice = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(amount / 100);
const names = { monthly: 'Monthly', quarterly: '3 Months', 'semi-annual': '6 Months' };
export default function BillingPlans({ layout = 'cards', busy = false, onCheckout, checkoutLabel = 'Continue to checkout' }) {
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/billing/plans', { timeout: 15000 });
      setPlans(data.plans);
    } catch { setPlans([]); setError('Subscription prices are currently unavailable. Please try again later.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <p role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading subscription prices…</p>;
  if (error) return <div className="text-center space-y-3 py-4"><p role="alert" className="text-sm text-slate-600">{error}</p><button className="btn-secondary" disabled={busy} onClick={load}>Retry prices</button></div>;
  const selectedPlan = plans.find(plan => plan.key === selected);
  const caption = plan => `Billed ${formatPrice(plan.amount, plan.currency)} ${plan.months === 1 ? 'every month' : `every ${plan.months} months`}`;
  return <div className="space-y-4">
    <div className={layout === 'cards' ? 'grid grid-cols-1 md:grid-cols-3 gap-6' : 'flex flex-col gap-3 text-left'}>
      {plans.map(plan => layout === 'cards' ? <div key={plan.key} data-plan={plan.key} className="min-w-0 bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 shadow-sm flex flex-col gap-4">
        <h3 className="text-lg font-bold text-slate-900">{names[plan.key]}</h3>
        <p className="text-3xl font-extrabold text-slate-900">{formatPrice(plan.amount, plan.currency)}</p>
        <p className="text-sm text-slate-600">{caption(plan)}</p>
        <p className="text-xs text-slate-500">Up to {plan.totalCycles} billing cycles. {plan.taxInclusive ? 'Taxes included.' : 'Applicable taxes are shown at checkout.'}</p>
        <ul className="text-sm text-slate-600 space-y-2 flex-1"><li>Google review monitoring</li><li>Rating-based WhatsApp alerts</li><li>AI drafts with owner approval</li></ul>
        <button disabled={busy} onClick={() => onCheckout(plan.key, plan.planId)} className="btn-primary justify-center">Buy {names[plan.key]}</button>
      </div> : <button key={plan.key} type="button" data-plan={plan.key} aria-pressed={selected === plan.key} disabled={busy} onClick={() => setSelected(plan.key)} className={`w-full p-4 rounded-xl border text-left ${selected === plan.key ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
        <span className="block font-semibold">{names[plan.key]} — {formatPrice(plan.amount, plan.currency)}</span>
        <span className="block text-xs text-slate-500 mt-1">{caption(plan)}. Up to {plan.totalCycles} billing cycles.</span>
      </button>)}
    </div>
    <p className="text-xs text-slate-500 text-center">Existing paid time is kept. Choosing a different plan replaces an unfinished checkout.</p>
    {layout === 'selector' && selectedPlan && <button className="btn-primary w-full justify-center" disabled={busy} onClick={() => onCheckout(selectedPlan.key, selectedPlan.planId)}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : checkoutLabel}
    </button>}
  </div>;
}
