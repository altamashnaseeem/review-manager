'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, ArrowRight, Check, Menu, X, Loader2, Star, MessageSquare, BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/brand/Brand';
import ReputationOrbit from '../components/brand/ReputationOrbit';
import ThemeToggle from '../components/ui/ThemeToggle';
import BillingPlans from '../components/billing/BillingPlans';
import { openCheckout } from '../lib/checkout';

const features = [
  { number: '01', label: 'Listen', title: 'The full picture.', description: 'Bring reviews from your connected Google Business Profile into one considered workspace. See the feedback, the ratings, and the replies already posted.' },
  { number: '02', label: 'Notice', title: 'Your threshold.\nYour attention.', description: 'Choose any rating from 1 to 5. New reviews at or below it trigger a WhatsApp alert, so you can focus on the feedback that needs you.' },
  { number: '03', label: 'Respond', title: 'Thoughtful replies.\nStill your voice.', description: 'Let AI prepare a starting point. Edit it, make it yours, and approve the exact reply before it is posted to Google.' },
];

export default function Home() {
  const { isAuthenticated, loading, user, logout, refreshUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(null);
  const router = useRouter();
  const destination = isAuthenticated ? '/dashboard' : '/register';
  const handleCheckout = async (plan, expectedPlanId) => {
    if (!isAuthenticated) { router.push('/register'); return; }
    setPaymentLoading(plan);
    try {
      if (!user?.billingEnabled) throw new Error('Subscriptions are currently unavailable. Please try again later.');
      await openCheckout(plan, expectedPlanId);
      await refreshUser(); router.push('/dashboard');
    } catch (error) {
      await refreshUser().catch(() => {});
      toast.error(error.response?.data?.message || error.message || 'Could not start checkout.');
    } finally { setPaymentLoading(null); }
  };
  if (loading) return <div className="min-h-dvh grid place-items-center bg-canvas"><Loader2 className="animate-spin text-accent" aria-label="Loading" /></div>;

  return <div className="min-h-dvh bg-canvas text-ink">
    <header className="landing-nav fixed inset-x-0 top-0 z-40 border-b border-line/70">
      <nav aria-label="Main" className="landing-container flex h-20 items-center justify-between gap-3">
        <Brand />
        <div className="hidden md:flex items-center gap-7 text-xs text-secondary">
          <a className="hover:text-ink" href="#features">What we do</a><a className="hover:text-ink" href="#how-it-works">How it works</a><a className="hover:text-ink" href="#pricing">Pricing</a>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <Link className="hidden md:inline-flex min-h-11 items-center gap-2 text-sm text-ink" href={isAuthenticated ? '/dashboard' : '/login'}>{isAuthenticated ? 'Your workspace' : 'Sign in'} <ArrowUpRight size={16} /></Link>
          <button aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMenuOpen} aria-controls="home-mobile-menu" onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden grid h-11 w-11 place-items-center rounded-full border border-line text-ink">{isMenuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </nav>
      {isMenuOpen && <div id="home-mobile-menu" className="md:hidden max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-line bg-surface px-4 py-4">
        <div className="flex flex-col gap-2">
          <a className="min-h-11 flex items-center text-secondary" href="#features" onClick={() => setIsMenuOpen(false)}>What we do</a>
          <a className="min-h-11 flex items-center text-secondary" href="#how-it-works" onClick={() => setIsMenuOpen(false)}>How it works</a>
          <a className="min-h-11 flex items-center text-secondary" href="#pricing" onClick={() => setIsMenuOpen(false)}>Pricing</a>
          <Link className="btn-primary" href={isAuthenticated ? '/dashboard' : '/login'} onClick={() => setIsMenuOpen(false)}>{isAuthenticated ? 'Go to Dashboard' : 'Sign In'} <ArrowUpRight size={16} /></Link>
          {isAuthenticated ? <button className="btn-secondary" onClick={() => { setIsMenuOpen(false); logout(); }}>Sign Out</button> : <Link className="btn-secondary" href="/register" onClick={() => setIsMenuOpen(false)}>Start Free Trial</Link>}
        </div>
      </div>}
    </header>

    <main>
      <section className="hero">
        <div className="landing-container relative">
          <div className="hero-labels eyebrow reveal"><span>Google reviews, considered.</span><span>WhatsApp alerts</span><span>AI drafts. Your approval.</span></div>
          <ReputationOrbit className="hero-art" />
          <h1 className="hero-title reveal">Every review.<br /><span className="hero-accent">A better reply.</span></h1>
          <div className="hero-bottom reveal">
            <p className="hero-description">A great reputation is built one conversation at a time. Listen to your customers, know when to act, and reply with care.</p>
            <div className="flex w-full sm:w-auto flex-col gap-3 sm:items-start">
              <Link href={destination} className="btn-primary w-full sm:w-auto px-6 py-3.5">{isAuthenticated ? 'Open your workspace' : 'Start your free trial'} <ArrowUpRight size={18} /></Link>
              <p className="eyebrow text-center sm:text-left">{isAuthenticated ? 'Your business. In focus.' : '7 days to find your rhythm. No card required.'}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section">
        <div className="landing-container">
          <div className="section-intro">
            <p className="eyebrow"><span className="text-accent mr-3">01</span> What we do</p>
            <div><h2 className="section-heading max-w-2xl">Behind every rating,<br />a conversation worth having.</h2><p className="mt-6 max-w-xl text-secondary leading-relaxed">Your customers have something to say. RepliQ brings the important moments into focus, and gives you the space to respond well.</p></div>
          </div>
          <div className="feature-grid">
            {features.map(feature => <article key={feature.number} className="feature-column">
              <p className="eyebrow"><span className="text-accent mr-3">{feature.number}</span>{feature.label}</p>
              <h3 className="whitespace-pre-line">{feature.title}</h3><p className="text-sm text-secondary leading-7">{feature.description}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section bg-surface/40">
        <div className="landing-container grid lg:grid-cols-2 gap-10 lg:gap-24 items-center">
          <div>
            <p className="eyebrow mb-6"><span className="text-accent mr-3">02</span> The review loop</p>
            <h2 className="section-heading">A little assistance.<br />A human touch.</h2>
            <p className="mt-6 text-secondary leading-7 max-w-md">From the first alert to the final word, you stay in control. AI helps with the draft. The decision to reply is always yours.</p>
            <div className="mt-9">
              {[['Connect', 'Choose the Google business location you manage.'], ['Set your signal', 'Save your rating threshold and WhatsApp number.'], ['Make it personal', 'Review the draft, edit, and approve it for Google.']].map(([title,description], index) => <div className="workflow-stage flex items-start gap-5" key={title}><span className="eyebrow text-accent pt-1">0{index+1}</span><div><h3 className="text-lg font-medium tracking-tight">{title}</h3><p className="text-sm text-secondary mt-2 leading-relaxed">{description}</p></div></div>)}
            </div>
          </div>
          <div className="workflow-illustration">
            <p className="eyebrow mb-8">An illustrative conversation</p>
            <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs text-secondary"><MessageSquare size={15} /> A new Google review</span><span className="text-caution text-xs flex gap-0.5"><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /></span></div>
            <p className="text-xl sm:text-2xl font-normal tracking-tight leading-relaxed mt-6 mb-7">“Lovely atmosphere, but our food arrived cold.”</p>
            <div className="flex items-start gap-3 border-t border-line py-6 text-sm text-secondary"><BellRing size={17} className="text-accent mt-0.5" /><p>WhatsApp alert sent.<span className="block text-xs text-muted mt-1">Example threshold: 3 stars or below.</span></p></div>
            <div className="rounded-lg bg-canvas border border-line p-5">
              <p className="eyebrow text-accent mb-4">A starting point, from AI</p><p className="text-sm text-secondary leading-7">Thank you for sharing this. We’re glad you enjoyed the atmosphere, and we’re sorry your meal wasn’t served as it should have been. We’d love the chance to make it right.</p>
              <div className="mt-5 pt-4 border-t border-line flex items-center gap-2 text-xs text-positive"><Check size={14} /> Only posted after you approve.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="landing-section">
        <div className="landing-container">
          <div className="section-intro"><p className="eyebrow"><span className="text-accent mr-3">03</span> A plan for your business</p><div><h2 className="section-heading">Good care.<br />A clear commitment.</h2><p className="mt-6 text-secondary leading-relaxed">Start with a 7-day free trial. Choose your billing rhythm below and review the subscription terms at checkout.</p></div></div>
          <BillingPlans busy={paymentLoading !== null} onCheckout={handleCheckout} />
        </div>
      </section>
    </main>

    <footer className="border-t border-line">
      <div className="landing-container py-14 sm:py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8"><h2 className="text-[clamp(2.75rem,7vw,6rem)] font-normal leading-[1.02] tracking-[-0.065em]">Make every<br /><span className="text-accent">reply count.</span></h2><Link href={destination} className="btn-secondary w-full sm:w-fit">{isAuthenticated ? 'Go to Dashboard' : 'Get started with RepliQ'} <ArrowRight size={18} /></Link></div>
        <div className="mt-16 pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-6"><Brand /><div className="flex flex-wrap gap-6 text-xs text-secondary"><a href="#features">What we do</a><a href="#pricing">Pricing</a><Link href={isAuthenticated ? '/settings' : '/login'}>{isAuthenticated ? 'Account settings' : 'Sign in'}</Link></div><p className="text-xs text-muted">© {new Date().getFullYear()} RepliQ</p></div>
      </div>
    </footer>
  </div>;
}
