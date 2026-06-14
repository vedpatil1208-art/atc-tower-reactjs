import React from 'react';
import { useAtcStore } from '../../store/atcStore';
import FlightStrip from './FlightStrip';

const PANELS = [
  { key: 'emergency', title: 'EMERGENCY', match: (a) => !!a.emergency },
  { key: 'final', title: 'FINAL / LANDING', match: (a) => ['final', 'landed'].includes(a.status) },
  { key: 'airborne', title: 'AIRBORNE / HOLDING', match: (a) => ['enroute', 'holding', 'approach'].includes(a.status) },
  { key: 'ground', title: 'GROUND OPS', match: (a) => ['taxi', 'holding-short'].includes(a.status) },
  { key: 'departure', title: 'DEPARTURE', match: (a) => ['departure', 'departed'].includes(a.status) },
];

// Structured vertical column displaying individual physical flight strip
// components, rearranging onto different status panels as clearances and
// flight phases change.
export default function FlightProgressStripStack() {
  const aircraft = useAtcStore((s) => s.aircraft);

  return (
    <div className="flight-strip-stack">
      {PANELS.map((panel) => {
        const items = aircraft.filter((a) => panel.key === 'emergency' ? panel.match(a) : panel.match(a) && !a.emergency);
        if (!items.length) return null;
        return (
          <div className="strip-panel" key={panel.key}>
            <div className="strip-panel-title">{panel.title} ({items.length})</div>
            {items.map((a) => (
              <FlightStrip key={a.id} aircraft={a} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
