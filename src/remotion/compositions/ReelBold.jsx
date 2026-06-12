import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { STYLE_TOKENS } from '../utils/styleTokens';
import { groupWordsIntoLines, secondsToFrames } from '../utils/captionUtils';
import CaptionLine from '../components/CaptionLine';

/**
 * ReelBold Composition
 * - Impact font, all-caps, bottom 20% of frame
 * - Thick black text stroke (via -webkit-text-stroke) for high-impact readability
 * - Aggressive scale on active word (e.g. 1.45 peak)
 * - Flash effect on line entry (opacity 0 -> 1 over 3 frames, no fade-out)
 */
export default function ReelBold({ words = [], videoWidth = 1080, videoHeight = 1920 }) {
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
    ...STYLE_TOKENS.ReelBold,
    // Add thick border and fill color (black text with thick white border or vice versa)
    // To match high impact social reels: yellow active word, white base text, black border
    strokeColor: '#000000',
    strokeWidth: 5,
    activeColor: '#FFD700', // yellow
    color: '#FFFFFF',
    animation: 'scale',
    shadow: '3px 3px 0px rgba(0,0,0,0.9)',
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
            fadeInFrames={3}  // Flash entry over 3 frames
            fadeOutFrames={0} // Sharp disappears
          />
        );
      })}
    </div>
  );
}
