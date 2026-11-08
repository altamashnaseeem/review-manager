'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import Sidebar from './Sidebar';
import Spinner from '../ui/Spinner';

export default function AppLayout({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const { loaded, loading: businessLoading, error, fetchBusinesses, selectedBusiness } = useBusiness();
  const ready = selectedBusiness?.googleConnected && selectedBusiness?.reviewsSynced;
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated && loaded && !error && !ready) router.replace('/connect-google');
  }, [isAuthenticated, loaded, error, ready, router]);

  if (loading || !loaded || businessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-gray-500 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (error) return <div className="p-8"><p>{error}</p><button onClick={fetchBusinesses} className="btn-primary mt-4">Retry</button></div>;
  if (!ready) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {selectedBusiness.isDemo && <div role="status" className="p-3 bg-amber-100 text-amber-900 text-sm">Development demo: synthetic reviews. Replies are saved locally; nothing is posted to Google.</div>}
        {children}
      </main>
    </div>
  );
}
