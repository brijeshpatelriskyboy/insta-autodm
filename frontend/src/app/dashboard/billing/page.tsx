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

function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BillingPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [history, setHistory] = useState<BillingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    const [sub, hist] = await Promise.all([
      api.getSubscription(token),
      api.getBillingHistory(token),
    ]);
    setSubscription(sub);
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

    setCheckoutPlan(plan);
    try {
      const { url } = await api.createCheckout(token, plan);
      if (url) {
        window.location.href = url;
      } else {
        toast.error("No checkout URL returned");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckoutPlan(null);
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

  const isActive =
    subscription?.status === "active" || subscription?.status === "trialing";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        description="Manage your subscription, plans, and payment history."
      />

      {!subscription?.stripeConfigured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Stripe not configured</p>
            <p className="mt-1 text-sm text-amber-800">
              Add Stripe API keys and price IDs to backend .env to enable live checkout.
              The billing UI is ready when you connect Stripe.
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
                  ${subscription.price}/month
                  {subscription.currentPeriodEnd &&
                    ` · Renews ${formatDate(subscription.currentPeriodEnd)}`}
                </p>
              )}
              {subscription?.cancelAtPeriodEnd && (
                <p className="mt-2 text-sm text-amber-700">
                  Cancels at end of billing period
                </p>
              )}
            </div>
            {isActive && !subscription?.cancelAtPeriodEnd && (
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={canceling || !subscription?.stripeConfigured}
              >
                {canceling ? "Canceling..." : "Cancel subscription"}
              </Button>
            )}
          </div>
        )}
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose a plan — billed monthly via Stripe Checkout.
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {BILLING_PLANS.map((plan) => (
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
                ${plan.price}
                <span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
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
                variant={subscription?.plan === plan.slug ? "secondary" : "primary"}
                disabled={
                  subscription?.plan === plan.slug ||
                  checkoutPlan === plan.slug ||
                  !subscription?.stripeConfigured
                }
                onClick={() => handleCheckout(plan.slug)}
              >
                {checkoutPlan === plan.slug ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : subscription?.plan === plan.slug ? (
                  "Current plan"
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Subscribe
                  </>
                )}
              </Button>
            </Card>
          ))}
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
