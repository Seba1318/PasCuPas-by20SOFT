import Chip from '../../ui/Chip.jsx';
import { LAYERS } from './layers.js';

// Chip-urile de straturi: rând derulabil pe telefon (C1), grilă în panou pe desktop (W5).
export default function LayerChips({ active, onToggle, variant = 'panel', count = LAYERS.length }) {
  const row = variant === 'row';
  return (
    <div
      role="group"
      aria-label="Straturi pe hartă"
      className={row ? 'flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]' : 'flex flex-wrap gap-2'}
    >
      {LAYERS.slice(0, count).map((layer) => (
        <Chip
          key={layer.id}
          pressed={active.has(layer.id)}
          onToggle={() => onToggle(layer.id)}
          className={row ? 'flex-none shadow-sm' : 'h-11 px-3 text-[16px]'}
        >
          {layer.label}
        </Chip>
      ))}
    </div>
  );
}
