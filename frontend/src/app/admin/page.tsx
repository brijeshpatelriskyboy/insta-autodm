"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";

type Report = {
  totalUsers: number;
  todayRegistrationsUTC: number;
  monthRegistrationsUTC: number;
  connectedInstagramAccounts: number;
  subscriptionsByStatus: Record<string, number>;
  asOf: string;
  recentUsers: {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
    instagramAccounts: { username: string; connectionStatus: string }[];
    subscription: { plan: string; status: string } | null;
  }[];
};

export default function AdminPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("Sign in first to access this area.");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    fetch("/api/admin/overview", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Access denied. This page is available only to authorised administrators.");
        }
        if (!response.ok) throw new Error("Admin reporting is temporarily unavailable.");
        return response.json() as Promise<Report>;
      })
      .then(setReport)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load report");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Comment2DM / Private</p>
            <h1 className="mt-2 text-3xl font-bold">Admin overview</h1>
            <p className="mt-2 text-sm text-slate-400">Read-only registration and subscription reporting</p>
          </div>
          <Link href="/dashboard" className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Back to dashboard</Link>
        </header>
        {loading && <p role="status" className="text-slate-300">Loading authorised report…</p>}
        {error && <div role="alert" className="rounded-xl border border-rose-700 bg-slate-900 p-5 text-rose-300">{error}</div>}
        {report && (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Registered users", report.totalUsers],
                ["New today (UTC)", report.todayRegistrationsUTC],
                ["New this month (UTC)", report.monthRegistrationsUTC],
                ["Connected Instagram accounts", report.connectedInstagramAccounts],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="mt-3 text-3xl font-bold">{value}</p>
                </div>
              ))}
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-lg font-semibold">Subscription records by status</h2>
              <p className="mb-4 text-xs text-slate-400">Database subscription statuses; not verified Stripe revenue</p>
              {Object.keys(report.subscriptionsByStatus).length === 0 ? (
                <p className="text-slate-400">No subscription records.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {Object.entries(report.subscriptionsByStatus).map(([status, count]) => (
                    <div key={status} className="rounded-xl border border-slate-700 px-4 py-3">
                      <p className="text-xs text-slate-400">{status}</p><p className="text-xl font-semibold">{count}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="p-6">
                <h2 className="text-lg font-semibold">Latest 25 registrations</h2>
                <p className="text-xs text-slate-400">Updated {new Date(report.asOf).toLocaleString()}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-slate-800 text-slate-300"><tr>
                    <th className="p-4">Account</th><th className="p-4">Joined</th><th className="p-4">Instagram</th><th className="p-4">Subscription</th>
                  </tr></thead>
                  <tbody>{report.recentUsers.map((user) => (
                    <tr key={user.id} className="border-t border-slate-800">
                      <td className="p-4"><div className="font-medium">{user.name || "Unnamed"}</div><div className="text-slate-400">{user.email}</div></td>
                      <td className="p-4 text-slate-300">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-slate-300">{user.instagramAccounts.map(a => `@${a.username} (${a.connectionStatus})`).join(", ") || "Not connected"}</td>
                      <td className="p-4 text-slate-300">{user.subscription ? `${user.subscription.plan} / ${user.subscription.status}` : "None"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
