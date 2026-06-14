import React, { useState } from 'react';
import { useAtcStore } from '../../store/atcStore';
import FlightStrip from './FlightStrip';
import { getCurrentPanelKey, getDragCommand, getValidDropPanels } from '../../utils/dragTransitions';

const PANELS = [
  { key: 'emergency', title: 'EMERGENCY', match: (a) => !!a.emergency },
  { key: 'final', title: 'FINAL / LANDING', match: (a) => ['final', 'landed'].includes(a.status) },
  { key: 'airborne', title: 'AIRBORNE / HOLDING', match: (a) => ['enroute', 'holding', 'approach'].includes(a.status) },
  { key: 'ground', title: 'GROUND OPS', match: (a) => ['taxi', 'holding-short'].includes(a.status) },
  { key: 'departure', title: 'DEPARTURE', match: (a) => ['departure', 'departed'].includes(a.status) },
];

const PANEL_KEYS = PANELS.map((p) => p.key);

// Structured vertical column displaying individual physical flight strip
// components, rearranging onto different status panels as clearances and
// flight phases change - either automatically as the simulation progresses,
// or manually by dragging a strip onto a different panel to issue the
// matching clearance (e.g. dragging an airborne strip onto FINAL / LANDING
// clears that aircraft to land).
export default function FlightProgressStripStack() {
  const aircraft = useAtcStore((s) => s.aircraft);
  const runways = useAtcStore((s) => s.runways);
  const executeCommand = useAtcStore((s) => s.executeCommand);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverPanel, setDragOverPanel] = useState(null);

  const draggedAircraft = aircraft.find((a) => a.id === draggedId) || null;
  const validDropPanels = draggedAircraft ? getValidDropPanels(draggedAircraft, runways, PANEL_KEYS) : [];

  const handleDragStart = (aircraftId) => (e) => {
    setDraggedId(aircraftId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', aircraftId);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverPanel(null);
  };

  const handleDragOver = (panelKey) => (e) => {
    if (!validDropPanels.includes(panelKey)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPanel(panelKey);
  };

  const handleDrop = (panelKey) => (e) => {
    e.preventDefault();
    setDragOverPanel(null);
    if (!draggedAircraft) return;
    const fromPanel = getCurrentPanelKey(draggedAircraft);
    const command = getDragCommand(draggedAircraft, fromPanel, panelKey, runways);
    if (command) executeCommand(command);
    setDraggedId(null);
  };

  return (
    <div className="flight-strip-stack">
      {PANELS.map((panel) => {
        const items = aircraft.filter((a) => panel.key === 'emergency' ? panel.match(a) : panel.match(a) && !a.emergency);
        const isDropTarget = draggedAircraft && validDropPanels.includes(panel.key);
        const isDragOver = isDropTarget && dragOverPanel === panel.key;
        if (!items.length && !isDropTarget) return null;
        const classes = ['strip-panel'];
        if (isDropTarget) classes.push('drop-eligible');
        if (isDragOver) classes.push('drop-active');
        return (
          <div
            className={classes.join(' ')}
            key={panel.key}
            onDragOver={handleDragOver(panel.key)}
            onDragLeave={() => setDragOverPanel((p) => (p === panel.key ? null : p))}
            onDrop={handleDrop(panel.key)}
          >
            <div className="strip-panel-title">{panel.title} ({items.length})</div>
            {items.map((a) => (
              <FlightStrip
                key={a.id}
                aircraft={a}
                draggable
                dragging={a.id === draggedId}
                onDragStart={handleDragStart(a.id)}
                onDragEnd={handleDragEnd}
              />
            ))}
            {!items.length && isDropTarget && <div className="strip-panel-dropzone">DROP TO REASSIGN</div>}
          </div>
        );
      })}
    </div>
  );
}
