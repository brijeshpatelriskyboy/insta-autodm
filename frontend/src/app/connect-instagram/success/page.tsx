"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, PartyPopper } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function ConnectInstagramSuccessPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    api
      .getInstagramStatus(token)
      .then((status) => {
        if (!status.joinedWaitlist) {
          router.replace("/connect-instagram");
          return;
        }
        setUsername(status.instagramUsername);
      })
      .catch(() => {
        router.replace("/dashboard/integrations");
      });
  }, [router]);

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-4">
          <Logo size="sm" />
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-12 sm:py-20">
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-card">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <PartyPopper className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-slate-900">
            Connection request saved!
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            You&apos;re on the waitlist
            {username ? (
              <>
                {" "}for <span className="font-semibold text-slate-900">@{username}</span>
              </>
            ) : null}
            . We&apos;ll notify you when Instagram integration goes live.
          </p>

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-left text-sm text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              What happens next
            </div>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Your username is saved in our database</li>
              <li>We&apos;ll email you when Meta OAuth is ready</li>
              <li>One-click connect when integration launches</li>
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Link href="/dashboard/integrations">
              <Button variant="secondary" className="w-full">
                Back to Integrations
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button className="w-full">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
