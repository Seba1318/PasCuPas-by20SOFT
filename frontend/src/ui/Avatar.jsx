// Poza de profil (opțională) sau, fără ea, inițiala numelui pe fond lavandă.
// Decorativă: numele e mereu scris lângă ea, deci cititoarele de ecran o sar.
const SIZES = { sm: 'h-9 w-9 text-[16px]', md: 'h-10 w-10 text-[18px]', lg: 'h-16 w-16 text-[28px]' };

export default function Avatar({ name, url, size = 'md', background = 'bg-lavender' }) {
  const box = `${SIZES[size]} flex-none rounded-chip`;
  if (url) return <img src={url} alt="" className={`${box} object-cover`} />;
  return (
    <span aria-hidden="true" className={`${box} flex items-center justify-center ${background} font-extrabold uppercase`}>
      {name[0]}
    </span>
  );
}
