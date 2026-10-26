"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { clearAuth, getToken } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { Button } from "@/components/ui/Button";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let active = true;
    api.me(token).then(() => {
      if (active) setSessionChecked(true);
    }).catch((error) => {
      if (!active || getToken() !== token) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        clearAuth();
        router.replace("/login");
      } else {
        // Keep account state during a transient outage; server auth still gates actions.
        setSessionChecked(true);
      }
    });
    return () => { active = false; };
  }, [router]);

  if (!sessionChecked) return <p role="status" className="p-6 text-slate-600">Checking your session…</p>;

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">Comment2DM</p>
          </div>
        </header>


        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
