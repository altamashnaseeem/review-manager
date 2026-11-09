'use client';
import { useState, useEffect } from 'react';
import { User, Bell, Lock, Trash2, Loader2, Save } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useBusiness } from '../../context/BusinessContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, updatePassword } = useAuth();
  const { selectedBusiness, updateBusiness, deleteBusiness } = useBusiness();
  const [activeTab, setActiveTab] = useState('profile');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [bizForm, setBizForm] = useState({
    alertPhone: selectedBusiness?.alertPhone || '',
    alertEmail: selectedBusiness?.alertEmail || '',
    alertOnRating: selectedBusiness?.alertOnRating ?? 3,
  });
  useEffect(() => {
    setBizForm({ alertPhone: selectedBusiness?.alertPhone || '', alertEmail: selectedBusiness?.alertEmail || '', alertOnRating: selectedBusiness?.alertOnRating ?? 3 });
  }, [selectedBusiness]);
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'business', label: 'Business Settings', icon: Bell },
    { id: 'security', label: 'Security', icon: Lock },
  ];
// Add this state at top of component
const [connecting, setConnecting] = useState(false);

// Add this function
const router = useRouter();
const handleConnectGoogle = () => router.push(`/connect-google?business=${selectedBusiness._id}&reconnect=1`);
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
      <div className="workspace-content max-w-3xl">
        <div className="mb-6">
          <p className="eyebrow mb-3">03 / Your preferences</p>
            <h1 className="page-heading">Settings</h1>
          <p className="text-muted text-sm mt-0.5">Manage your account and business preferences</p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 sm:flex gap-1 bg-raised p-1 rounded-xl mb-6 w-full sm:w-fit">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-pressed={activeTab === id}
              className={`flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activeTab === id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-secondary'}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="card p-4 sm:p-6">
            <h2 className="font-semibold text-ink mb-5">Your profile</h2>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 shrink-0 bg-action rounded-2xl flex items-center justify-center">
                <span className="text-white text-xl font-bold">{user?.name?.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="font-semibold text-ink">{user?.name}</p>
                <p className="break-all text-sm text-muted">{user?.email}</p>
                <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${user?.plan === 'trial' ? 'bg-caution-soft text-caution' : 'bg-positive-soft text-positive'}`}>
                  {user?.plan === 'trial' ? `Trial — ends ${new Date(user?.trialEndsAt).toLocaleDateString('en-IN')}` : user?.plan + ' plan'}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Full name</label>
                <input defaultValue={user?.name} className="input-field" readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Email</label>
                <input defaultValue={user?.email} className="input-field" readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Phone</label>
                <input defaultValue={user?.phone} className="input-field" readOnly />
              </div>
            </div>
          </div>
        )}

        {/* Business Settings Tab */}
        {activeTab === 'business' && (
          <div className="card p-4 sm:p-6">
            <h2 className="font-semibold text-ink mb-5">
              {selectedBusiness ? `Settings for ${selectedBusiness.name}` : 'No business selected'}
            </h2>
            {!selectedBusiness ? (
              <p className="text-muted text-sm">Select a business from the sidebar to manage its settings.</p>
            ) : (
              <form onSubmit={handleBizUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1.5">WhatsApp alert number</label>
                  <input
                    type="tel" value={bizForm.alertPhone}
                    onChange={(e) => setBizForm({ ...bizForm, alertPhone: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1.5">Alert email</label>
                  <input
                    type="email" value={bizForm.alertEmail}
                    onChange={(e) => setBizForm({ ...bizForm, alertEmail: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1.5">
                    Alert when rating ≤ {bizForm.alertOnRating} stars
                  </label>
                  <input
                    type="range" min="1" max="5" value={bizForm.alertOnRating}
                    onChange={(e) => setBizForm({ ...bizForm, alertOnRating: Number(e.target.value) })}
                    className="w-full accent-accent"
                  />
                </div>
                <p className="text-sm text-secondary p-4 bg-canvas rounded-xl">New reviews at or below your threshold trigger a WhatsApp alert and an AI draft. You approve the reply before it is posted to Google.</p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save changes</>}
                  </button>
                  <button type="button" onClick={handleDeleteBusiness} className="btn-danger sm:ml-auto">
                    <Trash2 size={14} /> Remove Business
                  </button>
                </div>
                <div className="mt-4 p-4 bg-canvas rounded-xl border border-line">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div className="min-w-0">
      <p className="text-sm font-medium text-ink">Google Business Account</p>
      <p className="text-xs text-muted mt-0.5">
        {selectedBusiness?.isDemo ? 'Development demo — replies stay local.' : selectedBusiness?.googleConnected
          ? 'Connected — Google reviews and replies available.'
          : 'Connect Google to import reviews and post replies.'}
      </p>
    </div>
    <button
      type="button"
      onClick={handleConnectGoogle}
      disabled={connecting}
      className="btn-secondary sm:shrink-0 text-sm"
    >
      {connecting
        ? 'Redirecting...'
        : selectedBusiness?.googleConnected
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
          <div className="card p-4 sm:p-6">
            <h2 className="font-semibold text-ink mb-5">Change password</h2>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Current password</label>
                <input
                  type="password" required value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="input-field" placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">New password</label>
                <input
                  type="password" required value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="input-field" placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Confirm new password</label>
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
