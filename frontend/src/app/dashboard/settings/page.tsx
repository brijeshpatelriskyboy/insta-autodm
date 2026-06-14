"use client";

import { useState } from "react";
import { Bell, Lock, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";
import { getStoredUser } from "@/lib/auth";

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "password", label: "Password" },
  { id: "notifications", label: "Notifications" },
];

export default function SettingsPage() {
  const toast = useToast();
  const user = getStoredUser();
  const [activeTab, setActiveTab] = useState("profile");

  const [name, setName] = useState(user?.name ?? "");
  const [email] = useState(user?.email ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [notifications, setNotifications] = useState({
    dmSent: true,
    newLead: true,
    ruleChanges: false,
    weeklyReport: true,
  });

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Profile preferences saved");
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    toast.info("Password change will be available after Meta OAuth integration");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function handleNotificationsSave(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Notification preferences updated");
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
            <Button type="submit">
              <Lock className="h-4 w-4" />
              Update Password
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
