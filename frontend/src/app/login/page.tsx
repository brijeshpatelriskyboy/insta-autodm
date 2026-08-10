"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthPage } from "@/components/auth/AuthPage";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const showDemo =
    searchParams.get("demo") === "1" || searchParams.get("demo") === "true";

  return <AuthPage initialMode="login" showDemo={showDemo} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">Loading...</div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
