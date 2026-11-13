import { Link } from 'react-router-dom';
import { MapPinOff, Route, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import Spot from '../../ui/Spot.jsx';
import Button, { ButtonLink } from '../../ui/Button.jsx';
import { SkeletonBlock } from '../../ui/Skeleton.jsx';
import { loadingText } from './routeUtils.js';

// G9: se calculează traseul.
export function RouteLoading({ profile }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-2">
        <Spot kind="loading" w={180} />
        <p className="m-0 text-title-3">Calculăm traseul…</p>
        <p className="m-0 text-[18px] leading-[26px] text-ink-muted">{loadingText(profile)}</p>
      </div>
      <div aria-busy="true" aria-label="Variante de traseu, se încarcă" className="flex w-full flex-col gap-2.5">
        <div className="flex gap-2">
          <SkeletonBlock className="h-8 w-28" />
          <SkeletonBlock className="h-8 w-20" />
        </div>
        <SkeletonBlock className="h-14 w-full rounded-field bg-skeleton" />
      </div>
    </div>
  );
}

// G1: niciun traseu nu respectă profilul. Nu propunem pe tăcute un drum inaccesibil.
export function NoRoute({ from, to, onPickOther }) {
  return (
    <section role="alert" className="flex flex-col gap-3">
      <p className="m-0 text-caption font-bold text-ink-muted">
        {from?.name} → {to?.name}
      </p>
      <Spot kind="routeNone" w={160} className="self-center" />
      <h2 className="m-0 text-title-3">Nu există traseu care să respecte profilul tău</h2>
      <p className="m-0 text-[18px] leading-[26px]">
        Pe toate drumurile până acolo e cel puțin un obstacol pe care profilul tău îl exclude. Nu vrem să te trimitem pe
        acolo fără să știi.
      </p>
      <p className="m-0 text-[18px] font-bold">Ce poți face:</p>
      <div className="flex flex-col gap-2.5">
        <ButtonLink to="/profil/nevoi" variant="primary" icon={SlidersHorizontal} full>
          Ajustează profilul
        </ButtonLink>
        <Button variant="secondary" icon={Route} full onClick={onPickOther}>
          Alege alt punct
        </Button>
        <ButtonLink to="/" variant="text" icon={TriangleAlert} full>
          Vezi unde sunt obstacolele
        </ButtonLink>
      </div>
    </section>
  );
}

// G2: punctul e în afara zonei acoperite (conturul zonei apare pe hartă).
export function OutOfArea({ onPickOther }) {
  return (
    <section role="alert" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-chip bg-info-bg text-info-strong">
          <MapPinOff aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <h2 className="m-0 text-title-3">Punctul e în afara zonei acoperite</h2>
      </div>
      <p className="m-0 text-[18px] leading-[26px]">
        Deocamdată verificăm trasee doar în zona conturată pe hartă: Complexul Studențesc, UVT, UPT și UMF. Lucrăm să o
        extindem.
      </p>
      <Button variant="primary" full onClick={onPickOther}>
        Alege un punct din zonă
      </Button>
      <Link to="/" className="inline-flex min-h-target items-center justify-center text-[18px] font-semibold">
        Înapoi la hartă
      </Link>
    </section>
  );
}
