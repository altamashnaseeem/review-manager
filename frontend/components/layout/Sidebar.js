'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Star, Settings, LogOut, Building2, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useState } from 'react';

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

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Star size={16} className="text-white fill-white" />
          </div>
          <span className="font-bold text-gray-900">ReviewManager</span>
        </div>
      </div>

      {/* Business Selector */}
      {businesses.length > 0 && (
        <div className="p-3 border-b border-gray-100">
          <button
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
            <div className="mt-1 bg-gray-50 rounded-lg overflow-hidden">
              {businesses.map((b) => (
                <button
                  key={b._id}
                  onClick={() => { selectBusiness(b); setShowBusinessMenu(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedBusiness?._id === b._id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
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
  );
}
