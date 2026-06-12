import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import WordHighlight from './WordHighlight';

const secondsToFrames = (seconds, fps) => Math.round(seconds * fps);

/**
 * AnimatedWord handles entry/active state animations for an individual word.
 * If the style is highlight-driven (like Bangers/NeonPop or Anton/HinglishFire),
 * it delegates to the WordHighlight component for additional text effects.
 */
export default function AnimatedWord({
  word,
  isActive,
  style,
  animation,
  currentFrame: propCurrentFrame
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentFrame = propCurrentFrame !== undefined ? propCurrentFrame : frame;
  const startFrame = secondsToFrames(word.start, fps);
  const activeFrame = currentFrame - startFrame;

  const animType = animation || style.animation || 'none';

  let transform = 'none';
  let opacity = 1;

  if (isActive && activeFrame >= 0) {
    if (animType === 'scale') {
      const peakScale = style.fontFamily === 'Impact' ? 1.45 : 1.25;
      const scale = interpolate(
        activeFrame,
        [0, 3, 8],
        [0.8, peakScale, 1.0],
        { extrapolateRight: 'clamp' }
      );
      transform = `scale(${scale})`;
    } else if (animType === 'bounce') {
      const spr = spring({
        frame: activeFrame,
        fps,
        config: {
          damping: 8,
          mass: 0.4,
          stiffness: 120,
        },
      });
      const scale = interpolate(spr, [0, 1], [0.8, 1.0]);
      
      // Slight horizontal shake for HinglishFire (Anton font)
      let shakeX = 0;
      if (style.fontFamily === 'Anton') {
        const shakePhase = activeFrame % 8; // fast oscillation
        shakeX = interpolate(
          shakePhase,
          [0, 2, 4, 6, 8],
          [0, -4, 4, -4, 0]
        );
      }
      transform = `scale(${scale}) translateX(${shakeX}px)`;
    } else if (animType === 'fade') {
      opacity = interpolate(
        activeFrame,
        [0, 6],
        [0.4, 1.0],
        { extrapolateRight: 'clamp' }
      );
    } else if (animType === 'slide') {
      const translateY = interpolate(
        activeFrame,
        [0, 5],
        [0, -6],
        { extrapolateRight: 'clamp' }
      );
      transform = `translateY(${translateY}px)`;
    }
  }

  const wrapperStyle = {
    display: 'inline-block',
    transform,
    opacity,
  };

  // Determine if this style should use WordHighlight
  const useHighlight = style.fontFamily === 'Bangers' || style.fontFamily === 'Anton';

  if (useHighlight) {
    return (
      <span style={wrapperStyle}>
        <WordHighlight word={word} isActive={isActive} tokens={style} />
      </span>
    );
  }

  // Base style configuration for other styles (e.g. CleanMinimal, BoldDevanagari, ReelBold)
  const baseStyle = {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}px`,
    color: isActive ? (style.activeColor || '#00FFFF') : (style.color || '#FFFFFF'),
    textTransform: style.textTransform || 'none',
    lineHeight: style.lineHeight || 1.2,
    display: 'inline-block',
    whiteSpace: 'pre',
    margin: '0 4px',
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    padding: style.padding || undefined,
    backgroundColor: style.background || undefined,
    transition: 'color 0.15s ease',
  };

  if (style.strokeColor && style.strokeWidth) {
    baseStyle.WebkitTextStroke = `${style.strokeWidth}px ${style.strokeColor}`;
  }
  
  if (style.shadow) {
    baseStyle.textShadow = style.shadow;
  }

  return (
    <span style={wrapperStyle}>
      <span style={baseStyle}>{word.word}</span>
    </span>
  );
}
