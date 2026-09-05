'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { RiTruckLine, RiLockLine, RiUser3Line, RiEyeLine, RiEyeOffLine, RiAlertLine, RiLoader4Line } from 'react-icons/ri';
import { authenticate } from '@/lib/api';
import { saveSession } from '@/lib/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter email and password');
      return;
    }
    setLoading(true);
    setLoginError(null);
    try {
      const res = await authenticate(username, password);
      const data = res.data;
      saveSession({
        username,
        token: data.token,
        id: data.id,
        roles: data.roles,
        refreshToken: data.refreshToken,
        locId: data.locId,
      });
      document.cookie = `logistics_token=${data.token}; path=/; SameSite=Strict`;
      window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/dashboard`;
    } catch (err: any) {
      const d = err?.response?.data;
      const msg = (typeof d === 'string' ? d : d?.message) || 'Invalid email or password.';
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg,#dbeafe 0%,#ede9fe 35%,#d1fae5 65%,#dbeafe 100%)' }}>
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow"
            style={{ background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)' }}>
            <RiTruckLine className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-800">CKD Logistics</span>
        </div>

        <div className="bg-white/70 backdrop-blur-xl border border-white/80 shadow-xl rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
          <p className="text-sm text-slate-500 mb-6">Sign in to Shipment Tracking</p>

          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            {loginError && (
              <div data-testid="login-error-alert" className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-600">
                <RiAlertLine className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Email</label>
              <div className="relative">
                <RiUser3Line className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input data-testid="login-email-input" type="email" value={username} onChange={(e) => setUsername(e.target.value)}
                  autoComplete="email" placeholder="Enter email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white/70 border border-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <div className="relative">
                <RiLockLine className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input data-testid="login-password-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 rounded-xl text-sm bg-white/70 border border-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? <RiEyeOffLine className="w-4 h-4" /> : <RiEyeLine className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button data-testid="login-submit-button" type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {loading ? (<><RiLoader4Line className="w-4 h-4 animate-spin" /> Signing in…</>) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} CKD Logistics
        </p>
      </div>
    </div>
  );
}
