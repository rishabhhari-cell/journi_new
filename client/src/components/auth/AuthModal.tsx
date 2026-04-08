/**
 * AuthModal — Sign In / Create Account
 * Slides in as a centred modal with animated view transitions.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle2, Building2, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ── Google icon SVG ───────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ── Field component ───────────────────────────────────────────────────────────
let fieldIdCounter = 0;

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  icon: Icon,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon: React.ElementType;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const [id] = useState(() => `field-${++fieldIdCounter}`);
  const isPassword = type === 'password';
  const inputType = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <div className="relative">
        <Icon
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full pl-9 pr-9 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-journi-green transition-shadow"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function AuthModal() {
  const { user, modalOpen, modalView, closeModal, signIn, signUp, requestPasswordReset, resendVerificationEmail, openModal, startOAuth } = useAuth();

  // Sign-in fields
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');

  // Sign-up fields
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [institutionalExpanded, setInstitutionalExpanded] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationEmailSent, setVerificationEmailSent] = useState(true);
  const [verificationRetryScheduled, setVerificationRetryScheduled] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Clear errors when switching views
  useEffect(() => {
    setError('');
    setSuccess('');
  }, [modalView, modalOpen]);

  useEffect(() => {
    if (modalOpen && user) {
      closeModal();
    }
  }, [modalOpen, user, closeModal]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!siEmail || !siPassword) return setError('Please fill in all fields.');
    setLoading(true);
    try {
      await signIn(siEmail, siPassword);
      closeModal();
      const hasPendingCheckout = localStorage.getItem('pending_checkout') === 'true';
      window.dispatchEvent(new CustomEvent('journi:navigate', { detail: { path: hasPendingCheckout ? '/pricing' : '/dashboard' } }));
      toast.success('Welcome back!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!suName || !suEmail || !suPassword || !suConfirm)
      return setError('Please fill in all fields.');
    if (suPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (suPassword !== suConfirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const result = await signUp(suName, suEmail, suPassword);
      if (result.requiresEmailVerification) {
        setVerificationEmail(suEmail.trim());
        setVerificationEmailSent(result.verificationEmailSent);
        setVerificationRetryScheduled(result.verificationRetryScheduled);
        if (result.verificationEmailSent) {
          toast.success('Account created. Check your email to verify your account.');
        } else if (result.verificationRetryScheduled) {
          toast.success('Account created. We are retrying your verification email in about a minute.');
        } else {
          toast.error("Account created, but the verification email didn't send. Use resend below.");
        }
        openModal('verify');
      } else {
        closeModal();
        const hasPendingCheckout = localStorage.getItem('pending_checkout') === 'true';
        window.dispatchEvent(new CustomEvent('journi:navigate', { detail: { path: hasPendingCheckout ? '/pricing' : '/dashboard' } }));
        toast.success('Account created — welcome to Journi!');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationEmail.trim()) return;
    setResendingVerification(true);
    try {
      const result = await resendVerificationEmail(verificationEmail.trim());
      if (result.alreadyVerified) {
        toast.success('This email is already verified. You can sign in now.');
        openModal('signin');
        return;
      }

      if (result.sent) {
        setVerificationEmailSent(true);
        toast.success('Verification email sent. Please check your inbox.');
      } else {
        toast.error("We still couldn't send the verification email. Please try again.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend verification email.');
    } finally {
      setResendingVerification(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!forgotEmail.trim()) return setError('Please enter your email.');
    setLoading(true);
    try {
      await requestPasswordReset(forgotEmail.trim());
      setSuccess('If an account exists for this email, a password reset link has been sent.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await startOAuth('google');
    } catch {
      toast.error('Google sign-in unavailable — enable the Google provider in your Supabase dashboard under Authentication → Providers.', { duration: 6000 });
    }
  };

  return (
    <AnimatePresence>
      {modalOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <motion.div
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22 }}
          >
            {/* Tab bar */}
            {modalView === 'verify' ? (
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <h3 className="text-sm font-semibold text-foreground">Verify your email</h3>
                <button
                  onClick={closeModal}
                  aria-label="Close"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="flex border-b border-border">
                <button
                  onClick={() => openModal('signin')}
                  className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                    modalView === 'signin'
                      ? 'text-foreground border-b-2 border-journi-green'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => openModal('signup')}
                  className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                    modalView === 'signup'
                      ? 'text-foreground border-b-2 border-journi-green'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Create Account
                </button>
                <button
                  onClick={closeModal}
                  aria-label="Close"
                  className="px-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="p-6">
              {modalView === 'verify' ? (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-700">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Please verify your email</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {verificationEmailSent
                          ? `We sent a verification link to ${verificationEmail || 'your email address'}. Click the link to verify your account.`
                          : verificationRetryScheduled
                            ? `We couldn't confirm delivery to ${verificationEmail || 'your email address'} yet, so we scheduled an automatic retry in about a minute. If nothing arrives after that, use resend below.`
                            : `We couldn't confirm delivery to ${verificationEmail || 'your email address'} yet. Use resend below, then verify your account.`}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    After verification, you will be signed in and redirected to your dashboard automatically.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                      className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-60"
                    >
                      {resendingVerification ? 'Sending…' : 'Resend email'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openModal('signin')}
                      className="flex-1 rounded-xl bg-journi-green px-4 py-2.5 text-sm font-bold text-journi-slate hover:opacity-90 transition-opacity"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </motion.div>
              ) : (
                <>
              {/* Google button */}
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-accent transition-colors text-sm font-medium text-foreground mb-5"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Error / success banners */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 text-red-500 text-xs mb-4"
                  >
                    <AlertCircle size={13} className="shrink-0" />
                    {error}
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs mb-4"
                  >
                    <CheckCircle2 size={13} className="shrink-0" />
                    {success}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Institutional login */}
              <button
                type="button"
                onClick={() => setInstitutionalExpanded(!institutionalExpanded)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-background hover:bg-accent transition-colors text-sm font-medium text-foreground mb-5"
              >
                <span className="flex items-center gap-2.5">
                  <Building2 size={16} className="text-muted-foreground" />
                  Sign in with institution
                </span>
                <ChevronDown
                  size={14}
                  className={`text-muted-foreground transition-transform ${institutionalExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {institutionalExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-5"
                  >
                    <div className="px-3 py-3 rounded-xl bg-journi-green/5 border border-journi-green/20 text-xs text-muted-foreground leading-relaxed">
                      <p className="font-semibold text-foreground mb-1">Institutional access</p>
                      <p>
                        Sign up or sign in using your institutional email address (e.g.{' '}
                        <span className="font-mono text-journi-green">name@ucl.ac.uk</span>). You'll be
                        automatically added to your institution's Journie workspace.
                      </p>
                      <p className="mt-2">Use the email &amp; password form below — no separate login is needed.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">or sign in with email</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Animated form switch */}
              <AnimatePresence mode="wait">
                {modalView === 'signin' ? (
                  <motion.form
                    key="signin"
                    onSubmit={handleSignIn}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <Field
                      label="Email"
                      type="email"
                      value={siEmail}
                      onChange={setSiEmail}
                      placeholder="you@example.com"
                      icon={Mail}
                      autoComplete="email"
                    />
                    <Field
                      label="Password"
                      type="password"
                      value={siPassword}
                      onChange={setSiPassword}
                      placeholder="Your password"
                      icon={Lock}
                      autoComplete="current-password"
                    />

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-journi-green text-journi-slate text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 mt-1"
                    >
                      {loading ? 'Signing in…' : 'Sign In'}
                    </button>

                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => openModal('forgot')}
                        className="text-xs text-journi-green hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <p className="text-center text-xs text-muted-foreground">
                      No account?{' '}
                      <button
                        type="button"
                        onClick={() => openModal('signup')}
                        className="text-journi-green hover:underline font-medium"
                      >
                        Create one
                      </button>
                    </p>
                  </motion.form>
                ) : modalView === 'signup' ? (
                  <motion.form
                    key="signup"
                    onSubmit={handleSignUp}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-3.5"
                  >
                    <Field
                      label="Full Name"
                      type="text"
                      value={suName}
                      onChange={setSuName}
                      placeholder="Jane Smith"
                      icon={User}
                      autoComplete="name"
                    />
                    <Field
                      label="Email"
                      type="email"
                      value={suEmail}
                      onChange={setSuEmail}
                      placeholder="you@example.com"
                      icon={Mail}
                      autoComplete="email"
                    />
                    <Field
                      label="Password"
                      type="password"
                      value={suPassword}
                      onChange={setSuPassword}
                      placeholder="Min. 8 characters"
                      icon={Lock}
                      autoComplete="new-password"
                    />
                    <Field
                      label="Confirm Password"
                      type="password"
                      value={suConfirm}
                      onChange={setSuConfirm}
                      placeholder="Repeat password"
                      icon={Lock}
                      autoComplete="new-password"
                    />

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-journi-green text-journi-slate text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 mt-1"
                    >
                      {loading ? 'Creating account…' : 'Create Account'}
                    </button>

                    <p className="text-center text-xs text-muted-foreground">
                      Already have one?{' '}
                      <button
                        type="button"
                        onClick={() => openModal('signin')}
                        className="text-journi-green hover:underline font-medium"
                      >
                        Sign in
                      </button>
                    </p>
                  </motion.form>
                ) : (
                  <motion.form
                    key="forgot"
                    onSubmit={handleForgotPassword}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <Field
                      label="Account email"
                      type="email"
                      value={forgotEmail}
                      onChange={setForgotEmail}
                      placeholder="you@example.com"
                      icon={Mail}
                      autoComplete="email"
                    />

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-journi-green text-journi-slate text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 mt-1"
                    >
                      {loading ? 'Sending link…' : 'Send reset link'}
                    </button>

                    <p className="text-center text-xs text-muted-foreground">
                      Remembered your password?{' '}
                      <button
                        type="button"
                        onClick={() => openModal('signin')}
                        className="text-journi-green hover:underline font-medium"
                      >
                        Back to sign in
                      </button>
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
