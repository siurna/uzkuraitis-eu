import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin/session";
import { db } from "@/lib/db";
import { adminCredentials } from "@/lib/db/schema";
import { AdminLogin } from "@/components/admin-login";

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) {
    redirect("/admin");
  }
  const credentials = await db
    .select({ id: adminCredentials.id })
    .from(adminCredentials);
  return <AdminLogin bootstrapped={credentials.length > 0} />;
}

export const dynamic = "force-dynamic";
