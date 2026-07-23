'use client';
import { useState } from 'react';
import { User, Bell, Lock, Trash2, Loader2, Save } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, updatePassword } = useAuth();
  const { selectedBusiness, updateBusiness, deleteBusiness } = useBusiness();
  const [activeTab, setActiveTab] = useState('profile');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [bizForm, setBizForm] = useState({
    alertPhone: selectedBusiness?.alertPhone || '',
    alertEmail: selectedBusiness?.alertEmail || '',
    alertOnRating: selectedBusiness?.alertOnRating || 3,
    autoReplyEnabled: selectedBusiness?.autoReplyEnabled || false,
  });
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'business', label: 'Business Settings', icon: Bell },
    { id: 'security', label: 'Security', icon: Lock },
  ];
// Add this state at top of component
const [connecting, setConnecting] = useState(false);

// Add this function
const handleConnectGoogle = async () => {
  if (!selectedBusiness) return;
  setConnecting(true);
  try {
    const { data } = await api.get(`/business/${selectedBusiness._id}/google/connect`);
    // Redirect owner to Google login
    window.location.href = data.url;
  } catch (error) {
    toast.error('Failed to connect Google Business');
    setConnecting(false);
  }
};
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setLoading(true);
    await updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setLoading(false);
  };

  const handleBizUpdate = async (e) => {
    e.preventDefault();
    if (!selectedBusiness) return;
    setLoading(true);
    await updateBusiness(selectedBusiness._id, bizForm);
    setLoading(false);
  };

  const handleDeleteBusiness = async () => {
    if (!selectedBusiness) return;
    if (!confirm(`Are you sure you want to remove "${selectedBusiness.name}"? This cannot be undone.`)) return;
    await deleteBusiness(selectedBusiness._id);
    toast.success('Business removed');
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your account and business preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Your profile</h2>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center">
                <span className="text-white text-xl font-bold">{user?.name?.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user?.name}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${user?.plan === 'trial' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>
                  {user?.plan === 'trial' ? `Trial — ends ${new Date(user?.trialEndsAt).toLocaleDateString('en-IN')}` : user?.plan + ' plan'}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input defaultValue={user?.name} className="input-field" readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input defaultValue={user?.email} className="input-field" readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input defaultValue={user?.phone} className="input-field" readOnly />
              </div>
            </div>
          </div>
        )}

        {/* Business Settings Tab */}
        {activeTab === 'business' && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-5">
              {selectedBusiness ? `Settings for ${selectedBusiness.name}` : 'No business selected'}
            </h2>
            {!selectedBusiness ? (
              <p className="text-gray-500 text-sm">Select a business from the sidebar to manage its settings.</p>
            ) : (
              <form onSubmit={handleBizUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp alert number</label>
                  <input
                    type="tel" value={bizForm.alertPhone}
                    onChange={(e) => setBizForm({ ...bizForm, alertPhone: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Alert email</label>
                  <input
                    type="email" value={bizForm.alertEmail}
                    onChange={(e) => setBizForm({ ...bizForm, alertEmail: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Alert when rating ≤ {bizForm.alertOnRating} stars
                  </label>
                  <input
                    type="range" min="1" max="5" value={bizForm.alertOnRating}
                    onChange={(e) => setBizForm({ ...bizForm, alertOnRating: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Auto-reply mode</p>
                    <p className="text-xs text-gray-500 mt-0.5">Let AI post replies automatically without your approval</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox" checked={bizForm.autoReplyEnabled}
                      onChange={(e) => setBizForm({ ...bizForm, autoReplyEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save changes</>}
                  </button>
                  <button type="button" onClick={handleDeleteBusiness} className="btn-danger ml-auto">
                    <Trash2 size={14} /> Remove Business
                  </button>
                </div>
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-900">Google Business Account</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {selectedBusiness?.googleAccessToken 
          ? '✅ Connected — can post replies directly to Google' 
          : '❌ Not connected — connect to enable posting replies'}
      </p>
    </div>
    <button
      type="button"
      onClick={handleConnectGoogle}
      disabled={connecting}
      className={`btn-primary text-sm ${selectedBusiness?.googleAccessToken ? 'bg-green-600 hover:bg-green-700' : ''}`}
    >
      {connecting 
        ? 'Redirecting...' 
        : selectedBusiness?.googleAccessToken 
          ? 'Reconnect Google' 
          : 'Connect Google Business'}
    </button>
  </div>
</div>
              </form>
            )}
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Change password</h2>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Current password</label>
                <input
                  type="password" required value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="input-field" placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                <input
                  type="password" required value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="input-field" placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                <input
                  type="password" required value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="input-field" placeholder="Repeat new password"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? <><Loader2 size={14} className="animate-spin" /> Updating...</> : <><Lock size={14} /> Update password</>}
              </button>
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
