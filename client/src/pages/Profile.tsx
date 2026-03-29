/**
 * Profile — Account settings page
 * Accessible at /profile for any authenticated user.
 * Lets users update their display name.
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { User, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Profile() {
  const { user, updateProfile, isLoading } = useAuth();
  const [, navigate] = useLocation();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  // Pre-fill name when user loads
  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) return setError('Name must be at least 2 characters.');
    if (trimmed === user?.name) return setSuccess('No changes to save.');

    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await updateProfile(trimmed);
      toast.success('Profile updated!');
      setSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-12 pt-24">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-journi-green text-journi-slate text-2xl font-bold flex items-center justify-center mb-4">
            {user.initials}
          </div>
          <h1 className="text-xl font-bold text-foreground">{user.name}</h1>
          <span className={`mt-2 text-xs font-semibold px-2.5 py-1 rounded-full ${
            user.provider === 'google'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'bg-muted text-muted-foreground border border-border'
          }`}>
            {user.provider === 'google' ? 'Google account' : 'Email & password'}
          </span>
        </div>

        {/* Edit form */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-5">Edit profile</h2>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 text-red-500 text-xs mb-4">
              <AlertCircle size={13} className="shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs mb-4">
              <CheckCircle2 size={13} className="shrink-0" />
              {success}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Name field */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Display name
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); setSuccess(''); }}
                  placeholder="Your full name"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-journi-green transition-shadow"
                />
              </div>
            </div>

            {/* Email — read only */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-muted border border-border rounded-lg text-muted-foreground cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Email cannot be changed here.</p>
            </div>

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full py-2.5 rounded-xl bg-journi-green text-journi-slate text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 mt-1"
            >
              {saving ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Saving…</span> : 'Save changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
