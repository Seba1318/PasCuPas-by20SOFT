import Slider from '../../ui/Slider.jsx';
import Switch from '../../ui/Switch.jsx';
import { formatPercent } from '../../lib/format.js';

const KERB_MAX = 10;
const INCLINE_MAX = 12;

function Section({ title, children }) {
  return (
    <section className="flex flex-col rounded-card bg-surface px-4 py-2.5 shadow-sm hc:border-2 hc:border-border md:px-6">
      <h2 className="mb-1.5 mt-2 text-[20px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({ id, label, checked, onChange }) {
  return <Switch id={id} label={label} checked={checked} onChange={onChange} className="border-t border-border" />;
}

/**
 * Formularul de profil (B2, W3): pragurile obligatorii, preferințele de drum și felul indicațiilor.
 * value = { profile, ui }; ui = preferințele de afișare (contrast, voce, vibrații, mod simplificat).
 */
export default function ProfileForm({ value, onChange }) {
  const { profile: p, ui } = value;
  const setP = (key, v) => onChange({ ...value, profile: { ...p, [key]: v } });
  const setUi = (key, v) => onChange({ ...value, ui: { ...ui, [key]: v } });

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-5 rounded-card bg-surface px-4 py-4 shadow-sm hc:border-2 hc:border-border md:px-6">
        <h2 className="m-0 text-[20px] font-bold">Ce pot trece</h2>
        <Switch id="pf-stairs" label="Fără trepte" hint="Traseul nu trece niciodată pe scări." checked={p.avoid_stairs} onChange={(v) => setP('avoid_stairs', v)} />
        <Slider
          id="pf-kerb"
          label="Bordura maximă"
          min={0}
          max={KERB_MAX}
          value={p.max_kerb_cm ?? KERB_MAX}
          onChange={(v) => setP('max_kerb_cm', v)}
          format={(v) => (p.max_kerb_cm == null ? 'Fără limită' : `${v} cm`)}
          minText="0 cm"
          maxText={`${KERB_MAX} cm`}
          hint={p.max_kerb_cm == null ? 'Mută glisorul ca să alegi o limită.' : `Bordurile mai înalte de ${p.max_kerb_cm} cm sunt ocolite.`}
        />
        <Slider
          id="pf-incline"
          label="Panta maximă"
          min={0}
          max={INCLINE_MAX}
          value={p.max_incline_pct ?? INCLINE_MAX}
          onChange={(v) => setP('max_incline_pct', v)}
          format={(v) => (p.max_incline_pct == null ? 'Fără limită' : formatPercent(v))}
          minText={formatPercent(0)}
          maxText={formatPercent(INCLINE_MAX)}
          hint={
            p.max_incline_pct == null
              ? 'Mută glisorul ca să alegi o limită.'
              : `Pantele peste ${formatPercent(p.max_incline_pct)} sunt ocolite; cele apropiate îți apar ca avertisment.`
          }
        />
      </section>

      <Section title="Pe drum">
        <Toggle id="pf-rough" label="Evită pietrișul" checked={p.avoid_rough_surface} onChange={(v) => setP('avoid_rough_surface', v)} />
        <Toggle id="pf-tactile" label="Prefer ghidaje tactile" checked={p.prefer_tactile} onChange={(v) => setP('prefer_tactile', v)} />
        <Toggle id="pf-audio" label="Prefer semafoare sonore" checked={p.prefer_audio_signals} onChange={(v) => setP('prefer_audio_signals', v)} />
        <Toggle id="pf-lit" label="Prefer străzi iluminate" checked={p.prefer_lit} onChange={(v) => setP('prefer_lit', v)} />
      </Section>

      <Section title="Cum primești indicațiile">
        <Toggle
          id="pf-simple"
          label="Mod simplificat"
          checked={p.simplified_mode}
          onChange={(v) => onChange({ profile: { ...p, simplified_mode: v }, ui: { ...ui, simplified: v } })}
        />
        <Toggle id="pf-voice" label="Indicații vocale" checked={ui.voice} onChange={(v) => setUi('voice', v)} />
        <Toggle id="pf-vibration" label="Vibrații la viraje" checked={ui.vibration} onChange={(v) => setUi('vibration', v)} />
        <Toggle id="pf-contrast" label="Contrast ridicat" checked={ui.highContrast} onChange={(v) => setUi('highContrast', v)} />
      </Section>

      <section className="flex flex-col gap-1.5 rounded-card bg-surface px-4 pb-4 pt-2.5 shadow-sm hc:border-2 hc:border-border md:px-6">
        <Switch
          id="pf-rest"
          label="Pauze pe traseu"
          checked={p.needs_rest_every_m != null}
          onChange={(v) => setP('needs_rest_every_m', v ? 300 : null)}
        />
        {p.needs_rest_every_m != null && (
          <Slider
            id="pf-rest-m"
            label="La fiecare"
            min={100}
            max={1000}
            step={50}
            value={p.needs_rest_every_m}
            onChange={(v) => setP('needs_rest_every_m', v)}
            format={(v) => `${v} m`}
            minText="100 m"
            maxText="1 km"
            hint={`Îți arătăm o bancă sau un loc de odihnă cam la fiecare ${p.needs_rest_every_m} m.`}
          />
        )}
      </section>
    </div>
  );
}
