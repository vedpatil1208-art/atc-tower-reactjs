import React, { useState } from 'react';
import { useAtcStore } from '../../store/atcStore';
import { RADAR_WIDTH, RADAR_HEIGHT } from '../../engine/constants';
import RunwayNodeElement from './RunwayNodeElement';
import AircraftSpriteBlip from './AircraftSpriteBlip';
import './RadarCanvasStage.css';

// Dark, vector-mapped tracking radar display rendered as an SVG overlay
// matrix. Hosts runway nodes, aircraft sprite blips, and an optional
// real-world live traffic overlay sourced from OpenSky.
export default function RadarCanvasStage() {
  const aircraft = useAtcStore((s) => s.aircraft);
  const runways = useAtcStore((s) => s.runways);
  const liveTraffic = useAtcStore((s) => s.liveTraffic);
  const liveTrafficEnabled = useAtcStore((s) => s.liveTrafficEnabled);
  const airportName = useAtcStore((s) => s.airportName);
  const [selectedId, setSelectedId] = useState(null);

  const activeCount = aircraft.filter((a) => a.status !== 'landed' && a.status !== 'departed').length;

  const rings = [120, 240, 360, 480];
  const cx = RADAR_WIDTH / 2;
  const cy = RADAR_HEIGHT / 2;

  const gridLines = [];
  for (let x = 0; x <= RADAR_WIDTH; x += 100) {
    gridLines.push(<line key={`vx-${x}`} className="radar-grid-line" x1={x} y1={0} x2={x} y2={RADAR_HEIGHT} />);
  }
  for (let y = 0; y <= RADAR_HEIGHT; y += 100) {
    gridLines.push(<line key={`hy-${y}`} className="radar-grid-line" x1={0} y1={y} x2={RADAR_WIDTH} y2={y} />);
  }

  return (
    <div className="radar-stage">
      <div className="radar-stage-header">
        <span>{airportName} - TERMINAL RADAR</span>
        <span>{activeCount} ACTIVE TRACKS</span>
      </div>

      <svg
        className="radar-svg"
        viewBox={`0 0 ${RADAR_WIDTH} ${RADAR_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {gridLines}
        {rings.map((r) => (
          <circle key={r} className="radar-ring" cx={cx} cy={cy} r={r} />
        ))}
        <line className="radar-grid-line" x1={0} y1={cy} x2={RADAR_WIDTH} y2={cy} />
        <line className="radar-grid-line" x1={cx} y1={0} x2={cx} y2={RADAR_HEIGHT} />

        {runways.map((rwy) => (
          <RunwayNodeElement key={rwy.id} runway={rwy} />
        ))}

        {liveTrafficEnabled &&
          liveTraffic.map((lt) => (
            <g key={lt.id}>
              <circle className="live-traffic-dot" cx={lt.x} cy={lt.y} r="2.5" />
              <text x={lt.x + 5} y={lt.y - 4} fill="#ff8af0" fontSize="8px">
                {lt.callsign} {Math.round(lt.altitude)}ft
              </text>
            </g>
          ))}

        {aircraft.map((a) => (
          <AircraftSpriteBlip key={a.id} aircraft={a} selected={a.id === selectedId} onSelect={setSelectedId} />
        ))}
      </svg>

      <div className="radar-legend">
        <span className="radar-legend-item">
          <span className="legend-swatch" style={{ background: '#39ff6a' }} /> CLEAR / ENROUTE
        </span>
        <span className="radar-legend-item">
          <span className="legend-swatch" style={{ background: '#ffd23f' }} /> OCCUPIED / APPROACH
        </span>
        <span className="radar-legend-item">
          <span className="legend-swatch" style={{ background: '#ff3b3b' }} /> CONFLICT / EMERGENCY
        </span>
        {liveTrafficEnabled && (
          <span className="radar-legend-item">
            <span className="legend-swatch" style={{ background: '#ff8af0' }} /> LIVE OPENSKY TRAFFIC
          </span>
        )}
      </div>
    </div>
  );
}
