import { create } from 'zustand';
import { initialAircraft, initialRunways, makeEmergencyAircraft } from '../data/seedData';
import { stepAircraft, respawnAtEdge } from '../engine/kinematics';
import { detectSeparationConflicts } from '../engine/separation';
import { parseCommand } from '../engine/commandParser';
import { fetchLiveAircraft } from '../services/openSkyService';
import { downloadJSON, downloadCSV } from '../utils/exportUtils';
import {
  RUNWAY_OCCUPANCY_MS,
  TOUCHDOWN_RADIUS_PX,
  TOUCHDOWN_ALTITUDE_FT,
  RUNWAY_VACATE_ALTITUDE_FT,
  OFF_RADAR_MARGIN_PX,
  RADAR_WIDTH,
  RADAR_HEIGHT,
  LOW_FUEL_THRESHOLD,
  CRITICAL_FUEL_THRESHOLD,
} from '../engine/constants';

const CONFIG_STORAGE_KEY = 'atc-tower-airport-config';
const SESSION_STORAGE_KEY = 'atc-tower-session-state';
const SESSION_PERSIST_INTERVAL_MS = 3000;
const MAX_LOG_ENTRIES = 200;
const MAX_METRIC_SAMPLES = 50;

let logIdCounter = 1;
function nextLogId() {
  logIdCounter += 1;
  return `log-${Date.now()}-${logIdCounter}`;
}

function loadPersistedConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applyPersistedRunways(runways) {
  const persisted = loadPersistedConfig();
  if (!persisted || !Array.isArray(persisted.runways)) return runways;
  return runways.map((rwy) => {
    const saved = persisted.runways.find((r) => r.id === rwy.id);
    if (!saved) return rwy;
    return {
      ...rwy,
      label: saved.label ?? rwy.label,
      x1: saved.x1 ?? rwy.x1,
      y1: saved.y1 ?? rwy.y1,
      x2: saved.x2 ?? rwy.x2,
      y2: saved.y2 ?? rwy.y2,
      heading: saved.heading ?? rwy.heading,
    };
  });
}

function distanceToThreshold(aircraft, runway) {
  const dx = runway.x2 - aircraft.x;
  const dy = runway.y2 - aircraft.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function makeLog(text, type = 'info') {
  return { id: nextLogId(), timestamp: Date.now(), text, type };
}

function loadPersistedSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.aircraft) || !Array.isArray(parsed.runways)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const persistedAirportName = (loadPersistedConfig() || {}).airportName || 'KAT INTERNATIONAL TOWER';
const persistedSession = loadPersistedSession();

export const useAtcStore = create((set, get) => ({
  aircraft: persistedSession?.aircraft ?? initialAircraft,
  runways: persistedSession?.runways ?? applyPersistedRunways(initialRunways),
  airportName: persistedSession?.airportName ?? persistedAirportName,

  commandLog: persistedSession?.commandLog ?? [],
  telemetryLog: persistedSession
    ? [makeLog(`SESSION RESTORED FROM LOCAL STORAGE (saved ${new Date(persistedSession.savedAt).toLocaleTimeString()})`, 'system'), ...persistedSession.telemetryLog]
    : [makeLog('TOWER SESSION INITIALIZED', 'system')],
  activeConflictKeys: persistedSession?.activeConflictKeys ?? [],

  metrics: persistedSession?.metrics ?? {
    totalHandled: 0,
    parsingLatenciesMs: [],
    runwayOccupancySeconds: [],
  },

  simRunning: persistedSession?.simRunning ?? true,
  lastPersistAt: 0,

  liveTraffic: [],
  liveTrafficEnabled: false,
  liveTrafficStatus: 'idle', // idle | loading | ok | error
  liveTrafficError: null,
  liveTrafficUpdatedAt: null,

  // ----- Simulation control -----
  toggleSim: () => {
    set((state) => ({ simRunning: !state.simRunning }));
    get().persistSession();
  },

  // ----- Full session persistence (survives tab/page reload) -----
  persistSession: () => {
    const state = get();
    const payload = {
      savedAt: Date.now(),
      airportName: state.airportName,
      aircraft: state.aircraft,
      runways: state.runways,
      commandLog: state.commandLog,
      telemetryLog: state.telemetryLog,
      metrics: state.metrics,
      activeConflictKeys: state.activeConflictKeys,
      simRunning: state.simRunning,
    };
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage unavailable or full - skip silently
    }
    set({ lastPersistAt: Date.now() });
  },

  // ----- Main update loop tick -----
  tick: (dtSeconds) => {
    const state = get();
    if (!state.simRunning) return;
    const now = Date.now();

    let aircraft = state.aircraft.map((a) => stepAircraft(a, dtSeconds));
    let runways = state.runways.map((r) => ({ ...r }));
    const newLogs = [];
    let totalHandledDelta = 0;
    const newOccupancySamples = [];

    aircraft = aircraft.map((a) => {
      // --- Landing completion ---
      if (a.status === 'final' && a.assignedRunway) {
        const rwy = runways.find((r) => r.id === a.assignedRunway);
        if (rwy && rwy.status !== 'emergency') {
          const dist = distanceToThreshold(a, rwy);
          if (dist < TOUCHDOWN_RADIUS_PX && a.altitude < TOUCHDOWN_ALTITUDE_FT) {
            totalHandledDelta += 1;
            newLogs.push(makeLog(`${a.callsign} TOUCHED DOWN ${rwy.id}`, 'success'));
            const idx = runways.findIndex((r) => r.id === rwy.id);
            runways[idx] = { ...runways[idx], status: 'occupied', occupiedBy: a.id, occupiedSince: now };
            return { ...a, status: 'landed', altitude: 0, speed: 0, targetSpeed: 0, descentRate: 0 };
          }
        }
      }

      // --- Departure airborne: vacate runway, then hand off once at cruise ---
      if (a.status === 'departure' && a.assignedRunway) {
        const rwyIdx = runways.findIndex((r) => r.id === a.assignedRunway);
        const rwy = rwyIdx >= 0 ? runways[rwyIdx] : null;
        if (rwy && rwy.status === 'occupied' && rwy.occupiedBy === a.id && a.altitude > RUNWAY_VACATE_ALTITUDE_FT) {
          const duration = (now - (rwy.occupiedSince || now)) / 1000;
          newOccupancySamples.push(duration);
          runways[rwyIdx] = { ...rwy, status: 'clear', occupiedBy: null, occupiedSince: null };
          newLogs.push(makeLog(`${a.callsign} AIRBORNE - ${rwy.id} VACATED`, 'info'));
        }
        if (a.altitude >= a.targetAltitude - 5 && a.altitude > RUNWAY_VACATE_ALTITUDE_FT) {
          totalHandledDelta += 1;
          newLogs.push(makeLog(`${a.callsign} HANDED OFF TO DEPARTURE CONTROL`, 'success'));
          return { ...a, status: 'departed', assignedRunway: null, clearance: null };
        }
      }

      // --- Free-flying traffic that exits controlled airspace: recycle ---
      if (['enroute', 'holding', 'approach'].includes(a.status)) {
        if (
          a.x < -OFF_RADAR_MARGIN_PX ||
          a.x > RADAR_WIDTH + OFF_RADAR_MARGIN_PX ||
          a.y < -OFF_RADAR_MARGIN_PX ||
          a.y > RADAR_HEIGHT + OFF_RADAR_MARGIN_PX
        ) {
          totalHandledDelta += 1;
          newLogs.push(makeLog(`${a.callsign} EXITED CONTROLLED AIRSPACE`, 'info'));
          return respawnAtEdge(a);
        }
      }

      return a;
    });

    // --- Runway vacate after occupancy timeout (landed aircraft) ---
    runways = runways.map((r) => {
      if (r.status === 'occupied' && r.occupiedSince && now - r.occupiedSince > RUNWAY_OCCUPANCY_MS) {
        const occ = aircraft.find((a) => a.id === r.occupiedBy);
        const duration = (now - r.occupiedSince) / 1000;
        newOccupancySamples.push(duration);
        newLogs.push(makeLog(`${occ ? occ.callsign : 'AIRCRAFT'} VACATED ${r.id}`.trim(), 'info'));
        return { ...r, status: 'clear', occupiedBy: null, occupiedSince: null };
      }
      return r;
    });

    // --- Fuel level alerts ---
    aircraft = aircraft.map((a) => {
      if (a.status === 'landed' || a.status === 'departed') return a;

      if (a.fuel <= CRITICAL_FUEL_THRESHOLD && a.fuelAlertLevel !== 'critical') {
        newLogs.push(
          makeLog(`FUEL EMERGENCY: ${a.callsign} CRITICAL FUEL ${a.fuel.toFixed(1)}% - DECLARING MAYDAY`, 'conflict')
        );
        return { ...a, fuelAlertLevel: 'critical', emergency: true, squawk: '7700' };
      }
      if (a.fuel <= LOW_FUEL_THRESHOLD && !a.fuelAlertLevel) {
        newLogs.push(
          makeLog(`LOW FUEL: ${a.callsign} AT ${a.fuel.toFixed(1)}% - REQUESTS PRIORITY HANDLING`, 'rejected')
        );
        return { ...a, fuelAlertLevel: 'low' };
      }
      return a;
    });

    // --- Separation conflict sweep ---
    const { conflictIds, pairs } = detectSeparationConflicts(aircraft);
    aircraft = aircraft.map((a) => ({ ...a, conflict: conflictIds.has(a.id) }));

    const currentKeys = pairs.map((p) => [p.a, p.b].sort().join('|'));
    const previousKeys = state.activeConflictKeys;
    currentKeys.forEach((key, i) => {
      if (!previousKeys.includes(key)) {
        const p = pairs[i];
        newLogs.push(
          makeLog(
            `SEPARATION CONFLICT: ${p.a} / ${p.b} (${p.horizontalNm}nm, ${p.verticalFt}ft)`,
            'conflict'
          )
        );
      }
    });
    previousKeys.forEach((key) => {
      if (!currentKeys.includes(key)) {
        const [csA, csB] = key.split('|');
        newLogs.push(makeLog(`CONFLICT RESOLVED: ${csA} / ${csB}`, 'success'));
      }
    });

    const metrics = { ...state.metrics };
    if (totalHandledDelta) metrics.totalHandled += totalHandledDelta;
    if (newOccupancySamples.length) {
      metrics.runwayOccupancySeconds = [...metrics.runwayOccupancySeconds, ...newOccupancySamples].slice(
        -MAX_METRIC_SAMPLES
      );
    }

    const telemetryLog = newLogs.length
      ? [...newLogs.reverse(), ...state.telemetryLog].slice(0, MAX_LOG_ENTRIES)
      : state.telemetryLog;

    set({
      aircraft,
      runways,
      activeConflictKeys: currentKeys,
      metrics,
      telemetryLog,
    });

    if (now - state.lastPersistAt > SESSION_PERSIST_INTERVAL_MS) {
      get().persistSession();
    }
  },

  // ----- Command Syntax State Machine -----
  executeCommand: (rawText) => {
    const state = get();
    const start = performance.now();
    const result = parseCommand(rawText, state);
    const latencyMs = performance.now() - start;

    const metrics = { ...state.metrics };
    metrics.parsingLatenciesMs = [...metrics.parsingLatenciesMs, latencyMs].slice(-MAX_METRIC_SAMPLES);

    const commandLog = [
      {
        id: nextLogId(),
        timestamp: Date.now(),
        text: rawText,
        ok: result.ok,
        message: result.message,
        latencyMs,
      },
      ...state.commandLog,
    ].slice(0, MAX_LOG_ENTRIES);

    const telemetryLog = [
      makeLog(result.message, result.ok ? 'success' : 'rejected'),
      ...state.telemetryLog,
    ].slice(0, MAX_LOG_ENTRIES);

    let aircraft = state.aircraft;
    let runways = state.runways;

    if (result.ok) {
      if (result.aircraftId) {
        aircraft = aircraft.map((a) => (a.id === result.aircraftId ? { ...a, ...result.patch } : a));
      }
      if (result.runwayId && result.runwayPatch) {
        runways = runways.map((r) =>
          r.id === result.runwayId ? { ...r, ...result.runwayPatch, occupiedSince: Date.now() } : r
        );
      }
    }

    set({ aircraft, runways, commandLog, telemetryLog, metrics });
    get().persistSession();
    return result;
  },

  // ----- Emergency injection -----
  injectEmergency: () => {
    const state = get();
    const emg = makeEmergencyAircraft(Date.now());
    const telemetryLog = [
      makeLog(`EMERGENCY SCENARIO INJECTED: ${emg.callsign} SQUAWKING 7700`, 'conflict'),
      ...state.telemetryLog,
    ].slice(0, MAX_LOG_ENTRIES);
    set({ aircraft: [...state.aircraft, emg], telemetryLog });
    get().persistSession();
  },

  // ----- Live traffic (OpenSky) -----
  toggleLiveTraffic: () => {
    const state = get();
    const enabled = !state.liveTrafficEnabled;
    set({ liveTrafficEnabled: enabled, liveTrafficStatus: enabled ? 'loading' : 'idle' });
    if (enabled) get().fetchLiveTraffic();
  },

  fetchLiveTraffic: async () => {
    const state = get();
    if (!state.liveTrafficEnabled) return;
    set({ liveTrafficStatus: 'loading' });
    try {
      const liveTraffic = await fetchLiveAircraft();
      set({
        liveTraffic,
        liveTrafficStatus: 'ok',
        liveTrafficError: null,
        liveTrafficUpdatedAt: Date.now(),
      });
    } catch (err) {
      set({ liveTrafficStatus: 'error', liveTrafficError: err.message });
    }
  },

  // ----- Persistence -----
  saveAirportConfig: () => {
    const state = get();
    const payload = {
      airportName: state.airportName,
      runways: state.runways.map((r) => ({
        id: r.id,
        label: r.label,
        x1: r.x1,
        y1: r.y1,
        x2: r.x2,
        y2: r.y2,
        heading: r.heading,
      })),
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(payload));
    const telemetryLog = [makeLog('AIRPORT CONFIGURATION SAVED TO LOCAL STORAGE', 'system'), ...state.telemetryLog].slice(
      0,
      MAX_LOG_ENTRIES
    );
    set({ telemetryLog });
  },

  setAirportName: (name) => set({ airportName: name }),

  exportSessionLedger: () => {
    const state = get();
    downloadJSON(
      {
        exportedAt: new Date().toISOString(),
        airportName: state.airportName,
        aircraft: state.aircraft,
        runways: state.runways,
        commandLog: state.commandLog,
        telemetryLog: state.telemetryLog,
        metrics: state.metrics,
      },
      `atc-session-ledger-${Date.now()}.json`
    );
  },

  exportTelemetryCSV: () => {
    const state = get();
    const rows = state.telemetryLog
      .slice()
      .reverse()
      .map((entry) => ({
        timestamp: new Date(entry.timestamp).toISOString(),
        type: entry.type,
        message: entry.text,
      }));
    downloadCSV(rows, `atc-telemetry-log-${Date.now()}.csv`);
  },
}));
