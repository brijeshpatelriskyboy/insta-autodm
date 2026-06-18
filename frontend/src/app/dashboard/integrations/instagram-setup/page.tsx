"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/providers/ToastProvider";
import {
  api,
  ApiError,
  type MetaOAuthConfig,
  type MetaOAuthUrlPreview,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  META_SETUP_REQUIREMENTS,
  META_SETUP_STEPS,
} from "@/lib/meta-setup-guide";

export default function InstagramSetupPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [metaConfig, setMetaConfig] = useState<MetaOAuthConfig | null>(null);
  const [oauthPreview, setOauthPreview] = useState<MetaOAuthUrlPreview | null>(null);
  const [loading, setLoading] = useState(true);

  const oauthNotice = searchParams.get("message");
  const oauthStatus = searchParams.get("oauth");

  const loadData = useCallback(async () => {
    const token = getToken();
    setLoading(true);

    try {
      const config = await api.getMetaOAuthConfig();
      setMetaConfig(config);

      if (token) {
        const preview = await api.getInstagramOAuthUrl(token);
        setOauthPreview(preview);
      }
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to load Meta setup info",
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label}`);
    }
  }

  async function handleConnectInstagram() {
    const token = getToken();
    if (!token) return;

    if (!metaConfig?.oauthEnabled) {
      toast.error("Meta setup required. Set META_OAUTH_ENABLED=true after Meta verification.");
      return;
    }

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
    }
  }

  const oauthReady = Boolean(metaConfig?.oauthEnabled && metaConfig?.configured);
  const connectLabel = oauthReady ? "Connect Instagram" : "Meta setup required";

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
        description="Follow this guide to prepare Insta AutoDM for real Meta OAuth. No permissions are requested yet."
      />

      {oauthNotice && (
        <Card padding="md">
          <p className="text-sm font-medium text-slate-900">
            OAuth callback status: {oauthStatus ?? "unknown"}
          </p>
          <p className="mt-1 text-sm text-slate-600">{oauthNotice}</p>
        </Card>
      )}

      <Card title="Before you start" padding="lg">
        <ul className="space-y-2">
          {META_SETUP_REQUIREMENTS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Server configuration" padding="lg">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Meta configuration status...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "META_OAUTH_ENABLED", ready: metaConfig?.oauthEnabled ?? false },
                { label: "META_APP_ID", ready: Boolean(metaConfig?.appId) },
                { label: "META_APP_SECRET", ready: metaConfig?.configured ?? false },
                { label: "META_REDIRECT_URI", ready: Boolean(metaConfig?.redirectUri) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  {item.ready ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300" />
                  )}
                  <span className="font-medium text-slate-700">{item.label}</span>
                </div>
              ))}
            </div>

            {metaConfig?.redirectUri && (
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                  Redirect URI (paste into Meta app)
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm text-slate-800">
                    {metaConfig.redirectUri}
                  </code>
                  <Button
                    variant="secondary"
                    onClick={() => copyText("Redirect URI", metaConfig.redirectUri!)}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>
            )}

            {metaConfig?.webhookUrl && (
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                    Webhook callback URL (Meta App Dashboard → Webhooks)
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm text-slate-800">
                      {metaConfig.webhookUrl}
                    </code>
                    <Button
                      variant="secondary"
                      onClick={() => copyText("Webhook URL", metaConfig.webhookUrl!)}
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                </div>

                {metaConfig.verifyToken && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                      Verify token (must match META_VERIFY_TOKEN on Railway)
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm text-slate-800">
                        {metaConfig.verifyToken}
                      </code>
                      <Button
                        variant="secondary"
                        onClick={() => copyText("Verify token", metaConfig.verifyToken!)}
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                  </div>
                )}

                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  <li>Subscribe to the Instagram object.</li>
                  <li>Enable the <span className="font-medium">comments</span> field.</li>
                  <li>
                    After verification, comment with a keyword from your rules — Activity Log will
                    show comment received, keyword matched, and DM pending (no real DM yet).
                  </li>
                </ul>
              </div>
            )}

            <p className="text-sm text-slate-600">
              {metaConfig?.oauthEnabled
                ? metaConfig.configured
                  ? "Meta OAuth is enabled and credentials are configured. Connect Instagram to authorize access."
                  : "Meta OAuth is enabled. Add the missing Meta credentials on Railway, then redeploy."
                : "OAuth is disabled by default. Set META_OAUTH_ENABLED=true after Meta app verification."}
            </p>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        {META_SETUP_STEPS.map((step) => (
          <Card key={step.step} padding="lg">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {step.step}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.summary}</p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
                  {step.instructions.map((instruction) => (
                    <li key={instruction}>{instruction}</li>
                  ))}
                </ol>
                {step.links && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {step.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-slate-50"
                      >
                        {link.label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card title="OAuth connection" padding="lg">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-600">
              {oauthPreview?.setupError?.message ??
                oauthPreview?.message ??
                "Fetch the OAuth URL from the server when Meta credentials are ready."}
            </p>
            {oauthPreview?.previewUrl && (
              <code className="mt-3 block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                {oauthPreview.previewUrl}
              </code>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Graph API {metaConfig?.graphApiVersion ?? "v21.0"} · OAuth{" "}
              {metaConfig?.oauthEnabled ? "enabled" : "disabled"} · No DMs sent yet
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/integrations">
          <Button variant="secondary">Return to Integrations</Button>
        </Link>
        <Button variant="primary" disabled={!oauthReady} onClick={handleConnectInstagram}>
          {connectLabel}
        </Button>
      </div>
    </div>
  );
}
