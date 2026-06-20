import React, { useState } from 'react';
import { Coffee, Key, Mail } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (token: string, user: { id: number; name: string; email: string; role: string; shop_id: number | null; shop_name: string | null }) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Server error. Please verify your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Subtle Background Pattern */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-70 -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-purple-700 flex items-center justify-center shadow-sm">
          <Coffee className="h-6 w-6 text-white" />
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold text-slate-900 tracking-tight">
          Odoo Cafe POS
        </h2>
        <p className="mt-1.5 text-center text-xs text-slate-500 font-medium">
          Sign in to your administration dashboard
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 border border-slate-200 rounded-2xl shadow-sm sm:px-10">
          
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Email Address
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 rounded-xl focus:ring-1 focus:ring-purple-600 focus:border-purple-600 block w-full pl-10 pr-3 py-2 text-sm placeholder-slate-400 outline-none transition-all"
                  placeholder="name@odoocafe.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 rounded-xl focus:ring-1 focus:ring-purple-600 focus:border-purple-600 block w-full pl-10 pr-3 py-2 text-sm placeholder-slate-400 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-1 focus:ring-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Clean, Subtle Admin Creds */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="inline-block text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              System Admin Credentials
            </span>
            <div className="mt-2 py-2 px-3 bg-slate-50 border border-slate-100 rounded-xl text-left font-mono text-[10px] text-slate-600 space-y-1">
              <div>
                <span className="font-bold text-slate-800">Email:</span> superadmin@odoocafe.com
              </div>
              <div>
                <span className="font-bold text-slate-800">Password:</span> superadmin123
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
