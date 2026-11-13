import { useEffect, useId, useState } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import { useSearch } from '../search/useSearch.js';

/**
 * Câmp de loc pentru traseu: scrii, alegi din listă (locuri și adrese) sau „Poziția mea”.
 * value = { name, point: [lon, lat] } | null.
 */
export default function PlaceInput({ id, label, value, onChange, onUseMyPosition, error }) {
  const [text, setText] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { results, status } = useSearch(open ? text : '');

  useEffect(() => setText(value?.name ?? ''), [value?.name]);

  const choose = (r) => {
    onChange({ name: r.name, point: r.geometry.coordinates });
    setText(r.name);
    setOpen(false);
  };

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-controls={open ? listId : undefined}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setText(value?.name ?? '');
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className={`h-[52px] w-full rounded-field border-2 bg-surface px-4 text-[18px] text-ink ${error ? 'border-error' : 'border-border-strong'}`}
      />
      {error && (
        <span id={`${id}-error`} className="text-[17px] font-semibold text-error">
          {error}
        </span>
      )}
      {open && (
        <ul id={listId} aria-label={`Sugestii pentru „${label}”`} className="absolute inset-x-0 top-full z-20 m-0 mt-1 max-h-72 list-none overflow-y-auto rounded-field border-2 border-border bg-surface p-1 shadow-lg">
          {onUseMyPosition && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onUseMyPosition();
                }}
                className="flex min-h-12 w-full items-center gap-2.5 rounded-icon px-3 text-left text-[18px] font-bold hover:bg-subtle"
              >
                <LocateFixed aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
                Poziția mea
              </button>
            </li>
          )}
          {status === 'loading' && <li className="px-3 py-2 text-ink-muted">Căutăm…</li>}
          {status === 'empty' && <li className="px-3 py-2 text-ink-muted">Niciun rezultat în zona acoperită.</li>}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                className="flex min-h-12 w-full items-center gap-2.5 rounded-icon px-3 py-1.5 text-left hover:bg-subtle"
              >
                <MapPin aria-hidden="true" className="h-5 w-5 flex-none" strokeWidth={2.5} />
                <span className="flex flex-col">
                  <span className="text-[18px] font-semibold">{r.name}</span>
                  {r.address && <span className="text-caption text-ink-muted">{r.address}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
