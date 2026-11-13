import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import BackLink from '../../ui/BackLink.jsx';
import SearchResults from './SearchResults.jsx';

// C3–C5: ecranul de căutare de pe telefon, peste hartă. Textul stă în URL (?q=), ca „Înapoi” să-l păstreze.
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const input = useRef(null);
  useEffect(() => input.current?.focus(), []);

  const setQuery = (q) => setParams(q ? { q } : {}, { replace: true });

  return (
    <div className="absolute inset-0 z-[1050] flex flex-col gap-3 overflow-y-auto bg-bg px-4 pb-6 pt-4">
      <h1 className="sr-only">Căutare</h1>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="search-q" className="text-label">
          Caută un loc sau o adresă
        </label>
        <div className="flex items-center gap-1">
          <BackLink to="/" label="Înapoi" />
          <div className="relative flex flex-1">
            <input
              ref={input}
              id="search-q"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-14 w-full rounded-field border-2 border-border-strong bg-surface pl-4 pr-24 text-[18px] text-ink [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  input.current?.focus();
                }}
                className="absolute right-1 top-1 flex h-12 items-center gap-1 rounded-icon px-2.5 text-[17px] font-bold hover:bg-subtle"
              >
                <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
                Șterge
              </button>
            )}
          </div>
        </div>
      </div>
      <SearchResults query={query} />
    </div>
  );
}
