// Single source of truth for the per-subscription notification toggles.
// The push_subscriptions.prefs jsonb column is typed against this on the
// server (lib/db/schema.ts) and every client surface (notification
// toggles, push-client helpers) imports the same definition — so adding
// a new category is one edit.
export type PushPrefs = {
  chatAll?: boolean;
  chatReplies?: boolean;
  nowPlaying?: boolean;
  votingState?: boolean;
  resultsTallied?: boolean;
};
