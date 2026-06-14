import React from 'react';
import { useAtcStore } from '../../store/atcStore';
import { RADAR_WIDTH, RADAR_HEIGHT, SCALE_NM_PER_PX } from '../../engine/constants';
import './TowerTelemetryHUD.css';

const AIRSPACE_AREA_NM2 = (RADAR_WIDTH * SCALE_NM_PER_PX) * (RADAR_HEIGHT * SCALE_NM_PER_PX);

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

const LOG_COLORS = {
  success: '#39ff6a',
  rejected: '#ff9a9a',
  conflict: '#ff3b3b',
  system: '#7af0ff',
  info: '#cfe8d8',
};

// Bottom-docked status terminal documenting chronological background data
// logs, in-memory operational metrics, and utility export tools.
export default function TowerTelemetryHUD() {
  const aircraft = useAtcStore((s) => s.aircraft);
  const metrics = useAtcStore((s) => s.metrics);
  const telemetryLog = useAtcStore((s) => s.telemetryLog);
  const exportTelemetryCSV = useAtcStore((s) => s.exportTelemetryCSV);
  const exportSessionLedger = useAtcStore((s) => s.exportSessionLedger);
  const injectEmergency = useAtcStore((s) => s.injectEmergency);
  const saveAirportConfig = useAtcStore((s) => s.saveAirportConfig);
  const toggleSim = useAtcStore((s) => s.toggleSim);
  const simRunning = useAtcStore((s) => s.simRunning);
  const liveTrafficEnabled = useAtcStore((s) => s.liveTrafficEnabled);
  const toggleLiveTraffic = useAtcStore((s) => s.toggleLiveTraffic);
  const liveTrafficStatus = useAtcStore((s) => s.liveTrafficStatus);
  const liveTrafficError = useAtcStore((s) => s.liveTrafficError);
  const liveTraffic = useAtcStore((s) => s.liveTraffic);

  const activeCount = aircraft.filter((a) => a.status !== 'landed' && a.status !== 'departed').length;
  const densityIndex = (activeCount / AIRSPACE_AREA_NM2) * 1000;
  const avgRunwayOccupancy = average(metrics.runwayOccupancySeconds);
  const avgParsingLatency = average(metrics.parsingLatenciesMs);
  const conflictCount = aircraft.filter((a) => a.conflict).length;

  return (
    <div className="telemetry-hud">
      <div className="telemetry-metrics">
        <div className="metric-cell">
          <div className="metric-label">TOTAL HANDLED TRAFFIC</div>
          <div className="metric-value">{metrics.totalHandled}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">AIRSPACE DENSITY INDEX</div>
          <div className="metric-value">{densityIndex.toFixed(2)} /1000nm²</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">AVG RUNWAY OCCUPANCY (s)</div>
          <div className="metric-value">{avgRunwayOccupancy.toFixed(2)}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">PARSER LATENCY (ms)</div>
          <div className="metric-value">{avgParsingLatency.toFixed(3)}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">ACTIVE TRACKS</div>
          <div className="metric-value">{activeCount}</div>
        </div>
        <div className="metric-cell">
          <div className="metric-label">CONFLICTS</div>
          <div className={`metric-value ${conflictCount ? 'metric-alert' : ''}`}>{conflictCount}</div>
        </div>
        {liveTrafficEnabled && (
          <div className="metric-cell">
            <div className="metric-label">LIVE OPENSKY TRACKS</div>
            <div className="metric-value">
              {liveTrafficStatus === 'loading' ? '...' : liveTraffic.length}
              {liveTrafficStatus === 'error' ? ` ERR` : ''}
            </div>
          </div>
        )}
      </div>

      <div className="telemetry-controls">
        <button onClick={toggleSim}>{simRunning ? 'PAUSE SIM' : 'RESUME SIM'}</button>
        <button onClick={injectEmergency}>INJECT EMERGENCY SCENARIO</button>
        <button onClick={exportTelemetryCSV}>EXPORT OPERATIONAL SUMMARY (CSV)</button>
        <button onClick={exportSessionLedger}>EXPORT SESSION LEDGER (JSON)</button>
        <button onClick={saveAirportConfig}>SAVE AIRPORT CONFIG</button>
        <button onClick={toggleLiveTraffic} className={liveTrafficEnabled ? 'active-toggle' : ''}>
          {liveTrafficEnabled ? 'LIVE TRAFFIC: ON' : 'LIVE TRAFFIC: OFF'}
        </button>
        {liveTrafficEnabled && liveTrafficStatus === 'error' && (
          <span className="live-error">OPENSKY ERROR: {liveTrafficError}</span>
        )}
      </div>

      <div className="telemetry-log">
        {telemetryLog.map((entry) => (
          <div className="log-row" key={entry.id} style={{ color: LOG_COLORS[entry.type] || '#cfe8d8' }}>
            <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            <span className="log-text">{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
