"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Lock, Trash2, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api";
import { clearAuth, getStoredUser, getToken } from "@/lib/auth";
import {
  ACCOUNT_DELETE_CONFIRMATION,
  accountDeletionClientOutcome,
  validateDeleteAccountForm,
} from "@/lib/account-forms";
import { validateChangePasswordForm } from "@/lib/auth-forms";

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "password", label: "Password" },
  { id: "account", label: "Account" },
  { id: "notifications", label: "Notifications" },
];

export default function SettingsPage() {
  const toast = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");

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
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);

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
    setPasswordSuccess("");

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

    setPasswordSaving(true);
    try {
      await api.changePassword(token, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated");
      toast.success("Password updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError("");

    const validationError = validateDeleteAccountForm({
      currentPassword: deletePassword,
      confirmation: deleteConfirmation,
    });
    if (validationError) {
      setDeleteError(validationError);
      return;
    }

    const token = getToken();
    if (!token) {
      setDeleteError("You must be signed in to delete your account");
      return;
    }

    setDeleteSaving(true);
    try {
      await api.deleteAccount(token, deletePassword, ACCOUNT_DELETE_CONFIRMATION);
      const outcome = accountDeletionClientOutcome();
      if (outcome.clearAuth) {
        clearAuth();
      }
      toast.success("Account deleted");
      router.replace(outcome.redirectTo);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete account";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleteSaving(false);
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

      {activeTab === "password" && (
        <Card title="Password" description="Update your password to keep your account secure.">
          <form onSubmit={handlePasswordSave} className="max-w-lg space-y-5">
            {passwordError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {passwordSuccess}
              </div>
            )}
            <Input
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
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
            <Button type="submit" disabled={passwordSaving}>
              <Lock className="h-4 w-4" />
              {passwordSaving ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </Card>
      )}

      {activeTab === "account" && (
        <Card
          title="Danger Zone"
          description="Permanently delete your Comment2DM account and the application data we store for it."
          className="border-red-200"
        >
          <form onSubmit={handleDeleteAccount} className="max-w-lg space-y-5">
            {deleteError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {deleteError}
              </div>
            )}
            <p className="text-sm leading-relaxed text-slate-600">
              This signs you out and deletes your Comment2DM login, keyword rules,
              campaigns, activity, and stored Instagram connection credentials.
              Stripe may still hold billing records on Stripe&apos;s systems. Type{" "}
              <span className="font-semibold text-slate-900">{ACCOUNT_DELETE_CONFIRMATION}</span>{" "}
              and enter your current password to confirm.
            </p>
            <Input
              label="Current password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <Input
              label={`Type ${ACCOUNT_DELETE_CONFIRMATION} to confirm`}
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={ACCOUNT_DELETE_CONFIRMATION}
              required
            />
            <Button type="submit" variant="danger" disabled={deleteSaving}>
              <Trash2 className="h-4 w-4" />
              {deleteSaving ? "Deleting..." : "Delete account"}
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
