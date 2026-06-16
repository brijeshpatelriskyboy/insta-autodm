"use client";

import { Camera, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { SampleDataLabel } from "@/components/trust/SampleDataLabel";
import { demoInstagramAccount } from "@/lib/demo-data";

export function InstagramConnectionCard() {
  const account = demoInstagramAccount;

  return (
    <Card
      title="Instagram Connection"
      description="Preview of how your connected account will appear."
    >
      <div className="mb-4">
        <SampleDataLabel />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white shadow-md">
                <Camera className="h-7 w-7" />
              </div>
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">{account.displayName}</p>
                <StatusPill status="connected" />
              </div>
              <p className="text-sm text-slate-500">{account.accountName}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" disabled>
            <RefreshCw className="h-4 w-4" />
            Reconnect
          </Button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 bg-white/60">
          <div className="px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Status
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-600">Live</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Followers
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {account.followers}
            </p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Last Sync
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {account.lastSync}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Sample account preview — connect Instagram in Integrations when available.
      </p>
    </Card>
  );
}
