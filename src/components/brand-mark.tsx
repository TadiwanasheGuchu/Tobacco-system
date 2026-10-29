import { Leaf } from "lucide-react";

export function BrandMark({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-[#3a2416] shadow-sm">
        <Leaf size={22} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block font-semibold tracking-tight">Tobacco Floor</span>
        {subtitle && <span className="block text-xs opacity-70">{subtitle}</span>}
      </span>
    </div>
  );
}
