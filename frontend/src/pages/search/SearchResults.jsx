import { Link, useNavigate } from 'react-router-dom';
import { Check, Clock, LocateFixed, MapPin, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { useSearch } from './useSearch.js';
import { accessBadge, createRecent, groupResults, splitMatch } from './searchUtils.js';
import Skeleton from '../../ui/Skeleton.jsx';
import Alert from '../../ui/Alert.jsx';
import EmptyState from '../../ui/EmptyState.jsx';
import { ButtonLink } from '../../ui/Button.jsx';
import { markerSvg } from '../../components/map/markerSvg.js';

const recentStore = createRecent();

function Highlight({ text, query }) {
  const { pre, hit, post } = splitMatch(text, query);
  return (
    <>
      {pre}
      {hit && <b className="text-ink">{hit}</b>}
      {post}
    </>
  );
}

// Unde duce un rezultat: locurile cu fișă deschid fișa, adresele planifică direct traseul.
export function resultTarget(r) {
  if (r.source === 'place') return `/loc/${r.id}`;
  const [lon, lat] = r.geometry.coordinates;
  return `/traseu?to=${lon},${lat}&toName=${encodeURIComponent(r.name)}`;
}

function PlaceIcon() {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 flex-none items-center justify-center rounded-icon bg-lavender"
      dangerouslySetInnerHTML={{ __html: markerSvg({ type: 'place' }).replace('width="48" height="48"', 'width="36" height="36"') }}
    />
  );
}

function Badge({ badge }) {
  if (!badge) return null;
  const Icon = badge.tone === 'success' ? Check : TriangleAlert;
  return (
    <span
      className={`inline-flex items-center gap-1 self-start rounded-chip px-2.5 py-0.5 text-[15px] font-bold ${
        badge.tone === 'success' ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'
      }`}
    >
      <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
      {badge.text}
    </span>
  );
}

function Recent({ onPick }) {
  const [items, setItems] = useState(recentStore.list);
  return (
    <div className="flex flex-col gap-2">
      <Link
        to="/traseu?from=me"
        className="flex min-h-14 items-center gap-2.5 rounded-field border-2 border-border-strong bg-surface px-4 text-[18px] font-bold text-ink no-underline hover:bg-subtle hover:text-ink"
      >
        <LocateFixed aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
        Pornește de la poziția mea
      </Link>
      {items.length > 0 && (
        <>
          <div className="mt-2 flex items-center justify-between">
            <h2 className="m-0 text-[18px] font-bold text-ink-muted">Căutări recente</h2>
            <button
              type="button"
              onClick={() => {
                recentStore.clear();
                setItems([]);
              }}
              className="min-h-target rounded-icon px-2 text-[17px] font-bold text-info underline underline-offset-2 hover:bg-info-bg"
            >
              Șterge istoricul
            </button>
          </div>
          <ul className="m-0 list-none p-0">
            {items.map((r) => (
              <li key={r.id} className="flex items-center gap-2 border-t border-border">
                <Link
                  to={resultTarget(r)}
                  onClick={() => onPick?.(r)}
                  className="flex min-h-16 flex-1 items-center gap-3 text-ink no-underline hover:text-ink"
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-icon bg-subtle">
                    <Clock aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.5} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[18px] font-semibold">{r.name}</span>
                    {r.address && <span className="text-caption text-ink-muted">{r.address}</span>}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Șterge ${r.name} din istoric`}
                  onClick={() => {
                    recentStore.remove(r.id);
                    setItems(recentStore.list());
                  }}
                  className="flex h-12 flex-none items-center gap-1 rounded-icon px-2 text-[17px] font-bold hover:bg-subtle"
                >
                  <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
                  Șterge
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Rezultatele căutării: recente (C4), rezultate grupate (C3, W5), niciun rezultat (C5).
 * Folosit pe ecranul de căutare de pe telefon și în panoul hărții pe desktop.
 */
export default function SearchResults({ query }) {
  const navigate = useNavigate();
  const { status, results, error } = useSearch(query);
  const pick = (r) => recentStore.add({ id: r.id, name: r.name, address: r.address, source: r.source, geometry: r.geometry });

  if (query.trim().length < 2) return <Recent onPick={pick} />;
  if (status === 'loading' && !results.length) return <Skeleton text="Căutăm…" lines={2} />;
  if (status === 'error') return <Alert tone="error" title="căutarea nu a mers">{error}</Alert>;
  if (status === 'empty') {
    return (
      <div role="status" className="flex flex-col gap-4">
        <EmptyState spot="gps" title="Niciun rezultat în zona acoperită">
          Deocamdată avem trasee verificate doar în zona Complexului Studențesc, UVT, UPT și UMF. Încearcă un loc din apropiere.
        </EmptyState>
        <div className="flex flex-wrap justify-center gap-2">
          {[['1', 'Rectoratul UPT'], ['6', 'Cantina'], ['2', 'Universitatea de Vest']].map(([id, name]) => (
            <ButtonLink key={id} to={`/loc/${id}`} size="sm">
              {name}
            </ButtonLink>
          ))}
        </div>
        <ButtonLink to="/" variant="text" full>
          Vezi zona acoperită pe hartă
        </ButtonLink>
      </div>
    );
  }

  const { places, addresses } = groupResults(results);
  const n = results.length;
  return (
    <div className="flex flex-col">
      <p role="status" className="m-0 mb-1 text-caption text-ink-muted">
        {n === 1 ? '1 rezultat' : `${n} rezultate`} pentru „{query.trim()}”
      </p>
      {places.length > 0 && (
        <>
          <h2 className="mb-1 mt-0 text-[18px] font-bold text-ink-muted">Locuri</h2>
          <ul className="m-0 list-none p-0">
            {places.map((r) => (
              <li key={r.id} className="border-t border-border">
                <Link to={resultTarget(r)} onClick={() => pick(r)} className="flex min-h-[76px] items-center gap-3 py-2 text-ink no-underline hover:bg-subtle hover:text-ink">
                  <PlaceIcon />
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="text-[18px] font-bold">
                      <Highlight text={r.name} query={query} />
                    </span>
                    {r.address && (
                      <span className="text-caption text-ink-muted">
                        <Highlight text={r.address} query={query} />
                      </span>
                    )}
                    <Badge badge={accessBadge(r.attributes)} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {addresses.length > 0 && (
        <>
          <h2 className="mb-1 mt-3 text-[18px] font-bold text-ink-muted">Adrese</h2>
          <ul className="m-0 list-none p-0">
            {addresses.map((r) => (
              <li key={r.id} className="border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    pick(r);
                    navigate(resultTarget(r));
                  }}
                  className="flex min-h-[60px] w-full items-center gap-3 text-left hover:bg-subtle"
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-icon bg-subtle">
                    <MapPin aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.5} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[18px] font-semibold">
                      <Highlight text={r.name} query={query} />
                    </span>
                    <span className="text-caption text-ink-muted">{r.address} · OpenStreetMap</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-caption text-ink-muted">Adresele vin din © OpenStreetMap. Locurile au fișe verificate de comunitate.</p>
    </div>
  );
}
