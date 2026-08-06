import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import CreateUserForm from "./CreateUserForm";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default async function UsersPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    notFound();
  }

  const users = await query<UserRow>(`select id, email, name, role from users order by created_at asc`);

  return (
    <main className="page page-narrow">
      <a href="/" className="back-link">
        &larr; Portfolio
      </a>
      <h1 style={{ marginBottom: 24 }}>Users</h1>

      <div className="card" style={{ marginBottom: 24, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role === "admin" ? "Admin" : "Analyst"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Add a user</h2>
      <CreateUserForm />
    </main>
  );
}
