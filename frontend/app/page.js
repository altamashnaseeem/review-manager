'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext'; 
import { motion } from 'framer-motion';
import { Star, Zap, Check, ArrowRight, MessageSquare, AlertTriangle, BarChart3, Menu, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import BillingPlans from '../components/billing/BillingPlans';
import { openCheckout } from '../lib/checkout';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { isAuthenticated, loading, user, logout, refreshUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(null); 
  const showExpiryModal = !loading && isAuthenticated && user?.hasReviewAccess === false;
  const router = useRouter();
  
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const handleCheckout = async (plan, expectedPlanId) => {
    if (!isAuthenticated) { router.push('/register'); return; }
    setPaymentLoading(plan);
    try {
      if (!user?.billingEnabled) throw new Error('Subscriptions are currently unavailable. Please try again later.');
      await openCheckout(plan, expectedPlanId);
      await refreshUser();
      router.push('/dashboard');
    } catch (error) {
      await refreshUser().catch(() => {});
      alert(error.response?.data?.message || error.message || 'Could not start checkout.');
    }
    finally { setPaymentLoading(null); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <Star size={20} fill="currentColor" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              RepliQ
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <button 
                  onClick={() => logout?.()}
                  className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors"
                >
                  Sign Out
                </button>
                <Link href="/dashboard" className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-500/20 active:scale-[0.98]">
                  Go to Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  Sign In
                </Link>
                <Link href="/register" className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-500/20 active:scale-[0.98]">
                  Start Free Trial
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden text-slate-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-slate-200 p-6 flex flex-col gap-4 shadow-xl">
            <a href="#features" onClick={() => setIsMenuOpen(false)} className="text-slate-600 font-medium">Features</a>
            <a href="#pricing" onClick={() => setIsMenuOpen(false)} className="text-slate-600 font-medium">Pricing</a>
            <hr className="border-slate-100" />
            {isAuthenticated ? (
              <div className="flex flex-col gap-3">
                <Link href="/dashboard" onClick={() => setIsMenuOpen(false)} className="bg-blue-600 text-white font-medium text-center py-3 rounded-xl">
                  Go to Dashboard
                </Link>
                <button 
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout?.();
                  }} 
                  className="border border-slate-200 text-slate-600 font-medium text-center py-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <Link href="/login" onClick={() => setIsMenuOpen(false)} className="text-slate-600 font-medium text-center py-2">Sign In</Link>
                <Link href="/register" onClick={() => setIsMenuOpen(false)} className="bg-blue-600 text-white font-medium text-center py-3 rounded-xl">Start Free Trial</Link>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-transparent to-transparent -z-10" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-400/10 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-5xl mx-auto px-6 text-center">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700 mb-6"
          >
            <Zap size={12} className="fill-current" /> Never lose a customer to a bad review
          </motion.div>

          <motion.h1 
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.1 } }
            }}
            className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6"
          >
            Monitor Negative Google Reviews <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              In Real Time.
            </span>
          </motion.h1>

          <motion.p 
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.2 } }
            }}
            className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Connect your business instantly. Get immediate automated alerts when a customer leaves a critical rating, and respond instantly before it impacts your reputation.
          </motion.p>

          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              visible: { opacity: 1, scale: 1, transition: { duration: 0.4, delay: 0.3 } }
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {isAuthenticated ? (
              <Link href="/dashboard" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all group">
                Back to Dashboard <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ) : (
              <>
                <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all group">
                  Start Your 7-Day Free Trial <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a href="#pricing" className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all">
                  See Pricing (Just $5/mo)
                </a>
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl mb-4">
              Everything you need to safeguard your local business
            </h2>
            <p className="text-slate-600">
              Simple, powerful tools built explicitly for business owners who care about their reputation.
            </p>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <motion.div variants={fadeIn} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-5">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Instant Alerts</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Get notified immediately via dashboard alerts the moment a 3-star or lower review lands on your profile.
              </p>
            </motion.div>

            <motion.div variants={fadeIn} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                <MessageSquare size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Centralized Replies</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                No need to open multiple tools. View pending negative reviews and reply directly through our clean workspace.
              </p>
            </motion.div>

            <motion.div variants={fadeIn} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
                <BarChart3 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Smart Analytics</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Track updates to overall ratings, review totals, and pending versus successfully resolved replies over time.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-slate-50 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Simple Pricing
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-3 sm:text-4xl">
              Choose the plan that fits your business
            </h2>
            <p className="text-slate-500 mt-4">
              Start with a 7-day free trial. Review the subscription terms in checkout.
            </p>
          </div>

          <BillingPlans busy={paymentLoading !== null} onCheckout={handleCheckout} />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-2xl font-bold tracking-tight mb-3">
            Take control of your online reputation today
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-8 text-sm">
            Join local business owners using ReviewPulse to keep their customer satisfaction rankings pristine.
          </p>
          {isAuthenticated ? (
            <Link href="/dashboard" className="inline-flex items-center justify-center px-6 py-3 font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-xl shadow-lg transition-all active:scale-[0.98]">
              Go to Dashboard
            </Link>
          ) : (
            <Link href="/register" className="inline-flex items-center justify-center px-6 py-3 font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-xl shadow-lg transition-all active:scale-[0.98]">
              Get Started For Free 
            </Link>
          )}
          <div className="mt-12 text-xs text-slate-500 border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>© 2026 ReviewPulse. All rights reserved.</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-slate-300">Privacy Policy</a>
              <a href="#" className="hover:text-slate-300">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

      

    </div>
  );
}
