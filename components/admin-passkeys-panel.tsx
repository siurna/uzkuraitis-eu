"use client";

import { useState, useTransition } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type Credential = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function AdminPasskeysPanel({
  credentials,
}: {
  credentials: Credential[];
}) {
  const [list, setList] = useState(credentials);
  const [pending, start] = useTransition();

  const enroll = () => {
    start(async () => {
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
          body: JSON.stringify({ attestation, label: "Backup passkey" }),
        });
        if (!finishRes.ok) {
          const { error } = (await finishRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(error ?? "Enrollment failed");
        }
        toast.success("Passkey added.");
        // Naive refresh — push the new entry locally so the UI updates.
        setList((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            label: "Backup passkey",
            createdAt: new Date().toISOString(),
            lastUsedAt: null,
          },
        ]);
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  };

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl leading-tight">Passkeys</h2>
          <p className="text-sm text-white/45 leading-snug mt-0.5">
            Devices allowed to sign in to the backstage. Lose one? Add a fresh
            one here, then revoke the old.
          </p>
        </div>
        <Button size="sm" onClick={enroll} disabled={pending} className="shrink-0">
          Add device
        </Button>
      </header>
      <ul className="text-sm space-y-2">
        {list.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]"
          >
            <div>
              <p>{c.label}</p>
              <p className="text-xs text-white/40">
                Added {new Date(c.createdAt).toLocaleDateString()}
                {c.lastUsedAt && (
                  <> · last used {new Date(c.lastUsedAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
