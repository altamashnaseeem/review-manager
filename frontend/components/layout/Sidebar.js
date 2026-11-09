'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Star, Settings, LogOut, Building2, ChevronDown, Menu, X } from 'lucide-react';
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
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600"><Star size={18} className="text-white fill-white" /></div>
          <div className="min-w-0"><p className="font-bold text-gray-900">RepliQ</p><p className="max-w-[55vw] truncate text-xs text-gray-500">{selectedBusiness?.name}</p></div>
        </Link>
        <button ref={menuButton} type="button" aria-label="Open navigation menu" aria-expanded={mobileOpen} aria-controls="app-navigation" onClick={() => setMobileOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"><Menu size={22} /></button>
      </header>
      {mobileOpen && <div aria-hidden="true" onClick={closeMenu} className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" />}
      <aside ref={drawer} id="app-navigation" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? true : undefined} aria-label="App navigation" className={`${mobileOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-50 h-dvh w-[min(20rem,calc(100vw-3rem))] flex-col overflow-y-auto overscroll-contain bg-white border-r border-gray-100 lg:sticky lg:top-0 lg:z-20 lg:flex lg:w-64 lg:shrink-0`}>
      {/* Logo */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Star size={16} className="text-white fill-white" />
          </div>
          <span className="font-bold text-gray-900">RepliQ</span>
        </div>
        <button ref={closeButton} type="button" aria-label="Close navigation menu" onClick={closeMenu} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50 lg:hidden"><X size={22} /></button>
      </div>

      {/* Business Selector */}
      {businesses.length > 0 && (
        <div className="p-3 border-b border-gray-100">
          <button
            aria-expanded={showBusinessMenu}
            aria-controls="business-options"
            onClick={() => setShowBusinessMenu(!showBusinessMenu)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center flex-shrink-0">
              <Building2 size={14} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">Active business</p>
              <p className="text-sm font-medium text-gray-800 truncate">
                {selectedBusiness?.name || 'Select business'}
              </p>
            </div>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${showBusinessMenu ? 'rotate-180' : ''}`} />
          </button>

          {showBusinessMenu && (
            <div id="business-options" className="mt-1 bg-gray-50 rounded-lg overflow-hidden">
              {businesses.map((b) => (
                <button
                  key={b._id}
                  onClick={() => { selectBusiness(b); setShowBusinessMenu(false); closeMenu(); }}
                  className={`w-full break-words text-left px-3 py-3 text-sm transition-colors ${selectedBusiness?._id === b._id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Primary" className="flex-1 p-3 space-y-1">
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
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
      </aside>
    </>
  );
}
