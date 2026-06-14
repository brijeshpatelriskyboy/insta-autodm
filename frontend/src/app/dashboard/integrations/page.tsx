"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Webhook,
  Server,
  ExternalLink,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { api, getApiBaseUrl } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function IntegrationsPage() {
  const [instagramStatus, setInstagramStatus] = useState<{
    joinedWaitlist: boolean;
    instagramUsername: string | null;
    status: string;
  } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.getInstagramStatus(token).then(setInstagramStatus).catch(() => {});
  }, []);

  const instagramConnected = instagramStatus?.joinedWaitlist ?? false;

  const integrations = [
    {
      id: "instagram",
      name: "Instagram Business",
      description:
        "Connect your Instagram Business account to enable live comment monitoring and DM delivery.",
      status: instagramConnected ? ("active" as const) : ("disconnected" as const),
      icon: Camera,
      iconGradient: "from-purple-500 via-pink-500 to-orange-400",
      details: [
        {
          label: "Account",
          value: instagramConnected
            ? `@${instagramStatus?.instagramUsername}`
            : "Not connected",
        },
        {
          label: "Status",
          value: instagramConnected ? "Waitlist joined" : "Available to connect",
        },
        { label: "Last sync", value: instagramConnected ? "Pending launch" : "—" },
      ],
      action: instagramConnected ? "Manage connection" : "Connect Instagram",
      href: instagramConnected
        ? "/connect-instagram/success"
        : "/connect-instagram",
    },
    {
      id: "meta",
      name: "Meta Graph API",
      description:
        "Required for Instagram messaging, comment webhooks, and account verification.",
      status: "pending" as const,
      icon: Server,
      iconGradient: "from-blue-500 to-blue-600",
      details: [
        { label: "API version", value: "v21.0 (planned)" },
        { label: "App status", value: "Development mode" },
        { label: "Token", value: "Not issued" },
      ],
      action: "Configure App",
      href: null,
      disabled: true,
    },
    {
      id: "webhook",
      name: "Instagram Webhooks",
      description:
        "Receives real-time comment events from Meta when followers interact with your posts.",
      status: "active" as const,
      icon: Webhook,
      iconGradient: "from-brand-500 to-brand-600",
      details: [
        { label: "Endpoint", value: `${getApiBaseUrl()}/api/webhooks/instagram` },
        { label: "Verify token", value: "Configured" },
        { label: "Events", value: "Placeholder listener" },
      ],
      action: "Test Webhook",
      href: null,
      disabled: false,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect Instagram and Meta services to power your DM automations."
      />

      <div className="grid gap-6">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.id} padding="lg">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${integration.iconGradient} text-white shadow-sm`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {integration.name}
                      </h3>
                      <StatusPill status={integration.status} />
                    </div>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                      {integration.description}
                    </p>
                  </div>
                </div>

                {integration.href ? (
                  <Link href={integration.href} className="shrink-0 self-start">
                    <Button variant="primary">
                      {integration.action}
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant={integration.disabled ? "secondary" : "primary"}
                    disabled={integration.disabled}
                    className="shrink-0 self-start"
                  >
                    {integration.action}
                    {!integration.disabled && <ExternalLink className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              <div className="mt-6 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-3">
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
              status: instagramConnected ? "Waitlist joined" : "Ready to connect",
            },
            { icon: RefreshCw, label: "Webhook listener", status: "Endpoint ready" },
            { icon: Server, label: "API connectivity", status: "Backend online" },
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
