"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/providers/ToastProvider";
import {
  api,
  ApiError,
  type InstagramIntegrationStatus,
  type MetaOAuthConfig,
} from "@/lib/api";
import { getToken, getStoredUser } from "@/lib/auth";
import { isOnboardingComplete } from "@/lib/onboarding";

export default function IntegrationsPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<InstagramIntegrationStatus | null>(null);
  const [metaConfig, setMetaConfig] = useState<MetaOAuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [resumeOnboarding, setResumeOnboarding] = useState(false);

  const loadStatus = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const [statusResult, configResult] = await Promise.allSettled([
      api.getInstagramIntegrationStatus(token),
      api.getMetaOAuthConfig(),
    ]);

    if (statusResult.status === "fulfilled") setStatus(statusResult.value);
    if (configResult.status === "fulfilled") setMetaConfig(configResult.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const result = searchParams.get("oauth");
    const message = searchParams.get("message");
    if (!result || !message) return;

    if (result === "success") {
      toast.success(message);
      loadStatus();
      const user = getStoredUser();
      if (user?.id && !isOnboardingComplete(user.id)) setResumeOnboarding(true);
    } else if (result === "error") {
      toast.error(message);
    }
  }, [searchParams, toast, loadStatus]);

  async function handleConnectInstagram() {
    const token = getToken();
    if (!token) return;

    setConnectLoading(true);
    try {
      const result = await api.getInstagramOAuthUrl(token);
      if (!result.url) {
        toast.error("Instagram connection is temporarily unavailable. Please try again shortly.");
        return;
      }
      window.location.href = result.url;
    } catch {
      toast.error("Could not start Instagram connection. Please try again.");
    } finally {
      setConnectLoading(false);
    }
  }

  async function handleDisconnect() {
    const token = getToken();
    if (!token) return;

    setActionLoading(true);
    try {
      await api.disconnectInstagram(token);
      await loadStatus();
      toast.success("Instagram disconnected");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to disconnect Instagram",
      );
    } finally {
      setActionLoading(false);
    }
  }

  const connected = status?.connected ?? false;
  const commentActive = Boolean(status?.webhookSubscribedAt);
  const dmActive = connected && status?.graphApiStatus === "active";
  const connectReady = Boolean(metaConfig?.oauthEnabled && metaConfig?.configured);
  const displayName = status?.username ? `@${status.username}` : "Instagram";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Instagram"
        description="Connect your account and check automation status."
      />

      {resumeOnboarding && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
          <span>Instagram connected. Continue setting up your first automation.</span>
          <Link href="/onboarding" className="font-medium underline-offset-2 hover:underline">
            Resume setup
          </Link>
        </div>
      )}

      <Card padding="lg">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              {status?.profilePictureUrl ? (
                <img
                  src={status.profilePictureUrl}
                  alt={displayName}
                  className="h-14 w-14 rounded-2xl object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white shadow-sm">
                  <Camera className="h-7 w-7" />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {connected ? displayName : "Instagram account"}
                  </h3>
                  <StatusPill status={connected ? "connected" : "disconnected"} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {connected
                    ? "Your Instagram Professional account is connected."
                    : "Connect an Instagram Business or Creator account to start automating DMs."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!connected ? (
                <Button
                  onClick={handleConnectInstagram}
                  disabled={!connectReady || connectLoading}
                >
                  {connectLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Connect Instagram
                </Button>
              ) : (
                <>
                  <Link href="/dashboard/integrations/instagram-setup">
                    <Button variant="secondary">Manage</Button>
                  </Link>
                  <Button
                    variant="secondary"
                    onClick={handleDisconnect}
                    disabled={actionLoading}
                  >
                    {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Card>

      {connected && (
        <Card title="Automation Status" padding="lg">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Instagram", value: "Connected", active: true },
              { label: "Comments", value: commentActive ? "Active" : "Checking", active: commentActive },
              { label: "DMs", value: dmActive ? "Active" : "Checking", active: dmActive },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <CheckCircle2
                  className={`h-5 w-5 ${item.active ? "text-emerald-500" : "text-amber-500"}`}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
