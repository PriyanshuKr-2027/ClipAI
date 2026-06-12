import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { STYLE_TOKENS } from '../utils/styleTokens';
import { groupWordsIntoLines, secondsToFrames } from '../utils/captionUtils';
import CaptionLine from '../components/CaptionLine';

/**
 * BoldDevanagari Composition
 * - Noto Sans Devanagari font, bottom 20% of frame
 * - Semi-transparent black pill backdrop box behind each line
 * - White text, no stroke
 * - Soft fade-in animation
 */
export default function BoldDevanagari({ words = [], videoWidth = 1080, videoHeight = 1920 }) {
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
    ...STYLE_TOKENS.BoldDevanagari,
    borderRadius: 12,
    padding: '6px 16px',
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
            showBackground={true}
            fadeInFrames={5}
            fadeOutFrames={5}
          />
        );
      })}
    </div>
  );
}
