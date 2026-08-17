"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api";
import {
  INVALID_OR_EXPIRED_RESET_MESSAGE,
  friendlyResetPasswordError,
  getResetTokenFromQuery,
  validateResetPasswordForm,
} from "@/lib/auth-forms";

function ResetPasswordForm() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const token = getResetTokenFromQuery(searchParams);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(token ? "" : INVALID_OR_EXPIRED_RESET_MESSAGE);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateResetPasswordForm({
      token,
      newPassword,
      confirmPassword,
    });
    if (validationError) {
      setError(friendlyResetPasswordError(validationError));
      return;
    }

    setError("");
    setLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setSuccess(true);
      toast.success("Password updated");
    } catch (err) {
      const message = friendlyResetPasswordError(
        err instanceof Error ? err.message : "Reset failed",
      );
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Choose a new password for your account."
    >
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Password updated. You can sign in with your new password.
          </div>
          <p className="text-center text-sm text-slate-500">
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            hint="Minimum 8 characters"
            disabled={!token || loading}
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
            disabled={!token || loading}
          />
          <Button type="submit" className="w-full" disabled={!token || loading} size="lg">
            {loading ? "Please wait..." : "Update password"}
          </Button>
          <p className="text-center text-sm text-slate-500">
            <Link href="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
              Request a new reset link
            </Link>
          </p>
          <p className="text-center text-sm text-slate-500">
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">Loading...</div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
