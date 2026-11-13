import Spot from './Spot.jsx';

// Stare goală sau de eroare (seria G): ilustrație, titlu, explicație, acțiuni explicite.
export default function EmptyState({ spot, title, children, actions, role, headingLevel = 2, className = '' }) {
  const H = `h${headingLevel}`;
  return (
    <section role={role} className={`flex flex-col items-center gap-4 text-center ${className}`}>
      {spot && <Spot kind={spot} w={200} />}
      <H className="m-0 text-title-2-sm md:text-title-2">{title}</H>
      {children && <div className="max-w-prose text-[18px] leading-[26px] text-ink-muted">{children}</div>}
      {actions && <div className="flex w-full max-w-sm flex-col gap-3">{actions}</div>}
    </section>
  );
}
