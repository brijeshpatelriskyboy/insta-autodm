"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  ExternalLink,
  Loader2,
  Shield,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";
import { api, ApiError } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import { isOnboardingComplete } from "@/lib/onboarding";

/**
 * Production Instagram connect entry for onboarding.
 * Starts Meta OAuth (same path as Integrations). No waitlist / simulated OAuth.
 */
export default function ConnectInstagramPage() {
  const router = useRouter();
  const toast = useToast();
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    api
      .getInstagramIntegrationStatus(token)
      .then((status) => {
        if (cancelled) return;
        if (status.connected) {
          // Avoid fake oauth=success toast; resume onboarding when incomplete.
          const user = getStoredUser();
          if (user?.id && !isOnboardingComplete(user.id)) {
            router.replace("/onboarding");
          } else {
            router.replace("/dashboard/integrations");
          }
        }
      })
      .catch(() => {
        /* stay on page — user can still start OAuth */
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleConnect() {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setStarting(true);
    try {
      const oauth = await api.getInstagramOAuthUrl(token);

      if (oauth.setupError) {
        toast.error(oauth.setupError.message);
        router.push("/dashboard/integrations/instagram-setup");
        return;
      }

      if (!oauth.url) {
        toast.error(oauth.message || "Meta setup required");
        router.push("/dashboard/integrations");
        return;
      }

      window.location.href = oauth.url;
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to start Meta OAuth",
      );
      router.push("/dashboard/integrations");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Logo size="sm" />
          <Link
            href="/onboarding"
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Back to setup
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
          {checking ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-slate-500">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-brand-600" />
              Checking connection…
            </div>
          ) : (
            <div className="animate-fade-in text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 text-white shadow-lg">
                <Camera className="h-8 w-8" />
              </div>
              <h1 className="mt-6 text-2xl font-semibold text-slate-900">
                Connect Instagram Business
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Authorize Comment2DM with Meta OAuth to monitor comments and send
                automated DMs on your behalf.
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
                onClick={handleConnect}
                disabled={starting}
              >
                {starting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting to Meta…
                  </>
                ) : (
                  <>
                    Continue with Instagram
                    <ExternalLink className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="mt-4 text-xs text-slate-400">
                You&apos;ll return to Integrations after Meta authorization. Then continue
                onboarding from your dashboard or setup wizard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
