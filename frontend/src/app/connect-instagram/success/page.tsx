"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * Legacy waitlist success URL. Real Meta OAuth returns to Integrations;
 * keep this route as a redirect so old bookmarks do not show waitlist copy.
 */
export default function ConnectInstagramSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/integrations");
  }, [router]);

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-4">
          <Logo size="sm" />
        </div>
      </header>
      <div className="flex flex-col items-center justify-center py-20 text-sm text-slate-500">
        <Loader2 className="mb-3 h-6 w-6 animate-spin text-brand-600" />
        Redirecting to Integrations…
      </div>
    </div>
  );
}
