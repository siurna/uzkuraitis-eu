import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin/session";
import { AdminNav } from "@/components/admin-nav";

// Server-side gate. Anything under /admin requires an authed session cookie.
// /admin/login is excluded because the login page must be reachable to bootstrap.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authed = await isAdminAuthed();
  if (!authed) {
    redirect("/admin/login");
  }
  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
