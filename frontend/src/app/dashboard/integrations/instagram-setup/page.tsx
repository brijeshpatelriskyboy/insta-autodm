"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
} from "lucide-react";
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
import { getToken } from "@/lib/auth";

export default function InstagramSetupPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [metaConfig, setMetaConfig] = useState<MetaOAuthConfig | null>(null);
  const [status, setStatus] = useState<InstagramIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const oauthNotice = searchParams.get("message");
  const oauthStatus = searchParams.get("oauth");

  const loadData = useCallback(async () => {
    const token = getToken();
    setLoading(true);

    try {
      const [config, integration] = await Promise.all([
        api.getMetaOAuthConfig(),
        token ? api.getInstagramIntegrationStatus(token) : Promise.resolve(null),
      ]);
      setMetaConfig(config);
      setStatus(integration);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Failed to load Instagram connection status",
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleConnectInstagram() {
    const token = getToken();
    if (!token) return;

    setConnecting(true);
    try {
      const oauth = await api.getInstagramOAuthUrl(token);

      if (oauth.setupError) {
        toast.error("Instagram connection is temporarily unavailable. Please try again shortly.");
        return;
      }

      if (!oauth.url) {
        toast.error("Instagram connection is temporarily unavailable. Please try again shortly.");
        return;
      }

      window.location.href = oauth.url;
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Failed to start Instagram connection",
      );
    } finally {
      setConnecting(false);
    }
  }

  const connected = Boolean(status?.connected);
  const graphActive = status?.graphApiStatus === "active";
  const webhookActive = Boolean(status?.webhookSubscribedAt);
  const automationActive = connected && graphActive && webhookActive;
  const displayName = status?.username ? `@${status.username}` : "Instagram account";
  const connectReady = Boolean(metaConfig?.oauthEnabled && metaConfig?.configured);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/integrations"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Integrations
        </Link>
      </div>

      <PageHeader
        title="Instagram Setup"
        description="Connect your Instagram Professional account to automate DMs from comments."
      />

      {oauthNotice && (
        <Card padding="md">
          <p className="text-sm font-medium text-slate-900">
            {oauthStatus === "success" ? "Instagram connected" : "Instagram connection update"}
          </p>
          <p className="mt-1 text-sm text-slate-600">{oauthNotice}</p>
        </Card>
      )}

      {loading ? (
        <Card title="Instagram Connection" padding="lg">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Instagram status...
          </div>
        </Card>
      ) : connected ? (
        <>
          <Card
            title="Instagram Connection"
            description="Your connected Instagram Professional account."
            padding="lg"
          >
            <div className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
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
                    <p className="font-semibold text-slate-900">{displayName}</p>
                    <StatusPill status="connected" />
                  </div>
                  {status?.accountType && (
                    <p className="mt-1 text-sm text-slate-500">{status.accountType}</p>
                  )}
                </div>
              </div>

              <Link href="/dashboard/integrations">
                <Button variant="secondary">Manage connection</Button>
              </Link>
            </div>
          </Card>

          <Card
            title="Automation Status"
            description="Comment2DM checks these automatically after Instagram is connected."
            padding="lg"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Instagram connected</p>
                  <p className="text-xs text-slate-500">Ready</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <CheckCircle2
                  className={`h-5 w-5 ${graphActive ? "text-emerald-500" : "text-amber-500"}`}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">DM automation</p>
                  <p className="text-xs text-slate-500">
                    {graphActive ? "Active" : "Checking"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <CheckCircle2
                  className={`h-5 w-5 ${webhookActive ? "text-emerald-500" : "text-amber-500"}`}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Comment automation</p>
                  <p className="text-xs text-slate-500">
                    {webhookActive ? "Active" : "Checking"}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${
                automationActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {automationActive
                ? "Instagram automation is active and ready to use."
                : "Instagram is connected. Comment2DM is finishing the automation check."}
            </div>
          </Card>
        </>
      ) : (
        <Card
          title="Connect Instagram"
          description="Use an Instagram Professional account (Business or Creator)."
          padding="lg"
        >
          <div className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white">
                <Camera className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Connect your Instagram account</p>
                <p className="mt-1 max-w-xl text-sm text-slate-600">
                  Authorize Comment2DM to detect keyword comments and send your configured DMs.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              disabled={!connectReady || connecting}
              onClick={handleConnectInstagram}
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Instagram"
              )}
            </Button>
          </div>

          {!connectReady && (
            <p className="mt-3 text-sm text-amber-700">
              Instagram connection is temporarily unavailable. Please try again shortly.
            </p>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/integrations">
          <Button variant="secondary">Return to Integrations</Button>
        </Link>
      </div>
    </div>
  );
}
