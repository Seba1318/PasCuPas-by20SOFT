import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import OnboardingLayout from './OnboardingLayout.jsx';
import Spot from '../../ui/Spot.jsx';
import Button from '../../ui/Button.jsx';
import { NEED_TYPES, needsFromProfile } from '../../profile/presets.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { users } from '../../api/endpoints.js';
import { safeNext } from '../../auth/validation.js';
import { displayName } from '../account/accountUtils.js';

// B1 (telefon) și W2 (desktop): ce te-ar ajuta pe drum. Bifele devin reguli de rutare la pasul 2.
export default function NeedsPick() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [picked, setPicked] = useState(new Set());

  // La editare pornim de la profilul salvat.
  useEffect(() => {
    users
      .getProfile()
      .then((p) => p && setPicked(new Set(needsFromProfile(p))))
      .catch(() => {});
  }, []);

  const toggle = (id) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const name = displayName(user);
  return (
    <OnboardingLayout step={1}>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[28px] font-extrabold leading-9 md:text-[36px] md:leading-[44px]">
          {name ? `Salut, ${name}! ` : 'Salut! '}Ce te-ar ajuta pe drum?
        </h1>
        <p className="m-0 text-[18px] text-ink-muted md:text-[20px]">
          Bifează tot ce ți se potrivește.<span className="hidden md:inline"> Folosește Tab și Spațiu ca să alegi din tastatură.</span>
        </p>
      </div>
      <fieldset className="m-0 grid grid-cols-2 gap-3 border-0 p-0 md:grid-cols-3 md:gap-5">
        <legend className="sr-only">Nevoile tale pe drum</legend>
        {NEED_TYPES.map((n) => {
          const on = picked.has(n.id);
          return (
            <label
              key={n.id}
              className={`relative flex min-h-[164px] cursor-pointer flex-col gap-1.5 rounded-card p-3 pb-3.5 shadow-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus md:flex-row md:items-center md:gap-4 md:p-5 ${
                on ? 'border-[3px] border-success bg-success-bg' : 'border-2 border-border bg-surface'
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(n.id)}
                className="absolute right-3 top-3 h-[26px] w-[26px] accent-success"
              />
              <span className="md:hidden">
                <Spot kind={n.spot} w={80} />
              </span>
              <span className="hidden flex-none md:block">
                <Spot kind={n.spot} w={120} />
              </span>
              <span className="flex flex-col gap-1 pr-8">
                <span className="text-[17px] font-bold leading-[23px] md:text-[20px] md:leading-7">{n.label}</span>
                <span className="hidden text-caption text-ink-muted md:block">{n.hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="mt-auto flex flex-col gap-2.5 md:flex-row-reverse md:items-center md:gap-4">
        <Button
          full
          className="font-extrabold md:w-auto md:min-w-[240px]"
          onClick={() => navigate(`/bun-venit/ajustare?next=${encodeURIComponent(next)}`, { state: { needs: [...picked] } })}
        >
          Continuă
        </Button>
        <Link to={next} className="inline-flex min-h-target items-center justify-center text-[18px] font-semibold">
          Sari peste
        </Link>
        <p className="m-0 text-center text-[17px] text-ink-muted md:mr-auto">Poți schimba oricând din Profil.</p>
      </div>
    </OnboardingLayout>
  );
}
