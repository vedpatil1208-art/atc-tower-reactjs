// Radar coordinate space (SVG viewBox units = pixels)
export const RADAR_WIDTH = 1000;
export const RADAR_HEIGHT = 700;

// Spatial scale: how many nautical miles a single radar px represents
export const SCALE_NM_PER_PX = 0.05; // radar spans 50nm x 35nm

// Simulation time runs faster than wall-clock time so flights are watchable
export const SIM_TIME_MULTIPLIER = 25; // sim-seconds per real second

// Separation minima
export const SEPARATION_HORIZONTAL_NM = 3;
export const SEPARATION_VERTICAL_FT = 1000;

// Kinematic tuning
export const TURN_RATE_DEG_PER_SEC = 6; // degrees per sim-second
export const ACCEL_KTS_PER_SEC = 4; // knots per sim-second
export const TRAIL_LENGTH = 16;

// How long an aircraft remains "on the runway" before it is considered
// vacated, for Average Runway Occupancy Time telemetry.
export const RUNWAY_OCCUPANCY_MS = 8000;

// Aircraft within this many px of the assigned runway threshold, below
// this altitude, are considered to have touched down.
export const TOUCHDOWN_RADIUS_PX = 18;
export const TOUCHDOWN_ALTITUDE_FT = 150;

// Departures are considered "airborne / runway vacated" past this altitude.
export const RUNWAY_VACATE_ALTITUDE_FT = 500;

// Aircraft this far outside the radar bounds are recycled.
export const OFF_RADAR_MARGIN_PX = 40;

// Fuel burn rates (% of tank per sim-second). Airborne phases burn fuel
// much faster than ground operations.
export const FUEL_BURN_AIRBORNE_PER_SEC = 0.006;
export const FUEL_BURN_GROUND_PER_SEC = 0.001;

// Fuel level thresholds (% remaining)
export const LOW_FUEL_THRESHOLD = 15;
export const CRITICAL_FUEL_THRESHOLD = 5;
