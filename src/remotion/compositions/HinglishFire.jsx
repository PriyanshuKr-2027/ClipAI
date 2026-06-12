import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { STYLE_TOKENS } from '../utils/styleTokens';
import { groupWordsIntoLines, secondsToFrames } from '../utils/captionUtils';
import CaptionLine from '../components/CaptionLine';

/**
 * HinglishFire Composition
 * - Anton font, blue base color, active word in orange (with horizontal shake)
 * - Thick text stroke for high visibility on mixed Hindi/English content
 */
export default function HinglishFire({ words = [], videoWidth = 1080, videoHeight = 1920 }) {
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
            tokens={STYLE_TOKENS.HinglishFire}
            showBackground={false}
            fadeInFrames={5}
            fadeOutFrames={5}
          />
        );
      })}
    </div>
  );
}
