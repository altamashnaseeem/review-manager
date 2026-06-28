'use client';
import { useEffect, useState } from 'react';
import { Star, AlertCircle, CheckCircle, MessageSquare, Plus, Building2, RefreshCw } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatCard from '../../components/dashboard/StatCard';
import RatingChart from '../../components/dashboard/RatingChart';
import AddBusinessModal from '../../components/dashboard/AddBusinessModal';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { useBusiness } from '../../context/BusinessContext';
import { useReview } from '../../context/ReviewContext';
import { useAuth } from '../../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const { businesses, selectedBusiness, loading: bizLoading } = useBusiness();
  const { stats, fetchStats, loading: reviewLoading } = useReview();
  const [showAddBusiness, setShowAddBusiness] = useState(false);

  useEffect(() => {
    if (selectedBusiness?._id) {
      fetchStats(selectedBusiness._id);
    }
  }, [selectedBusiness]);

  const isLoading = bizLoading || reviewLoading;

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Good morning, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {selectedBusiness ? `Showing stats for ${selectedBusiness.name}` : 'Add your first business to get started'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedBusiness && (
              <button onClick={() => fetchStats(selectedBusiness._id)} className="btn-secondary">
                <RefreshCw size={15} /> Refresh
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

        {/* Stats */}
        {selectedBusiness && (
          <>
            {isLoading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : (
              <>
                {/* Trial banner */}
                {user?.plan === 'trial' && (
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <StatCard title="Overall Rating" value={stats?.overallRating?.toFixed(1) || '—'} subtitle="Google rating" icon={Star} color="yellow" />
                  <StatCard title="Total Reviews" value={stats?.totalReviews || 0} subtitle="All time" icon={MessageSquare} color="blue" />
                  <StatCard title="Pending Replies" value={stats?.pendingReplies || 0} subtitle="Need your attention" icon={AlertCircle} color="red" />
                  <StatCard title="Replies Posted" value={stats?.postedReplies || 0} subtitle="Successfully replied" icon={CheckCircle} color="green" />
                </div>

                {/* Chart + Recent */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <RatingChart ratingBreakdown={stats?.ratingBreakdown || []} />

                  <div className="card p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick summary</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                        <span className="text-sm text-gray-600">Reviews last 30 days</span>
                        <span className="text-sm font-semibold text-gray-900">{stats?.recentReviews || 0}</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                        <span className="text-sm text-gray-600">Alert threshold</span>
                        <span className="text-sm font-semibold text-gray-900">{selectedBusiness?.alertOnRating}★ and below</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
                        <span className="text-sm text-gray-600">Alert number</span>
                        <span className="text-sm font-semibold text-gray-900">{selectedBusiness?.alertPhone}</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
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

      <AddBusinessModal isOpen={showAddBusiness} onClose={() => setShowAddBusiness(false)} />
    </AppLayout>
  );
}
