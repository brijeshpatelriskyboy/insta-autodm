"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Webhook,
  Server,
  RefreshCw,
  Shield,
  CheckCircle2,
  Circle,
  Loader2,
  BookOpen,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/providers/ToastProvider";
import {
  api,
  ApiError,
  getApiBaseUrl,
  type InstagramIntegrationStatus,
  type MetaOAuthConfig,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

const SETUP_ITEMS = [
  { key: "professionalAccount" as const, label: "Instagram Professional account" },
  { key: "facebookPageLinked" as const, label: "Facebook Page linked" },
  { key: "metaDeveloperApp" as const, label: "Meta Developer app" },
  { key: "webhookConfigured" as const, label: "Webhook configured" },
];

export default function IntegrationsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<InstagramIntegrationStatus | null>(null);
  const [metaConfig, setMetaConfig] = useState<MetaOAuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [data, config] = await Promise.all([
        api.getInstagramIntegrationStatus(token),
        api.getMetaOAuthConfig(),
      ]);
      setStatus(data);
      setMetaConfig(config);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to load Instagram status",
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

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

  async function handleMockConnect() {
    const token = getToken();
    if (!token) return;

    setActionLoading(true);
    try {
      await api.connectInstagramMock(token);
      await loadStatus();
      toast.success("Instagram connected (demo mode)");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to connect Instagram demo",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConnectInstagram() {
    const token = getToken();
    if (!token) return;

    if (!metaConfig?.oauthEnabled) {
      toast.error("Meta setup required. Complete the setup guide and enable OAuth on the server.");
      return;
    }

    setConnectLoading(true);
    try {
      const oauth = await api.getInstagramOAuthUrl(token);

      if (oauth.setupError) {
        toast.error(oauth.setupError.message);
        return;
      }

      if (!oauth.url) {
        toast.error(oauth.message || "Meta setup required");
        return;
      }

      window.location.href = oauth.url;
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to start Meta OAuth",
      );
    } finally {
      setConnectLoading(false);
    }
  }

  const connected = status?.connected ?? false;
  const oauthReady = Boolean(metaConfig?.oauthEnabled && metaConfig?.configured);
  const connectLabel = oauthReady
    ? "Connect Instagram"
    : "Meta setup required";

  const integrations = [
    {
      id: "instagram",
      name: "Instagram Business",
      description:
        "Connect your Instagram Business or Creator account to enable comment monitoring and DM automation.",
      status: connected ? ("active" as const) : ("disconnected" as const),
      icon: Camera,
      iconGradient: "from-purple-500 via-pink-500 to-orange-400",
      details: [
        {
          label: "Account",
          value: connected && status?.username ? `@${status.username}` : "Not connected",
        },
        {
          label: "Account type",
          value: status?.accountType ?? "—",
        },
        {
          label: "Last sync",
          value: status?.lastSyncAt
            ? new Date(status.lastSyncAt).toLocaleString()
            : "—",
        },
      ],
    },
    {
      id: "meta",
      name: "Meta Graph API",
      description:
        "Required for Instagram messaging, comment webhooks, and account verification.",
      status: connected ? ("pending" as const) : ("disconnected" as const),
      icon: Server,
      iconGradient: "from-blue-500 to-blue-600",
      details: [
        { label: "API version", value: "v21.0 (planned)" },
        { label: "IG User ID", value: status?.instagramUserId ?? "—" },
        { label: "Page ID", value: status?.pageId ?? "—" },
      ],
    },
    {
      id: "webhook",
      name: "Instagram Webhooks",
      description:
        "Receives real-time comment events from Meta when followers interact with your posts.",
      status: status?.setupChecklist.webhookConfigured ? ("active" as const) : ("pending" as const),
      icon: Webhook,
      iconGradient: "from-brand-500 to-brand-600",
      details: [
        { label: "Endpoint", value: `${getApiBaseUrl()}/api/webhooks/instagram` },
        { label: "Verify token", value: "Configured" },
        { label: "Events", value: connected ? "Awaiting Meta subscription" : "Not subscribed" },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect Instagram and Meta services to power your DM automations."
      />

      <Card title="Instagram Connection" padding="lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white shadow-sm">
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Instagram</h3>
                <StatusPill status={connected ? "active" : "disconnected"} />
              </div>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                {connected && status?.username
                  ? `Connected as @${status.username}${metaConfig?.oauthEnabled ? "" : " (demo mode)"}.`
                  : metaConfig?.oauthEnabled
                    ? "Connect your Instagram Professional account with Meta OAuth when credentials are configured."
                    : "Complete the Meta setup guide, then enable OAuth on the server when verification is complete."}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3 self-start">
            {!connected && (
              <>
                <Button
                  variant="primary"
                  onClick={handleConnectInstagram}
                  disabled={connectLoading || loading || !oauthReady}
                >
                  {connectLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {connectLabel}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleMockConnect}
                  disabled={actionLoading || loading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Connect (Demo)
                </Button>
              </>
            )}
            <Link href="/dashboard/integrations/instagram-setup">
              <Button variant="secondary">
                <BookOpen className="h-4 w-4" />
                Setup Guide
              </Button>
            </Link>
            {connected && (
              <Button
                variant="secondary"
                onClick={handleDisconnect}
                disabled={actionLoading || loading}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Disconnect
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Setup checklist
          </p>
          <ul className="mt-3 space-y-2">
            {SETUP_ITEMS.map((item) => {
              const done = status?.setupChecklist[item.key] ?? false;
              return (
                <li key={item.key} className="flex items-center gap-2 text-sm text-slate-700">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300" />
                  )}
                  {item.label}
                </li>
              );
            })}
          </ul>
          <Link
            href="/dashboard/integrations/instagram-setup"
            className="mt-4 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Open Instagram Setup guide →
          </Link>
        </div>
      </Card>

      <div className="grid gap-6">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.id} padding="lg">
              <div className="flex gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${integration.iconGradient} text-white shadow-sm`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {integration.name}
                    </h3>
                    <StatusPill status={integration.status} />
                  </div>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                    {integration.description}
                  </p>
                  <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-3">
                    {integration.details.map((detail) => (
                      <div key={detail.label}>
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                          {detail.label}
                        </p>
                        <p className="mt-1 truncate text-sm font-medium text-slate-700">
                          {detail.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card
        title="Integration Health"
        description="System checks for your connected services."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Shield,
              label: "OAuth",
              status: oauthReady
                ? "Ready — real Meta OAuth enabled"
                : metaConfig?.oauthEnabled
                  ? "Enabled — add Meta App ID, Secret, Redirect URI"
                  : "Meta setup required — OAuth disabled",
            },
            {
              icon: RefreshCw,
              label: "Webhook listener",
              status: "Endpoint ready",
            },
            {
              icon: Server,
              label: "API connectivity",
              status: "Backend online",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.status}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
