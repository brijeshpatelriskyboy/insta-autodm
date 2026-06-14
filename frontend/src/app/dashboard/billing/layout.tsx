import { Suspense } from "react";

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading billing...</div>}>
      {children}
    </Suspense>
  );
}
