import React, { useEffect, useRef, useState } from 'react';

/**
 * WaveformDisplay decodes audio data on the client using the Web Audio API,
 * downsamples it, and renders an interactive waveform with beats, scene boundaries,
 * and a real-time playback playhead.
 */
export default function WaveformDisplay({
  audioUrl,
  currentTime,
  duration,
  beats = [],
  scenes = [],
  onSeek,
  height = 80,
}) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Waveform data storage
  const rmsDataRef = useRef([]);
  const maxRmsRef = useRef(0.01); // avoid division by zero
  const animationFrameId = useRef(null);

  // 1. Fetch and decode audio data
  useEffect(() => {
    if (!audioUrl) return;

    let isAborted = false;
    setLoading(true);
    setError(null);
    rmsDataRef.current = [];

    const loadAudio = async () => {
      try {
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        if (isAborted) return;

        // Use standard or webkit AudioContext
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (isAborted) {
          audioCtx.close();
          return;
        }

        // Downsample to 1000 RMS buckets
        const channelData = audioBuffer.getChannelData(0); // Use mono channel
        const totalSamples = channelData.length;
        const numBuckets = 1000;
        const samplesPerBucket = Math.floor(totalSamples / numBuckets);
        
        const rmsBuckets = [];
        let maxRms = 0.001;

        for (let i = 0; i < numBuckets; i++) {
          const start = i * samplesPerBucket;
          const end = Math.min(start + samplesPerBucket, totalSamples);
          
          let sumSquares = 0;
          for (let s = start; s < end; s++) {
            sumSquares += channelData[s] * channelData[s];
          }
          
          const rms = Math.sqrt(sumSquares / Math.max(1, end - start));
          rmsBuckets.push(rms);
          if (rms > maxRms) {
            maxRms = rms;
          }
        }

        rmsDataRef.current = rmsBuckets;
        maxRmsRef.current = maxRms;
        setLoading(false);
        audioCtx.close();
      } catch (err) {
        console.error("Error decoding audio data:", err);
        if (!isAborted) {
          setError(err.message || "Failed to decode audio");
          setLoading(false);
        }
      }
    };

    loadAudio();

    return () => {
      isAborted = true;
    };
  }, [audioUrl]);

  // 2. Draw canvas loop
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const canvasHeight = canvas.height;

    // Clear and draw background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, width, canvasHeight);

    const rms = rmsDataRef.current;
    const maxRms = maxRmsRef.current;

    // Render waveform bars if data is loaded
    if (rms.length > 0) {
      const barWidth = 3;
      const barGap = 1.5;
      const step = (barWidth + barGap);
      const numBars = Math.floor(width / step);

      // Draw the bars
      for (let i = 0; i < numBars; i++) {
        // Find corresponding index in the 1000 buckets array
        const rmsIdx = Math.floor((i / numBars) * rms.length);
        const val = rms[rmsIdx] || 0;
        
        // Normalize height relative to canvas height (leave padding top and bottom)
        const normalizedHeight = (val / maxRms) * (canvasHeight * 0.7);
        const barHeight = Math.max(2, normalizedHeight);
        
        const x = i * step;
        const y = (canvasHeight - barHeight) / 2;

        // Color coding by height: Low (gray), Mid (orange 60%), High (orange 100%)
        const heightRatio = val / maxRms;
        if (heightRatio < 0.3) {
          ctx.fillStyle = '#374151'; // Gray
        } else if (heightRatio < 0.75) {
          ctx.fillStyle = 'rgba(249, 115, 22, 0.6)'; // Orange, 60% opacity
        } else {
          ctx.fillStyle = '#f97316'; // Orange, full opacity
        }

        // Draw vertical bar symmetric to center line
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    } else {
      // Draw centered flat line if no audio decoded
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvasHeight / 2);
      ctx.lineTo(width, canvasHeight / 2);
      ctx.stroke();
    }

    // Draw scene markers: full height, 50% opacity white lines
    if (duration > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      scenes.forEach(scene => {
        const x = (scene.start / duration) * width;
        ctx.fillRect(x, 0, 1, canvasHeight);
      });
    }

    // Draw beat markers: orange ticks at the top of the canvas
    if (duration > 0) {
      ctx.fillStyle = '#f97316';
      beats.forEach(beat => {
        const x = (beat / duration) * width;
        // 4px wide, 12px tall
        ctx.fillRect(x - 2, 0, 4, 12);
      });
    }

    // Draw playhead: 2px white line
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(playheadX - 1, 0, 2, canvasHeight);
    }
  };

  // Redraw when properties change
  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [currentTime, duration, beats, scenes, loading]);

  // Click on canvas seeks the playback
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetTime = (clickX / rect.width) * duration;
    
    // Clamp between boundaries
    const clampedTime = Math.min(duration, Math.max(0, targetTime));
    onSeek(clampedTime);
  };

  return (
    <div 
      className="relative w-full overflow-hidden rounded-xl border border-white/10"
      style={{ height: `${height}px` }}
    >
      {/* Loading scanner state */}
      {loading && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-[#f97316] rounded-full animate-bounce delay-100" />
            <span className="w-1.5 h-4 bg-[#f97316] rounded-full animate-bounce delay-200" />
            <span className="w-1.5 h-4 bg-[#f97316] rounded-full animate-bounce delay-300" />
          </div>
          <span className="text-[10px] text-white/50 font-mono tracking-wider">DECODING AUDIO WAVEFORM...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 px-4 text-center">
          <span className="text-xs text-red-400 font-mono">Error: {error}</span>
        </div>
      )}

      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        width={1000}
        height={height}
        className="w-full h-full cursor-col-resize block"
      />
    </div>
  );
}
