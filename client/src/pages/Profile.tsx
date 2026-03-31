import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { User, Mail, CheckCircle2, AlertCircle, Loader2, Settings2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import ProjectSettingsPanel from '@/components/settings/ProjectSettingsPanel';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type ProfileTab = 'profile' | 'settings';

export default function Profile() {
  const { user, updateProfile, isLoading } = useAuth();
  const [, navigate] = useLocation();

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

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
      <div className="mx-auto max-w-5xl px-4 py-12 pt-24">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your profile and workspace settings.</p>
          </div>
        </div>

        <div className="mb-5 inline-flex rounded-lg border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-[#9999cc] text-white' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-[#9999cc] text-white' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Settings2 size={14} />
            Settings
          </button>
        </div>

        {activeTab === 'profile' && (
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <div className="h-fit rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col items-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-journi-green text-2xl font-bold text-journi-slate">
                  {user.initials}
                </div>
                <h2 className="text-lg font-bold text-foreground text-center">{user.name}</h2>
                <span
                  className={`mt-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    user.provider === 'google'
                      ? 'border border-blue-200 bg-blue-100 text-blue-700'
                      : 'border border-border bg-muted text-muted-foreground'
                  }`}
                >
                  {user.provider === 'google' ? 'Google account' : 'Email & password'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-5 text-sm font-semibold text-foreground">Edit profile</h2>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2.5 text-xs text-red-500">
                  <AlertCircle size={13} className="shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-600">
                  <CheckCircle2 size={13} className="shrink-0" />
                  {success}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Display name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setError('');
                        setSuccess('');
                      }}
                      placeholder="Your full name"
                      className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-journi-green transition-shadow"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email address</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                      type="email"
                      value={user.email}
                      readOnly
                      className="w-full cursor-not-allowed rounded-lg border border-border bg-muted py-2.5 pl-9 pr-3 text-sm text-muted-foreground"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Email cannot be changed here.</p>
                </div>

                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="mt-1 w-full rounded-xl bg-journi-green py-2.5 text-sm font-bold text-journi-slate transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </span>
                  ) : (
                    'Save changes'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'settings' && <ProjectSettingsPanel />}
      </div>
    </div>
  );
}
