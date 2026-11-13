/**
 * Foaia de jos de pe telefon (design/Navigatie-Telefon): rază 24 sus, mâner apăsabil.
 * `expanded` comută între înălțimea compactă și cea mare; nu depinde de gesturi.
 */
export default function BottomSheet({ label, expanded, onToggle, children, className = '' }) {
  return (
    <section
      aria-label={label}
      className={[
        'absolute inset-x-0 bottom-0 z-[900] flex flex-col gap-3 rounded-t-sheet bg-surface px-4 pb-4 shadow-lg transition-[max-height] hc:border-t-[3px] hc:border-border',
        expanded ? 'max-h-[85%]' : 'max-h-[45%]',
        className,
      ].join(' ')}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex h-8 w-24 flex-none items-center justify-center self-center"
      >
        <span className="h-[5px] w-11 rounded-chip bg-route-blocked" aria-hidden="true" />
        <span className="sr-only">{expanded ? 'Restrânge panoul' : 'Extinde panoul'}</span>
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}
