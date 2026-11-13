import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import OnboardingLayout from './OnboardingLayout.jsx';
import ProfileForm from './ProfileForm.jsx';
import Button from '../../ui/Button.jsx';
import Alert from '../../ui/Alert.jsx';
import BackLink from '../../ui/BackLink.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import { NEED_TYPES } from '../../profile/presets.js';
import { useProfileEditor } from '../../profile/useProfileEditor.js';
import { useToast } from '../../ui/Toast.jsx';
import { safeNext } from '../../auth/validation.js';

/**
 * B2 (pasul 2 la bun venit) și editarea din profil (`editing`).
 * La bun venit pornim de la valorile inițiale ale nevoilor bifate; la editare, de la profilul salvat.
 */
export default function NeedsAdjust({ editing = false }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const needs = useLocation().state?.needs;
  const { show } = useToast();
  const { value, setValue, save, busy, error } = useProfileEditor(editing ? undefined : needs);

  const onSave = async () => {
    if (!(await save())) return;
    show({ tone: 'success', title: 'Profil salvat', message: 'Traseele țin cont de el de acum.' });
    navigate(editing ? '/profil' : safeNext(params.get('next')), { replace: true });
  };

  const first = needs?.[0] && NEED_TYPES.find((n) => n.id === needs[0]);
  const content = (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[26px] font-extrabold leading-8 md:text-[32px] md:leading-10">
          {editing ? 'Profilul de nevoi' : 'Să potrivim traseele pentru tine'}
        </h1>
        <p className="m-0 text-[18px] leading-[26px] text-ink-muted">
          {first ? `Am pornit de la profilul „${first.label.toLowerCase()}”. ` : ''}Schimbă ce nu se potrivește.
        </p>
      </div>
      {error && (
        <Alert tone="error" urgent title="nu am putut salva profilul">
          {error}
        </Alert>
      )}
      {value ? (
        <div className="max-w-[720px]">
          <ProfileForm value={value} onChange={setValue} />
        </div>
      ) : (
        <Skeleton text="Se încarcă profilul…" />
      )}
      <div className="sticky bottom-0 -mx-4 bg-bg px-4 py-3 md:static md:mx-0 md:px-0">
        <Button full className="font-extrabold md:w-auto md:min-w-[280px]" loading={busy} loadingText="Se salvează…" disabled={!value} onClick={onSave}>
          {editing ? 'Salvează profilul' : 'Salvează și mergi la hartă'}
        </Button>
      </div>
    </>
  );

  if (editing) {
    return (
      <>
        <BackLink to="/profil" />
        {content}
      </>
    );
  }
  return (
    <OnboardingLayout step={2} top={<BackLink to={`/bun-venit?${params}`} />}>
      {content}
    </OnboardingLayout>
  );
}
