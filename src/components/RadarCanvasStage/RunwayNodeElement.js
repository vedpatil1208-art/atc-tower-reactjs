import React from 'react';

const STATUS_COLORS = {
  clear: '#39ff6a',
  occupied: '#ffd23f',
  emergency: '#ff3b3b',
};

// A linear path block mapped to an active runway configuration. Color
// communicates availability: green = clear, yellow = occupied, pulsing red
// = emergency closure.
export default function RunwayNodeElement({ runway }) {
  const color = STATUS_COLORS[runway.status] || STATUS_COLORS.clear;
  const flashClass = runway.status === 'emergency' ? 'runway-flash' : '';
  const midX = (runway.x1 + runway.x2) / 2;
  const midY = (runway.y1 + runway.y2) / 2;

  return (
    <g className="runway-node">
      <line
        className={flashClass}
        x1={runway.x1}
        y1={runway.y1}
        x2={runway.x2}
        y2={runway.y2}
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.85"
      />
      <line
        x1={runway.x1}
        y1={runway.y1}
        x2={runway.x2}
        y2={runway.y2}
        stroke="#0a0e14"
        strokeWidth="1"
        strokeDasharray="6 6"
      />
      <text x={midX} y={midY - 10} fill={color} fontSize="10px" textAnchor="middle">
        {runway.id} ({runway.label}) - {runway.status.toUpperCase()}
      </text>
    </g>
  );
}
