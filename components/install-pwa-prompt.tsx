"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, MoreVertical, Plus, Puzzle, Share } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { isInstalledPwa, detectPlatform } from "@/components/notification-toggles";
import { LANGUAGES, LANGUAGE_NAMES, t, type Language } from "@/lib/i18n";
import { readLang, writeLang } from "@/lib/i18n-client";

// Sticky bottom prompt on the room-gate that nudges visitors to install
// the app as a PWA. Visible only when we're NOT already running in
// standalone mode. The user hasn't picked a language yet at this
// point in the journey, so the CTA text crossfades between LT and EN
// every ~3s — they spot whichever they read.
const CROSSFADE_MS = 3000;
const APP_ICON_URL =
  "https://mbgkujipbdfsdvjobtrf.supabase.co/storage/v1/object/public/icons/icon-192.png";

export function InstallPwaPrompt() {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [drawerLang, setDrawerLang] = useState<Language>("lt");
  const [ctaLang, setCtaLang] = useState<Language>("lt");

  useEffect(() => {
    setMounted(true);
    setInstalled(isInstalledPwa());
    setDrawerLang(readLang());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCtaLang((prev) => (prev === "lt" ? "en" : "lt"));
    }, CROSSFADE_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!mounted || installed) return null;

  const platform = detectPlatform();
  const setLang = (code: Language) => {
    setDrawerLang(code);
    writeLang(code);
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-1/2 -translate-x-1/2 z-30
                   max-w-[calc(100vw-2rem)] rainbow-border rounded-full"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        aria-label={t(ctaLang, "install_cta")}
      >
        <span
          className="inline-flex items-center gap-2.5 h-11 pl-3.5 pr-4 rounded-full
                     bg-dark-blue-900/95 text-white text-sm font-display
                     shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]"
        >
          <span className="grid place-items-center h-6 w-6 rounded-full bg-flamingo/20 ring-1 ring-flamingo/40 text-flamingo">
            <Download className="h-3.5 w-3.5" />
          </span>
          <span className="relative inline-block leading-tight">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={ctaLang}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="block whitespace-nowrap"
              >
                {t(ctaLang, "install_cta")}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
      </motion.button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t(drawerLang, "install_drawer_title")}
        sub={t(drawerLang, "install_drawer_sub")}
      >
        <div className="flex flex-col gap-5">
          {/* Small lang pill — same visual shape as the onboarding pill
              in NameGate. Slightly more horizontal padding inside each
              button so the touch target isn't cramped, and the inner
              gap zeroed so the pill bg meets the buttons flush. */}
          <div className="relative inline-flex self-center items-center rounded-full bg-black/30 p-1">
            <span
              aria-hidden
              className="absolute top-1 bottom-1 rounded-full bg-white pointer-events-none"
              style={{
                width: "calc(50% - 0.25rem)",
                left: drawerLang === LANGUAGES[0] ? "0.25rem" : "50%",
                transition: "left 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
            {LANGUAGES.map((code) => {
              const active = drawerLang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`relative z-10 px-5 py-2 rounded-full text-sm font-display ${
                    active ? "text-dark-blue" : "text-white/60 hover:text-white"
                  }`}
                >
                  {LANGUAGE_NAMES[code]}
                </button>
              );
            })}
          </div>

          {platform === "ios-safari" && (
            <Steps title={t(drawerLang, "push_help_ios_title")}>
              <Step icon={<Share className="h-4 w-4" />}>{t(drawerLang, "push_help_ios_1")}</Step>
              <Step icon={<Plus className="h-4 w-4" />}>{t(drawerLang, "push_help_ios_2")}</Step>
              <Step icon={<AppIcon />}>{t(drawerLang, "push_help_ios_3")}</Step>
            </Steps>
          )}
          {platform === "android" && (
            <Steps title={t(drawerLang, "push_help_android_title")}>
              <Step icon={<MoreVertical className="h-4 w-4" />}>{t(drawerLang, "push_help_android_1")}</Step>
              <Step icon={<Download className="h-4 w-4" />}>{t(drawerLang, "push_help_android_2")}</Step>
              <Step icon={<AppIcon />}>{t(drawerLang, "push_help_android_3")}</Step>
            </Steps>
          )}
          {platform === "desktop" && (
            <Steps title={t(drawerLang, "push_help_desktop_title")}>
              {/* Desktop Chrome / Edge: the install affordance is a
                  computer-monitor icon at the RIGHT edge of the
                  address bar (omnibox), not in the ⋮ menu by default.
                  Calling that out explicitly because users hunt for it
                  in the menu first. */}
              <Step icon={<Puzzle className="h-4 w-4" />}>{t(drawerLang, "install_desktop_1")}</Step>
              <Step icon={<Download className="h-4 w-4" />}>{t(drawerLang, "install_desktop_2")}</Step>
              <Step icon={<AppIcon />}>{t(drawerLang, "install_desktop_3")}</Step>
            </Steps>
          )}
          {platform === "other" && (
            <Steps title={t(drawerLang, "push_help_other_title")}>
              <Step icon={<Share className="h-4 w-4" />}>{t(drawerLang, "push_help_ios_1")}</Step>
              <Step icon={<Plus className="h-4 w-4" />}>{t(drawerLang, "push_help_ios_2")}</Step>
              <Step icon={<AppIcon />}>{t(drawerLang, "push_help_ios_3")}</Step>
            </Steps>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

// The webapp's own icon, used as the "now open the installed app"
// indicator in step 3 of each platform guide. Reading the actual
// installed-icon graphic next to "tap this icon on your home screen"
// is way more legible than a generic AppWindow lucide stroke.
function AppIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={APP_ICON_URL}
      alt=""
      width={20}
      height={20}
      className="h-5 w-5 rounded-md object-cover"
    />
  );
}

function Steps({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[10px] uppercase tracking-[0.28em] text-white/55 font-display">
        {title}
      </h3>
      <ol className="flex flex-col gap-2">{children}</ol>
    </section>
  );
}

function Step({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded-2xl glass-surface px-4 py-3">
      {icon && (
        <span className="shrink-0 grid place-items-center h-8 w-8 rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
          {icon}
        </span>
      )}
      <p className="flex-1 text-sm text-white/85 leading-relaxed text-balance">
        {children}
      </p>
    </li>
  );
}
