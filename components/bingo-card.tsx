"use client";

import { Grid3x3 } from "lucide-react";
import { useLang, t } from "@/lib/i18n";

// Placeholder until the bingo feature lands.
export function BingoCard() {
  const lang = useLang();
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12 flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center text-center gap-3 text-white/55">
        <Grid3x3 className="h-10 w-10 text-white/30" />
        <h2 className="font-display text-2xl text-white/80">{t(lang, "bingo_coming")}</h2>
        <p className="text-sm max-w-sm">{t(lang, "bingo_coming_sub")}</p>
      </div>
    </main>
  );
}
