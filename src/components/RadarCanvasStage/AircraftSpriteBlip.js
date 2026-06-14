import React from 'react';
import { LOW_FUEL_THRESHOLD, CRITICAL_FUEL_THRESHOLD } from '../../engine/constants';

const STATUS_COLORS = {
  enroute: '#39ff6a',
  holding: '#39c0ff',
  approach: '#ffd23f',
  final: '#ffa83f',
  taxi: '#9a9a9a',
  'holding-short': '#c9c9c9',
  departure: '#7af0ff',
  landed: '#555555',
  departed: '#444444',
};

const CONFLICT_COLOR = '#ff3b3b';
const EMERGENCY_COLOR = '#ff3b3b';

// Graphical indicator tracking a live flight: vector trail, heading-aligned
// sprite, and a text data tag (speed / altitude / status).
export default function AircraftSpriteBlip({ aircraft, selected, onSelect }) {
  const color = aircraft.conflict || aircraft.emergency
    ? aircraft.conflict ? CONFLICT_COLOR : EMERGENCY_COLOR
    : STATUS_COLORS[aircraft.status] || '#39ff6a';

  const trailPoints = (aircraft.trail || [])
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .concat(`${aircraft.x.toFixed(1)},${aircraft.y.toFixed(1)}`)
    .join(' ');

  const flashClass = aircraft.conflict || aircraft.emergency ? 'blip-flash' : '';

  const fuel = aircraft.fuel ?? 100;
  const fuelColor =
    fuel <= CRITICAL_FUEL_THRESHOLD ? '#ff3b3b' : fuel <= LOW_FUEL_THRESHOLD ? '#ffd23f' : '#9adfc0';

  return (
    <g
      className="aircraft-blip"
      onClick={() => onSelect(aircraft.id)}
      style={{ cursor: 'pointer' }}
    >
      {trailPoints && (
        <polyline
          points={trailPoints}
          fill="none"
          stroke={color}
          strokeOpacity="0.35"
          strokeWidth="1"
        />
      )}

      <g transform={`translate(${aircraft.x},${aircraft.y}) rotate(${aircraft.heading})`}>
        <polygon
          className={flashClass}
          points="0,-7 5,6 0,3 -5,6"
          fill={color}
          stroke={selected ? '#ffffff' : 'none'}
          strokeWidth={selected ? 1.5 : 0}
        />
      </g>

      <text x={aircraft.x + 9} y={aircraft.y - 6} fill={color} fontSize="9px">
        {aircraft.callsign}
      </text>
      <text x={aircraft.x + 9} y={aircraft.y + 5} fill={color} fontSize="9px">
        {`FL${Math.round(aircraft.altitude / 100)
          .toString()
          .padStart(3, '0')} ${Math.round(aircraft.speed)}KT`}
      </text>
      <text x={aircraft.x + 9} y={aircraft.y + 15} fill={color} fontSize="8px" opacity="0.8">
        {aircraft.status.toUpperCase()}
        {aircraft.assignedRunway ? ` ${aircraft.assignedRunway}` : ''}
      </text>
      <text x={aircraft.x + 9} y={aircraft.y + 25} fill={fuelColor} fontSize="8px" opacity="0.9">
        {`FUEL ${fuel.toFixed(0)}%`}
      </text>
    </g>
  );
}
