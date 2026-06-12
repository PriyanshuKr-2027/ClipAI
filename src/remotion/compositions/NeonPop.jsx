import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { STYLE_TOKENS } from '../utils/styleTokens';
import { groupWordsIntoLines, secondsToFrames } from '../utils/captionUtils';
import CaptionLine from '../components/CaptionLine';

/**
 * NeonPop Composition
 * - All-caps Bangers font, bottom 20% of frame
 * - White glow text-shadow, active word cyan color + scale bounce
 * - 5-frame fade-in, 5-frame fade-out per line
 */
export default function NeonPop({ words = [], videoWidth = 1080, videoHeight = 1920 }) {
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Group words into lines
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
    ...STYLE_TOKENS.NeonPop,
    // Add additional white glow text shadow behind words
    shadow: '0 0 8px rgba(255,255,255,0.7), 2px 2px 4px rgba(0,0,0,0.8)',
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
