import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Accessibility, Info, LocateFixed, MapPin, Volume2 } from 'lucide-react';
import { CATEGORIES, categoryLabel } from '../../reports/categories.js';
import CategoryIcon from '../../reports/CategoryIcon.jsx';
import { MAX_DESCRIPTION } from '../../reports/reportDraft.js';
import { transit } from '../../api/endpoints.js';
import { etaText } from '../place/sheetUtils.js';
import PhotoPicker from './PhotoPicker.jsx';
import Field from '../../ui/Field.jsx';
import Button from '../../ui/Button.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import MiniMap from '../../components/map/MiniMap.jsx';

// E1: categoria. Fiecare opțiune e un buton mare, cu iconiță și text.
export function StepCategory({ value, onPick }) {
  return (
    <>
      <h2 className="m-0 text-title-3">Ce ai găsit?</h2>
      <div role="radiogroup" aria-label="Categoria problemei" className="grid grid-cols-2 gap-2.5 md:grid-cols-1 lg:grid-cols-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value === c.id}
            onClick={() => onPick(c.id)}
            className={`flex min-h-[104px] flex-col items-start justify-between gap-2 rounded-card border-2 p-3 text-left shadow-sm hover:border-ink ${
              value === c.id ? 'border-[3px] border-ink bg-peach' : 'border-border bg-surface'
            }`}
          >
            <CategoryIcon category={c} size="sm" />
            <span className="text-[17px] font-bold leading-[22px]">{c.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// E2: vehiculul, din sosirile stației apropiate.
export function StepVehicle({ stopId, value, onPick, onContinue, error }) {
  const [arrivals, setArrivals] = useState(null);
  useEffect(() => {
    transit
      .arrivals(stopId)
      .then(setArrivals)
      .catch(() => setArrivals([]));
  }, [stopId]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-title-3">În ce vehicul ai fost?</h2>
        <p className="m-0 text-[17px] text-ink-muted">Din stația cea mai apropiată de tine.</p>
        <Link to={`/statie/${stopId}`} className="inline-flex min-h-target items-center text-[17px] font-semibold">
          Schimbă stația
        </Link>
      </div>
      {!arrivals ? (
        <Skeleton text="Se încarcă vehiculele…" lines={2} />
      ) : (
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0" aria-invalid={error ? true : undefined}>
          <legend className="sr-only">Vehicule</legend>
          {arrivals.map((a) => {
            const on = value === a.vehicle.id;
            return (
              <label
                key={a.trip_id}
                className={`flex min-h-[72px] cursor-pointer items-center gap-3 rounded-card p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-focus ${
                  on ? 'border-[3px] border-success bg-success-bg' : 'border-2 border-border bg-surface'
                }`}
              >
                <input type="radio" name="vehicle" checked={on} onChange={() => onPick(a.vehicle.id, a)} className="h-6 w-6 accent-success" />
                <span className="flex h-11 min-w-11 items-center justify-center rounded-icon bg-primary px-2 text-[20px] font-extrabold text-on-primary">
                  {a.route}
                </span>
                <span className="flex flex-col">
                  <span className="text-[18px] font-semibold">
                    {a.type} {a.route} · spre {a.headsign}
                  </span>
                  <span className="text-caption text-ink-muted">Sosește {etaText(a.arrival_time)}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {error && <p className="m-0 text-[17px] font-semibold text-error">{error}</p>}
      <Button full className="font-extrabold" onClick={onContinue}>
        Continuă
      </Button>
    </>
  );
}

function CharCount({ id, value }) {
  return (
    <span id={id} className="self-end text-caption text-ink-muted">
      {value.length} / {MAX_DESCRIPTION}
    </span>
  );
}

/**
 * E4 (telefon), W14 și W15 (desktop), E3 pentru vehicule: poza, locul și descrierea.
 * Locul vine din GPS sau din clic pe hartă; pe telefon, „Alege pe hartă” ascunde formularul.
 */
export function StepDetails({ phone, draft, set, photo, setPhoto, photoError, setPhotoError, errors, gps, onLocateMe, onPickOnMap, onContinue }) {
  const vehicle = draft.category === 'dotare_vehicul';
  return (
    <>
      {vehicle && (
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2 text-title-3">Ce nu a funcționat?</legend>
          {[
            ['ramp', 'Rampa', Accessibility],
            ['audio', 'Anunțurile sonore', Volume2],
          ].map(([id, label, Icon]) => (
            <label
              key={id}
              className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-card p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-focus ${
                draft.equipment === id ? 'border-[3px] border-success bg-success-bg' : 'border-2 border-border bg-surface'
              }`}
            >
              <input type="radio" name="equipment" checked={draft.equipment === id} onChange={() => set({ equipment: id })} className="h-6 w-6 accent-success" />
              <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
              <span className="text-[18px] font-semibold">{label}</span>
            </label>
          ))}
        </fieldset>
      )}

      <PhotoPicker phone={phone} file={photo} onChange={setPhoto} error={photoError ?? errors.photo} onError={setPhotoError} />

      {!vehicle && (
        <div className="flex flex-col gap-2">
          <span className="text-label">Locație</span>
          {draft.point ? (
            <div className="flex flex-col gap-2">
              {phone && <MiniMap point={draft.point} label="Locul ales" className="h-36" />}
              <p className="m-0 flex items-start gap-2 text-[17px]">
                <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" strokeWidth={2.5} />
                <span>
                  {gps && draft.pointSource === 'gps'
                    ? `Din GPS · aproximativ, pe o rază de ${Math.round(gps.accuracy)} m`
                    : 'Ales pe hartă'}
                </span>
              </p>
            </div>
          ) : (
            <p className="m-0 text-[17px] text-ink-muted">
              {phone ? 'Folosește locația ta sau alege locul pe hartă.' : 'Fă clic pe hartă acolo unde e problema sau folosește locația ta.'}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={LocateFixed} onClick={onLocateMe}>
              Folosește locația mea
            </Button>
            {phone && (
              <Button variant="secondary" size="sm" icon={MapPin} onClick={onPickOnMap}>
                Alege pe hartă
              </Button>
            )}
          </div>
          {errors.location && <p className="m-0 text-[17px] font-semibold text-error">{errors.location}</p>}
          <Field
            id="report-location-text"
            label="Unde e, în cuvinte"
            value={draft.location_text}
            onChange={(e) => set({ location_text: e.target.value })}
            placeholder="de exemplu: colț cu Bd. Vasile Pârvan"
            error={errors.location_text}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Field
          id="report-description"
          label="Descriere"
          optional
          multiline
          maxLength={MAX_DESCRIPTION}
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          aria-describedby="report-description-count"
          error={errors.description}
        />
        <CharCount id="report-description-count" value={draft.description} />
      </div>

      {vehicle && (
        <p className="m-0 flex items-start gap-2 rounded-field bg-info-bg p-3 text-[17px] leading-6">
          <Info aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-info-strong" strokeWidth={2.5} />
          Nu trebuie să alegi locul pe hartă: raportul merge direct la operatorul de transport.
        </p>
      )}

      <Button full className="font-extrabold" onClick={onContinue} disabled={!photo}>
        {photo ? 'Continuă' : 'Continuă după ce adaugi poza'}
      </Button>
    </>
  );
}

// E5: verifică și trimite.
export function StepSummary({ draft, photo, vehicleInfo, onEdit, onSubmit, busy, error }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!photo) return undefined;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const rows = [
    ['Categorie', categoryLabel(draft.category), 'category'],
    draft.category === 'dotare_vehicul'
      ? ['Vehicul', vehicleInfo ? `${vehicleInfo.type} ${vehicleInfo.route} · spre ${vehicleInfo.headsign}` : draft.vehicle, 'vehicle']
      : ['Locație', draft.location_text, 'details'],
    ['Descriere', draft.description?.trim() || '—', 'details'],
  ];
  return (
    <>
      {preview && <img src={preview} alt="Poza ta" className="max-h-56 w-full rounded-card object-cover" />}
      <dl className="m-0 flex flex-col">
        {rows.map(([k, v, step], i) => (
          <div key={k} className={`flex items-start justify-between gap-3 py-2.5 ${i ? 'border-t border-border' : ''}`}>
            <div className="flex flex-col">
              <dt className="text-caption font-bold text-ink-muted">{k}</dt>
              <dd className="m-0 text-[18px]">{v}</dd>
            </div>
            <button type="button" onClick={() => onEdit(step)} className="h-12 flex-none rounded-icon px-2 text-[17px] font-bold text-info underline underline-offset-2 hover:bg-info-bg">
              Schimbă<span className="sr-only"> {k.toLowerCase()}</span>
            </button>
          </div>
        ))}
      </dl>
      <p className="m-0 flex items-start gap-2 text-[17px] text-ink-muted">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" strokeWidth={2.5} />
        Poza se salvează fără metadate și se șterge după 30 de zile.
      </p>
      {error}
      <Button full className="font-extrabold" loading={busy} loadingText="Se trimite…" onClick={onSubmit}>
        Trimite raportul
      </Button>
    </>
  );
}
