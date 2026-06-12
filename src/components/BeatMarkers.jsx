import React from 'react';

/**
 * BeatMarkers renders a compact visual overlay of orange tick marks corresponding
 * to music beats, aligned absolute-positionally inside the timeline.
 */
export default function BeatMarkers({ beats = [], duration, width }) {
  if (!duration || duration <= 0) return null;

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: width !== undefined ? `${width}px` : '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {beats.map((beat, idx) => {
        // Calculate ratio coordinate
        const positionPercent = (beat / duration) * 100;
        
        // Safety check to ensure beats align within timeline range
        if (positionPercent < 0 || positionPercent > 100) return null;

        return (
          <div
            key={`${beat}-${idx}`}
            style={{
              position: 'absolute',
              left: `${positionPercent}%`,
              width: '2px',
              height: '12px',
              background: '#f97316',
              top: 0,
              borderRadius: '1px',
              boxShadow: '0 0 4px rgba(249, 115, 22, 0.4)',
            }}
          />
        );
      })}
    </div>
  );
}
