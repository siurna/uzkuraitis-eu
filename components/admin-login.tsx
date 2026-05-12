"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo2026 } from "@/components/logo-2026";
import { Loader2, Fingerprint, KeyRound } from "lucide-react";

export function AdminLogin({ bootstrapped }: { bootstrapped: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");

  // Enroll a new passkey. Optionally accepts a recovery secret to bypass
  // the "must be authed" check when there's already a passkey in the DB
  // and you've lost access to it.
  const enroll = async (secret?: string) => {
    setBusy(true);
    try {
      const optsRes = await fetch("/api/admin/register/begin", {
        method: "POST",
        headers: secret
          ? { authorization: `Bearer ${secret}` }
          : undefined,
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
        body: JSON.stringify({
          attestation,
          label: secret ? "Recovery passkey" : "Primary passkey",
        }),
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
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center gap-10">
        <Logo2026 className="w-full max-w-xs" />

        <div className="glass-card w-full rounded-xl p-6 sm:p-8 flex flex-col gap-4">
          <div className="text-center flex flex-col items-center gap-2">
            <p className="font-display text-2xl">Admin sign-in</p>
            <p className="text-xs text-white/50 max-w-[24rem]">
              {bootstrapped
                ? "Authenticate with the registered passkey."
                : "First run, enroll the admin passkey on this device."}
            </p>
          </div>

          <Button
            onClick={() => (bootstrapped ? signIn() : enroll())}
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

          {bootstrapped && (
            <>
              <button
                type="button"
                onClick={() => setShowRecovery((v) => !v)}
                className="text-xs text-white/40 hover:text-white/70 transition self-center"
              >
                or enter admin key
              </button>
              <AnimatePresence initial={false}>
                {showRecovery && (
                  <motion.form
                    key="recovery"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!recoveryKey.trim()) return;
                      enroll(recoveryKey.trim());
                    }}
                  >
                    <div className="flex flex-col gap-2 pt-2">
                      <Input
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="ADMIN_BOOTSTRAP_SECRET"
                        value={recoveryKey}
                        onChange={(e) => setRecoveryKey(e.target.value)}
                        className="h-11"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={busy || !recoveryKey.trim()}
                        className="font-display"
                      >
                        Enroll new passkey
                      </Button>
                      <p className="text-[11px] text-white/40 leading-relaxed">
                        Use this if you lost access to your original passkey.
                        It enrolls a new one on this device. The secret comes
                        from your <code>ADMIN_BOOTSTRAP_SECRET</code> env var.
                      </p>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
