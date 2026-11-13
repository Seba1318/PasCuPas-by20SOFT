import { USE_MOCKS } from '../config/env.js';

// Observații §11: datele de exemplu trebuie marcate clar. Apare doar cât aplicația rulează pe mock.
export default function DemoBadge() {
  if (!USE_MOCKS) return null;
  return (
    <p className="m-0 flex-none border-b border-border bg-lavender px-4 py-1 text-center text-caption font-semibold text-ink">
      Mod demo: adresele, rapoartele și orarele sunt date de exemplu, nu reale.
    </p>
  );
}
