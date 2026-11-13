import { Outlet } from 'react-router-dom';
import Footer from './Footer.jsx';

// Pagini fără hartă (profil, rapoartele mele, confidențialitate): conținut centrat, derulabil.
export default function PageLayout({ wide = false }) {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className={`mx-auto flex min-h-full flex-col gap-6 px-4 py-6 md:px-8 md:py-10 ${wide ? 'max-w-[1120px]' : 'max-w-[720px]'}`}>
        <Outlet />
        <Footer className="mt-auto pt-6" />
      </div>
    </main>
  );
}
