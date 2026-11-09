'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import Sidebar from './Sidebar';
import Spinner from '../ui/Spinner';
import ThemeToggle from '../ui/ThemeToggle';

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
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-muted text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (error) return <div className="p-8"><p>{error}</p><button onClick={fetchBusinesses} className="btn-primary mt-4">Retry</button></div>;
  if (!ready) return null;

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <Sidebar />
      <main className="w-full min-w-0 flex-1 [overflow-wrap:anywhere]">
        <header className="hidden lg:flex items-center justify-between gap-4 px-8 py-4 border-b border-line bg-surface/50"><p className="eyebrow">RepliQ <span className="mx-3 text-line">/</span> Owner workspace</p><ThemeToggle /></header>
        {selectedBusiness.isDemo && <div role="status" className="px-4 sm:px-8 py-3 border-b border-line bg-caution-soft/40 text-caution text-xs leading-relaxed">Development demo: synthetic reviews. Replies are saved locally; nothing is posted to Google.</div>}
        {children}
      </main>
    </div>
  );
}
