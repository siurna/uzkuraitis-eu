// Flag-derived accent colours per finalist, keyed on ISO-2 lowercase.
// Used for the now-playing takeover wash + the big animated country
// name. Two colours each: a primary and an accent. Anything missing
// falls back to the brand rainbow pair.
const COLORS: Record<string, [string, string]> = {
  al: ["#e41e20", "#1a1a1a"],
  am: ["#0033a0", "#d90012"],
  at: ["#ed2939", "#ffffff"],
  au: ["#012169", "#e4002b"],
  az: ["#00b5e2", "#509e2f"],
  be: ["#fae042", "#ed2939"],
  bg: ["#00966e", "#d62612"],
  ch: ["#d52b1e", "#ffffff"],
  cy: ["#d57800", "#4e5b31"],
  cz: ["#11457e", "#d7141a"],
  de: ["#dd0000", "#ffce00"],
  dk: ["#c8102e", "#ffffff"],
  ee: ["#0072ce", "#1a1a1a"],
  fi: ["#003580", "#ffffff"],
  fr: ["#0055a4", "#ef4135"],
  gb: ["#012169", "#c8102e"],
  ge: ["#e8112d", "#ffffff"],
  gr: ["#0d5eaf", "#ffffff"],
  hr: ["#ff0000", "#171796"],
  il: ["#0038b8", "#ffffff"],
  it: ["#008c45", "#cd212a"],
  lt: ["#fdb913", "#c1272d"],
  lu: ["#00a1de", "#ed2939"],
  lv: ["#9e3039", "#ffffff"],
  md: ["#0046ae", "#ffd200"],
  me: ["#c40308", "#d5af34"],
  mt: ["#cf142b", "#ffffff"],
  no: ["#ba0c2f", "#00205b"],
  pl: ["#dc143c", "#ffffff"],
  pt: ["#006600", "#ff0000"],
  ro: ["#002b7f", "#fcd116"],
  rs: ["#c6363c", "#0c4076"],
  se: ["#006aa7", "#fecc00"],
  sm: ["#5eb6e4", "#ffffff"],
  ua: ["#0057b7", "#ffd700"],
};

const FALLBACK: [string, string] = ["#ff2ede", "#4cc9f0"];

export function countryColors(code: string): [string, string] {
  return COLORS[code.toLowerCase()] ?? FALLBACK;
}
