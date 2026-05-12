import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { isAdminAuthed, isAdminAuthBypassed } from "@/lib/admin/session";
import { AdminNav } from "@/components/admin-nav";

// Server-side gate. Anything under /admin requires an authed session cookie.
// /admin/login is excluded because the login page must be reachable to bootstrap.
//
// Exception: on Vercel preview deploys (VERCEL_ENV === "preview") auth is
// bypassed since passkeys can't be enrolled reliably on per-deploy preview
// hostnames. The banner below makes it visually obvious that the gate is open.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authed = await isAdminAuthed();
  if (!authed) {
    redirect("/admin/login");
  }
  const bypass = isAdminAuthBypassed();

  return (
    <div className="min-h-dvh flex flex-col">
      <AdminNav />
      {bypass && (
        <div className="bg-orange/15 border-b border-orange/30 text-orange">
          <div className="container mx-auto max-w-5xl px-4 py-2 flex items-center gap-2 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>
              <strong className="font-display">Preview mode</strong>: admin
              auth is bypassed because this is a Vercel preview deploy. Anyone
              with this URL can use admin tools. The passkey gate is only
              active on production and localhost.
            </p>
          </div>
        </div>
      )}
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
