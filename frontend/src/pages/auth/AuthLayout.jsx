import Logo from '../../layout/Logo.jsx';
import Footer from '../../layout/Footer.jsx';
import Spot from '../../ui/Spot.jsx';
import SkipLink from '../../layout/SkipLink.jsx';
import { DisplayMenu } from '../../accessibility/DisplaySettings.jsx';

/**
 * Cadrul ecranelor de cont. Telefon: pagină plină (A1–A6). De la 768 px: card centrat ca în W1;
 * pe desktop, autentificarea și înregistrarea au în stânga prezentarea aplicației.
 */
export default function AuthLayout({ top, intro = false, children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SkipLink />
      <header className="flex h-[72px] flex-none items-center justify-between gap-3 px-4 md:px-10">
        {top ?? <Logo />}
        <DisplayMenu />
      </header>
      <main id="continut" tabIndex={-1} className="flex flex-1 items-start justify-center gap-24 px-4 pb-6 outline-none md:items-center md:px-10">
        {intro && (
          <div className="hidden w-[520px] flex-col gap-5 lg:flex">
            <Spot kind="welcome" w={440} />
            <p className="m-0 text-[34px] font-extrabold leading-[42px]">Drumuri fără trepte în Complexul Studențesc</p>
            <p className="m-0 text-body-lg text-ink-muted">
              Trasee pe jos și cu transportul public, potrivite profilului tău, între UVT, UPT, UMF și cămine.
            </p>
          </div>
        )}
        <section className="flex w-full max-w-[480px] flex-col gap-4 md:rounded-sheet md:bg-surface md:p-10 md:shadow-lg md:hc:border-[3px] md:hc:border-border">
          {children}
        </section>
      </main>
      <Footer className="flex-none py-4" />
    </div>
  );
}

export function AuthHeading({ title, children, spot, spotSize = 200, spotDesktop = true }) {
  return (
    <>
      {spot && (
        <div className={`self-center ${spotDesktop ? '' : 'md:hidden'}`}>
          <Spot kind={spot} w={spotSize} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[28px] font-extrabold leading-9 md:text-[30px] md:leading-[38px]">{title}</h1>
        {children && <div className="text-[18px] leading-[26px] text-ink-muted">{children}</div>}
      </div>
    </>
  );
}
