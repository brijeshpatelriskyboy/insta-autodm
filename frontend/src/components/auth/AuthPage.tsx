"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/brand/Logo";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { validateRegistrationConsent } from "@/lib/auth-forms";
import { isOnboardingComplete } from "@/lib/onboarding";
import type { SelectedPlan } from "@/lib/plans";

interface AuthPageProps {
  initialMode: "login" | "register";
  selectedPlan?: SelectedPlan | null;
}

export function AuthPage({
  initialMode,
  selectedPlan = null,
}: AuthPageProps) {
  const router = useRouter();
  const toast = useToast();
  const mode = initialMode;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  async function authenticate(
    authEmail: string,
    authPassword: string,
    authMode: "login" | "register" = mode,
    authName?: string,
  ) {
    setError("");
    setLoading(true);

    try {
      const result =
        authMode === "login"
          ? await api.login(authEmail, authPassword)
          : await api.register(authEmail, authPassword, {
              name: authName,
              acceptedTerms: acceptedLegal,
              acceptedPrivacy: acceptedLegal,
            });

      setAuth(result.token, result.user);
      toast.success(authMode === "login" ? "Welcome back!" : "Account created successfully");

      if (authMode === "register" || !isOnboardingComplete(result.user.id)) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "register") {
      const consentError = validateRegistrationConsent(acceptedLegal);
      if (consentError) {
        setError(consentError);
        toast.error(consentError);
        return;
      }
    }
    await authenticate(email, password, mode, name);
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 lg:flex">
        <Logo size="lg" variant="light" />
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            Instagram DM Automation
          </div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white">
            Turn every comment into a conversation that converts.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            Comment2DM sends personalized DMs the moment someone comments your
            keyword — so you never miss a lead.
          </p>
        </div>
        <p className="text-xs text-slate-500">© Comment2DM</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo size="md" />
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {mode === "login" ? "Sign in" : "Create account"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {mode === "login"
                ? "Access your automation dashboard"
                : "Creating an account does not start a paid subscription."}
            </p>

            {mode === "register" && selectedPlan && (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/80 px-4 py-3 text-sm">
                <p className="font-medium text-brand-800">Selected plan</p>
                <p className="mt-1 text-brand-700">
                  <span className="font-semibold">{selectedPlan.name}</span>
                  {" · "}
                  <span className="font-mono">USD ${selectedPlan.price}/month</span>
                </p>
                {selectedPlan.introductoryMonths && selectedPlan.standardPrice && (
                  <p className="mt-1 text-xs font-medium text-brand-700">
                    First {selectedPlan.introductoryMonths} months, then USD ${selectedPlan.standardPrice}/month
                  </p>
                )}
                <p className="mt-1 text-xs text-brand-600">
                  Billing begins only after you complete Stripe checkout when billing is enabled.
                </p>
              </div>
            )}

            <div className="mt-6 flex rounded-xl bg-slate-100 p-1">
              {(["login", "register"] as const).map((tab) => (
                <Link
                  key={tab}
                  href={tab === "login" ? "/login" : selectedPlan ? `/register?plan=${selectedPlan.slug}` : "/register"}
                  className={`flex-1 rounded-lg py-2 text-center text-sm font-medium capitalize transition-all ${
                    mode === tab
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab}
                </Link>
              ))}
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "register" && (
                <Input
                  label="Name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                hint="Minimum 8 characters"
              />
              {mode === "register" && (
                <label className="flex items-start gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    checked={acceptedLegal}
                    onChange={(e) => setAcceptedLegal(e.target.checked)}
                    required
                  />
                  <span>
                    I agree to the{" "}
                    <Link href="/terms" className="font-medium text-brand-600 hover:text-brand-700">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="font-medium text-brand-600 hover:text-brand-700">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
              )}
              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? (
                  "Please wait..."
                ) : (
                  <>
                    {mode === "login" ? "Sign In" : "Create Account"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {mode === "login" && (
              <p className="mt-4 text-center text-sm text-slate-500">
                <Link href="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
                  Forgot password?
                </Link>
              </p>
            )}

            <p className="mt-4 text-center text-sm text-slate-500">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
                    Create Account
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/" className="font-medium text-brand-600 hover:text-brand-700">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
