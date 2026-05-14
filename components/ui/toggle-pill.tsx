// Visual primitive for the iOS-style switch pill we render in every
// toggle row across the app: the rounded track + the white dot that
// slides between two positions. The exact same markup (h-6 w-11
// track, h-5 w-5 dot, translate-x-5 / 0) was inline in five places
// (notification-toggles PrefRow, admin-live-controls DrawerSwitch,
// settings-modal ToggleRow, admin-room-boolean-toggle, room-manage)
// — when we tweak one we want all to move.
//
// The accent prop lets admin "behaviour" rows render the gray
// (subtle, non-color-signalling) variant while voter-facing prefs
// render the green "success" variant. Lift it from inside the
// callers' chain.
export function TogglePill({
  on,
  accent = "success",
}: {
  on: boolean;
  /** "success" = green (voter prefs); "neutral" = gray (admin flags
   *  that shouldn't read as celebratory). */
  accent?: "success" | "neutral";
}) {
  const onBg = accent === "success" ? "bg-success/90" : "bg-white/50";
  return (
    <span
      className={`relative h-6 w-11 rounded-full transition shrink-0 ${
        on ? onBg : "bg-white/10"
      }`}
      aria-hidden
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </span>
  );
}
