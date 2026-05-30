import React, { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Eye, EyeOff, Lock, Unlock, Scissors, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import * as api from '../services/api';

export default function Timeline() {
  const store = useEditorStore();
  const {
    clips,
    audioTracks,
    textLayers,
    captionGroups,
    currentTime,
    zoom,
    selectedTool,
    selectedClipId,
    isPlaying,
  } = store;

  const pixelsPerSecond = zoom / 5; // e.g. at zoom=100, 20px per second

  // Track settings (visible & locked states)
  const [trackSettings, setTrackSettings] = useState({
    V1: { visible: true, locked: false },
    A1: { visible: true, locked: false },
    T1: { visible: true, locked: false },
    C1: { visible: true, locked: false },
  });

  const toggleVisibility = (track) => {
    setTrackSettings((prev) => ({
      ...prev,
      [track]: { ...prev[track], visible: !prev[track].visible },
    }));
  };

  const toggleLock = (track) => {
    setTrackSettings((prev) => ({
      ...prev,
      [track]: { ...prev[track], locked: !prev[track].locked },
    }));
  };

  const timelineContentRef = useRef(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);

  // Total timeline duration based on clips or audio or captions
  const getTimelineDuration = () => {
    let max = 30; // default minimum 30s
    clips.forEach((c) => {
      const end = (c.timelineStart || 0) + (c.duration || 0);
      if (end > max) max = end;
    });
    captionGroups.forEach((g) => {
      if (g.endTime > max) max = g.endTime;
    });
    textLayers.forEach((l) => {
      const end = (l.startTime || 0) + (l.duration || 0);
      if (end > max) max = end;
    });
    if (store.videoInfo?.duration && store.videoInfo.duration > max) {
      max = store.videoInfo.duration;
    }
    return max + 5; // padding
  };

  const totalDuration = getTimelineDuration();

  // Handle zooming via wheel event
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      const newZoom = Math.max(10, Math.min(500, zoom + delta));
      store.setZoom(newZoom);
    }
  };

  // Playhead dragging & seeking
  const handleSeek = (clientX) => {
    if (!timelineContentRef.current) return;
    const rect = timelineContentRef.current.getBoundingClientRect();
    const scrollLeft = timelineContentRef.current.scrollLeft;
    const x = clientX - rect.left + scrollLeft;
    const newTime = Math.max(0, Math.min(totalDuration, x / pixelsPerSecond));
    store.setCurrentTime(newTime);
  };

  const handlePlayheadMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingPlayhead(true);
    handleSeek(e.clientX);
  };

  const handleTimelineRulerMouseDown = (e) => {
    handleSeek(e.clientX);
    setIsDraggingPlayhead(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingPlayhead) {
        handleSeek(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    if (isDraggingPlayhead) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, pixelsPerSecond]);

  // Block Dragging & Resizing State
  const [dragBlock, setDragBlock] = useState(null);

  const handleBlockMouseDown = (e, blockType, blockId, mode) => {
    e.stopPropagation();
    e.preventDefault();

    // Do not allow dragging if track is locked
    if (trackSettings[blockType]?.locked) return;

    let targetBlock;
    if (blockType === 'V1') targetBlock = clips.find((c) => c.id === blockId);
    else if (blockType === 'T1') targetBlock = textLayers.find((l) => l.id === blockId);

    if (!targetBlock) return;

    const initialStart = blockType === 'V1' ? (targetBlock.timelineStart || 0) : targetBlock.startTime;
    const initialDuration = targetBlock.duration;

    setDragBlock({
      type: blockType,
      id: blockId,
      mode, // 'drag' | 'resize-left' | 'resize-right'
      startX: e.clientX,
      initialStart,
      initialDuration,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragBlock) return;

      const deltaX = e.clientX - dragBlock.startX;
      const deltaSec = deltaX / pixelsPerSecond;

      store.takeSnapshot();

      if (dragBlock.mode === 'drag') {
        const newStart = Math.max(0, dragBlock.initialStart + deltaSec);
        if (dragBlock.type === 'V1') {
          store.updateClipSegment(dragBlock.id, { timelineStart: newStart });
        } else if (dragBlock.type === 'T1') {
          store.updateTextLayer(dragBlock.id, { startTime: newStart });
        }
      } else if (dragBlock.mode === 'resize-left') {
        const newStart = Math.max(0, dragBlock.initialStart + deltaSec);
        const diff = dragBlock.initialStart - newStart;
        const newDuration = Math.max(0.5, dragBlock.initialDuration + diff);

        if (dragBlock.type === 'V1') {
          store.updateClipSegment(dragBlock.id, {
            timelineStart: newStart,
            duration: newDuration,
          });
        } else if (dragBlock.type === 'T1') {
          store.updateTextLayer(dragBlock.id, {
            startTime: newStart,
            duration: newDuration,
          });
        }
      } else if (dragBlock.mode === 'resize-right') {
        const newDuration = Math.max(0.5, dragBlock.initialDuration + deltaSec);

        if (dragBlock.type === 'V1') {
          store.updateClipSegment(dragBlock.id, { duration: newDuration });
        } else if (dragBlock.type === 'T1') {
          store.updateTextLayer(dragBlock.id, { duration: newDuration });
        }
      }
    };

    const handleMouseUp = () => {
      setDragBlock(null);
    };

    if (dragBlock) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragBlock, pixelsPerSecond]);

  // Video splitting logic
  const handleSplitClip = async () => {
    const activeClip = clips.find(
      (c) => currentTime >= (c.timelineStart || 0) && currentTime < (c.timelineStart || 0) + (c.duration || 0)
    );

    if (!activeClip) return;

    const offset = currentTime - (activeClip.timelineStart || 0);
    if (offset <= 0.2 || offset >= activeClip.duration - 0.2) return; // avoid slivers

    setIsSplitting(true);
    try {
      const outputName1 = `split_${Date.now()}_1`;
      const outputName2 = `split_${Date.now()}_2`;

      // Split physically using FFmpeg
      const cut1 = await api.cutClip(activeClip.videoPath || store.videoPath, 0, offset, outputName1);
      const cut2 = await api.cutClip(activeClip.videoPath || store.videoPath, offset, activeClip.duration, outputName2);

      const firstHalf = {
        ...activeClip,
        id: outputName1,
        videoPath: cut1.clipPath,
        videoUrl: cut1.clipUrl,
        duration: offset,
      };

      const secondHalf = {
        ...activeClip,
        id: outputName2,
        videoPath: cut2.clipPath,
        videoUrl: cut2.clipUrl,
        duration: activeClip.duration - offset,
        timelineStart: (activeClip.timelineStart || 0) + offset,
      };

      // Replace the original clip with both segments
      const index = clips.findIndex((c) => c.id === activeClip.id);
      const updatedClips = [...clips];
      updatedClips.splice(index, 1, firstHalf, secondHalf);

      store.takeSnapshot();
      useEditorStore.setState({ clips: updatedClips, selectedClipId: firstHalf.id });
    } catch (e) {
      console.error(e);
      alert('Split failed. Check server console.');
    } finally {
      setIsSplitting(false);
    }
  };

  const formatTimestamp = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="glass-panel rounded-none border-t border-b-0 border-x-0 bg-[#0a0a10]/95 h-[175px] flex flex-col relative select-none z-40 overflow-hidden">
      {/* Timeline Controls Toolbar */}
      <div className="h-9 border-b border-white/5 px-4 flex items-center justify-between text-xs text-white/50 bg-[#060608]/40">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[#7c5cfc] font-semibold">
            {formatTimestamp(currentTime)}
          </span>
          <div className="h-3 w-[1px] bg-white/10" />
          <span className="font-mono">Zoom: {zoom}%</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Split button */}
          <button
            onClick={handleSplitClip}
            disabled={
              isSplitting ||
              !clips.some(
                (c) =>
                  currentTime >= (c.timelineStart || 0) &&
                  currentTime < (c.timelineStart || 0) + (c.duration || 0)
              )
            }
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#7c5cfc]/15 hover:bg-[#7c5cfc]/20 border border-[#7c5cfc]/30 text-white transition-all disabled:opacity-40 disabled:pointer-events-none"
            title="Split Clip at Playhead"
          >
            <Scissors size={12} />
            <span>{isSplitting ? 'Splitting...' : 'Split'}</span>
          </button>

          <div className="h-3 w-[1px] bg-white/10 mx-1" />

          {/* Zoom controls */}
          <button
            onClick={() => store.setZoom(Math.max(10, zoom - 15))}
            className="p-1 rounded hover:bg-white/10 hover:text-white"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => store.setZoom(Math.min(500, zoom + 15))}
            className="p-1 rounded hover:bg-white/10 hover:text-white"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* Main Track Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Labels */}
        <div className="w-16 flex flex-col border-r border-white/5 bg-[#0a0a10] z-10">
          {['V1', 'A1', 'T1', 'C1'].map((track) => {
            const isVisible = trackSettings[track].visible;
            const isLocked = trackSettings[track].locked;

            return (
              <div
                key={track}
                className="h-[28px] border-b border-white/5 flex items-center justify-between px-2 text-xs font-mono font-bold text-white/40"
              >
                <span>{track}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleVisibility(track)}
                    className={`hover:text-white transition-colors ${!isVisible ? 'text-[#ff4d6a]' : ''}`}
                  >
                    {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                  </button>
                  <button
                    onClick={() => toggleLock(track)}
                    className={`hover:text-white transition-colors ${isLocked ? 'text-warning' : ''}`}
                  >
                    {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Track Content */}
        <div
          ref={timelineContentRef}
          onWheel={handleWheel}
          className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#060608]/60 flex flex-col"
        >
          {/* Scrollable container with width matching duration */}
          <div
            className="relative h-full flex flex-col"
            style={{ width: `${totalDuration * pixelsPerSecond}px` }}
          >
            {/* Timeline Ruler */}
            <div
              onMouseDown={handleTimelineRulerMouseDown}
              className="h-5 bg-[#0a0a10]/60 border-b border-white/5 cursor-ew-resize relative flex-shrink-0"
            >
              {/* Ruler ticks every 5 seconds */}
              {Array.from({ length: Math.ceil(totalDuration / 5) }).map((_, i) => {
                const sec = i * 5;
                return (
                  <div
                    key={sec}
                    className="absolute top-0 bottom-0 border-l border-white/10 flex items-center pl-1 font-mono text-[9px] text-white/35"
                    style={{ left: `${sec * pixelsPerSecond}px` }}
                  >
                    {formatTimestamp(sec).split('.')[0]}
                  </div>
                );
              })}
            </div>

            {/* V1 (Video) Track */}
            <div className="h-[28px] border-b border-white/5 relative bg-white/[0.01]">
              {trackSettings.V1.visible &&
                clips.map((clip) => {
                  const isSelected = selectedClipId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        store.setSelectedClip(clip.id);
                      }}
                      onMouseDown={(e) => handleBlockMouseDown(e, 'V1', clip.id, 'drag')}
                      className={`absolute top-[2px] bottom-[2px] rounded border flex items-center justify-between px-2 cursor-grab active:cursor-grabbing group overflow-hidden ${
                        isSelected
                          ? 'bg-[#7c5cfc]/20 border-[#7c5cfc] shadow-glow-sm'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                      style={{
                        left: `${(clip.timelineStart || 0) * pixelsPerSecond}px`,
                        width: `${(clip.duration || 0) * pixelsPerSecond}px`,
                      }}
                    >
                      {/* Left Resize Handle */}
                      <div
                        onMouseDown={(e) => handleBlockMouseDown(e, 'V1', clip.id, 'resize-left')}
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-transparent hover:bg-[#7c5cfc] opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                      <span className="text-[10px] font-semibold text-white/80 truncate pointer-events-none">
                        {clip.title || 'Video Clip'}
                      </span>
                      {/* Right Resize Handle */}
                      <div
                        onMouseDown={(e) => handleBlockMouseDown(e, 'V1', clip.id, 'resize-right')}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-transparent hover:bg-[#7c5cfc] opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  );
                })}
            </div>

            {/* A1 (Audio) Track */}
            <div className="h-[28px] border-b border-white/5 relative bg-white/[0.01]">
              {trackSettings.A1.visible &&
                audioTracks.map((track) => (
                  <div
                    key={track.id}
                    className="absolute top-[2px] bottom-[2px] rounded border border-[#00d4ff]/30 bg-[#00d4ff]/10 flex items-center overflow-hidden"
                    style={{
                      left: `${(track.startTime || 0) * pixelsPerSecond}px`,
                      width: `${(track.duration || 0) * pixelsPerSecond}px`,
                    }}
                  >
                    {/* Visual Simulated Waveform */}
                    <div className="w-full h-full flex items-center justify-between px-1 opacity-50 pointer-events-none">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-[2px] bg-[#00d4ff] rounded-full"
                          style={{ height: `${20 + Math.sin(i * 0.8) * 60}%` }}
                        />
                      ))}
                    </div>
                    <span className="absolute left-2 text-[10px] font-semibold text-[#00d4ff] truncate pointer-events-none">
                      {track.name || 'Audio Track'}
                    </span>
                  </div>
                ))}
            </div>

            {/* T1 (Text) Track */}
            <div className="h-[28px] border-b border-white/5 relative bg-white/[0.01]">
              {trackSettings.T1.visible &&
                textLayers.map((layer) => (
                  <div
                    key={layer.id}
                    onMouseDown={(e) => handleBlockMouseDown(e, 'T1', layer.id, 'drag')}
                    className="absolute top-[2px] bottom-[2px] rounded border border-accent-teal/30 bg-accent-teal/10 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing group overflow-hidden"
                    style={{
                      left: `${(layer.startTime || 0) * pixelsPerSecond}px`,
                      width: `${(layer.duration || 0) * pixelsPerSecond}px`,
                    }}
                  >
                    <div
                      onMouseDown={(e) => handleBlockMouseDown(e, 'T1', layer.id, 'resize-left')}
                      className="absolute left-0 top-0 bottom-0 w-1 bg-transparent hover:bg-accent-teal cursor-ew-resize opacity-0 group-hover:opacity-100"
                    />
                    <span className="text-[10px] font-semibold text-accent-teal truncate pointer-events-none">
                      {layer.text || 'Text Layer'}
                    </span>
                    <div
                      onMouseDown={(e) => handleBlockMouseDown(e, 'T1', layer.id, 'resize-right')}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-accent-teal cursor-ew-resize opacity-0 group-hover:opacity-100"
                    />
                  </div>
                ))}
            </div>

            {/* C1 (Caption) Track */}
            <div className="h-[28px] border-b border-white/5 relative bg-white/[0.01]">
              {trackSettings.C1.visible &&
                captionGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`absolute top-[2px] bottom-[2px] rounded border text-[9px] flex items-center px-1 overflow-hidden pointer-events-none ${
                      currentTime >= group.startTime && currentTime <= group.endTime
                        ? 'border-warning/50 bg-warning/15 text-warning font-semibold shadow-glow-sm'
                        : 'border-white/5 bg-white/5 text-white/50'
                    }`}
                    style={{
                      left: `${group.startTime * pixelsPerSecond}px`,
                      width: `${(group.endTime - group.startTime) * pixelsPerSecond}px`,
                    }}
                  >
                    <span className="truncate">{group.text}</span>
                  </div>
                ))}
            </div>

            {/* Playhead Vertical Line overlay */}
            <div
              className="absolute top-0 bottom-0 w-[1.5px] bg-[#7c5cfc] z-30 pointer-events-none flex flex-col items-center"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              {/* Playhead handle */}
              <div
                onMouseDown={handlePlayheadMouseDown}
                className="w-3 h-3 bg-[#7c5cfc] rotate-45 transform -translate-y-[4px] cursor-grab active:cursor-grabbing border border-white/20 pointer-events-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
