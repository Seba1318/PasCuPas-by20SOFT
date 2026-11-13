# Accesibilitate — rezultatele verificării (frontend)

Verificare făcută pe 18 octombrie 2026, pe modul mock, cu **axe-core 4.10** (reguli WCAG 2.0 A/AA și WCAG 2.1 AA), rulat în browser pe fiecare rută.

## Automat (axe)

| Ce | Lățimi | Teme | Rezultat |
|---|---|---|---|
| Hartă, căutare, fișă loc, fișă stație, traseu (pe jos și cu transport), raportare, pagina raportului, profil, rapoartele mele, confidențialitate, profil de nevoi | 1440 | luminos, întunecat, contrast ridicat | 0 încălcări |
| Autentificare, înregistrare, parolă uitată, link expirat, bun venit, hartă, căutare, raportare, rapoartele mele, profil | 375 | luminos | 0 încălcări |
| Administrare: prezentare, rapoarte, hartă, lucrări, proiecte, dotări, străzi, vehicule, statistici, utilizatori, instituții | 1440 | luminos, contrast ridicat | 0 încălcări |

Probleme găsite și corectate în timpul verificării:

- câmpurile „De la” / „Până la” aveau `aria-expanded` fără rol de combobox și `aria-controls` spre o listă ascunsă;
- miniharta era `aria-hidden`, dar conținea un link focusabil (atribuirea OSM);
- linkurile din atribuirea hărții se distingeau doar prin culoare (acum sunt subliniate);
- în contrast ridicat, insigna liniei pentru un vehicul nepotrivit era galben pe alb.

Axe nu poate verifica tot. Ce urmează se face de mână.

## Manual — de făcut înainte de demo (Observații §3 și §12)

- [ ] VoiceOver pe iPhone: autentificare, căutare, traseu, raport (cu poză), navigare simulată.
- [ ] TalkBack pe Android: aceleași fluxuri.
- [ ] Doar tastatura pe desktop: Tab prin toate paginile, scurtăturile `/ [ L + − ?`, Esc închide fișele și dialogurile, focusul revine pe butonul care a deschis dialogul.
- [ ] `prefers-reduced-motion`: harta nu animă zoom-ul, nimic nu glisează.
- [ ] Zoom 200 % în browser: nimic nu se suprapune, nimic nu cere derulare orizontală (în afara tabelelor de admin).
- [ ] O sesiune scurtă cu un utilizator în scaun cu rotile și unul cu vedere slabă.
- [ ] Lighthouse ≥ 90 la accesibilitate pe `/`, `/traseu`, `/raporteaza`, `/admin/rapoarte`.

## Cum se repetă verificarea automată

Cu `npm run dev` pornit, în consola browserului, pe orice pagină:

```js
await new Promise((ok) => { const s = document.createElement('script'); s.src = '/node_modules/axe-core/axe.min.js'; s.onload = ok; document.head.append(s); });
(await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations
```
