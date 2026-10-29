import { Empty } from "@/components/empty";
import { PageTitle } from "@/components/page-title";
import { UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

export default async function GrowersPage({ searchParams }: PageProps<"/growers">) {
  const user = await requirePage("grower.view");
  const q = String((await searchParams).q ?? "").trim();
  const growers = await db.grower.findMany({
    where: q
      ? {
          OR: [
            { timbGrowerNumber: { contains: q, mode: "insensitive" } },
            { nationalId: { contains: q.replace(/[\s-]/g, ""), mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageTitle icon={<Users size={22} />} title="Growers" />
        {can(user.role, "grower.register") && (
          <Link href="/growers/new" className="btn btn-primary ml-auto">
            <UserPlus size={16} aria-hidden />
            Register grower
          </Link>
        )}
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Grower number, national ID or name" className="input max-w-md" />
        <button className="btn">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>TIMB number</th>
              <th>Name</th>
              <th>District</th>
              <th>TIMB</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {growers.map((g) => (
              <tr key={g.id}>
                <td>
                  <Link href={`/growers/${g.id}`} className="font-medium underline">
                    {g.timbGrowerNumber}
                  </Link>
                </td>
                <td>
                  {g.firstName} {g.lastName}
                </td>
                <td>{g.district ?? "-"}</td>
                <td>{g.timbVerifiedAt ? "Verified" : <span className="text-danger">Not verified</span>}</td>
                <td>{g.status.toLowerCase()}</td>
              </tr>
            ))}
            {growers.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <Empty>No growers found.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
