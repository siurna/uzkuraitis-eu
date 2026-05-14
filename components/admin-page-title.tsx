// Standard admin page heading: a gradient title, nothing else. Every
// /admin/* page top uses this so the backstage feels like one tool.
//
// `trailing` is for inline page-level metadata that lives next to the
// title rather than buried in a card, e.g. a "X/Y filled" status
// badge on the Results page. Right-aligned via `ml-auto`.
export function AdminPageTitle({
  children,
  trailing,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 heading-rise">
      <h1 className="font-display text-4xl gradient-text leading-tight">{children}</h1>
      {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
    </div>
  );
}
