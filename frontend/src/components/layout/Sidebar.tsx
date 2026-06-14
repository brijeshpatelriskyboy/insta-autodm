"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquareText,
  BarChart3,
  LogOut,
  X,
  Plug,
  Activity,
  Settings,
  HelpCircle,
  CreditCard,
} from "lucide-react";
import { clearAuth, getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";

const mainNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/rules", label: "Keyword Rules", icon: MessageSquareText },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/activity", label: "Activity Log", icon: Activity },
];

const platformNav = [
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/help", label: "Help Center", icon: HelpCircle },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive =
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        isActive
          ? "bg-slate-800 text-white shadow-sm"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
      }`}
    >
      <Icon className={`h-4 w-4 ${isActive ? "text-brand-400" : ""}`} />
      {label}
    </Link>
  );
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getStoredUser();

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  const content = (
    <>
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
        <Logo size="md" variant="light" />
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Menu
          </p>
          <div className="space-y-1">
            {mainNav.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                pathname={pathname}
                onNavigate={onMobileClose}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Platform
          </p>
          <div className="space-y-1">
            {platformNav.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                pathname={pathname}
                onNavigate={onMobileClose}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 rounded-xl bg-slate-800/80 px-3 py-3">
          <p className="truncate text-sm font-medium text-white">
            {user?.name ?? "Creator"}
          </p>
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden h-screen w-64 shrink-0 flex-col bg-sidebar lg:flex">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onMobileClose}
            aria-label="Close menu"
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar shadow-elevated">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
