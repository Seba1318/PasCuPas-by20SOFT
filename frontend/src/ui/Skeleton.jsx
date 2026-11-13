// Încărcare: blocuri gri care pulsează lent (statice cu reduced-motion) + text vizibil.
export function SkeletonBlock({ className = '' }) {
  return <span aria-hidden="true" className={`block rounded-[10px] bg-border motion-safe:animate-pulse ${className}`} />;
}

export default function Skeleton({ text = 'Se încarcă…', lines = 3, className = '' }) {
  return (
    <div aria-busy="true" className={`flex flex-col gap-3 rounded-card border-2 border-border p-5 ${className}`}>
      <span className="text-label text-ink-muted">{text}</span>
      <div className="flex gap-2">
        <SkeletonBlock className="h-8 w-[120px] rounded-chip" />
        <SkeletonBlock className="h-8 w-[90px] rounded-chip" />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock key={i} className={`h-5 bg-skeleton ${i % 2 ? 'w-[85%]' : 'w-full'}`} />
      ))}
    </div>
  );
}
