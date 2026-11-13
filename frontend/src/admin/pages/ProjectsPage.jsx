import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import AdminPage, { Select } from './AdminPage.jsx';
import { admin } from '../../api/endpoints.js';
import { validateProject } from '../formsUtils.js';
import { formatDate } from '../../lib/format.js';
import Field from '../../ui/Field.jsx';
import Button from '../../ui/Button.jsx';
import Dialog from '../../ui/Dialog.jsx';
import Alert from '../../ui/Alert.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import { Tag } from '../../ui/Chip.jsx';
import { useToast } from '../../ui/Toast.jsx';

const STATUS = [
  ['planificat', 'Planificat', 'info'],
  ['in_curs', 'În curs', 'warning'],
  ['finalizat', 'Finalizat', 'success'],
  ['suspendat', 'Suspendat', 'neutral'],
];
const EMPTY = { title: '', description: '', zone: '', start_date: '', end_date: '', status: 'planificat', budget: '' };

// X6: proiectele primăriei (sursa de date pentru chatbot).
export default function ProjectsPage() {
  const { show } = useToast();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null); // null = niciun formular deschis
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState(null);

  const load = () => admin.projects().then(setList).catch((e) => setError(e.detail));
  useEffect(() => {
    load();
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    const found = validateProject(form);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`p-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    const body = { ...form, budget: form.budget === '' ? null : Number(form.budget) };
    try {
      if (form.id) await admin.patchProject(form.id, body);
      else await admin.createProject(body);
      show({ tone: 'success', title: 'Proiect salvat', message: form.title });
      setForm(null);
      load();
    } catch (e) {
      setError(e.detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`grid min-h-0 flex-1 ${form ? 'grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
      <AdminPage
        title="Proiectele primăriei"
        actions={
          <Button size="sm" icon={Plus} onClick={() => { setForm(EMPTY); setErrors({}); }}>
            Proiect nou
          </Button>
        }
      >
        {error && (
          <Alert tone="error" title="ceva n-a mers">
            {error}
          </Alert>
        )}
        {!list ? (
          <Skeleton text="Se încarcă proiectele…" />
        ) : (
          <div className="overflow-x-auto rounded-card bg-surface shadow-sm hc:border-2 hc:border-border">
            <table className="w-full border-collapse text-left text-[17px]">
              <caption className="sr-only">Proiecte</caption>
              <thead>
                <tr className="border-b-2 border-border text-caption text-ink-muted">
                  <th scope="col" className="p-3 font-bold">Proiect</th>
                  <th scope="col" className="p-3 font-bold">Perioadă</th>
                  <th scope="col" className="p-3 font-bold">Status</th>
                  <th scope="col" className="p-3 font-bold">Buget</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const st = STATUS.find((s) => s[0] === p.status) ?? STATUS[0];
                  return (
                    <tr key={p.id} className={`border-b border-border ${form?.id === p.id ? 'bg-info-bg' : ''}`}>
                      <td className="p-3">
                        <button type="button" onClick={() => { setForm({ ...EMPTY, ...p, budget: p.budget ?? '' }); setErrors({}); }} className="flex flex-col items-start text-left">
                          <span className="font-bold text-info underline underline-offset-2">{p.title}</span>
                          <span className="text-caption text-ink-muted">{p.zone}</span>
                        </button>
                      </td>
                      <td className="p-3">
                        {formatDate(p.start_date)} – {p.end_date ? formatDate(p.end_date) : 'nestabilit'}
                      </td>
                      <td className="p-3">
                        <Tag tone={st[2]}>{st[1]}</Tag>
                      </td>
                      <td className="p-3">{p.budget == null ? '—' : `${new Intl.NumberFormat('ro-RO').format(p.budget)} lei`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPage>
      {form && (
        <aside aria-labelledby="pf-title" className="flex flex-col gap-4 overflow-y-auto border-l border-border bg-surface p-5 hc:border-l-[3px]">
          <h2 id="pf-title" className="m-0 text-title-3">
            {form.id ? 'Editează proiectul' : 'Proiect nou'}
          </h2>
          <Field id="p-title" label="Titlu" value={form.title} onChange={(e) => set({ title: e.target.value })} error={errors.title} />
          <Field id="p-description" label="Descriere" multiline optional value={form.description} onChange={(e) => set({ description: e.target.value })} />
          <Field id="p-zone" label="Zona" optional value={form.zone} onChange={(e) => set({ zone: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="p-start_date" label="Început" type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} error={errors.start_date} />
            <Field id="p-end_date" label="Final estimat" type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} error={errors.end_date} />
          </div>
          <Select id="p-status" label="Status" value={form.status} onChange={(v) => set({ status: v })} options={STATUS.map(([v, l]) => [v, l])} />
          <Field id="p-budget" label="Buget, în lei" optional inputMode="numeric" value={form.budget} onChange={(e) => set({ budget: e.target.value.replace(/\D/g, '') })} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setForm(null)}>
              Renunță
            </Button>
            <Button loading={busy} loadingText="Se salvează…" onClick={save} className="flex-1">
              Salvează proiectul
            </Button>
          </div>
          {form.id && (
            <Button variant="text" icon={Trash2} onClick={() => setToDelete(form)}>
              Șterge proiectul
            </Button>
          )}
        </aside>
      )}
      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Ștergi proiectul?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Renunță
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await admin.deleteProject(toDelete.id).catch((e) => setError(e.detail));
                setToDelete(null);
                setForm(null);
                load();
              }}
            >
              Șterge proiectul
            </Button>
          </>
        }
      >
        „{toDelete?.title}” nu va mai apărea în răspunsurile despre proiectele primăriei.
      </Dialog>
    </div>
  );
}
