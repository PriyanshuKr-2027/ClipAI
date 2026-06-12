import React from 'react';

/**
 * WordHighlight renders a word with high-impact karaoke-style highlights,
 * such as underlines or text glow, tailored for NeonPop and HinglishFire styles.
 */
export default function WordHighlight({ word, isActive, tokens }) {
  const baseStyle = {
    fontFamily: tokens.fontFamily,
    fontSize: `${tokens.fontSize}px`,
    color: isActive ? (tokens.activeColor || '#00FFFF') : (tokens.color || '#FFFFFF'),
    textTransform: tokens.textTransform || 'none',
    lineHeight: tokens.lineHeight || 1.2,
    display: 'inline-block',
    whiteSpace: 'pre',
    margin: '0 6px',
    position: 'relative',
    transition: 'color 0.15s ease, text-shadow 0.15s ease',
  };

  // Webkit Text Stroke
  if (tokens.strokeColor && tokens.strokeWidth) {
    baseStyle.WebkitTextStroke = `${tokens.strokeWidth}px ${tokens.strokeColor}`;
  }

  // Text Shadow (Glow or Standard drop shadow)
  if (isActive && tokens.activeColor) {
    // Add neon glow effect for NeonPop-style high impact
    baseStyle.textShadow = `0 0 8px ${tokens.activeColor}, 0 0 15px ${tokens.activeColor}, ${tokens.shadow || '2px 2px 4px rgba(0,0,0,0.8)'}`;
  } else if (tokens.shadow) {
    baseStyle.textShadow = tokens.shadow;
  }

  return (
    <span style={baseStyle}>
      {word.word}
      {isActive && (
        <span
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: 0,
            right: 0,
            height: '4px',
            backgroundColor: tokens.activeColor || '#00FFFF',
            borderRadius: '2px',
            boxShadow: `0 0 8px ${tokens.activeColor || '#00FFFF'}`,
            transform: 'scaleX(1)',
            transformOrigin: 'left',
            animation: 'highlightGrow 0.15s ease-out',
          }}
        />
      )}
    </span>
  );
}
