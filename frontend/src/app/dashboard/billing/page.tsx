"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  Receipt,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/providers/ToastProvider";
import { api, type BillingHistoryItem, type SubscriptionInfo } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { BILLING_PLANS } from "@/lib/billing-plans";
import { VideoGuideCard } from "@/components/help/VideoGuideCard";
import { VIDEO_GUIDES } from "@/lib/video-guides";

function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export default function BillingPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [history, setHistory] = useState<BillingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [canceling, setCanceling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [liteCode, setLiteCode] = useState("");
  const [activatingLite, setActivatingLite] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    const [sub, hist] = await Promise.all([
      api.getSubscription(token),
      api.getBillingHistory(token),
    ]);
    setSubscription(sub);
    setBillingInterval(sub.billingInterval ?? "monthly");
    setHistory(hist);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success("Subscription activated successfully!");
      load();
    } else if (checkout === "canceled") {
      toast.info("Checkout canceled");
    }
  }, [searchParams, toast, load]);

  async function handleCheckout(plan: "starter" | "creator" | "pro") {
    const token = getToken();
    if (!token) return;

    if (isPaidActive) {
      const planName = BILLING_PLANS.find((item) => item.slug === plan)?.name ?? plan;
      const confirmed = window.confirm(
        `Change to the ${planName} ${billingInterval} plan? Stripe will apply any prorated charge or credit now.`,
      );
      if (!confirmed) return;
    }

    setCheckoutPlan(plan);
    try {
      if (isPaidActive) {
        const result = await api.changePlan(token, plan, billingInterval);
        toast.success(result.message);
        await load();
        return;
      }

      const result = await api.createCheckout(token, plan, billingInterval);
      if (result.launchOfferEligible === false && result.launchOfferMessage) {
        window.alert(result.launchOfferMessage);
      }
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("No checkout URL returned");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckoutPlan(null);
    }
  }

  async function handleActivateLite() {
    const token = getToken();
    if (!token) return;

    setActivatingLite(true);
    try {
      const result = await api.activateLite(token, liteCode);
      toast.success(result.message);
      setLiteCode("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lite activation failed");
    } finally {
      setActivatingLite(false);
    }
  }

  async function handleCancel() {
    const token = getToken();
    if (!token) return;

    setCanceling(true);
    try {
      const result = await api.cancelSubscription(token);
      toast.success(result.message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCanceling(false);
    }
  }

  async function handleResume() {
    const token = getToken();
    if (!token) return;

    setResuming(true);
    try {
      const result = await api.resumeSubscription(token);
      toast.success(result.message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setResuming(false);
    }
  }

  const isActive =
    subscription?.status === "active" || subscription?.status === "trialing";
  const isPaidActive = isActive && subscription?.plan !== "lite";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        description="Manage your subscription, plans, and payment history."
      />

      <VideoGuideCard {...VIDEO_GUIDES.billing} />

      {!subscription?.stripeConfigured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Billing temporarily unavailable</p>
            <p className="mt-1 text-sm text-amber-800">
              Please try again shortly or contact support if you need help.
            </p>
          </div>
        </div>
      )}

      <Card title="Current subscription" description="Your active plan and renewal date.">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-slate-900">
                  {subscription?.planName ?? "No plan"}
                </h3>
                <StatusPill
                  status={
                    isActive
                      ? "active"
                      : subscription?.status === "canceled"
                        ? "disconnected"
                        : "pending"
                  }
                />
              </div>
              {subscription?.price != null && (
                <p className="mt-1 text-sm text-slate-500">
                  {subscription.plan === "lite"
                    ? "Free for 30 days · 1 Instagram · 2 keywords · 200 DMs"
                    : subscription.billingInterval === "annual"
                      ? `USD $${subscription.annualPrice?.toFixed(2) ?? "0.00"}/year`
                      : subscription.introductoryMonths && subscription.standardPrice
                        ? `USD $${subscription.price}/month for the first ${subscription.introductoryMonths} months, then USD $${subscription.standardPrice}/month`
                        : `USD $${subscription.price}/month`}
                  {subscription.currentPeriodEnd &&
                    ` · ${subscription.plan === "lite" ? "Ends" : "Renews"} ${formatDate(subscription.currentPeriodEnd)}`}
                </p>
              )}
              {subscription?.cancelAtPeriodEnd && (
                <p className="mt-2 text-sm text-amber-700">
                  Cancels at end of billing period
                </p>
              )}
            </div>
            {isPaidActive && subscription?.cancelAtPeriodEnd ? (
              <Button
                onClick={handleResume}
                disabled={resuming || !subscription?.stripeConfigured}
              >
                {resuming ? "Resuming..." : "Resume subscription"}
              </Button>
            ) : isPaidActive ? (
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={canceling || !subscription?.stripeConfigured}
              >
                {canceling ? "Canceling..." : "Cancel subscription"}
              </Button>
            ) : null}
          </div>
        )}
      </Card>

      <Card
        title="Lite — free for 30 days"
        description="First-time users can try Comment2DM with no card or payment details."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-3 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1">1 Instagram account</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">2 keyword rules</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">200 DMs</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">30 days</span>
            </div>
            <p className="text-sm text-slate-600">
              Follow @comment2dm.ai and comment <strong>LITE</strong> on the Lite offer post. We will send your private Lite access code directly to your Instagram DM. Connect your Instagram account first, then enter that private code below. This offer can be used once per user and Instagram account.
            </p>
            <input
              value={liteCode}
              onChange={(event) => setLiteCode(event.target.value)}
              placeholder="Enter your private Lite code"
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-200 focus:ring-2 lg:max-w-sm"
              disabled={activatingLite || isActive}
            />
          </div>
          <Button
            onClick={handleActivateLite}
            disabled={activatingLite || isActive || !liteCode.trim()}
          >
            {activatingLite ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : isActive && subscription?.plan === "lite" ? (
              "Lite active"
            ) : isActive ? (
              "Plan already active"
            ) : (
              "Activate Lite free"
            )}
          </Button>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose monthly billing or save 20% with annual billing. Plan changes can include
          an immediate prorated charge or credit.
        </p>
        <div className="mt-4 flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setBillingInterval("monthly")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${billingInterval === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("annual")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${billingInterval === "annual" ? "bg-brand-600 text-white shadow-sm" : "text-slate-500"}`}
          >
            Annual · Save 20%
          </button>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {BILLING_PLANS.map((plan) => {
            const isCurrentPlan =
              isActive &&
              subscription?.plan === plan.slug &&
              subscription?.billingInterval === billingInterval;
            const planOrder = { lite: -1, starter: 0, creator: 1, pro: 2 } as const;
            const currentPlanOrder = subscription?.plan
              ? planOrder[subscription.plan]
              : -1;
            const actionLabel = isActive
              ? subscription?.plan === plan.slug
                ? "Switch billing"
                : planOrder[plan.slug] > currentPlanOrder
                  ? "Upgrade plan"
                  : "Downgrade plan"
              : "Subscribe";
            return (
              <Card
              key={plan.slug}
              className={
                plan.popular ? "border-brand-300 ring-1 ring-brand-200" : ""
              }
              padding="lg"
            >
              {plan.popular && (
                <span className="mb-3 inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                USD ${billingInterval === "annual" ? plan.annualPrice.toFixed(2) : plan.price}
                <span className="text-sm font-normal text-slate-500">
                  {billingInterval === "annual" ? "/year" : "/month"}
                </span>
              </p>
              {billingInterval === "annual" ? (
                <p className="mt-1 text-sm font-medium text-emerald-700">
                  20% off · equivalent to USD ${(plan.annualPrice / 12).toFixed(2)}/month
                </p>
              ) : plan.introductoryMonths && plan.offerPrice ? (
                <p className="mt-1 text-sm font-medium text-brand-700">
                  Follow @comment2dm.ai and comment GREAT on our pinned post to unlock 50% off for your first {plan.introductoryMonths} months
                </p>
              ) : null}
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={isCurrentPlan ? "secondary" : "primary"}
                disabled={
                  isCurrentPlan ||
                  checkoutPlan === plan.slug ||
                  !subscription?.stripeConfigured
                }
                onClick={() => handleCheckout(plan.slug)}
              >
                {checkoutPlan === plan.slug ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isPaidActive ? "Changing plan..." : "Redirecting..."}
                  </>
                ) : isCurrentPlan ? (
                  "Current plan"
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    {actionLabel}
                  </>
                )}
              </Button>
              </Card>
            );
          })}
        </div>
      </div>

      <Card
        title="Billing history"
        description="Past invoices and payments."
      >
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Receipt className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No billing history yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Invoices appear here after your first Stripe payment
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Description</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 pr-4 text-slate-600">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-3 pr-4 text-slate-900">
                      {item.description ?? "Subscription"}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {formatMoney(item.amount, item.currency)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill
                        status={item.status === "paid" ? "active" : "pending"}
                        label={
                          item.amount < 0
                            ? "Credit"
                            : item.status === "paid"
                              ? "Paid"
                              : undefined
                        }
                      />
                    </td>
                    <td className="py-3">
                      {item.invoiceUrl ? (
                        <a
                          href={item.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
                        >
                          View
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-slate-400">
        Questions about billing?{" "}
        <Link href="/contact" className="text-brand-600 hover:text-brand-700">
          Contact support
        </Link>
      </p>
    </div>
  );
}
