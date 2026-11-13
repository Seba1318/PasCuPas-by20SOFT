// Ajutoare pentru ecranul de navigare: simularea mersului (doar în modul demo),
// tipul manevrei pentru iconiță și ora de sosire.
import { distanceM } from '../components/map/geo.js';
import { formatTime } from '../lib/format.js';

// Puncte la fiecare `stepM` metri de-a lungul liniei, ca pozițiile unui om care merge.
export function pointsAlong(line, stepM = 12) {
  const out = [line[0]];
  let carry = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const len = distanceM(a, b);
    let d = stepM - carry;
    while (d < len) {
      const t = d / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += stepM;
    }
    carry = len - (d - stepM);
  }
  const end = line[line.length - 1];
  if (distanceM(out[out.length - 1], end) > 1) out.push(end);
  else out[out.length - 1] = end;
  return out;
}

export function maneuverOf(instruction) {
  const t = instruction.toLowerCase();
  if (t.includes('ajuns')) return 'arrive';
  if (t.includes('stânga')) return 'left';
  if (t.includes('dreapta')) return 'right';
  if (t.includes('traversează')) return 'cross';
  return 'straight';
}

export function etaClock(minutes, now = new Date()) {
  return formatTime(new Date(now.getTime() + minutes * 60000).toISOString());
}
