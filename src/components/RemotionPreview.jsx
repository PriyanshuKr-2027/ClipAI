import React, { useEffect, useRef } from 'react';
import { Player } from '@remotion/player';
import NeonPop from '../remotion/compositions/NeonPop';
import HinglishFire from '../remotion/compositions/HinglishFire';
import BoldDevanagari from '../remotion/compositions/BoldDevanagari';
import CleanMinimal from '../remotion/compositions/CleanMinimal';
import ReelBold from '../remotion/compositions/ReelBold';

const COMPOSITION_MAP = {
  NeonPop,
  HinglishFire,
  BoldDevanagari,
  CleanMinimal,
  ReelBold,
};

/**
 * RemotionPreview renders the animated caption preview in-browser with zero server calls.
 * Used across the Caption Editor, Style Picker, and Clips Review screens.
 */
export default function RemotionPreview({
  words = [],
  selectedStyle = 'NeonPop',
  currentTime = 0,
  duration = 5,
  videoWidth = 1080,
  videoHeight = 1920,
  width = '100%',
  height = '100%',
  showControls = false,
  loop = true,
}) {
  const playerRef = useRef(null);

  const durationInFrames = Math.max(30, Math.ceil((duration || 1) * 30));
  const Component = COMPOSITION_MAP[selectedStyle] || NeonPop;

  // Sync player playhead with external currentTime changes (e.g. from timeline scrubbers)
  useEffect(() => {
    if (playerRef.current) {
      const targetFrame = Math.floor(currentTime * 30);
      // Seek to target frame ensuring it doesn't exceed duration boundaries
      const clampedFrame = Math.min(durationInFrames - 1, Math.max(0, targetFrame));
      
      // If player is not playing, seek it. If it is playing, let it run or sync if out of bound.
      if (!playerRef.current.isPlaying()) {
        playerRef.current.seekTo(clampedFrame);
      }
    }
  }, [currentTime, durationInFrames]);

  return (
    <Player
      ref={playerRef}
      component={Component}
      durationInFrames={durationInFrames}
      compositionWidth={videoWidth}
      compositionHeight={videoHeight}
      fps={30}
      inputProps={{ words, videoWidth, videoHeight }}
      style={{ width, height }}
      controls={showControls}
      loop={loop}
      initialFrame={Math.min(durationInFrames - 1, Math.floor(currentTime * 30))}
    />
  );
}
