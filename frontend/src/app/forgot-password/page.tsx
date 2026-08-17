"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api";
import { GENERIC_FORGOT_PASSWORD_MESSAGE, validateForgotPasswordForm } from "@/lib/auth-forms";

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validateForgotPasswordForm(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Request a password reset for your Comment2DM account."
    >
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {submitted ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>{GENERIC_FORGOT_PASSWORD_MESSAGE}</p>
          </div>
          <p className="text-center text-sm text-slate-500">
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading} size="lg">
            {loading ? "Please wait..." : "Continue"}
          </Button>
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
