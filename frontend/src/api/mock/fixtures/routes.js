// Traseul de demo: Căminul 1 → Rectoratul UPT, ocolind scările (cifre de exemplu).
export const demoRoute = {
  route: {
    type: 'LineString',
    coordinates: [
      [21.2389, 45.7469], [21.2372, 45.7478], [21.2340, 45.7479], [21.2311, 45.7476],
      [21.2285, 45.7480], [21.2275, 45.7500], [21.2268, 45.7520], [21.2263, 45.7535],
    ],
  },
  length_m: 1200,
  duration_min: 16,
  extra_m: 150,
  explanation: 'Traseu cu 150 m mai lung, evită scările de lângă Rectorat.',
  steps: [
    { instruction: 'Pornește spre vest pe Aleea Studenților', distance_m: 180, coord: [21.2389, 45.7469] },
    { instruction: 'Treci pe lângă cantină și continuă înainte', distance_m: 400, coord: [21.2372, 45.7478] },
    { instruction: 'Virează la dreapta pe Bd. Vasile Pârvan', distance_m: 300, coord: [21.2285, 45.7480] },
    { instruction: 'Traversează la semaforul sonor', distance_m: 250, coord: [21.2268, 45.7520] },
    { instruction: 'Ai ajuns la rampa de la intrarea de est a Rectoratului', distance_m: 0, coord: [21.2263, 45.7535] },
  ],
  warnings: [{ type: 'incline', text: 'Pantă de 5 % pe 40 m, lângă podul de pe Bega.', coord: [21.2275, 45.7500] }],
  avoided: {
    geometry: { type: 'LineString', coordinates: [[21.2285, 45.7480], [21.2259, 45.7510], [21.2257, 45.7533]] },
    reason: '3 trepte lângă Rectorat',
    stairs_at: [21.2257, 45.7530],
  },
};
