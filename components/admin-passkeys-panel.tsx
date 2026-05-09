"use client";

import { useState, useTransition } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { toast } from "sonner";
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
    <section className="glass-card rounded-xl p-5">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl">Passkeys</h2>
        <Button size="sm" onClick={enroll} disabled={pending}>
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
