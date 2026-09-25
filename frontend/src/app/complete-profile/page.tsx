"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/brand/Logo";
import { api } from "@/lib/api";
import { getStoredUser, getToken, setAuth } from "@/lib/auth";

export default function CompleteProfilePage() {
  const router = useRouter();
  const stored = getStoredUser();
  const [name, setName] = useState(stored?.name ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const token = getToken();
      if (!token) throw new Error("Your login session has expired.");
      const result = await api.completeInstagramProfile(token, { email, password, name });
      setAuth(result.token, result.user);
      router.replace("/onboarding");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not complete profile"); setLoading(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-card"><Logo size="md" /><h1 className="mt-6 text-2xl font-semibold">Complete your account</h1><p className="mt-2 text-sm text-slate-500">Instagram does not share your email. Add one for billing, recovery, and account security.</p>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required /><Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><Input label="Create password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required hint="Use this if you later sign in by email." /><Button type="submit" className="w-full" disabled={loading}>{loading ? "Saving…" : "Continue"}</Button></form></div></main>;
}
