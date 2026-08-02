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

export default function DashboardPage() {
  const { user, logout } = useAuth(); // Extracted logout here
  const { businesses, selectedBusiness, loading: bizLoading } = useBusiness();
  const { stats, fetchStats, loading: reviewLoading } = useReview();
  
  // Modal & Selection States
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [selectedModalPlan, setSelectedModalPlan] = useState('monthly');
  const [paymentLoading, setPaymentLoading] = useState(null);
  
  // 1. Evaluate trial/plan subscription status
 // 1. Evaluate trial/plan subscription status accurately
useEffect(() => {
  if (user) {
    const now = new Date();
    const trialExpired = user.trialEndsAt && new Date(user.trialEndsAt) < now;
    
    // Check if the user is currently on an active paid plan subscription tier
    const hasActivePaidPlan = ['monthly', 'quarterly', 'semi-annual'].includes(user.plan);
    
    // Only lock the screen if they DON'T have a paid plan AND their trial state is invalid
    if (!hasActivePaidPlan && (user.plan === 'none' || trialExpired)) {
      console.log("Access Denied: Suspending UI view");
      setShowExpiryModal(true);
    } else {
      console.log("Access Granted: Clear active dashboard context");
      setShowExpiryModal(false);
    }
  }
}, [user]);

  useEffect(() => {
    if (selectedBusiness?._id && !showExpiryModal) {
      fetchStats(selectedBusiness._id);
    }
  }, [selectedBusiness, showExpiryModal]);

  // 2. Razorpay Checkout Handler Logic
  const handleCheckout = async (planType) => {
    try {
      setPaymentLoading(planType);
      
      // Call your checkout session backend route
      const response = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planType, userId: user?._id }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to initialize payment.');

      // Initialize Razorpay Checkout
      const options = {
        key: data.razorpayKeyId,
        subscription_id: data.subscriptionId,
        name: 'RepliQ',
        description: `${planType.charAt(0).toUpperCase() + planType.slice(1)} Subscription`,
        prefill: {
          name: data.name,
          email: data.email,
          contact: data.phone,
        },
        handler: function (response) {
          // Handle successful subscription payment client side if needed
          // Usually window updates or waits for the webhook status update
          window.location.reload();
        },
        theme: { color: '#2563eb' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      
    } catch (err) {
      alert(err.message || 'Payment integration error occurred.');
    } finally {
      setPaymentLoading(null);
    }
  };

  const isLoading = bizLoading || reviewLoading;
  
  return (
    <AppLayout>
      {/* Blurs and disables dashboard interactions seamlessly behind the modal overlay */}
      <div className={`p-6 max-w-6xl mx-auto transition-all duration-300 ${showExpiryModal ? 'blur-sm pointer-events-none select-none' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <StatCard title="Overall Rating" value={stats?.overallRating?.toFixed(1) || '—'} subtitle="Google rating" icon={Star} color="yellow" />
                  <StatCard title="Total Reviews" value={stats?.totalReviews || 0} subtitle="All time" icon={MessageSquare} color="blue" />
                  <StatCard title="Pending Replies" value={stats?.pendingReplies || 0} subtitle="Need your attention" icon={AlertCircle} color="red" />
                  <StatCard title="Replies Posted" value={stats?.postedReplies || 0} subtitle="Successfully replied" icon={CheckCircle} color="green" />
                </div>

                {/* Chart + Summary */}
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

      {/* Add Business Setup Modal */}
      <AddBusinessModal isOpen={showAddBusiness} onClose={() => setShowAddBusiness(false)} />
      
      {/* 3. YOUR DESIGNED SUBSCRIPTION OVERLAY INTEGRATED HERE */}
      {showExpiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-slate-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 to-amber-500" />
            
            <div className="mx-auto w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4 mt-2">
              <AlertTriangle size={28} />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Access Suspended
            </h2>
            
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Your trial timeline has concluded. Choose a package option below to instantly restore real-time review updates and AI workflows.
            </p>

            {/* Interactive Selector Layout for all 3 Tiers */}
            <div className="flex flex-col gap-2.5 my-6 text-left">
              
              {/* Monthly Option Button */}
              <button
                type="button"
                onClick={() => setSelectedModalPlan('monthly')}
                className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  selectedModalPlan === 'monthly'
                    ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    selectedModalPlan === 'monthly' ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                  }`}>
                    {selectedModalPlan === 'monthly' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">Monthly Plan</div>
                    <div className="text-xs text-slate-400">Billed month-to-month</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-slate-900 text-base">Rs. 1000</span>
                  <span className="text-xs text-slate-400">/mo</span>
                </div>
              </button>

              {/* Quarterly Option Button */}
              <button
                type="button"
                onClick={() => setSelectedModalPlan('quarterly')}
                className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer relative ${
                  selectedModalPlan === 'quarterly'
                    ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80'
                }`}
              >
                <div className="absolute -top-2 right-4 bg-blue-600 text-white font-bold text-[10px] tracking-wide px-2 py-0.5 rounded-full uppercase">
                  Save 10%
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    selectedModalPlan === 'quarterly' ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                  }`}>
                    {selectedModalPlan === 'quarterly' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">3 Months Plan</div>
                    <div className="text-xs text-blue-600 font-medium">Rs. 2700 billed upfront</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-slate-900 text-base">Rs. 900</span>
                  <span className="text-xs text-slate-400">/mo</span>
                </div>
              </button>

              {/* Semi-Annual Option Button */}
              <button
                type="button"
                onClick={() => setSelectedModalPlan('semi-annual')}
                className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer relative ${
                  selectedModalPlan === 'semi-annual'
                    ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50/80'
                }`}
              >
                <div className="absolute -top-2 right-4 bg-emerald-600 text-white font-bold text-[10px] tracking-wide px-2 py-0.5 rounded-full uppercase">
                  Save 20%
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    selectedModalPlan === 'semi-annual' ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                  }`}>
                    {selectedModalPlan === 'semi-annual' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">6 Months Plan</div>
                    <div className="text-xs text-emerald-600 font-medium">Rs. 4800 billed upfront</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-slate-900 text-base">Rs. 800</span>
                  <span className="text-xs text-slate-400">/mo</span>
                </div>
              </button>

            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleCheckout(selectedModalPlan)}
                disabled={paymentLoading !== null}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-75 transition-colors text-white font-semibold rounded-xl text-sm shadow-md flex items-center justify-center gap-2"
              >
                {paymentLoading === selectedModalPlan ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Reactivate Account Tier</>
                )}
              </button>
               
              <button 
                onClick={() => {
                  logout?.();
                  setShowExpiryModal(false);
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