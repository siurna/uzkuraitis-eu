"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo2026 } from "@/components/logo-2026";
import { Loader2, Fingerprint, KeyRound } from "lucide-react";

export function AdminLogin({ bootstrapped }: { bootstrapped: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const enroll = async () => {
    setBusy(true);
    try {
      const optsRes = await fetch("/api/admin/register/begin", {
        method: "POST",
      });
      if (!optsRes.ok) {
        const { error } = (await optsRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(error ?? "Couldn't start enrollment");
      }
      const opts = await optsRes.json();
      const attestation = await startRegistration({ optionsJSON: opts });
      const finishRes = await fetch("/api/admin/register/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attestation, label: "Primary passkey" }),
      });
      if (!finishRes.ok) {
        const { error } = (await finishRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(error ?? "Could not register passkey");
      }
      toast.success("Passkey enrolled.");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    setBusy(true);
    try {
      const optsRes = await fetch("/api/admin/login/begin", { method: "POST" });
      if (!optsRes.ok) {
        const { error } = (await optsRes.json().catch(() => ({}))) as {
          error?: string;
        };
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
        const { error } = (await finishRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(error ?? "Verification failed");
      }
      toast.success("Welcome back.");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center gap-10">
        <Logo2026 className="w-full max-w-xs" />

        <div className="glass-card w-full rounded-xl p-6 sm:p-8 flex flex-col gap-5">
          <div className="text-center flex flex-col items-center gap-2">
            <p className="font-display text-2xl">Admin sign-in</p>
            <p className="text-xs text-white/50 max-w-[24rem]">
              {bootstrapped
                ? "Authenticate with the registered passkey."
                : "First run — enroll the admin passkey on this device."}
            </p>
          </div>

          <Button
            onClick={bootstrapped ? signIn : enroll}
            disabled={busy}
            className="h-14 text-lg font-display"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : bootstrapped ? (
              <Fingerprint className="h-5 w-5 mr-2" />
            ) : (
              <KeyRound className="h-5 w-5 mr-2" />
            )}
            {bootstrapped ? "Sign in with passkey" : "Enroll admin passkey"}
          </Button>
        </div>
      </div>
    </main>
  );
}
