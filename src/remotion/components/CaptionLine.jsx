import React from 'react';
import { interpolate, useVideoConfig } from 'remotion';
import AnimatedWord from './AnimatedWord';
import { getActiveWordIndex } from '../utils/captionUtils';

/**
 * CaptionLine renders a full line of words side by side, fades the whole line in/out,
 * and highlights/animates the currently spoken word.
 */
export default function CaptionLine({
  words,
  startFrame,
  endFrame,
  currentFrame,
  tokens,
  showBackground = true,
  fadeInFrames = 5,
  fadeOutFrames = 5
}) {
  const { fps } = useVideoConfig();

  // Calculate fade-in and fade-out opacity for the whole line
  let opacity = 1;
  if (endFrame > startFrame) {
    const totalDuration = endFrame - startFrame;
    const inFrames = Math.min(fadeInFrames, Math.floor(totalDuration / 2));
    const outFrames = Math.min(fadeOutFrames, Math.floor(totalDuration / 2));
    
    if (inFrames > 0 || outFrames > 0) {
      const points = [startFrame];
      const values = [0];
      
      const inPoint = startFrame + inFrames;
      const outPoint = endFrame - outFrames;
      
      if (inPoint < outPoint) {
        points.push(inPoint, outPoint, endFrame);
        values.push(1, 1, 0);
      } else {
        const midPoint = Math.floor((startFrame + endFrame) / 2);
        if (midPoint > startFrame) {
          points.push(midPoint);
          values.push(1);
        }
        points.push(endFrame);
        values.push(0);
      }
      
      opacity = interpolate(
        currentFrame,
        points,
        values,
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
    }
  }

  // Find index of the word actively spoken based on current video time
  const currentTimeSeconds = currentFrame / fps;
  const activeWordIndex = getActiveWordIndex(words, currentTimeSeconds);

  // Line container style (with optional background styling)
  const containerStyle = {
    display: 'inline-flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    ...(showBackground && tokens.background ? {
      backgroundColor: tokens.background,
      borderRadius: tokens.borderRadius ? `${tokens.borderRadius}px` : '8px',
      padding: tokens.padding || '6px 14px',
    } : {}),
  };

  const wrapperStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    opacity,
  };

  return (
    <div style={wrapperStyle}>
      <div style={containerStyle}>
        {words.map((word, index) => (
          <AnimatedWord
            key={index}
            word={word}
            isActive={index === activeWordIndex}
            style={tokens}
            animation={tokens.animation}
            currentFrame={currentFrame}
          />
        ))}
      </div>
    </div>
  );
}
