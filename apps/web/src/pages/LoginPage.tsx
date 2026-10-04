import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Send,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/auth.service';

type AuthViewMode = 'login' | 'reset-request' | 'reset-verify';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Mode state
  const [viewMode, setViewMode] = useState<AuthViewMode>('login');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Telegram 2FA Reset form state
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Handle standard login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await login({ login: identifier.trim(), password });
      navigate('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Invalid username or password. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request OTP code via Telegram Bot
  const handleRequestTelegramOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const targetUser = resetIdentifier.trim() || identifier.trim();

    if (!targetUser) {
      setError('Please enter your username or registered email.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.requestTelegramReset(targetUser);
      setSuccess(res.message || 'Verification code sent to your Telegram Bot!');
      setViewMode('reset-verify');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not dispatch code to Telegram.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP code and update password
  const handleVerifyTelegramOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const targetUser = resetIdentifier.trim() || identifier.trim();
    if (!targetUser) {
      setError('Username or email is missing.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (otpCode.trim().length < 6) {
      setError('Please enter the complete 6-digit code received on Telegram.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.verifyTelegramReset({
        identifier: targetUser,
        otp: otpCode.trim(),
        newPassword,
      });

      // Reset completed successfully
      setSuccess(res.message || 'Password successfully updated! You can now log in.');
      setIdentifier(targetUser);
      setPassword('');
      setOtpCode('');
      setNewPassword('');
      setViewMode('login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Authentication Container */}
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="mb-6 text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-1">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-950/50">
              <Send className="w-5 h-5 fill-current" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight font-display">
            Forward Bot
          </h1>

          <p className="text-xs text-slate-400">
            Automated Multi-Channel Forwarding &amp; Distribution Gateway
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0e1017] border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-sm">
          {/* VIEW MODE 1: Standard Login */}
          {viewMode === 'login' && (
            <>
              <div className="mb-5 pb-3 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Sign In to Dashboard</h2>
                  <p className="text-[11px] text-slate-400">Enter your credentials to access the operator console</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                </div>
              </div>

              {success && (
                <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-emerald-300 text-xs animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                  <span className="leading-relaxed">{success}</span>
                </div>
              )}

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-rose-300 text-xs animate-fade-in">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Username or Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      autoFocus
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. admin"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#131722] border border-white/[0.08] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/80 transition-colors font-mono"
                    />
                  </div>
                </div>

                {/* Password with Eye Show/Hide Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSuccess(null);
                        setResetIdentifier(identifier);
                        setViewMode('reset-request');
                      }}
                      className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#131722] border border-white/[0.08] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/80 transition-colors font-mono"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-2.5 p-1 rounded-md text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs tracking-wide transition-all shadow-md shadow-sky-950/40 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Telegram 2FA Recovery banner */}
              <div className="mt-5 pt-4 border-t border-white/[0.06] text-center">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setResetIdentifier(identifier);
                    setViewMode('reset-request');
                  }}
                  className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-sky-300 transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                  <span>Reset password via Telegram Bot OTP</span>
                </button>
              </div>
            </>
          )}

          {/* VIEW MODE 2: Request Telegram Reset OTP */}
          {viewMode === 'reset-request' && (
            <div className="animate-fade-in">
              <div className="mb-5 pb-3 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-sky-400" />
                    <span>Telegram 2FA Password Reset</span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    A one-time verification code will be sent to your registered Telegram Bot
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-rose-300 text-xs animate-fade-in">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <form onSubmit={handleRequestTelegramOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Admin Username or Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={resetIdentifier}
                      onChange={(e) => setResetIdentifier(e.target.value)}
                      placeholder="e.g. admin"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#131722] border border-white/[0.08] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/80 transition-colors font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    The Telegram Bot will send a 6-digit OTP code to the administrator chat ID configured in the system.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setViewMode('login');
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs tracking-wide transition-all shadow-md shadow-sky-950/40 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Send Code to Bot</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW MODE 3: Verify OTP & Enter New Password */}
          {viewMode === 'reset-verify' && (
            <div className="animate-fade-in">
              <div className="mb-5 pb-3 border-b border-white/[0.06]">
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-sky-400" />
                  <span>Enter Telegram Verification Code</span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Check your Telegram Bot for the 6-digit code sent to your chat
                </p>
              </div>

              {success && (
                <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-emerald-300 text-xs animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                  <span className="leading-relaxed">{success}</span>
                </div>
              )}

              {error && (
                <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-rose-300 text-xs animate-fade-in">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyTelegramOtp} className="space-y-4">
                {/* 6-Digit OTP Code */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    6-Digit Verification Code (OTP)
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\s+/g, ''))}
                    placeholder="123456"
                    className="w-full py-2.5 px-3.5 bg-[#131722] border border-white/[0.08] rounded-xl text-center text-lg tracking-[0.3em] text-sky-400 placeholder-slate-600 focus:outline-none focus:border-sky-500/80 transition-colors font-mono font-bold"
                  />
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    New Master Password (min 8 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#131722] border border-white/[0.08] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/80 transition-colors font-mono"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 p-1 rounded-md text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setViewMode('reset-request');
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs font-medium transition-colors flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs tracking-wide transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Update Password</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Clean Footer */}
        <div className="mt-6 text-center text-[11px] text-slate-500 font-mono">
          Telegram Autonomous Forwarding Engine &bull; Zero Message Loss
        </div>
      </div>
    </div>
  );
};
