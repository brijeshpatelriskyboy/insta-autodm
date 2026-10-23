"use client";

import { useEffect, useState } from "react";
import { Bell, Lock, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";
import { api, ApiError } from "@/lib/api";
import { clearAuth, getStoredUser, getToken } from "@/lib/auth";
import { validateChangePasswordForm } from "@/lib/auth-forms";

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "password", label: "Password" },
  { id: "notifications", label: "Notifications" },
];

export default function SettingsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [deletionPassword, setDeletionPassword] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  async function handleAccountDeletion(e: React.FormEvent) {
    e.preventDefault();
    if (deletionBusy || deletionConfirmation !== "DELETE MY ACCOUNT") return;
    const token = getToken();
    if (!token) { setDeletionError("Please sign in again."); return; }
    setDeletionBusy(true); setDeletionError("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: deletionPassword, confirmation: deletionConfirmation }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not delete account");
      }
      clearAuth();
      window.location.assign("/");
    } catch (err) { setDeletionError(err instanceof Error ? err.message : "Could not delete account"); }
    finally { setDeletionBusy(false); }
  }

  // Stable empty defaults for SSR/hydration; hydrate from localStorage after mount.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const user = getStoredUser();
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
  }, []);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [notifications, setNotifications] = useState({
    dmSent: true,
    newLead: true,
    ruleChanges: false,
    weeklyReport: true,
  });

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    toast.info("Coming Soon");
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");

    const validationError = validateChangePasswordForm({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    const token = getToken();
    if (!token) {
      setPasswordError("You must be signed in to change your password");
      return;
    }

    setPasswordLoading(true);
    try {
      await api.changePassword(token, currentPassword, newPassword);
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Unable to update password";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setPasswordLoading(false);
    }
  }

  function handleNotificationsSave(e: React.FormEvent) {
    e.preventDefault();
    toast.info("Coming Soon");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your account, security, and notification preferences."
      />

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "profile" && (
        <Card title="Profile" description="Update your personal information.">
          <form onSubmit={handleProfileSave} className="max-w-lg space-y-5">
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-semibold text-white">
                {(name || email || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-slate-900">{name || "Creator"}</p>
                <p className="text-sm text-slate-500">{email}</p>
              </div>
            </div>

            <Input
              label="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              disabled
              hint="Email cannot be changed in this version"
            />
            <Button type="submit">
              <User className="h-4 w-4" />
              Save Profile
            </Button>
          </form>
        </Card>
      )}

      {activeTab === "profile" && (
        <section className="mt-8 rounded-xl border border-red-300 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">Delete account permanently</h2>
          <p className="my-3 text-sm text-red-800">This permanently deletes your Comment2DM account, automation rules, Instagram connections, leads and activity. Active billing will be cancelled immediately. Payment-provider records may be retained where legally required. This cannot be undone.</p>
          <form onSubmit={handleAccountDeletion} className="max-w-lg space-y-4">
            <label className="block text-sm text-red-900">Confirm your password
              <input type="password" autoComplete="current-password" required value={deletionPassword} onChange={e => setDeletionPassword(e.target.value)} className="mt-1 w-full rounded-md border border-red-300 bg-white p-3 text-slate-900"/>
            </label>
            <label className="block text-sm text-red-900">Type DELETE MY ACCOUNT
              <input required value={deletionConfirmation} onChange={e => setDeletionConfirmation(e.target.value)} className="mt-1 w-full rounded-md border border-red-300 bg-white p-3 text-slate-900"/>
            </label>
            {deletionError && <p role="alert" className="text-sm text-red-700">{deletionError}</p>}
            <button disabled={deletionBusy || deletionConfirmation !== "DELETE MY ACCOUNT" || !deletionPassword} type="submit" className="rounded-md bg-red-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{deletionBusy ? "Deleting..." : "Permanently delete my account"}</button>
          </form>
        </section>
      )}
      {activeTab === "password" && (
        <Card title="Password" description="Update your password to keep your account secure.">
          <form onSubmit={handlePasswordSave} className="max-w-lg space-y-5">
            {passwordError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {passwordError}
              </div>
            )}
            <Input
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              hint="Minimum 8 characters"
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Button type="submit" disabled={passwordLoading}>
              <Lock className="h-4 w-4" />
              {passwordLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </Card>
      )}

      {activeTab === "notifications" && (
        <Card
          title="Notifications"
          description="Choose which events you want to be notified about."
        >
          <form onSubmit={handleNotificationsSave} className="max-w-lg space-y-4">
            {[
              {
                key: "dmSent" as const,
                label: "DM sent",
                description: "When an automated DM is delivered",
              },
              {
                key: "newLead" as const,
                label: "New lead",
                description: "When a lead is captured from a conversation",
              },
              {
                key: "ruleChanges" as const,
                label: "Rule changes",
                description: "When keyword rules are created or updated",
              },
              {
                key: "weeklyReport" as const,
                label: "Weekly report",
                description: "Summary of your automation performance",
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-start gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-colors hover:border-slate-300"
              >
                <input
                  type="checkbox"
                  checked={notifications[item.key]}
                  onChange={(e) =>
                    setNotifications((prev) => ({
                      ...prev,
                      [item.key]: e.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                </div>
              </label>
            ))}
            <Button type="submit" className="mt-2">
              <Bell className="h-4 w-4" />
              Save Preferences
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
