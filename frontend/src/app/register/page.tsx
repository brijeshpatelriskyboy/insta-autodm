"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthPage } from "@/components/auth/AuthPage";
import { getPlanBySlug } from "@/lib/plans";

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const selectedPlan = getPlanBySlug(searchParams.get("plan"));

  return <AuthPage initialMode="register" selectedPlan={selectedPlan} />;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
