'use client';
import { useEffect, useState } from 'react';
import { 
  Star, 
  AlertCircle, 
  CheckCircle, 
  MessageSquare, 
  Plus, 
  Building2, 
  RefreshCw, 
  ArrowLeft, 
  AlertTriangle, 
  Loader2 
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatCard from '../../components/dashboard/StatCard';
import RatingChart from '../../components/dashboard/RatingChart';
import AddBusinessModal from '../../components/dashboard/AddBusinessModal';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { useBusiness } from '../../context/BusinessContext';
import { useReview } from '../../context/ReviewContext';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import BillingPlans from '../../components/billing/BillingPlans';
import { openCheckout, refreshSubscriptionStatus } from '../../lib/checkout';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, logout, refreshUser } = useAuth(); // Extracted logout here
  const { businesses, selectedBusiness, fetchBusinesses, loading: bizLoading } = useBusiness();
  const { stats, fetchStats, loading: reviewLoading } = useReview();
  
  const [syncing, setSyncing] = useState(false);
  const syncReviews = async () => {
    if (!selectedBusiness) return;
    setSyncing(true);
    try {
      await api.post(`/business/${selectedBusiness._id}/google/sync`);
      await fetchBusinesses();
      await fetchStats(selectedBusiness._id);
      toast.success(selectedBusiness.isDemo ? 'Demo reviews synced' : 'Google reviews synced');
    } catch (error) { toast.error(error.response?.data?.message || 'Could not sync reviews'); }
    finally { setSyncing(false); }
  };

  // Modal & Selection States
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const showExpiryModal = user?.hasReviewAccess === false;
  const [paymentLoading, setPaymentLoading] = useState(null);
  

  useEffect(() => {
    if (selectedBusiness?.googleConnected && selectedBusiness?.reviewsSynced && user?.hasReviewAccess !== false && !showExpiryModal) {
      fetchStats(selectedBusiness._id);
    }
  }, [selectedBusiness, showExpiryModal, user?.hasReviewAccess, fetchStats]);

  const handleCheckout = async (plan, expectedPlanId) => {
    setPaymentLoading(plan);
    try {
      if (!user?.billingEnabled) throw new Error('Subscriptions are currently unavailable. Please try again later.');
      const result = await openCheckout(plan, expectedPlanId);
      await refreshUser();
      toast.success(result.message);
    } catch (error) {
      await refreshUser().catch(() => {});
      toast.error(error.response?.data?.message || error.message || 'Could not start checkout.');
    }
    finally { setPaymentLoading(null); }
  };

  const refreshSubscription = async () => {
    setPaymentLoading('refresh');
    try {
      await refreshSubscriptionStatus(); await refreshUser();
      toast.success('Subscription status refreshed');
    } catch (error) { toast.error(error.response?.data?.message || 'Could not refresh subscription status'); }
    finally { setPaymentLoading(null); }
  };

  const isLoading = bizLoading || reviewLoading;
  
  return (
    <AppLayout>
      {/* Blurs and disables dashboard interactions seamlessly behind the modal overlay */}
      <div className={`p-4 sm:p-6 max-w-6xl mx-auto transition-all duration-300 ${showExpiryModal ? 'blur-sm pointer-events-none select-none' : ''}`}>
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="min-w-0">
            <Link 
              href="/" 
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 mb-2 transition-colors"
            >
              <ArrowLeft size={13} /> Back 
            </Link>

            <h1 className="text-xl font-bold text-gray-900">
              Good morning, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {selectedBusiness ? `Showing stats for ${selectedBusiness.name}` : 'Add your first business to get started'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none">
            {selectedBusiness && (
              <button onClick={syncReviews} disabled={syncing} className="btn-secondary">
                <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Sync Reviews"}
              </button>
            )}
            <button onClick={() => setShowAddBusiness(true)} className="btn-primary">
              <Plus size={16} /> Add Business
            </button>
          </div>
        </div>

        {/* No business yet */}
        {!bizLoading && businesses.length === 0 && (
          <div className="card">
            <EmptyState
              icon={Building2}
              title="Add your first business"
              description="Connect your Google Business profile to start monitoring reviews and getting instant alerts."
              action={
                <button onClick={() => setShowAddBusiness(true)} className="btn-primary">
                  <Plus size={16} /> Add Business
                </button>
              }
            />
          </div>
        )}

        {/* Stats Content Block */}
        {selectedBusiness && (
          <>
            {isLoading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : (
              <>
                {/* Active Trial banner */}
                {user?.plan === 'trial' && !showExpiryModal && (
                  <div className="mb-5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                    <AlertCircle size={18} className="text-blue-600 flex-shrink-0" />
                    <p className="text-sm text-blue-700">
                      You are on a <strong>7-day free trial</strong>. Trial ends{' '}
                      {new Date(user?.trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}.
                      Upgrade to keep getting alerts.
                    </p>
                  </div>
                )}

                {/* Stat cards */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  <StatCard title="Overall Rating" value={stats?.overallRating?.toFixed(1) || '—'} subtitle="Google rating" icon={Star} color="yellow" />
                  <StatCard title="Total Reviews" value={stats?.totalReviews || 0} subtitle="All time" icon={MessageSquare} color="blue" />
                  <StatCard title="Pending Replies" value={stats?.pendingReplies || 0} subtitle="Need your attention" icon={AlertCircle} color="red" />
                  <StatCard title="Replies Posted" value={stats?.postedReplies || 0} subtitle="Successfully replied" icon={CheckCircle} color="green" />
                </div>

                {/* Chart + Summary */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <RatingChart ratingBreakdown={stats?.ratingBreakdown || []} />

                  <div className="card min-w-0 p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick summary</h3>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-50">
                        <span className="text-sm text-gray-600">Reviews last 30 days</span>
                        <span className="text-sm font-semibold text-gray-900">{stats?.recentReviews || 0}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-50">
                        <span className="text-sm text-gray-600">Alert threshold</span>
                        <span className="text-sm font-semibold text-gray-900">{selectedBusiness?.alertOnRating}★ and below</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-50">
                        <span className="text-sm text-gray-600">Alert number</span>
                        <span className="min-w-0 break-all text-right text-sm font-semibold text-gray-900">{selectedBusiness?.alertPhone}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 py-2.5">
                        <span className="text-sm text-gray-600">Last checked</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {selectedBusiness?.lastPolledAt
                            ? new Date(selectedBusiness.lastPolledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : 'Not yet'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Add Business Setup Modal */}
      <AddBusinessModal isOpen={showAddBusiness} onClose={() => setShowAddBusiness(false)} />
      
      {/* 3. YOUR DESIGNED SUBSCRIPTION OVERLAY INTEGRATED HERE */}
      {showExpiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div role="dialog" aria-modal="true" aria-labelledby="subscription-title" className="bg-white rounded-3xl p-5 sm:p-8 max-w-lg w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain shadow-2xl border border-slate-100 text-center relative">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 to-amber-500" />
            
            <div className="mx-auto w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4 mt-2">
              <AlertTriangle size={28} />
            </div>

            <h2 id="subscription-title" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Access Suspended
            </h2>
            
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Your access period has ended. Choose a subscription below or refresh the status of an existing payment.
            </p>

            <div className="my-6"><BillingPlans layout="selector" busy={paymentLoading !== null} onCheckout={handleCheckout} checkoutLabel="Reactivate Account Tier" /></div>
            <div className="flex flex-col gap-3">
              {user?.hasSubscription && <button onClick={refreshSubscription} disabled={paymentLoading !== null} className="btn-secondary justify-center">Refresh subscription status</button>}
              <button 
                onClick={() => {
                  logout?.();
                }}
                className="w-full py-3 bg-transparent hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-800 font-medium text-sm rounded-xl"
              >
                Sign Out & Clear Session
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
