import type { LucideIcon } from "lucide-react";

// Standard admin page heading: a flamingo-tinted icon tile + gradient title.
// Every /admin/* page top uses this so the backstage feels like one tool.
// The icon should match the section's nav icon (see components/admin-nav.tsx).
//
// `trailing` is for inline page-level metadata that lives next to the
// title rather than buried in a card — e.g. a "X/Y filled" status
// badge on the Results page. Right-aligned via `ml-auto`.
export function AdminPageTitle({
  icon: Icon,
  children,
  trailing,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 heading-rise">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-flamingo/15 ring-1 ring-flamingo/30 text-flamingo">
        <Icon className="h-5 w-5" />
      </span>
      <h1 className="font-display text-3xl gradient-text">{children}</h1>
      {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
    </div>
  );
}
