// Standard admin page heading: a gradient title, optional subtitle
// directly below it, optional inline page-level metadata or action
// buttons to the right. Every /admin/* page top uses this so the
// backstage feels like one tool.
export function AdminPageTitle({
  children,
  subtitle,
  trailing,
}: {
  children: React.ReactNode;
  /** Optional muted line under the title — page-level context the
   *  user wants visible without it being buried inside a card. */
  subtitle?: React.ReactNode;
  /** Right-rail slot for action buttons or status badges. */
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 heading-rise">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-4xl gradient-text leading-tight">{children}</h1>
        {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
      </div>
      {subtitle && (
        <p className="text-sm text-white/55 leading-snug max-w-2xl">{subtitle}</p>
      )}
    </div>
  );
}
