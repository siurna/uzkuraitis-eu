// A tiny haptic tap. Android honours `navigator.vibrate`; iOS Safari
// silently ignores it (no web haptics there) — calling it is harmless
// either way.
export function haptic(pattern: number | number[] = 8): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
