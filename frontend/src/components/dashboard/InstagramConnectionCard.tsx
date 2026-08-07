"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, type InstagramIntegrationStatus } from "@/lib/api";
import { getToken } from "@/lib/auth";

function formatConnectedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function InstagramConnectionCard() {
  const [status, setStatus] = useState<InstagramIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    api
      .getInstagramIntegrationStatus(token)
      .then((value) => {
        if (!cancelled) setStatus(value);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card title="Instagram Connection" description="Loading connection status…">
        <div className="h-36 animate-pulse rounded-xl bg-slate-100" />
      </Card>
    );
  }

  if (!status?.connected) {
    return (
      <Card title="Instagram Connection">
        <EmptyState
          compact
          title="Instagram not connected"
          description="Connect Instagram to start automating comment DMs."
          actionLabel="Connect Instagram"
          actionHref="/dashboard/integrations"
          icon={<Camera className="h-7 w-7 text-brand-600" />}
        />
      </Card>
    );
  }

  const displayName = status.username ? `@${status.username}` : "Instagram account";

  return (
    <Card
      title="Instagram Connection"
      description="Your connected Instagram Professional account."
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              {status.profilePictureUrl ? (
                <img
                  src={status.profilePictureUrl}
                  alt={displayName}
                  className="h-14 w-14 rounded-2xl object-cover shadow-md"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white shadow-md">
                  <Camera className="h-7 w-7" />
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">{displayName}</p>
                <StatusPill status="connected" />
              </div>
              {status.accountType && (
                <p className="text-sm text-slate-500">{status.accountType}</p>
              )}
            </div>
          </div>
          <Link href="/dashboard/integrations">
            <Button variant="secondary" size="sm">
              Manage
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200 bg-white/60">
          <div className="px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Status
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-600">Connected</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Connected
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatConnectedAt(status.connectedAt)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
