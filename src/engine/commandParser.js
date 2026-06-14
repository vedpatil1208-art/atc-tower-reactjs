// Command Syntax State Machine Parser
//
// Accepts free-form controller macros such as:
//   "AA-104 clear land RWY-09L"
//   "DL-442 fly heading 180"
//   "UA210 climb and maintain 8000"
//   "BA256 hold position"
//   "SW489 set speed 220"
//   "JB1822 clear takeoff RWY-09R"
//
// Tokens are normalized (uppercased, filler words stripped), matched
// against a small grammar table, then validated against current airport
// state before producing a patch the store can apply atomically.

const FILLER_WORDS = new Set(['TO', 'AND', 'FOR', 'THE', 'MAINTAIN', 'A']);

function normalizeCallsign(token) {
  return token.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function normalizeRunway(token) {
  return token.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function tokenize(raw) {
  return raw
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !FILLER_WORDS.has(t));
}

function findAircraft(aircraftList, callsign) {
  const target = normalizeCallsign(callsign);
  return aircraftList.find((a) => normalizeCallsign(a.callsign) === target);
}

function findRunway(runways, runwayToken) {
  const target = normalizeRunway(runwayToken);
  return runways.find((r) => normalizeRunway(r.id) === target);
}

const FINISHED_STATUSES = new Set(['landed', 'departed', 'holding-pad']);

// Returns:
//   { ok: true, message, aircraftId, patch, runwayId?, runwayPatch? }
//   { ok: false, message }
export function parseCommand(rawText, state) {
  const tokens = tokenize(rawText);

  if (tokens.length < 2) {
    return { ok: false, message: 'SYNTAX ERROR - expected "<CALLSIGN> <ACTION> ..."' };
  }

  const [csToken, ...rest] = tokens;
  const aircraft = findAircraft(state.aircraft, csToken);
  if (!aircraft) {
    return { ok: false, message: `UNKNOWN CALLSIGN "${csToken}" - NOT ON FREQUENCY` };
  }
  if (FINISHED_STATUSES.has(aircraft.status)) {
    return { ok: false, message: `${aircraft.callsign} - AIRCRAFT NO LONGER ACTIVE` };
  }

  const verb = rest[0];

  // --- CLEAR LAND / CLEAR TAKEOFF ---
  if (verb === 'CLEAR') {
    const action = rest[1]; // LAND | TAKEOFF
    const rwyToken = rest[2];
    if (!rwyToken) {
      return { ok: false, message: 'SYNTAX ERROR - expected "CLEAR LAND|TAKEOFF RWY-XX"' };
    }
    const runway = findRunway(state.runways, rwyToken);
    if (!runway) {
      return { ok: false, message: `UNKNOWN RUNWAY "${rwyToken}"` };
    }

    if (action === 'LAND') {
      if (!['enroute', 'approach', 'final', 'holding'].includes(aircraft.status)) {
        return { ok: false, message: `${aircraft.callsign} - CANNOT ISSUE LANDING CLEARANCE FROM STATUS "${aircraft.status.toUpperCase()}"` };
      }
      if (runway.status === 'occupied' && runway.occupiedBy !== aircraft.id) {
        return { ok: false, message: `${runway.id} OCCUPIED - LANDING CLEARANCE DENIED FOR ${aircraft.callsign}` };
      }
      if (runway.status === 'emergency') {
        return { ok: false, message: `${runway.id} CLOSED FOR EMERGENCY - LANDING CLEARANCE DENIED` };
      }
      return {
        ok: true,
        message: `${aircraft.callsign} CLEARED TO LAND ${runway.id}`,
        aircraftId: aircraft.id,
        patch: {
          clearance: 'land',
          assignedRunway: runway.id,
          status: 'final',
          targetHeading: runway.heading,
          targetAltitude: 0,
          climbDescentRate: 1200,
          targetSpeed: Math.min(aircraft.targetSpeed, 170),
        },
      };
    }

    if (action === 'TAKEOFF') {
      if (!['taxi', 'holding-short'].includes(aircraft.status)) {
        return { ok: false, message: `${aircraft.callsign} - NOT HOLDING SHORT, CANNOT ISSUE TAKEOFF CLEARANCE` };
      }
      if (runway.status === 'occupied' && runway.occupiedBy !== aircraft.id) {
        return { ok: false, message: `${runway.id} OCCUPIED - TAKEOFF CLEARANCE DENIED FOR ${aircraft.callsign}` };
      }
      return {
        ok: true,
        message: `${aircraft.callsign} CLEARED FOR TAKEOFF ${runway.id}`,
        aircraftId: aircraft.id,
        patch: {
          clearance: 'takeoff',
          assignedRunway: runway.id,
          status: 'departure',
          heading: runway.heading,
          targetHeading: runway.heading,
          targetSpeed: 250,
          targetAltitude: 10000,
          climbDescentRate: 1800,
        },
        runwayId: runway.id,
        runwayPatch: { status: 'occupied', occupiedBy: aircraft.id },
      };
    }

    return { ok: false, message: 'SYNTAX ERROR - expected "CLEAR LAND|TAKEOFF RWY-XX"' };
  }

  // --- FLY HEADING <deg> ---
  if (verb === 'FLY' && rest[1] === 'HEADING') {
    const deg = Number(rest[2]);
    if (!Number.isFinite(deg) || deg < 0 || deg > 360) {
      return { ok: false, message: 'INVALID HEADING - MUST BE 0-360' };
    }
    return {
      ok: true,
      message: `${aircraft.callsign} FLY HEADING ${String(deg).padStart(3, '0')}`,
      aircraftId: aircraft.id,
      patch: { targetHeading: deg % 360, clearance: null },
    };
  }

  // --- CLIMB / DESCEND <alt> ---
  if (verb === 'CLIMB' || verb === 'DESCEND') {
    const alt = Number(rest[rest.length - 1]);
    if (!Number.isFinite(alt) || alt < 0 || alt > 41000) {
      return { ok: false, message: 'INVALID ALTITUDE - MUST BE 0-41000 FT' };
    }
    if (verb === 'CLIMB' && alt < aircraft.altitude) {
      return { ok: false, message: `${aircraft.callsign} - "${alt}" IS BELOW CURRENT ALTITUDE, USE DESCEND` };
    }
    if (verb === 'DESCEND' && alt > aircraft.altitude) {
      return { ok: false, message: `${aircraft.callsign} - "${alt}" IS ABOVE CURRENT ALTITUDE, USE CLIMB` };
    }
    return {
      ok: true,
      message: `${aircraft.callsign} ${verb} AND MAINTAIN ${alt}`,
      aircraftId: aircraft.id,
      patch: { targetAltitude: alt, climbDescentRate: 1500 },
    };
  }

  // --- HOLD POSITION ---
  if (verb === 'HOLD' && rest[1] === 'POSITION') {
    return {
      ok: true,
      message: `${aircraft.callsign} HOLD POSITION`,
      aircraftId: aircraft.id,
      patch: { targetSpeed: 0, status: aircraft.status === 'taxi' ? 'holding-short' : aircraft.status },
    };
  }

  // --- SET SPEED <kts> ---
  if ((verb === 'SET' && rest[1] === 'SPEED') || (verb === 'REDUCE' && rest[1] === 'SPEED') || (verb === 'INCREASE' && rest[1] === 'SPEED')) {
    const kts = Number(rest[rest.length - 1]);
    if (!Number.isFinite(kts) || kts < 0 || kts > 500) {
      return { ok: false, message: 'INVALID SPEED - MUST BE 0-500 KTS' };
    }
    return {
      ok: true,
      message: `${aircraft.callsign} SPEED ${kts}`,
      aircraftId: aircraft.id,
      patch: { targetSpeed: kts },
    };
  }

  // --- TAXI RWY-XX ---
  if (verb === 'TAXI') {
    const rwyToken = rest[rest.length - 1];
    const runway = findRunway(state.runways, rwyToken);
    if (!runway) {
      return { ok: false, message: `UNKNOWN RUNWAY "${rwyToken}"` };
    }
    return {
      ok: true,
      message: `${aircraft.callsign} TAXI TO ${runway.id}`,
      aircraftId: aircraft.id,
      patch: { status: 'holding-short', assignedRunway: runway.id, targetSpeed: 0 },
    };
  }

  // --- GO AROUND ---
  if (verb === 'GO' && rest[1] === 'AROUND') {
    return {
      ok: true,
      message: `${aircraft.callsign} GO AROUND`,
      aircraftId: aircraft.id,
      patch: {
        status: 'enroute',
        clearance: null,
        assignedRunway: null,
        targetAltitude: 3000,
        climbDescentRate: 1500,
        targetSpeed: 220,
      },
    };
  }

  return { ok: false, message: `SYNTAX ERROR - UNRECOGNIZED COMMAND "${rest.join(' ')}"` };
}
