'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '../../components/layout/AuthShell';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace('/connect-google');
  }, [isAuthenticated, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const result = await register(form.name, form.email, form.password, form.phone);
    if (result.success) router.replace('/connect-google');
    setLoading(false);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <AuthShell title="Start free trial" description="7 days free. No credit card needed.">
          {error && (
            <div className="mb-4 px-4 py-3 bg-negative-soft border border-negative/25 rounded-lg text-negative text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Full name</label>
              <input name="name" type="text" required value={form.name} onChange={handleChange} className="input-field" placeholder="Altamash Khan" />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Email address</label>
              <input name="email" type="email" required value={form.email} onChange={handleChange} className="input-field" placeholder="you@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">WhatsApp number</label>
              <input name="phone" type="tel" required value={form.phone} onChange={handleChange} className="input-field" placeholder="+91 9876543210" />
              <p className="text-xs text-muted mt-1">You will receive review alerts on this number</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Password</label>
              <div className="relative">
                <input
                  name="password" type={showPassword ? 'text' : 'password'} required
                  value={form.password} onChange={handleChange} className="input-field pr-10" placeholder="Min 6 characters"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-muted">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Confirm password</label>
              <input name="confirmPassword" type="password" required value={form.confirmPassword} onChange={handleChange} className="input-field" placeholder="Repeat password" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : 'Create free account'}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-accent font-medium hover:underline">Sign in</Link>
          </p>

    </AuthShell>
  );
}
