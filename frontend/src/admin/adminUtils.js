// Regulile panoului de administrare (design/AdminSide; Observații §9).
// Permisiunile reale se verifică pe server; aici doar nu arătăm ce nu e permis.

export const ADMIN_NAV = [
  { id: 'prezentare', label: 'Prezentare', to: '/admin', who: 'all' },
  { id: 'rapoarte', label: 'Rapoarte', to: '/admin/rapoarte', who: 'all' },
  { id: 'harta', label: 'Hartă', to: '/admin/harta', who: 'all' },
  { id: 'lucrari', label: 'Lucrări', to: '/admin/lucrari', who: 'primarie' },
  { id: 'proiecte', label: 'Proiecte', to: '/admin/proiecte', who: 'primarie' },
  { id: 'dotari', label: 'Dotări și locații', to: '/admin/dotari', who: 'all' },
  { id: 'vehicule', label: 'Vehicule', to: '/admin/vehicule', who: 'transport' },
  { id: 'statistici', label: 'Statistici', to: '/admin/statistici', who: 'all' },
  { id: 'utilizatori', label: 'Utilizatori și instituții', to: '/admin/utilizatori', who: 'super' },
];

export const isAdmin = (user) => user?.role === 'admin' || user?.role === 'superadmin';

export function canAccess(user, sectionId) {
  if (!isAdmin(user)) return false;
  if (user.role === 'superadmin') return true;
  const item = ADMIN_NAV.find((i) => i.id === sectionId);
  if (!item) return false;
  if (item.who === 'all') return true;
  if (item.who === 'super') return false;
  return user.institution?.type === item.who;
}

export const visibleNav = (user) => ADMIN_NAV.filter((i) => canAccess(user, i.id));

export function scoreLevel(score) {
  if (score >= 80) return { label: 'Ridicat', tone: 'success' };
  if (score >= 50) return { label: 'Mediu', tone: 'warning' };
  return { label: 'Scăzut', tone: 'neutral' };
}

// Planul 20SOFT · Verificări automate: AI 0–60, data din EXIF 0–20, locația 0–20.
export function scoreParts({ ai, date, location }) {
  return [
    ['AI', ai, 60],
    ['Dată', date, 20],
    ['Locație', location, 20],
  ].map(([key, value, max]) => ({ key, value, max, text: `${key} ${value} din ${max}` }));
}

export function roleLabel(user) {
  if (user?.role === 'superadmin') return 'Superadministrator';
  return `Administrator · ${user?.institution?.name ?? ''}`.trim();
}
