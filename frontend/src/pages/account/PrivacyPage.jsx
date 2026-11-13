import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, Download, FileText, Mail, MapPin, SlidersHorizontal, UserRound } from 'lucide-react';
import BackLink from '../../ui/BackLink.jsx';
import Button from '../../ui/Button.jsx';
import Dialog from '../../ui/Dialog.jsx';
import Alert from '../../ui/Alert.jsx';
import { users, reports } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useToast } from '../../ui/Toast.jsx';

const DATA = [
  ['Emailul', 'Pentru cont, confirmare și resetarea parolei.', Mail, 'bg-sky'],
  ['Numele și poza de profil', 'Apar pe rapoartele tale publice. Poza de profil e opțională.', UserRound, 'bg-lavender'],
  ['Profilul de nevoi', 'Doar ca să calculăm traseele potrivite. Nu îl arătăm nimănui.', SlidersHorizontal, 'bg-peach'],
  ['Poziția', 'Doar cât timp planifici, navighezi sau raportezi.', MapPin, 'bg-mint'],
  ['Rapoartele', 'Categoria, locația, descrierea și poza pe care le trimiți.', FileText, 'bg-lavender'],
];

const section = 'flex flex-col gap-3 rounded-card bg-surface p-5 shadow-sm hc:border-2 hc:border-border';

// F2: confidențialitate, descărcarea datelor și ștergerea contului.
// Textul trebuie verificat de cineva care cunoaște GDPR înainte de lansare (Observații §11).
export default function PrivacyPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mine, setMine] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const download = async () => {
    try {
      const data = await users.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pas-cu-pas-datele-mele.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.detail);
    }
  };

  const askDelete = async () => {
    setConfirmOpen(true);
    setMine(null);
    reports
      .mine()
      .then((r) => setMine(r.length))
      .catch(() => setMine(null));
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await users.deleteAccount();
      logout();
      show({ tone: 'success', title: 'Contul a fost șters', message: 'Rapoartele tale au dispărut de pe hartă.' });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.detail);
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BackLink to="/profil" label="Înapoi la profil" />
      <h1 className="m-0 text-title-2-sm md:text-title-2">Confidențialitate</h1>
      <p className="m-0 text-body-lg">Pe scurt: folosim doar ce ne trebuie ca să-ți găsim drumuri bune și să rezolvăm problemele raportate.</p>
      {error && (
        <Alert tone="error" urgent title="nu a mers">
          {error}
        </Alert>
      )}
      <section aria-labelledby="pv-data" className={section}>
        <h2 id="pv-data" className="m-0 text-title-3">
          Ce date colectăm
        </h2>
        <ul className="m-0 list-none p-0">
          {DATA.map(([title, text, Icon, bg], i) => (
            <li key={title} className={`flex items-start gap-3 py-3 ${i ? 'border-t border-border' : ''}`}>
              <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-icon ${bg}`}>
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <div className="flex flex-col">
                <span className="text-[18px] font-bold">{title}</span>
                <span className="text-[17px] text-ink-muted">{text}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="pv-photos" className={section}>
        <h2 id="pv-photos" className="m-0 flex items-center gap-2 text-title-3">
          <Camera aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
          Pozele tale
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[17px]">
          {[
            'Se salvează fără metadate: fără locația din fișier, fără modelul telefonului, fără ora exactă.',
            'Se șterg automat după 30 de zile.',
            'Pentru verificare, poza poate fi analizată automat de un model AI; decizia o ia mereu un om.',
            'Te rugăm să nu fotografiezi fețe sau numere de înmatriculare.',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-success" strokeWidth={3} />
              {t}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="pv-who" className={section}>
        <h2 id="pv-who" className="m-0 text-title-3">
          Cine vede ce
        </h2>
        <p className="m-0 text-[17px]">
          Pagina publică a unui raport arată poza, categoria, locația, statusul, numele tău și poza de profil, dacă ai pus una. Emailul nu apare
          niciodată. Primăria și operatorul de transport văd rapoartele ca să le poată rezolva.
        </p>
      </section>
      {user && (
        <div className="flex flex-col gap-3">
          <Button variant="secondary" icon={Download} full onClick={download}>
            Descarcă datele mele
          </Button>
          <Button variant="danger" full onClick={askDelete}>
            Șterge contul
          </Button>
          <span className="text-caption text-ink-muted">Dacă îți ștergi contul, se șterg și rapoartele tale, iar ele dispar de pe hartă.</span>
        </div>
      )}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Ștergi contul?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Renunță
            </Button>
            <Button variant="danger" loading={busy} loadingText="Se șterge…" onClick={doDelete}>
              Șterge definitiv
            </Button>
          </>
        }
      >
        <p className="m-0">
          Se șterg contul, profilul de nevoi și {mine == null ? 'toate rapoartele tale' : mine === 1 ? 'raportul tău' : `cele ${mine} rapoarte ale tale`}, cu poze cu
          tot. Ele dispar de pe hartă. Acțiunea nu se poate anula.
        </p>
      </Dialog>
    </>
  );
}
