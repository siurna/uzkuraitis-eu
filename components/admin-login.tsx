"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo2026 } from "@/components/logo-2026";
import { Loader2, KeyRound, Fingerprint } from "lucide-react";

export function AdminLogin({ bootstrapped }: { bootstrapped: boolean }) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "bootstrap" | "login">("idle");

  const bootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;
    setBusy(true);
    setPhase("bootstrap");
    try {
      const optsRes = await fetch("/api/admin/register/begin", {
        method: "POST",
        headers: { authorization: `Bearer ${secret.trim()}` },
      });
      if (!optsRes.ok) {
        const { error } = (await optsRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? "Bootstrap failed");
      }
      const opts = await optsRes.json();
      const attestation = await startRegistration({ optionsJSON: opts });
      const finishRes = await fetch("/api/admin/register/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attestation, label: "Primary passkey" }),
      });
      if (!finishRes.ok) {
        const { error } = (await finishRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? "Could not register passkey");
      }
      toast.success("Passkey enrolled. You're in.");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  };

  const signIn = async () => {
    setBusy(true);
    setPhase("login");
    try {
      const optsRes = await fetch("/api/admin/login/begin", { method: "POST" });
      if (!optsRes.ok) {
        const { error } = (await optsRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? "Login failed");
      }
      const opts = await optsRes.json();
      const assertion = await startAuthentication({ optionsJSON: opts });
      const finishRes = await fetch("/api/admin/login/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assertion }),
      });
      if (!finishRes.ok) {
        const { error } = (await finishRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? "Verification failed");
      }
      toast.success("Welcome back.");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <Logo2026 className="w-full max-w-xs" />

        <div className="glass-card w-full rounded-xl p-6 sm:p-8 flex flex-col gap-6">
          <div className="text-center flex flex-col items-center gap-2">
            <p className="font-display text-2xl">Admin sign-in</p>
            <p className="text-xs text-white/50 max-w-[24rem]">
              {bootstrapped
                ? "Authenticate with the registered passkey."
                : "First run — enter the bootstrap secret to enroll a passkey."}
            </p>
          </div>

          {bootstrapped ? (
            <Button
              onClick={signIn}
              disabled={busy}
              className="h-14 text-lg font-display"
            >
              {busy && phase === "login" ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Fingerprint className="h-5 w-5 mr-2" />
              )}
              Sign in with passkey
            </Button>
          ) : (
            <form onSubmit={bootstrap} className="flex flex-col gap-3">
              <Input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="ADMIN_BOOTSTRAP_SECRET"
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="h-12"
              />
              <Button
                type="submit"
                disabled={busy}
                className="h-12 font-display"
              >
                {busy && phase === "bootstrap" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4 mr-2" />
                )}
                Enroll passkey
              </Button>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Set <code className="text-white/60">ADMIN_BOOTSTRAP_SECRET</code>
                {" "}in your environment, then come here. After enrollment the secret
                is no longer accepted — only your passkey.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
