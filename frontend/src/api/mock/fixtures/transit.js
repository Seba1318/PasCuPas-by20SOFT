// Stații și sosiri de exemplu. Liniile reale vin din GTFS-ul SMTT.
const stop = (id, name, coordinates, extra) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates },
  properties: { id, name, wheelchair_boarding: true, has_tactile: true, has_display: true, ...extra },
});

export const stops = [
  stop(1, 'Complex Studențesc', [21.2372, 45.7482]),
  stop(2, 'Piața Victoriei', [21.2250, 45.7531], { has_tactile: false }),
];

// Sosirile se calculează față de ora curentă, ca demo-ul să arate mereu „în 4 min”.
const inMinutes = (m) => new Date(Date.now() + m * 60000).toISOString();
const vehicle = (label, extra = {}) => ({
  id: label, label, has_ramp: true, ramp_ok: true, low_floor: true,
  has_audio_announce: true, audio_ok: true, has_visual_display: true, ...extra,
});

export function arrivalsFor(stopId) {
  const table = {
    1: [
      { trip_id: 11, route: '1', type: 'Tramvai', headsign: 'Piața Victoriei', arrival_time: inMinutes(4), vehicle: vehicle('V-1042') },
      { trip_id: 12, route: '14', type: 'Troleibuz', headsign: 'Gara de Nord', arrival_time: inMinutes(9), vehicle: vehicle('V-2210', { ramp_ok: false }) },
      { trip_id: 13, route: '1', type: 'Tramvai', headsign: 'Piața Victoriei', arrival_time: inMinutes(16), vehicle: vehicle('V-1043', { audio_ok: false }) },
    ],
    2: [
      { trip_id: 21, route: '1', type: 'Tramvai', headsign: 'Complex Studențesc', arrival_time: inMinutes(6), vehicle: vehicle('V-1044') },
    ],
  };
  return table[stopId] ?? [];
}
