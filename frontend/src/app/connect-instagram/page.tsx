"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  ExternalLink,
  Loader2,
  Shield,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

type FlowStep = "authorize" | "waitlist" | "submitting";

export default function ConnectInstagramPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<FlowStep>("authorize");
  const [authorizing, setAuthorizing] = useState(false);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    }
  }, [router]);

  function handleAuthorize() {
    setAuthorizing(true);
    setTimeout(() => {
      setAuthorizing(false);
      setStep("waitlist");
    }, 1800);
  }

  async function handleJoinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    setStep("submitting");

    try {
      await api.connectInstagram(token, username);
      router.push("/connect-instagram/success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save request";
      toast.error(message);
      setStep("waitlist");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Logo size="sm" />
          <Link
            href="/dashboard/integrations"
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <div className="mb-8 flex items-center justify-center gap-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-2 w-12 rounded-full transition-colors ${
                (step === "authorize" && n === 1) ||
                (step === "waitlist" && n <= 2) ||
                (step === "submitting" && n <= 3)
                  ? "bg-gradient-to-r from-brand-500 to-accent-500"
                  : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
          {step === "authorize" && (
            <div className="animate-fade-in text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 text-white shadow-lg">
                <Camera className="h-8 w-8" />
              </div>
              <h1 className="mt-6 text-2xl font-semibold text-slate-900">
                Connect Instagram Business
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Authorize Insta AutoDM to monitor comments and send automated DMs
                on your behalf.
              </p>

              <div className="mx-auto mt-8 max-w-sm space-y-3 text-left">
                {[
                  "Read comments on your posts & Reels",
                  "Send DMs when keywords are matched",
                  "Secure OAuth via Meta",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-slate-600">
                    <Shield className="h-4 w-4 shrink-0 text-brand-600" />
                    {item}
                  </div>
                ))}
              </div>

              <Button
                className="mt-8 w-full"
                size="lg"
                onClick={handleAuthorize}
                disabled={authorizing}
              >
                {authorizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting to Meta...
                  </>
                ) : (
                  <>
                    Continue with Instagram
                    <ExternalLink className="h-4 w-4" />
                  </>
                )}
              </Button>

              {authorizing && (
                <p className="mt-4 animate-pulse text-xs text-slate-400">
                  Simulating OAuth redirect...
                </p>
              )}
            </div>
          )}

          {(step === "waitlist" || step === "submitting") && (
            <div className="animate-fade-in">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    Instagram Integration Coming Soon
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    Live Meta OAuth isn&apos;t available yet. Join the waitlist and
                    we&apos;ll notify you when your account can be connected.
                  </p>
                </div>
              </div>

              <form onSubmit={handleJoinWaitlist} className="mt-8 space-y-4">
                <Input
                  label="Instagram username"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  hint="We'll reserve your spot for this account"
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting || !username.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Join waitlist
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
