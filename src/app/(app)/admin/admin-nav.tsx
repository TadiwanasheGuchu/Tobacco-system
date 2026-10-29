import Link from "next/link";

const LINKS = [
  ["/admin", "Floors, seasons & buyers"],
  ["/admin/users", "Users"],
  ["/admin/pricing", "Grades & contract prices"],
  ["/admin/charges", "Charges & payment split"],
  ["/admin/scales", "Scales"],
  ["/admin/timb", "TIMB outbox"],
  ["/admin/sms", "Text messages"],
  ["/admin/audit", "Audit log"],
];

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className="btn">
          {label}
        </Link>
      ))}
    </nav>
  );
}
