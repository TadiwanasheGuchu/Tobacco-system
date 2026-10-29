import Link from "next/link";
import { LogOut } from "lucide-react";
import { AppNav, NavItem } from "@/components/app-nav";
import { BrandMark } from "@/components/brand-mark";
import { FlashProvider } from "@/components/flash";
import { requirePage } from "@/lib/auth/dal";
import { can, Permission } from "@/lib/permissions";
import { logout } from "../login/actions";

const NAV: (NavItem & { permission?: Permission })[] = [
  { href: "/", label: "Today", icon: "dashboard" },
  { href: "/floor", label: "Floor (scan)", icon: "floor", permission: "bale.view" },
  { href: "/reception", label: "Reception", icon: "reception", permission: "bale.receive" },
  { href: "/bales", label: "Bales", icon: "bales", permission: "bale.view" },
  { href: "/growers", label: "Growers", icon: "growers", permission: "grower.view" },
  { href: "/settlements", label: "Settlements", icon: "settlements", permission: "settlement.view" },
  { href: "/reports", label: "Reports", icon: "reports", permission: "reports.view" },
  { href: "/rates", label: "Exchange rate", icon: "rates", permission: "rates.capture" },
  { href: "/admin", label: "Admin", icon: "admin", permission: "admin" },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  SUPERVISOR: "Floor supervisor",
  RECEPTION: "Reception",
  CLASSIFIER: "Classifier",
  BUYER: "Buyer",
  CASHIER: "Cashier",
};

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requirePage();
  const items = NAV.filter((n) => !n.permission || can(user.role, n.permission)).map(({ href, label, icon }) => ({
    href,
    label,
    icon,
  }));
  const initials = user.fullName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="bg-sidebar text-sidebar-text print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 lg:px-5 lg:pt-6 lg:pb-6">
          <Link href="/">
            <BrandMark subtitle={user.floor?.name ?? "All floors"} />
          </Link>
          <form action={logout} className="lg:hidden">
            <button className="rounded-full p-2 text-sidebar-muted hover:text-sidebar-text" aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </form>
        </div>
        <div className="px-3 pb-3 lg:flex-1 lg:px-3">
          <AppNav items={items} />
        </div>
        <div className="hidden border-t border-white/10 p-4 lg:block">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
              {initials}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{user.fullName}</span>
              <span className="block truncate text-xs text-sidebar-muted">
                {ROLE_LABEL[user.role]}
                {user.buyer ? ` · ${user.buyer.code}` : ""}
              </span>
            </span>
            <form action={logout}>
              <button className="rounded-full p-2 text-sidebar-muted hover:bg-white/5 hover:text-sidebar-text" aria-label="Sign out" title="Sign out">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <FlashProvider>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-10 lg:py-10">{children}</main>
      </FlashProvider>
    </div>
  );
}
