import { Suspense } from "react";

export default function InstagramSetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-slate-500">Loading Instagram setup guide...</div>
      }
    >
      {children}
    </Suspense>
  );
}
