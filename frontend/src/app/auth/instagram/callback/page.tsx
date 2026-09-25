"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import type { AuthResponse } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function InstagramAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const value = new URLSearchParams(window.location.hash.slice(1)).get("session");
      if (!value) throw new Error("Instagram did not return a login session.");
      const result = JSON.parse(atob(value.replace(/-/g, "+").replace(/_/g, "/"))) as AuthResponse;
      if (!result.token || !result.user?.id) throw new Error("Invalid Instagram login session.");
      setAuth(result.token, result.user);
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(result.user.needsProfileCompletion ? "/complete-profile" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Instagram login failed.");
    }
  }, [router]);

  return <main className="flex min-h-screen items-center justify-center p-6"><div className="text-center"><Logo size="md" /><p className="mt-6 text-sm text-slate-600">{error || "Signing you in with Instagram…"}</p></div></main>;
}
