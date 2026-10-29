"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Package,
  Scale,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  reception: Scale,
  bales: Package,
  growers: Users,
  settlements: Wallet,
  reports: BarChart3,
  rates: ArrowLeftRight,
  admin: Settings,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-accent text-[#2b1d12]"
                : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-text"
            }`}
          >
            <Icon size={18} strokeWidth={2} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
