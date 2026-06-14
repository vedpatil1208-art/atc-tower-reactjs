import React from 'react';
import CommandInputStrip from './CommandInputStrip';
import FlightProgressStripStack from './FlightProgressStripStack';
import './TowerControlConsole.css';

// Command Terminal & Flight Strips Deck.
export default function TowerControlConsole() {
  return (
    <div className="tower-control-console">
      <div className="console-title">TOWER CONTROL CONSOLE</div>
      <CommandInputStrip />
      <FlightProgressStripStack />
    </div>
  );
}
