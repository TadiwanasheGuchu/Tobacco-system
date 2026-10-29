import Link from "next/link";
import { FlashProvider } from "@/components/flash";
import { requirePage } from "@/lib/auth/dal";
import { can, Permission } from "@/lib/permissions";
import { logout } from "../login/actions";

const NAV: { href: string; label: string; permission: Permission }[] = [
  { href: "/reception", label: "Reception", permission: "bale.receive" },
  { href: "/bales", label: "Bales", permission: "bale.view" },
  { href: "/growers", label: "Growers", permission: "grower.view" },
  { href: "/settlements", label: "Settlements", permission: "settlement.view" },
  { href: "/rates", label: "Exchange rate", permission: "rates.capture" },
  { href: "/admin", label: "Admin", permission: "admin" },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requirePage();
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold">
            Tobacco Floor
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {NAV.filter((n) => can(user.role, n.permission)).map((n) => (
              <Link key={n.href} href={n.href} className="text-muted hover:text-text">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted">
              {user.fullName} · {user.role.toLowerCase()}
              {user.floor ? ` · ${user.floor.code}` : ""}
              {user.buyer ? ` · ${user.buyer.code}` : ""}
            </span>
            <form action={logout}>
              <button className="btn">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <FlashProvider>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </FlashProvider>
    </div>
  );
}
