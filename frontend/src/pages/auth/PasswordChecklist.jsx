import { Check, X } from 'lucide-react';
import { passwordChecks } from '../../auth/validation.js';

// Cerințele parolei, bifate pe măsură ce scrii: iconiță + text, nu doar culoare.
export default function PasswordChecklist({ id, password }) {
  const checks = passwordChecks(password);
  const rows = [
    ['length', 'Cel puțin 8 caractere'],
    ['digit', 'Cel puțin o cifră'],
  ];
  return (
    <ul id={id} className="m-0 flex list-none flex-col gap-1 p-0">
      {rows.map(([key, label]) => {
        const ok = checks[key];
        const Icon = ok ? Check : X;
        return (
          <li key={key} className={`flex items-center gap-2 text-caption ${ok ? 'font-semibold text-success' : 'text-ink-muted'}`}>
            <Icon aria-hidden="true" className="h-5 w-5 flex-none" strokeWidth={3} />
            {label}
            <span className="sr-only">{ok ? ': îndeplinit' : ': încă nu'}</span>
          </li>
        );
      })}
    </ul>
  );
}
