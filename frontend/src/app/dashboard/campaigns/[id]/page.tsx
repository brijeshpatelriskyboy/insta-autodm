"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/providers/ToastProvider";
import { useSmartCampaignsEnabled } from "@/hooks/useSmartCampaignsEnabled";
import {
  api,
  ApiError,
  type CampaignClaimListItem,
  type CampaignDetail,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const router = useRouter();
  const { enabled, loading: flagLoading } = useSmartCampaignsEnabled();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [claims, setClaims] = useState<CampaignClaimListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !id) {
      setLoading(false);
      return;
    }
    try {
      const [detail, claimResult] = await Promise.all([
        api.getCampaign(token, id),
        api.getCampaignClaims(token, id, 100),
      ]);
      setCampaign(detail);
      setClaims(claimResult.claims);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to load campaign",
      );
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (flagLoading) return;
    if (!enabled) {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [enabled, flagLoading, load, router]);

  async function runAction(
    action: "activate" | "pause" | "archive",
  ): Promise<void> {
    const token = getToken();
    if (!token || !id) return;
    setBusy(true);
    try {
      if (action === "activate") await api.activateCampaign(token, id);
      if (action === "pause") await api.pauseCampaign(token, id);
      if (action === "archive") await api.archiveCampaign(token, id);
      toast.success(`Campaign ${action}d`);
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (flagLoading || !enabled || loading) {
    return <TableSkeleton rows={5} />;
  }

  if (!campaign) {
    return (
      <p className="text-sm text-slate-600">
        Campaign not found.{" "}
        <Link href="/dashboard/campaigns" className="underline">
          Back
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        description={`${campaign.status} · keyword ${campaign.keywordRule.keyword}`}
        action={
          <div className="flex flex-wrap gap-2">
            {(campaign.status === "DRAFT" || campaign.status === "PAUSED") && (
              <Button disabled={busy} onClick={() => void runAction("activate")}>
                Activate
              </Button>
            )}
            {campaign.status === "ACTIVE" && (
              <Button disabled={busy} onClick={() => void runAction("pause")}>
                Pause
              </Button>
            )}
            {campaign.status !== "ACTIVE" && campaign.status !== "ARCHIVED" && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void runAction("archive")}
              >
                Archive
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-slate-500">Claimed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {campaign.claimedCount}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Remaining</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {campaign.remainingCount}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-500">Max claims</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {campaign.maxClaims}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Code pool counts</h2>
        <p className="mt-1 text-sm text-slate-600">
          Unused codes are never listed. Counts only.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          {Object.entries(campaign.codeCounts).map(([status, count]) => (
            <div key={status}>
              <dt className="text-slate-500">{status}</dt>
              <dd className="font-medium text-slate-900">{count}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Claims</h2>
        {claims.length === 0 ? (
          <p className="text-sm text-slate-600">No claims yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Claimed</th>
                  <th className="py-2">Delivery</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id} className="border-t border-slate-100">
                    <td className="py-2 pr-4">{claim.instagramUsername ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{claim.code}</td>
                    <td className="py-2 pr-4">
                      {new Date(claim.claimedAt).toLocaleString()}
                    </td>
                    <td className="py-2">{claim.deliveryStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Link href="/dashboard/campaigns" className="text-sm text-slate-600 underline">
        Back to campaigns
      </Link>
    </div>
  );
}
