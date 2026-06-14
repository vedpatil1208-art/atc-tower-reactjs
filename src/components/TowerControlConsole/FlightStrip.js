import React from 'react';
import { LOW_FUEL_THRESHOLD, CRITICAL_FUEL_THRESHOLD } from '../../engine/constants';

const STATUS_LABELS = {
  enroute: 'ENROUTE',
  holding: 'HOLDING',
  approach: 'APPROACH',
  final: 'FINAL APPROACH',
  taxi: 'TAXI',
  'holding-short': 'HOLDING SHORT',
  departure: 'DEPARTURE CLIMB',
  landed: 'LANDED',
  departed: 'DEPARTED',
};

// A single physical flight strip card: Squawk Code, Aircraft Class, Current
// Altitude, Assigned Runway, and clearance status.
export default function FlightStrip({ aircraft }) {
  const classes = ['flight-strip'];
  if (aircraft.conflict || aircraft.emergency) classes.push('conflict');
  if (aircraft.status === 'landed' || aircraft.status === 'departed') classes.push('inactive');

  const fuel = aircraft.fuel ?? 100;
  const fuelClass = fuel <= CRITICAL_FUEL_THRESHOLD ? 'fuel-critical' : fuel <= LOW_FUEL_THRESHOLD ? 'fuel-low' : 'fuel-ok';

  return (
    <div className={classes.join(' ')}>
      <div className="flight-strip-row flight-strip-callsign">
        <strong>{aircraft.callsign}</strong>
        <span className="strip-class">{aircraft.aircraftClass}</span>
        {aircraft.emergency && <span className="strip-emergency">EMERGENCY 7700</span>}
      </div>
      <div className="flight-strip-row">
        <span>SQUAWK {aircraft.squawk}</span>
        <span>FL{Math.round(aircraft.altitude / 100).toString().padStart(3, '0')}</span>
      </div>
      <div className="flight-strip-row">
        <span>HDG {Math.round(aircraft.heading).toString().padStart(3, '0')}</span>
        <span>{Math.round(aircraft.speed)} KT</span>
      </div>
      <div className="flight-strip-row">
        <span>{STATUS_LABELS[aircraft.status] || aircraft.status.toUpperCase()}</span>
        <span>{aircraft.assignedRunway || '--'}</span>
      </div>
      <div className="flight-strip-row fuel-row">
        <span>FUEL</span>
        <div className="fuel-gauge">
          <div className={`fuel-gauge-fill ${fuelClass}`} style={{ width: `${Math.max(0, Math.min(100, fuel))}%` }} />
        </div>
        <span className={fuelClass}>{fuel.toFixed(0)}%</span>
      </div>
    </div>
  );
}
