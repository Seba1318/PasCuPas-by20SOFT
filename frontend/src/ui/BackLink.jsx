import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function BackLink({ to, label = 'Înapoi', className = '' }) {
  return (
    <Link
      to={to}
      className={`-ml-2 flex min-h-target min-w-target flex-none items-center gap-0.5 rounded-[14px] pl-1 pr-3 text-[17px] font-bold text-ink no-underline hover:bg-subtle hover:text-ink ${className}`}
    >
      <ChevronLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
      {label}
    </Link>
  );
}
