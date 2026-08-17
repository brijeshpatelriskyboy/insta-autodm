import type { ReactNode } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
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
            Turn every keyword comment into an automatic DM.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            Comment2DM sends your message when someone comments your keyword.
            The product is in beta.
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
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
            {children}
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
