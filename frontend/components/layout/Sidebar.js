'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Star, Settings, LogOut, Building2, ChevronDown, Menu, X } from 'lucide-react';
import Brand, { BrandMark } from '../brand/Brand';
import ThemeToggle from '../ui/ThemeToggle';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useCallback, useEffect, useRef, useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reviews', label: 'Reviews', icon: Star },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { businesses, selectedBusiness, selectBusiness } = useBusiness();
  const [showBusinessMenu, setShowBusinessMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawer = useRef(null);
  const menuButton = useRef(null);
  const closeButton = useRef(null);
  const closeMenu = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = () => { if (desktop.matches) closeMenu(); };
    desktop.addEventListener('change', onResize);
    return () => desktop.removeEventListener('change', onResize);
  }, [closeMenu]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
      if (event.key !== 'Tab') return;
      const controls = drawer.current?.querySelectorAll('a[href], button:not([disabled])');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const trigger = menuButton.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (trigger?.getClientRects().length) trigger.focus();
    };
  }, [mobileOpen, closeMenu]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="h-8 w-8 shrink-0 text-accent" />
          <div className="min-w-0"><p className="font-medium tracking-tight text-ink">RepliQ</p><p className="max-w-[35vw] truncate text-[10px] text-muted">{selectedBusiness?.name}</p></div>
        </Link>
        <div className="flex shrink-0 items-center gap-2"><ThemeToggle /><button ref={menuButton} type="button" aria-label="Open navigation menu" aria-expanded={mobileOpen} aria-controls="app-navigation" onClick={() => setMobileOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-secondary hover:bg-raised"><Menu size={20} /></button></div>
      </header>
      {mobileOpen && <div aria-hidden="true" onClick={closeMenu} className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" />}
      <aside ref={drawer} id="app-navigation" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? true : undefined} aria-label="App navigation" className={`${mobileOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-50 h-dvh w-[min(20rem,calc(100vw-3rem))] flex-col overflow-y-auto overscroll-contain bg-surface border-r border-line lg:sticky lg:top-0 lg:z-20 lg:flex lg:w-64 lg:shrink-0`}>
      {/* Logo */}
      <div className="p-5 border-b border-line flex items-center justify-between gap-3">
        <Brand href="/dashboard" onClick={closeMenu} />
        <button ref={closeButton} type="button" aria-label="Close navigation menu" onClick={closeMenu} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-secondary hover:bg-canvas lg:hidden"><X size={22} /></button>
      </div>

      {/* Business Selector */}
      {businesses.length > 0 && (
        <div className="p-3 border-b border-line">
          <button
            aria-expanded={showBusinessMenu}
            aria-controls="business-options"
            onClick={() => setShowBusinessMenu(!showBusinessMenu)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-canvas transition-colors text-left"
          >
            <div className="w-7 h-7 bg-accent-soft rounded-md flex items-center justify-center flex-shrink-0">
              <Building2 size={14} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted">Active business</p>
              <p className="text-sm font-medium text-ink truncate">
                {selectedBusiness?.name || 'Select business'}
              </p>
            </div>
            <ChevronDown size={14} className={`text-muted transition-transform ${showBusinessMenu ? 'rotate-180' : ''}`} />
          </button>

          {showBusinessMenu && (
            <div id="business-options" className="mt-1 bg-canvas rounded-lg overflow-hidden">
              {businesses.map((b) => (
                <button
                  key={b._id}
                  onClick={() => { selectBusiness(b); setShowBusinessMenu(false); closeMenu(); }}
                  className={`w-full break-words text-left px-3 py-3 text-sm transition-colors ${selectedBusiness?._id === b._id ? 'bg-accent-soft text-accent font-medium' : 'text-secondary hover:bg-raised'}`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Primary" className="flex-1 p-3 pt-6 space-y-2">
        <p className="eyebrow px-3 mb-4">Your workspace</p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={closeMenu}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/20'
                  : 'text-secondary hover:bg-canvas hover:text-ink'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-line">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 bg-action rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">{user?.name}</p>
            <p className="text-xs text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-negative hover:bg-negative-soft transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
      </aside>
    </>
  );
}
