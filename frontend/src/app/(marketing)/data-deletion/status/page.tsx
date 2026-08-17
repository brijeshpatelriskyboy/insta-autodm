"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { dataDeletionStatusCopy } from "@/lib/data-deletion-copy";

function DataDeletionStatusView() {
  const searchParams = useSearchParams();
  const code = (searchParams.get("code") ?? "").trim();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(code));

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .getMetaDataDeletionStatus(code)
      .then((result) => {
        if (!cancelled) {
          setStatus(result.status);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Unable to load status");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Data deletion status
        </h1>
        <p className="mt-4 text-sm text-slate-500">
          Confirmation code: {code || "(none provided)"}
        </p>
        <p className="mt-8 text-sm leading-relaxed text-slate-600">
          {loading
            ? "Checking this request…"
            : error
              ? error
              : dataDeletionStatusCopy(status)}
        </p>
      </div>
    </section>
  );
}

export default function DataDeletionStatusPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-slate-500">Loading…</div>}>
      <DataDeletionStatusView />
    </Suspense>
  );
}
