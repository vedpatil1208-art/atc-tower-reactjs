import {
  SCALE_NM_PER_PX,
  SEPARATION_HORIZONTAL_NM,
  SEPARATION_VERTICAL_FT,
} from './constants';

// Continuous spatial proximity sweep across all active aircraft.
// Returns a Set of aircraft ids that are currently in a separation conflict
// (less than SEPARATION_VERTICAL_FT vertical AND SEPARATION_HORIZONTAL_NM
// horizontal separation from another active aircraft), plus a list of
// conflict pair descriptions for logging.
export function detectSeparationConflicts(aircraftList) {
  const conflictIds = new Set();
  const pairs = [];

  const active = aircraftList.filter(
    (a) => a.status !== 'landed' && a.status !== 'departed' && a.status !== 'holding-pad'
  );

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      const dxPx = a.x - b.x;
      const dyPx = a.y - b.y;
      const horizontalNm = Math.sqrt(dxPx * dxPx + dyPx * dyPx) * SCALE_NM_PER_PX;
      const verticalFt = Math.abs(a.altitude - b.altitude);

      if (horizontalNm < SEPARATION_HORIZONTAL_NM && verticalFt < SEPARATION_VERTICAL_FT) {
        conflictIds.add(a.id);
        conflictIds.add(b.id);
        pairs.push({
          a: a.callsign,
          b: b.callsign,
          horizontalNm: horizontalNm.toFixed(2),
          verticalFt: verticalFt.toFixed(0),
        });
      }
    }
  }

  return { conflictIds, pairs };
}
