// Live aircraft telemetry via the OpenSky Network REST API.
// https://openskynetwork.github.io/opensky-api/rest.html
//
// The public /states/all endpoint works anonymously (no API key) with a
// lower rate limit (~400 requests/day, 10s resolution). If the user has an
// OpenSky account, optional Basic Auth credentials can be supplied via
// REACT_APP_OPENSKY_USERNAME / REACT_APP_OPENSKY_PASSWORD env vars for a
// higher rate limit (one request every 5s).

import { RADAR_WIDTH, RADAR_HEIGHT } from '../engine/constants';

const STATES_URL = 'https://opensky-network.org/api/states/all';

// Default bounding box: New York / JFK area
export const DEFAULT_BBOX = {
  lamin: 40.3,
  lomin: -74.6,
  lamax: 41.0,
  lomax: -73.4,
};

const STATE_FIELDS = [
  'icao24',
  'callsign',
  'originCountry',
  'timePosition',
  'lastContact',
  'longitude',
  'latitude',
  'baroAltitude',
  'onGround',
  'velocity',
  'trueTrack',
  'verticalRate',
  'sensors',
  'geoAltitude',
  'squawk',
  'spi',
  'positionSource',
];

function buildUrl(bbox) {
  const params = new URLSearchParams({
    lamin: bbox.lamin,
    lomin: bbox.lomin,
    lamax: bbox.lamax,
    lomax: bbox.lomax,
  });
  return `${STATES_URL}?${params.toString()}`;
}

function buildAuthHeader() {
  const username = process.env.REACT_APP_OPENSKY_USERNAME;
  const password = process.env.REACT_APP_OPENSKY_PASSWORD;
  if (username && password) {
    return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
  }
  return {};
}

// Projects a lon/lat pair onto the radar's px coordinate space using the
// same bounding box used to query OpenSky.
export function projectToRadar(lon, lat, bbox = DEFAULT_BBOX) {
  const x = ((lon - bbox.lomin) / (bbox.lomax - bbox.lomin)) * RADAR_WIDTH;
  const y = ((bbox.lamax - lat) / (bbox.lamax - bbox.lamin)) * RADAR_HEIGHT;
  return { x, y };
}

// Fetches live aircraft state vectors within the bounding box and maps them
// into a shape compatible with the simulator's aircraft model (read-only,
// for overlay/info-panel purposes only).
export async function fetchLiveAircraft(bbox = DEFAULT_BBOX) {
  const response = await fetch(buildUrl(bbox), {
    headers: buildAuthHeader(),
  });

  if (!response.ok) {
    throw new Error(`OpenSky request failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rows = data.states || [];

  return rows
    .map((row) => {
      const state = {};
      STATE_FIELDS.forEach((field, idx) => {
        state[field] = row[idx];
      });
      return state;
    })
    .filter((s) => s.longitude != null && s.latitude != null)
    .map((s) => {
      const { x, y } = projectToRadar(s.longitude, s.latitude, bbox);
      return {
        id: `live-${s.icao24}`,
        icao24: s.icao24,
        callsign: (s.callsign || s.icao24 || '----').trim() || '----',
        x,
        y,
        longitude: s.longitude,
        latitude: s.latitude,
        altitude: s.baroAltitude != null ? Math.round(s.baroAltitude * 3.28084) : 0, // m -> ft
        speed: s.velocity != null ? Math.round(s.velocity * 1.94384) : 0, // m/s -> kts
        heading: s.trueTrack != null ? Math.round(s.trueTrack) : 0,
        verticalRateFtMin: s.verticalRate != null ? Math.round(s.verticalRate * 196.85) : 0, // m/s -> ft/min
        onGround: !!s.onGround,
        squawk: s.squawk || '----',
      };
    });
}
