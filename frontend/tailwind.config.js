// Tokenii din design/Culori.dc.html și design/Fundatii.dc.html.
// Valorile reale stau ca variabile CSS în src/styles/index.css, pe teme;
// componentele folosesc doar numele de mai jos, niciodată hex.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens: { sm: '390px', md: '768px', lg: '1280px', xl: '1440px' },
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        border: { DEFAULT: v('border'), strong: v('border-strong') },
        ink: { DEFAULT: v('ink'), muted: v('ink-muted') },
        primary: { DEFAULT: v('primary'), hover: v('primary-hover'), pressed: v('primary-pressed') },
        'on-primary': v('on-primary'),
        route: { DEFAULT: v('route'), casing: v('route-casing'), blocked: v('route-blocked') },
        focus: v('focus'),
        info: { DEFAULT: v('info'), strong: v('info-strong'), bg: v('info-bg') },
        success: { DEFAULT: v('success'), bg: v('success-bg') },
        warning: { DEFAULT: v('warning'), bg: v('warning-bg') },
        error: { DEFAULT: v('error'), bg: v('error-bg'), hover: v('error-hover'), pressed: v('error-pressed') },
        'on-error': v('on-error'),
        subtle: v('subtle'),
        'line-soft': v('line-soft'),
        skeleton: v('skeleton'),
        problem: { DEFAULT: v('problem'), ink: v('problem-ink') },
        peach: v('peach'),
        mint: v('mint'),
        sky: v('sky'),
        lavender: v('lavender'),
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible Next"', 'Lexend', 'system-ui', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        display: ['40px', { lineHeight: '48px', fontWeight: '800' }],
        'display-sm': ['32px', { lineHeight: '40px', fontWeight: '800' }],
        'title-1': ['32px', { lineHeight: '40px', fontWeight: '700' }],
        'title-1-sm': ['28px', { lineHeight: '36px', fontWeight: '700' }],
        'title-2': ['26px', { lineHeight: '34px', fontWeight: '700' }],
        'title-2-sm': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'title-3': ['22px', { lineHeight: '30px', fontWeight: '700' }],
        'body-lg': ['20px', '30px'],
        body: ['18px', '28px'],
        label: ['17px', { lineHeight: '24px', fontWeight: '600' }],
        caption: ['16px', '24px'],
      },
      borderRadius: { icon: '12px', field: '16px', card: '20px', sheet: '24px', chip: '999px' },
      minHeight: { target: '48px' },
      minWidth: { target: '48px' },
      boxShadow: {
        sm: '0 1px 2px rgb(30 41 59 / 0.06)',
        md: '0 4px 12px rgb(30 41 59 / 0.10)',
        lg: '0 12px 32px rgb(30 41 59 / 0.16)',
      },
      transitionDuration: { fast: '150ms', DEFAULT: '200ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    },
  },
  plugins: [
    // hc: = contrast ridicat (ales din profil sau din prefers-contrast), dark: = tema întunecată
    ({ addVariant }) => {
      addVariant('hc', ':root[data-contrast="high"] &');
      addVariant('dark', ':root[data-theme="dark"] &');
    },
  ],
};
