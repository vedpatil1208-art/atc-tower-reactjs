// Maps a flight strip drag-and-drop gesture (source panel -> target panel)
// onto an equivalent controller command string, so dropping a strip onto a
// new status panel is handled by the same parser/validation path as typed
// or spoken commands.

export function getCurrentPanelKey(aircraft) {
  if (aircraft.emergency) return 'emergency';
  if (['final', 'landed'].includes(aircraft.status)) return 'final';
  if (['enroute', 'holding', 'approach'].includes(aircraft.status)) return 'airborne';
  if (['taxi', 'holding-short'].includes(aircraft.status)) return 'ground';
  if (['departure', 'departed'].includes(aircraft.status)) return 'departure';
  return null;
}

function pickRunway(runways, statusFilter) {
  const runway = statusFilter
    ? runways.find((r) => r.status === statusFilter) || runways[0]
    : runways[0];
  return runway ? runway.id : null;
}

const DRAG_TRANSITIONS = {
  'airborne->final': (aircraft, runways) => {
    const rwy = aircraft.assignedRunway || pickRunway(runways, 'clear');
    if (!rwy) return null;
    return `${aircraft.callsign} CLEAR LAND ${rwy}`;
  },
  'final->airborne': (aircraft) => {
    if (aircraft.status !== 'final') return null;
    return `${aircraft.callsign} GO AROUND`;
  },
  'final->ground': (aircraft, runways) => {
    if (aircraft.status !== 'landed') return null;
    const rwy = pickRunway(runways);
    if (!rwy) return null;
    return `${aircraft.callsign} TAXI ${rwy}`;
  },
  'ground->departure': (aircraft, runways) => {
    const rwy = aircraft.assignedRunway || pickRunway(runways, 'clear');
    if (!rwy) return null;
    return `${aircraft.callsign} CLEAR TAKEOFF ${rwy}`;
  },
  'airborne->emergency': (aircraft) => `${aircraft.callsign} DECLARE EMERGENCY`,
  'ground->emergency': (aircraft) => `${aircraft.callsign} DECLARE EMERGENCY`,
  'final->emergency': (aircraft) => `${aircraft.callsign} DECLARE EMERGENCY`,
  'departure->emergency': (aircraft) => `${aircraft.callsign} DECLARE EMERGENCY`,
  'emergency->airborne': (aircraft) => `${aircraft.callsign} CANCEL EMERGENCY`,
  'emergency->final': (aircraft) => `${aircraft.callsign} CANCEL EMERGENCY`,
  'emergency->ground': (aircraft) => `${aircraft.callsign} CANCEL EMERGENCY`,
  'emergency->departure': (aircraft) => `${aircraft.callsign} CANCEL EMERGENCY`,
};

export function getDragCommand(aircraft, fromPanel, toPanel, runways) {
  if (fromPanel === toPanel) return null;
  const builder = DRAG_TRANSITIONS[`${fromPanel}->${toPanel}`];
  if (!builder) return null;
  return builder(aircraft, runways);
}

export function getValidDropPanels(aircraft, runways, panelKeys) {
  const fromPanel = getCurrentPanelKey(aircraft);
  return panelKeys.filter((toPanel) => !!getDragCommand(aircraft, fromPanel, toPanel, runways));
}
