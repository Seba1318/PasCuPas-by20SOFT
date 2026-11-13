import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';

// design/Componente-Controale: înălțime 56 (48 pentru „sm”), rază 16, text 18/700.
const VARIANTS = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed shadow-sm border-2 border-transparent hc:border-border',
  secondary:
    'bg-surface text-ink border-2 border-border-strong hover:bg-subtle hover:border-ink active:bg-border',
  text: 'bg-transparent text-info underline underline-offset-2 hover:bg-info-bg hover:text-info-strong border-2 border-transparent',
  danger: 'bg-error text-on-error hover:bg-error-hover active:bg-error-pressed border-2 border-transparent',
};

const SIZES = {
  md: 'h-14 px-5 gap-2.5 text-[18px]',
  sm: 'h-12 px-4 gap-2 text-[17px]',
};

const DISABLED = 'disabled:cursor-not-allowed disabled:border-line-soft disabled:bg-subtle disabled:text-ink-muted disabled:shadow-none';

export function buttonClasses({ variant = 'primary', size = 'md', full = false, className = '' } = {}) {
  return [
    'inline-flex min-h-target min-w-target items-center justify-center rounded-field font-bold no-underline transition-colors',
    VARIANTS[variant],
    SIZES[size],
    DISABLED,
    full ? 'w-full' : '',
    className,
  ].join(' ');
}

/**
 * Buton cu text mereu vizibil. `icon` e o componentă Lucide, ascunsă cititoarelor de ecran.
 * `loading` păstrează butonul pe loc, pune aria-busy și schimbă textul (de ex. „Se caută…”).
 */
const Button = forwardRef(function Button(
  { variant, size, full, icon: Icon, loading = false, loadingText, children, className, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, full, className })}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="h-[22px] w-[22px] motion-safe:animate-spin" strokeWidth={2.5} />
      ) : (
        Icon && <Icon aria-hidden="true" className="h-6 w-6 flex-none" strokeWidth={2.5} />
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
});

export default Button;

// Link care arată ca un buton (de ex. „Nu ai cont? Creează unul”).
export function ButtonLink({ to, variant = 'secondary', size, full, icon: Icon, children, className, ...rest }) {
  return (
    <Link to={to} className={buttonClasses({ variant, size, full, className })} {...rest}>
      {Icon && <Icon aria-hidden="true" className="h-6 w-6 flex-none" strokeWidth={2.5} />}
      <span>{children}</span>
    </Link>
  );
}
