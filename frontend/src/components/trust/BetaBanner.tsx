import { Info } from "lucide-react";

export function BetaBanner() {
  return (
    <div className="border-b border-amber-200/80 bg-amber-50 px-4 py-2.5 sm:px-6">
      <p className="mx-auto flex max-w-7xl items-start gap-2 text-sm text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <span>
          Instagram automation is currently in beta. Real Instagram connection coming soon.
        </span>
      </p>
    </div>
  );
}
