'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; 
import { motion } from 'framer-motion';
import { Star, Zap, Check, ArrowRight, MessageSquare, AlertTriangle, BarChart3, Menu, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(null); 
  const [showExpiryModal, setShowExpiryModal] = useState(false); // Controlled structural overlay state
  const [selectedModalPlan, setSelectedModalPlan] = useState('monthly'); // Track chosen option inside modal
  const router = useRouter();
  
  // Track system temporal limits across authenticated account updates
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const now = new Date();
      const trialExpired = user.trialEndsAt && new Date(user.trialEndsAt) < now;
      
      // Trigger modal overlay if user has no premium active tier and trial window is past
      if (user.plan === 'none' && trialExpired) {
        setShowExpiryModal(true);
      }
      console.log("user", user)
      console.log("showexpirymodal", showExpiryModal)
    }
  }, [user, loading, isAuthenticated]);

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

  const handleCheckout = async (planKey) => {
    if (!isAuthenticated || !user?.id) {
      router.push('/register');
      return;
    }
  
    try {
      setPaymentLoading(planKey);
      
      const res = await fetch('http://localhost:5000/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, userId: user.id }),
      });
       
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize session');
      }

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
          document.body.appendChild(script);
        });
      }

      const options = {
        key: data.razorpayKeyId,
        subscription_id: data.subscriptionId,
        name: 'RepliQ',
        description: `${planKey.toUpperCase()} Subscription Plan`,
        handler: function (response) {
          console.log('Payment Verification Success Data:', response);
          setShowExpiryModal(false); // Clear structural overlay state block
          router.push('/dashboard?payment=success');
        },
        prefill: {
          name: user.name || data.name || '',
          email: user.email || data.email || '',
          contact: data.phone || '',
        },
        theme: {
          color: '#2563eb',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error('Checkout error:', err);
      alert(err.message || 'An error occurred during payment setup.');
    } finally {
      setPaymentLoading(null);
    }
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
              All plans include a 7-day free trial. Cancel or change your subscription timeline at any time.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            
            {/* 1 Month Plan */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between shadow-sm relative hover:shadow-md transition-shadow">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Monthly</h3>
                <p className="text-slate-400 text-sm mt-1">Flexible month-to-month access</p>
                <div className="mt-6 flex items-baseline text-slate-900">
                  <span className="text-4xl font-extrabold tracking-tight">Rs. 999</span>
                  <span className="ml-1 text-xl font-semibold text-slate-500">/mo</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Billed monthly at Rs.999</p>
                
                <ul className="mt-8 space-y-4 text-sm text-slate-600">
                  <li className="flex items-center gap-3"><Check size={16} className="text-blue-600 inline" /> 7-Day Free Trial</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-blue-600 inline" /> Unlimited Review Monitoring</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-blue-600 inline" /> Instant Text & WhatsApp Alerts</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-blue-600 inline" /> AI Reply Generation</li>
                </ul>
              </div>
              <button 
                onClick={() => handleCheckout('monthly')}
                disabled={paymentLoading !== null}
                className="mt-8 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center disabled:opacity-75"
              >
                {paymentLoading === 'monthly' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buy'}
              </button>
            </div>

            {/* 3 Month Plan */}
            <div className="bg-white border-2 border-blue-600 rounded-3xl p-8 flex flex-col justify-between shadow-md relative scale-105 md:scale-100 lg:scale-105 hover:shadow-lg transition-shadow">
              <div className="absolute top-0 right-6 transform -translate-y-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Popular Choice
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">3 Months</h3>
                <p className="text-slate-400 text-sm mt-1">Perfect stability for growing brands</p>
                <div className="mt-6 flex items-baseline text-slate-900">
                  <span className="text-4xl font-extrabold tracking-tight">Rs. 899</span>
                  <span className="ml-1 text-xl font-semibold text-slate-500">/mo</span>
                </div>
                <p className="text-xs text-blue-600 font-medium mt-2">Billed Rs.2697 every 3 months</p>
                
                <ul className="mt-8 space-y-4 text-sm text-slate-600">
                  <li className="flex items-center gap-3"><Check size={16} className="text-blue-600 inline" /> 7-Day Free Trial</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-blue-600 inline" /> Unlimited Review Monitoring</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-blue-600 inline" /> Instant Text & WhatsApp Alerts</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-blue-600 inline" /> Priority AI Features</li>
                </ul>
              </div>
              <button 
                onClick={() => handleCheckout('quarterly')}
                disabled={paymentLoading !== null}
                className="mt-8 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center disabled:opacity-75"
              >
                {paymentLoading === 'quarterly' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buy'}
              </button>
            </div>

            {/* 6 Month Plan */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between shadow-sm relative hover:shadow-md transition-shadow">
              <div>
                <h3 className="text-lg font-bold text-slate-900">6 Months</h3>
                <p className="text-slate-400 text-sm mt-1">Best value infrastructure scaling</p>
                <div className="mt-6 flex items-baseline text-slate-900">
                  <span className="text-4xl font-extrabold tracking-tight">Rs. 799</span>
                  <span className="ml-1 text-xl font-semibold text-slate-500">/mo</span>
                </div>
                <p className="text-xs text-green-600 font-medium mt-2">Billed Rs.4794 every 6 months</p>
                
                <ul className="mt-8 space-y-4 text-sm text-slate-600">
                  <li className="flex items-center gap-3"><Check size={16} className="text-slate-900 inline" /> 7-Day Free Trial</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-slate-900 inline" /> Unlimited Review Monitoring</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-slate-900 inline" /> Instant Text & WhatsApp Alerts</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-slate-900 inline" /> Max Dedicated API Speed</li>
                </ul>
              </div>
              <button 
                onClick={() => handleCheckout('semi-annual')}
                disabled={paymentLoading !== null}
                className="mt-8 w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center disabled:opacity-75"
              >
                {paymentLoading === 'semi-annual' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buy'}
              </button>
            </div>

          </div>
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