// Visual primitive for the iOS-style switch pill we render in every
// toggle row across the app: the rounded track + the white dot that
// slides between two positions. The exact same markup (h-6 w-11
// track, h-5 w-5 dot, translate-x-5 / 0) was inline in five places
// (notification-toggles PrefRow, admin-live-controls DrawerSwitch,
// settings-modal ToggleRow, admin-room-boolean-toggle, room-manage)
// — when we tweak one we want all to move.
//
// Accent variants:
//  - "success"  → green, voter prefs (sub-feature toggles)
//  - "neutral"  → gray, admin flags that shouldn't read celebratory
//  - "electric" → cyan, the MASTER notifications switch only. Reads
//    as the gate that gates everything else, distinct from the
//    green sub-prefs underneath.
export function TogglePill({
  on,
  accent = "success",
}: {
  on: boolean;
  accent?: "success" | "neutral" | "electric";
}) {
  const onBg =
    accent === "electric"
      ? "bg-[oklch(72%_0.18_225)] shadow-[0_0_18px_-2px_oklch(72%_0.2_225_/_0.7)]"
      : accent === "success"
        ? "bg-success/90"
        : "bg-white/50";
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
