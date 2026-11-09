'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import AddBusinessModal from '../../components/dashboard/AddBusinessModal';
import api from '../../lib/axios';

const oauthErrors = {
  access_denied: 'Permission was declined. Connect again and allow Business Profile access.',
  invalid_state: 'This connection expired or was already used. Start again in this browser tab.',
  oauth_failed: 'Google authorization failed. Please try connecting again.',
};

export default function ConnectGooglePage() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { businesses, selectedBusiness, loaded, error: businessError, demoEnabled, fetchBusinesses, selectBusiness } = useBusiness();
  const [businessId, setBusinessId] = useState('');
  const [callback, setCallback] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [locationKey, setLocationKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const started = useRef(false);
  const router = useRouter();
  const business = businesses.find(b => b._id === businessId) || selectedBusiness;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBusinessId(params.get('business') || '');
    if (params.get('error')) setError(oauthErrors[params.get('error')] || oauthErrors.oauth_failed);
    if (params.get('code')) {
      setCallback({ businessId: params.get('business'), code: params.get('code'), state: params.get('state') });
      // Remove the authorization code immediately from the address bar.
      window.history.replaceState({}, '', `/connect-google?business=${params.get('business') || ''}`);
    }
  }, []);
  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!callback || !isAuthenticated || started.current) return;
    started.current = true;
    const finish = async () => {
      setBusy(true);
      const key = `google-pkce-${callback.businessId}`;
      try {
        const codeVerifier = sessionStorage.getItem(key);
        if (!codeVerifier) throw new Error('Connection must finish in the browser tab where it started. Connect again.');
        await api.post(`/business/${callback.businessId}/google/complete`, { ...callback, codeVerifier });
        await fetchBusinesses();
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { sessionStorage.removeItem(key); setCallback(null); setBusy(false); }
    };
    finish();
  }, [callback, isAuthenticated, fetchBusinesses]);

  useEffect(() => {
    setLocations([]); setLocationsLoaded(false); setLocationKey('');
    if (!business?.googleAuthorized || business.isDemo || callback || busy) return;
    let cancelled = false;
    api.get(`/business/${business._id}/google/locations`).then(({ data }) => {
      if (!cancelled) { setLocations(data.locations); setLocationsLoaded(true); }
    }).catch(err => { if (!cancelled) setError(err.response?.data?.message || 'Could not load Google locations.'); });
    return () => { cancelled = true; };
  }, [business?._id, business?.googleAuthorized, business?.isDemo, callback, busy]);

  const act = async (action) => {
    setBusy(true); setError('');
    try { await action(); }
    catch (err) { setError(err.response?.data?.message || err.message || 'Please try again.'); }
    finally { setBusy(false); }
  };
  const connect = () => act(async () => {
    const { data } = await api.get(`/business/${business._id}/google/connect`);
    sessionStorage.setItem(`google-pkce-${business._id}`, data.codeVerifier);
    window.location.assign(data.url);
  });
  const selectLocation = () => act(async () => {
    const location = locations.find(l => `${l.accountId}/${l.locationId}` === locationKey);
    if (!location) throw new Error('Choose your business location.');
    const { data } = await api.post(`/business/${business._id}/google/location`, { accountId: location.accountId, locationId: location.locationId });
    await fetchBusinesses(); selectBusiness(data.business); router.replace('/dashboard');
  });
  const demo = () => act(async () => {
    const { data } = await api.post(`/business/${business._id}/google/demo`);
    await fetchBusinesses(); selectBusiness(data.business); router.replace('/dashboard');
  });
  const sync = () => act(async () => {
    const { data } = await api.post(`/business/${business._id}/google/sync`);
    await fetchBusinesses(); selectBusiness(data.business); router.replace('/dashboard');
  });

  if (loading || !loaded) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" aria-label="Loading" /></div>;
  if (!isAuthenticated) return null;
  return (
    <main className="min-h-dvh bg-gray-50 flex items-center justify-center px-4 py-8 sm:p-6">
      <div className="card min-w-0 p-5 sm:p-8 w-full max-w-xl [overflow-wrap:anywhere] space-y-5">
        <Building2 className="text-blue-600" size={32} />
        <p className="text-sm text-gray-500">Welcome, {user?.name} · Business setup</p>
        <h1 className="text-xl sm:text-2xl font-bold">Connect your Google Business Profile</h1>
        <p className="text-gray-600 text-sm">Add your business details, grant Google permission, then choose the location you manage. Your dashboard opens after the reviews sync.</p>
        {(error || businessError) && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error || businessError}</p>}
        {businessError && <button className="btn-secondary w-full sm:w-auto" onClick={fetchBusinesses}>Retry loading businesses</button>}
        {businesses.length > 0 && <div>
          <label htmlFor="business" className="block text-sm font-medium mb-2">Your business</label>
          <select id="business" className="input-field" disabled={busy || !!callback} value={business?._id || ''} onChange={e => { setBusinessId(e.target.value); setError(''); selectBusiness(businesses.find(b => b._id === e.target.value)); }}>
            {businesses.map(b => <option key={b._id} value={b._id}>{b.name}{b.isDemo ? ' (demo)' : ''}</option>)}
          </select>
        </div>}
        <button className="btn-secondary w-full sm:w-auto" disabled={busy || !!callback} onClick={() => setShowAdd(true)}>{business ? 'Add another business' : 'Enter business details'}</button>
        {business && <div className="space-y-4 border-t pt-5">
          {business.isDemo ? <p className="text-sm text-amber-800">Development demo: 125 synthetic reviews. No real Google connection or Google posts.</p> : <button className="btn-primary w-full justify-center" disabled={busy || !!callback} onClick={connect}>{business.googleAuthorized ? 'Reconnect Google Business account' : 'Connect Google Business account'}</button>}
          {busy && <p role="status" className="text-sm text-gray-500 flex gap-2"><Loader2 size={16} className="animate-spin" /> Connecting or syncing reviews…</p>}
          {business.googleAuthorized && !business.isDemo && locationsLoaded && locations.length === 0 && <p className="text-sm text-gray-600">No managed locations were found. Sign in with a Google account that owns or manages a real Business Profile, or ask an owner to invite you as a manager. Adding an OAuth test user does not give business access.</p>}
          {locations.length > 0 && <div className="space-y-3">
            <label htmlFor="location" className="block text-sm font-medium">Choose your Google location</label>
            <select id="location" className="input-field" disabled={busy} value={locationKey} onChange={e => setLocationKey(e.target.value)}>
              <option value="">Select a location</option>
              {locations.map(l => <option key={`${l.accountId}/${l.locationId}`} value={`${l.accountId}/${l.locationId}`}>{l.title} · {l.address || l.accountName}</option>)}
            </select>
            <button className="btn-primary w-full sm:w-auto" disabled={busy || !locationKey} onClick={selectLocation}>Sync reviews and open dashboard</button>
          </div>}
          {business.googleConnected && <button className="btn-primary w-full sm:w-auto" disabled={busy || !!callback} onClick={sync}>{business.reviewsSynced ? 'Sync and continue to dashboard' : 'Retry review sync'}</button>}
          {demoEnabled && !business.googleAuthorized && !business.googleLocationId && <div className="bg-amber-50 p-4 rounded-lg space-y-2">
            <p className="text-sm text-amber-900">Developer testing without a store: load 125 synthetic reviews. Replies stay local and no alerts are sent.</p>
            <button className="btn-secondary w-full sm:w-auto" disabled={busy || !!callback} onClick={demo}>Use development demo</button>
          </div>}
        </div>}
        <div className="flex justify-between text-sm text-gray-500 pt-3"><Link href="/" className="inline-flex min-h-11 items-center">Home</Link><button onClick={logout}>Sign out</button></div>
      </div>
      <AddBusinessModal isOpen={showAdd} onClose={() => { setShowAdd(false); setBusinessId(''); }} />
    </main>
  );
}
