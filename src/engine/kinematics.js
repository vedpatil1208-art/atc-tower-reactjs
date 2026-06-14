import {
  SCALE_NM_PER_PX,
  SIM_TIME_MULTIPLIER,
  TURN_RATE_DEG_PER_SEC,
  ACCEL_KTS_PER_SEC,
  TRAIL_LENGTH,
  RADAR_WIDTH,
  RADAR_HEIGHT,
  FUEL_BURN_AIRBORNE_PER_SEC,
  FUEL_BURN_GROUND_PER_SEC,
} from './constants';

const GROUND_STATUSES = new Set(['taxi', 'holding-short', 'landed', 'departed']);

// Converts a compass heading (0 = N, 90 = E, clockwise) into a standard
// math angle theta (0 = +X axis, counter-clockwise) used by cos/sin.
export function headingToTheta(headingDeg) {
  return ((90 - headingDeg) * Math.PI) / 180;
}

function normalizeHeading(deg) {
  return ((deg % 360) + 360) % 360;
}

// Shortest signed angular distance from a -> b, in degrees, range (-180, 180]
function angleDiff(a, b) {
  let diff = (b - a) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

// Advances a single aircraft's flight vector by dtSeconds of real time.
// Implements:
//   deltaX = speed * cos(theta) * deltaT
//   deltaY = speed * sin(theta) * deltaT
//   deltaAltitude = descentRate * deltaT
export function stepAircraft(aircraft, dtSeconds) {
  if (aircraft.status === 'landed' || aircraft.status === 'departed' || aircraft.status === 'holding-pad') {
    return aircraft;
  }

  const simDt = dtSeconds * SIM_TIME_MULTIPLIER;

  // --- Heading: turn toward targetHeading at a fixed turn rate ---
  let heading = aircraft.heading;
  const hDiff = angleDiff(heading, aircraft.targetHeading);
  const maxTurn = TURN_RATE_DEG_PER_SEC * simDt;
  if (Math.abs(hDiff) <= maxTurn) {
    heading = aircraft.targetHeading;
  } else {
    heading += Math.sign(hDiff) * maxTurn;
  }
  heading = normalizeHeading(heading);

  // --- Speed: accelerate/decelerate toward targetSpeed ---
  let speed = aircraft.speed;
  const sDiff = aircraft.targetSpeed - speed;
  const maxAccel = ACCEL_KTS_PER_SEC * simDt;
  if (Math.abs(sDiff) <= maxAccel) {
    speed = aircraft.targetSpeed;
  } else {
    speed += Math.sign(sDiff) * maxAccel;
  }
  speed = Math.max(0, speed);

  // --- Position: vector kinematics ---
  const theta = headingToTheta(heading);
  const speedNmPerSec = speed / 3600;
  const speedPxPerSec = speedNmPerSec / SCALE_NM_PER_PX;
  const deltaX = speedPxPerSec * Math.cos(theta) * simDt;
  // Screen Y grows downward, so "north" (sin component) decreases Y
  const deltaY = -speedPxPerSec * Math.sin(theta) * simDt;

  // --- Altitude: descent/climb rate toward targetAltitude ---
  let altitude = aircraft.altitude;
  let descentRate = aircraft.descentRate;
  const altDiff = aircraft.targetAltitude - altitude;
  if (Math.abs(altDiff) < 1) {
    altitude = aircraft.targetAltitude;
    descentRate = 0;
  } else {
    const ratePerSec = (Math.abs(aircraft.climbDescentRate) || 1500) / 60;
    const deltaAltitude = Math.sign(altDiff) * ratePerSec * simDt;
    if (Math.abs(deltaAltitude) >= Math.abs(altDiff)) {
      altitude = aircraft.targetAltitude;
      descentRate = 0;
    } else {
      altitude += deltaAltitude;
      descentRate = Math.sign(altDiff) * (Math.abs(aircraft.climbDescentRate) || 1500);
    }
  }

  const x = aircraft.x + deltaX;
  const y = aircraft.y + deltaY;

  const trail = [...(aircraft.trail || []), { x: aircraft.x, y: aircraft.y }].slice(-TRAIL_LENGTH);

  // --- Fuel: burns continuously, faster while airborne ---
  const burnRate = GROUND_STATUSES.has(aircraft.status)
    ? FUEL_BURN_GROUND_PER_SEC
    : FUEL_BURN_AIRBORNE_PER_SEC;
  const fuel = Math.max(0, (aircraft.fuel ?? 100) - burnRate * simDt);

  return {
    ...aircraft,
    heading,
    speed,
    altitude,
    descentRate,
    x,
    y,
    trail,
    fuel,
  };
}

export function pxDistanceToNm(pxDistance) {
  return pxDistance * SCALE_NM_PER_PX;
}

// Re-enters an aircraft that has flown off the edge of controlled airspace
// at a fresh edge position with a heading aimed back into the radar, so the
// simulation keeps a steady stream of traffic.
export function respawnAtEdge(aircraft) {
  const edge = Math.floor(Math.random() * 4); // 0=N,1=E,2=S,3=W
  let x;
  let y;
  let heading;
  switch (edge) {
    case 0: // top edge, heading roughly south
      x = Math.random() * RADAR_WIDTH;
      y = -20;
      heading = 135 + Math.random() * 90;
      break;
    case 1: // right edge, heading roughly west
      x = RADAR_WIDTH + 20;
      y = Math.random() * RADAR_HEIGHT;
      heading = 225 + Math.random() * 90;
      break;
    case 2: // bottom edge, heading roughly north
      x = Math.random() * RADAR_WIDTH;
      y = RADAR_HEIGHT + 20;
      heading = 315 + Math.random() * 90;
      break;
    default: // left edge, heading roughly east
      x = -20;
      y = Math.random() * RADAR_HEIGHT;
      heading = 45 + Math.random() * 90;
  }
  heading = heading % 360;
  const altitude = 6000 + Math.floor(Math.random() * 6) * 1000;
  return {
    ...aircraft,
    x,
    y,
    heading,
    targetHeading: heading,
    altitude,
    targetAltitude: altitude,
    speed: 230 + Math.floor(Math.random() * 6) * 10,
    targetSpeed: 230 + Math.floor(Math.random() * 6) * 10,
    descentRate: 0,
    climbDescentRate: 0,
    status: 'enroute',
    assignedRunway: null,
    clearance: null,
    emergency: false,
    fuel: 100,
    trail: [],
  };
}
