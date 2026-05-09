"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Trophy, Settings, Vote, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const navItems = [
  { path: "/admin",          label: "Rooms",    icon: Vote },
  { path: "/admin/results",  label: "Results",  icon: Trophy },
  { path: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    toast.success("Logged out");
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 bg-dark-blue-900/85 backdrop-blur-md border-b border-white/5">
      <div className="container mx-auto max-w-5xl px-4 h-14 flex items-center gap-4">
        <Link href="/" className="text-white/60 hover:text-white">
          <Home className="h-5 w-5" />
        </Link>
        <span className="font-display text-lg">Admin</span>
        <nav className="ml-auto flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
                  active
                    ? "bg-flamingo/20 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-white/60"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    </header>
  );
}
