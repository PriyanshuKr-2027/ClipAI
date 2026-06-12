import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { STYLE_TOKENS } from '../utils/styleTokens';
import { groupWordsIntoLines, secondsToFrames } from '../utils/captionUtils';
import CaptionLine from '../components/CaptionLine';

/**
 * CleanMinimal Composition
 * - Montserrat font, clean white, bottom 20% of frame
 * - Minimal stroke, subtle drop shadow
 * - Whole line appears/disappears cleanly (no per-word active animations)
 * - 5-frame fade-in/out transitions
 */
export default function CleanMinimal({ words = [], videoWidth = 1080, videoHeight = 1920 }) {
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lines = groupWordsIntoLines(words, 5, true);

  const containerStyle = {
    position: 'absolute',
    bottom: '20%',
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  };

  const customTokens = {
    ...STYLE_TOKENS.CleanMinimal,
    // Force active color to match base color, and disable scale/bounce per-word animation
    activeColor: STYLE_TOKENS.CleanMinimal.color || '#FFFFFF',
    animation: 'none',
    shadow: '1px 1px 3px rgba(0,0,0,0.5)',
  };

  return (
    <div style={containerStyle}>
      {lines.map((line, idx) => {
        const startFrame = secondsToFrames(line.startTime, fps);
        const endFrame = secondsToFrames(line.endTime, fps);

        if (currentFrame < startFrame || currentFrame > endFrame) {
          return null;
        }

        return (
          <CaptionLine
            key={idx}
            words={line.words}
            startFrame={startFrame}
            endFrame={endFrame}
            currentFrame={currentFrame}
            tokens={customTokens}
            showBackground={false}
            fadeInFrames={5}
            fadeOutFrames={5}
          />
        );
      })}
    </div>
  );
}
