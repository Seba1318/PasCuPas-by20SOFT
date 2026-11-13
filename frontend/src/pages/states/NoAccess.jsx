import EmptyState from '../../ui/EmptyState.jsx';
import { ButtonLink } from '../../ui/Button.jsx';

// X13: cineva deschide direct un URL pentru care contul nu are drepturi.
export default function NoAccess() {
  return (
    <div className="absolute inset-0 z-[1050] flex items-center justify-center overflow-y-auto bg-bg p-6 md:static md:flex-1 md:bg-transparent">
      <EmptyState
        role="alert"
        headingLevel={1}
        spot="key"
        title="Nu ai acces la această secțiune"
        actions={
          <ButtonLink to="/" variant="primary" full>
            Înapoi la hartă
          </ButtonLink>
        }
      >
        Contul tău nu are drepturi pentru pagina asta. Dacă ai nevoie de acces, cere-l unui superadmin.
      </EmptyState>
    </div>
  );
}
