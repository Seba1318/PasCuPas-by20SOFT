// Primul element focusabil: sare peste navigare direct la conținut.
export default function SkipLink({ target = '#continut' }) {
  return (
    <a
      href={target}
      className="sr-only-focusable fixed left-4 top-4 z-[3000] rounded-field bg-surface px-4 py-3 text-[18px] font-bold shadow-lg"
    >
      Sari la conținut
    </a>
  );
}
