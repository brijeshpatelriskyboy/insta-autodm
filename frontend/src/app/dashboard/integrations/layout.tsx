import { Suspense } from "react";

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-slate-500">Loading integrations...</div>
      }
    >
      {children}
    </Suspense>
  );
}
