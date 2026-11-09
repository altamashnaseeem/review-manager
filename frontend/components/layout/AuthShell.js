import Brand from '../brand/Brand';
import ReputationOrbit from '../brand/ReputationOrbit';
import ThemeToggle from '../ui/ThemeToggle';

export default function AuthShell({ children, title, description }) {
  return <main className="auth-shell">
    <header className="landing-container flex h-20 shrink-0 items-center justify-between gap-4 border-b border-line"><Brand /><ThemeToggle /></header>
    <div className="auth-grid">
      <aside className="auth-aside"><p className="eyebrow mb-8">Your reputation, considered.</p><h2>Great care.<br /><span className="text-accent">One reply<br />at a time.</span></h2><ReputationOrbit /><p className="auth-caption">A quieter way to stay on top of your Google reviews. Thoughtful assistance, with you in control.</p></aside>
      <section className="auth-form-panel"><p className="eyebrow mb-6">Welcome to your workspace</p><h1 className="text-3xl sm:text-4xl font-normal tracking-[-0.05em] mb-3">{title}</h1><p className="text-sm text-secondary leading-relaxed mb-8">{description}</p>{children}</section>
    </div>
  </main>;
}
