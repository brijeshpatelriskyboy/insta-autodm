"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  type CampaignStatus,
  type PatchCampaignPayload,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { FRONTEND_MAX_CAMPAIGN_CLAIMS_CAP } from "@/lib/campaignForm";

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function editableFieldsForStatus(status: CampaignStatus): Set<string> {
  if (status === "DRAFT") {
    return new Set([
      "name",
      "startsAt",
      "endsAt",
      "maxClaims",
      "dmTemplate",
      "soldOutMessage",
      "alreadyClaimedMessage",
      "notStartedMessage",
      "endedMessage",
    ]);
  }
  if (status === "PAUSED") {
    return new Set([
      "name",
      "dmTemplate",
      "soldOutMessage",
      "alreadyClaimedMessage",
      "notStartedMessage",
      "endedMessage",
    ]);
  }
  if (status === "ACTIVE") {
    return new Set([
      "soldOutMessage",
      "alreadyClaimedMessage",
      "notStartedMessage",
      "endedMessage",
    ]);
  }
  return new Set();
}

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxClaims, setMaxClaims] = useState(50);
  const [dmTemplate, setDmTemplate] = useState("");
  const [soldOutMessage, setSoldOutMessage] = useState("");
  const [alreadyClaimedMessage, setAlreadyClaimedMessage] = useState("");
  const [notStartedMessage, setNotStartedMessage] = useState("");
  const [endedMessage, setEndedMessage] = useState("");

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
      setName(detail.name);
      setStartsAt(toLocalInputValue(detail.startsAt));
      setEndsAt(toLocalInputValue(detail.endsAt));
      setMaxClaims(detail.maxClaims);
      setDmTemplate(detail.dmTemplate);
      setSoldOutMessage(detail.soldOutMessage);
      setAlreadyClaimedMessage(detail.alreadyClaimedMessage);
      setNotStartedMessage(detail.notStartedMessage ?? "");
      setEndedMessage(detail.endedMessage ?? "");
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

  const editable = useMemo(
    () => (campaign ? editableFieldsForStatus(campaign.status) : new Set<string>()),
    [campaign],
  );
  const canEdit = editable.size > 0;

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
      setEditing(false);
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const token = getToken();
    if (!token || !id || !campaign) return;

    const payload: PatchCampaignPayload = {};
    if (editable.has("name")) payload.name = name.trim();
    if (editable.has("startsAt")) {
      payload.startsAt = new Date(startsAt).toISOString();
    }
    if (editable.has("endsAt")) {
      payload.endsAt = new Date(endsAt).toISOString();
    }
    if (editable.has("maxClaims")) {
      if (!Number.isInteger(maxClaims) || maxClaims < 1) {
        toast.error("Number of codes must be an integer >= 1");
        return;
      }
      if (maxClaims > FRONTEND_MAX_CAMPAIGN_CLAIMS_CAP) {
        toast.error(
          `Number of codes cannot exceed ${FRONTEND_MAX_CAMPAIGN_CLAIMS_CAP}`,
        );
        return;
      }
      payload.maxClaims = maxClaims;
    }
    if (editable.has("dmTemplate")) payload.dmTemplate = dmTemplate;
    if (editable.has("soldOutMessage")) payload.soldOutMessage = soldOutMessage;
    if (editable.has("alreadyClaimedMessage")) {
      payload.alreadyClaimedMessage = alreadyClaimedMessage;
    }
    if (editable.has("notStartedMessage")) {
      payload.notStartedMessage = notStartedMessage.trim()
        ? notStartedMessage.trim()
        : null;
    }
    if (editable.has("endedMessage")) {
      payload.endedMessage = endedMessage.trim() ? endedMessage.trim() : null;
    }

    setSaving(true);
    try {
      const updated = await api.patchCampaign(token, id, payload);
      setCampaign(updated);
      setEditing(false);
      toast.success("Campaign updated");
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Update failed");
    } finally {
      setSaving(false);
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
            {canEdit && !editing && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setEditing(true)}
              >
                Edit Campaign
              </Button>
            )}
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

      {editing && canEdit && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Edit Campaign
          </h2>
          <form className="space-y-4" onSubmit={(e) => void onSaveEdit(e)}>
            {editable.has("name") && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Name</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
            )}

            {(editable.has("startsAt") || editable.has("endsAt")) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {editable.has("startsAt") && (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">
                      Start date
                    </span>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      required
                    />
                  </label>
                )}
                {editable.has("endsAt") && (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">
                      End date
                    </span>
                    <input
                      type="datetime-local"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      required
                    />
                  </label>
                )}
              </div>
            )}

            {editable.has("maxClaims") && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Number of codes
                </span>
                <input
                  type="number"
                  min={1}
                  max={FRONTEND_MAX_CAMPAIGN_CLAIMS_CAP}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={maxClaims}
                  onChange={(e) => setMaxClaims(Number(e.target.value))}
                  required
                />
                <span className="mt-1 block text-xs text-slate-500">
                  How many unique codes can be claimed in this campaign.
                </span>
                {maxClaims < campaign.maxClaims && (
                  <span className="mt-2 block text-xs text-amber-700">
                    Reducing this number removes unused codes. This is only
                    allowed before any codes have been claimed or reserved.
                  </span>
                )}
              </label>
            )}

            {editable.has("dmTemplate") && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  DM template
                </span>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  rows={3}
                  value={dmTemplate}
                  onChange={(e) => setDmTemplate(e.target.value)}
                  required
                />
              </label>
            )}

            {editable.has("soldOutMessage") && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Sold-out message
                </span>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  rows={2}
                  value={soldOutMessage}
                  onChange={(e) => setSoldOutMessage(e.target.value)}
                  required
                />
              </label>
            )}

            {editable.has("alreadyClaimedMessage") && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Already-claimed message
                </span>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  rows={2}
                  value={alreadyClaimedMessage}
                  onChange={(e) => setAlreadyClaimedMessage(e.target.value)}
                  required
                />
              </label>
            )}

            {editable.has("notStartedMessage") && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Not-started message
                </span>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  rows={2}
                  value={notStartedMessage}
                  onChange={(e) => setNotStartedMessage(e.target.value)}
                />
              </label>
            )}

            {editable.has("endedMessage") && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Ended message
                </span>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  rows={2}
                  value={endedMessage}
                  onChange={(e) => setEndedMessage(e.target.value)}
                />
              </label>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  void load();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

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
          <p className="text-xs uppercase text-slate-500">Number of codes</p>
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
