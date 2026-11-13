import Logo from '../../layout/Logo.jsx';
import SkipLink from '../../layout/SkipLink.jsx';

// Cadrul pașilor de bun venit (B1, B2, W2): logo, „Pasul X din 2”, conținut lat pe desktop.
export default function OnboardingLayout({ step, total = 2, top, children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SkipLink />
      <header className="flex min-h-[72px] flex-none items-center gap-3 px-4 md:px-10">
        {top ?? <Logo compact />}
        <span className="ml-auto whitespace-nowrap text-[17px] font-bold text-ink-muted">
          Pasul {step} din {total}
        </span>
        <div aria-hidden="true" className="flex gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-10 rounded-chip md:w-12 ${i + 1 < step ? 'bg-success' : i + 1 === step ? 'bg-primary' : 'bg-border'}`}
            />
          ))}
        </div>
      </header>
      <main id="continut" tabIndex={-1} className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-4 px-4 pb-6 outline-none md:gap-6 md:px-10">
        {children}
      </main>
    </div>
  );
}
