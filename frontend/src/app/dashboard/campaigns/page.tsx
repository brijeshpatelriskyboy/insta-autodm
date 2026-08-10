"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/providers/ToastProvider";
import { useSmartCampaignsEnabled } from "@/hooks/useSmartCampaignsEnabled";
import { api, ApiError, type CampaignListItem } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function CampaignsPage() {
  const toast = useToast();
  const router = useRouter();
  const { enabled, loading: flagLoading } = useSmartCampaignsEnabled();
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getCampaigns(token);
      setCampaigns(data);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to load campaigns",
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (flagLoading) return;
    if (!enabled) {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [enabled, flagLoading, load, router]);

  if (flagLoading || !enabled) {
    return <TableSkeleton rows={4} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Create scarce-code campaigns linked to a keyword rule (V2)."
        action={
          <Link href="/dashboard/campaigns/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New campaign
            </Button>
          </Link>
        }
      />

      {loading ? (
        <TableSkeleton rows={4} />
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-slate-600">
          No campaigns yet. Create one to generate a unique code pool.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Keyword</th>
                <th className="px-4 py-3 font-medium">Claimed</th>
                <th className="px-4 py-3 font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.status}</td>
                  <td className="px-4 py-3 text-slate-600">{c.keywordRule.keyword}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.claimedCount}/{c.maxClaims}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.remainingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
