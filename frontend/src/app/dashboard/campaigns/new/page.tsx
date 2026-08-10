"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/providers/ToastProvider";
import { useSmartCampaignsEnabled } from "@/hooks/useSmartCampaignsEnabled";
import { api, ApiError, type KeywordRule } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { validateCampaignCreateForm } from "@/lib/campaignForm";

export default function NewCampaignPage() {
  const toast = useToast();
  const router = useRouter();
  const { enabled, loading: flagLoading } = useSmartCampaignsEnabled();
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [keywordRuleId, setKeywordRuleId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxClaims, setMaxClaims] = useState(50);
  const [prefix, setPrefix] = useState("CODE");
  const [dmTemplate, setDmTemplate] = useState(
    "Congratulations! Your code is {{code}}",
  );
  const [soldOutMessage, setSoldOutMessage] = useState(
    "All codes have been claimed.",
  );
  const [alreadyClaimedMessage, setAlreadyClaimedMessage] = useState(
    "You already claimed this offer. Your code is {{code}}",
  );

  useEffect(() => {
    if (flagLoading) return;
    if (!enabled) {
      router.replace("/dashboard");
      return;
    }
    const token = getToken();
    if (!token) return;
    api
      .getKeywordRules(token)
      .then((data) => {
        setRules(data);
        if (data[0]) setKeywordRuleId(data[0].id);
      })
      .catch((error) => {
        toast.error(
          error instanceof ApiError ? error.message : "Failed to load rules",
        );
      });
  }, [enabled, flagLoading, router, toast]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateCampaignCreateForm({
      name,
      keywordRuleId,
      startsAt,
      endsAt,
      maxClaims,
      dmTemplate,
      soldOutMessage,
      alreadyClaimedMessage,
      prefix,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    try {
      const created = await api.createCampaign(token, {
        keywordRuleId,
        name: name.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        maxClaims,
        dmTemplate,
        soldOutMessage,
        alreadyClaimedMessage,
        codeGeneration: {
          mode: "AUTO",
          prefix: prefix.trim().toUpperCase(),
          length: 8,
        },
      });
      toast.success("Campaign created as DRAFT");
      router.push(`/dashboard/campaigns/${created.id}`);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to create campaign",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (flagLoading || !enabled) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New campaign"
        description="AUTO-generate a unique code pool linked to one keyword rule."
      />

      <Card>
        <form className="space-y-4 p-1" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Name</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Keyword rule
            </span>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={keywordRuleId}
              onChange={(e) => setKeywordRuleId(e.target.value)}
              required
            >
              {rules.length === 0 ? (
                <option value="">No rules — create one first</option>
              ) : (
                rules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.keyword}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Starts</span>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Ends</span>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Quantity (maxClaims)
              </span>
              <input
                type="number"
                min={1}
                max={10000}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={maxClaims}
                onChange={(e) => setMaxClaims(Number(e.target.value))}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Code prefix
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              DM template (must include {"{{code}}"})
            </span>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              rows={3}
              value={dmTemplate}
              onChange={(e) => setDmTemplate(e.target.value)}
              required
            />
          </label>

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

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting || rules.length === 0}>
              {submitting ? "Creating…" : "Create draft"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/dashboard/campaigns")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
