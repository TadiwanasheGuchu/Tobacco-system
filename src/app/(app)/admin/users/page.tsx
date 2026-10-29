import { PageTitle } from "@/components/page-title";
import { KeyRound, UserCheck, UserCog, UserPlus, UserX } from "lucide-react";
import { ActionForm, Field, Select } from "@/components/action-form";
import { Role } from "@/generated/prisma/enums";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { AdminNav } from "../admin-nav";
import { createUserAction, resetPasswordAction, setUserActiveAction } from "../actions";

export default async function UsersPage() {
  await requirePage("admin");
  const [users, buyers, floors] = await Promise.all([
    db.user.findMany({ include: { buyer: true, floor: true }, orderBy: { username: "asc" } }),
    db.buyer.findMany({ orderBy: { code: "asc" } }),
    db.floor.findMany({ orderBy: { code: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <PageTitle icon={<UserCog size={22} />} title="Users" />
      <AdminNav />
      <section className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Role</th>
              <th>Floor</th>
              <th>Buyer</th>
              <th />
              <th>Reset password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "text-muted line-through"}>
                <td>{u.username}</td>
                <td>{u.fullName}</td>
                <td>{u.role.toLowerCase()}</td>
                <td>{u.floor?.code ?? "-"}</td>
                <td>{u.buyer?.code ?? "-"}</td>
                <td>
                  <ActionForm action={setUserActiveAction.bind(null, u.id, !u.active)} submitLabel={u.active ? "Disable" : "Enable"} icon={u.active ? <UserX size={16} /> : <UserCheck size={16} />} buttonClassName="btn" className="">
                    {null}
                  </ActionForm>
                </td>
                <td>
                  <ActionForm action={resetPasswordAction.bind(null, u.id)} submitLabel="Reset" icon={<KeyRound size={16} />} buttonClassName="btn" className="flex gap-2">
                    <input name="password" type="password" className="input w-36" placeholder="New password" required />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">Add user</h2>
        <ActionForm action={createUserAction} submitLabel="Create user" icon={<UserPlus size={16} />} className="grid gap-3 sm:grid-cols-3" resetOnSuccess>
          <Field label="Username" name="username" required />
          <Field label="Full name" name="fullName" required />
          <Field label="Initial password" name="password" type="password" required hint="At least 10 characters, letters and numbers." />
          <Select label="Role" name="role" options={Object.values(Role).map((r) => ({ value: r, label: r.toLowerCase() }))} />
          <Select label="Floor" name="floorId" options={[{ value: "", label: "Any" }, ...floors.map((f) => ({ value: f.id, label: f.code }))]} />
          <Select label="Buyer (buyer accounts only)" name="buyerId" options={[{ value: "", label: "-" }, ...buyers.map((b) => ({ value: b.id, label: b.code }))]} />
        </ActionForm>
      </section>
    </div>
  );
}
