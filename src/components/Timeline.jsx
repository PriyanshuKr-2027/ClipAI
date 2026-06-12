import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import {
  Eye, EyeOff, Lock, Unlock, Scissors, ZoomIn, ZoomOut,
  Film, Music, Volume2,
} from 'lucide-react';
import * as api from '../services/api';

// ── Track meta-config ──────────────────────────────────────────────────────
const TRACK_DEFS = [
  {
    id: 'V1',
    label: 'V1',
    height: 30,
    color: '#f97316',    // orange
    bgCls: 'bg-[#f97316]/10 border-[#f97316]/30',
    activeBgCls: 'bg-[#f97316]/25 border-[#f97316]',
    textCls: 'text-[#f97316]',
    desc: 'Video',
  },
  {
    id: 'B1',
    label: 'B1',
    height: 30,
    color: '#0d9488',    // teal
    bgCls: 'bg-[#0d9488]/10 border-[#0d9488]/30',
    activeBgCls: 'bg-[#0d9488]/25 border-[#0d9488]',
    textCls: 'text-[#0d9488]',
    desc: 'B-Roll',
  },
  {
    id: 'A1',
    label: 'A1',
    height: 30,
    color: '#00d4ff',    // blue
    bgCls: 'bg-[#00d4ff]/10 border-[#00d4ff]/30',
    activeBgCls: 'bg-[#00d4ff]/25 border-[#00d4ff]',
    textCls: 'text-[#00d4ff]',
    desc: 'Audio',
  },
  {
    id: 'M1',
    label: 'M1',
    height: 30,
    color: '#7c3aed',    // purple
    bgCls: 'bg-[#7c3aed]/10 border-[#7c3aed]/30',
    activeBgCls: 'bg-[#7c3aed]/25 border-[#7c3aed]',
    textCls: 'text-[#7c3aed]',
    desc: 'Music',
  },
  {
    id: 'T1',
    label: 'T1',
    height: 26,
    color: '#9ca3af',    // gray
    bgCls: 'bg-white/5 border-white/20',
    activeBgCls: 'bg-white/10 border-white/40',
    textCls: 'text-white/70',
    desc: 'Text',
  },
  {
    id: 'C1',
    label: 'C1',
    height: 26,
    color: '#fb923c',    // lighter orange
    bgCls: 'bg-[#fb923c]/8 border-[#fb923c]/20',
    activeBgCls: 'bg-[#fb923c]/20 border-[#fb923c]/60',
    textCls: 'text-[#fb923c]',
    desc: 'Captions',
  },
];

// Simulated sine-wave bars for waveform visuals
function WaveformBars({ color, count = 22, style }) {
  return (
    <div
      className="w-full h-full flex items-center justify-between px-1 pointer-events-none select-none"
      style={style}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: '2px',
            backgroundColor: color,
            height: `${18 + Math.sin(i * 0.9 + 1) * 55}%`,
            opacity: 0.55,
          }}
        />
      ))}
    </div>
  );
}

export default function Timeline() {
  const store = useEditorStore();
  const {
    clips,
    audioTracks,
    textLayers,
    captionGroups,
    brollTrack = [],
    musicTrack = [],
    currentTime,
    zoom,
    selectedTool,
    selectedClipId,
  } = store;

  const pixelsPerSecond = zoom / 5; // zoom=100 → 20px/s

  // ── Track visibility + lock ───────────────────────────────────────────────
  const [trackSettings, setTrackSettings] = useState(() =>
    Object.fromEntries(TRACK_DEFS.map((t) => [t.id, { visible: true, locked: false }]))
  );

  const toggleVisibility = (track) =>
    setTrackSettings((p) => ({ ...p, [track]: { ...p[track], visible: !p[track].visible } }));

  const toggleLock = (track) =>
    setTrackSettings((p) => ({ ...p, [track]: { ...p[track], locked: !p[track].locked } }));

  // ── Selected B-Roll / Music clip ─────────────────────────────────────────
  const [selectedBRollId, setSelectedBRollId] = useState(null);
  const [selectedMusicId, setSelectedMusicId] = useState(null);

  // ── B1 drop zone ─────────────────────────────────────────────────────────
  const [isDroppingOnB1, setIsDroppingOnB1] = useState(false);

  const handleB1DragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDroppingOnB1(true);
  };

  const handleB1DragLeave = () => setIsDroppingOnB1(false);

  const handleB1Drop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDroppingOnB1(false);

      // Accept JSON payload from BRollPanel or a dragged file
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        try {
          const clip = JSON.parse(jsonData);
          // Snap start to nearest captionGroup boundary if close enough
          const rect = e.currentTarget.getBoundingClientRect();
          const scrollLeft = timelineContentRef.current?.scrollLeft || 0;
          const x = e.clientX - rect.left + scrollLeft;
          let start = Math.max(0, x / pixelsPerSecond);

          // Snap to caption boundaries within 1 second
          for (const g of captionGroups) {
            if (Math.abs(g.startTime - start) < 1) { start = g.startTime; break; }
            if (Math.abs(g.endTime - start) < 1) { start = g.endTime; break; }
          }

          store.addBRollClip({
            id: clip.id || `broll_${Date.now()}`,
            filePath: clip.filePath || '',
            videoUrl: clip.videoUrl || '',
            thumbUrl: clip.thumbUrl || '',
            start,
            end: start + (clip.duration || 5),
            duration: clip.duration || 5,
            label: clip.label || clip.title || 'B-Roll',
          });
        } catch (err) {
          console.error('[B1 drop] JSON parse error:', err);
        }
        return;
      }

      // File drop fallback
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        const rect = e.currentTarget.getBoundingClientRect();
        const scrollLeft = timelineContentRef.current?.scrollLeft || 0;
        const x = e.clientX - rect.left + scrollLeft;
        const start = Math.max(0, x / pixelsPerSecond);
        store.addBRollClip({
          id: `broll_${Date.now()}`,
          filePath: file.name,
          videoUrl: url,
          thumbUrl: '',
          start,
          end: start + 5,
          duration: 5,
          label: file.name,
        });
      }
    },
    [store, captionGroups, pixelsPerSecond]
  );

  // ── M1 music file drop ────────────────────────────────────────────────────
  const [isDroppingOnM1, setIsDroppingOnM1] = useState(false);

  const handleM1DragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDroppingOnM1(true);
  };

  const handleM1DragLeave = () => setIsDroppingOnM1(false);

  const handleM1Drop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDroppingOnM1(false);

      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('audio/')) {
        const url = URL.createObjectURL(file);
        const rect = e.currentTarget.getBoundingClientRect();
        const scrollLeft = timelineContentRef.current?.scrollLeft || 0;
        const x = e.clientX - rect.left + scrollLeft;
        const start = Math.max(0, x / pixelsPerSecond);
        store.addMusicClip({
          id: `music_${Date.now()}`,
          filePath: file.name,
          audioUrl: url,
          start,
          end: start + 30,
          duration: 30,
          volume: 80,
          isDucked: false,
          label: file.name,
        });
      }
    },
    [store, pixelsPerSecond]
  );

  // ── Refs ──────────────────────────────────────────────────────────────────
  const timelineContentRef = useRef(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);

  // ── Total duration ────────────────────────────────────────────────────────
  const totalDuration = (() => {
    let max = 30;
    clips.forEach((c) => { const e = (c.timelineStart || 0) + (c.duration || 0); if (e > max) max = e; });
    captionGroups.forEach((g) => { if (g.endTime > max) max = g.endTime; });
    textLayers.forEach((l) => { const e = (l.startTime || 0) + (l.duration || 0); if (e > max) max = e; });
    brollTrack.forEach((c) => { if ((c.end || 0) > max) max = c.end; });
    musicTrack.forEach((c) => { if ((c.end || 0) > max) max = c.end; });
    if (store.videoInfo?.duration && store.videoInfo.duration > max) max = store.videoInfo.duration;
    return max + 5;
  })();

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      store.setZoom(Math.max(10, Math.min(500, zoom + delta)));
    }
  };

  // ── Seek ──────────────────────────────────────────────────────────────────
  const handleSeek = (clientX) => {
    if (!timelineContentRef.current) return;
    const rect = timelineContentRef.current.getBoundingClientRect();
    const scrollLeft = timelineContentRef.current.scrollLeft;
    const x = clientX - rect.left + scrollLeft;
    store.setCurrentTime(Math.max(0, Math.min(totalDuration, x / pixelsPerSecond)));
  };

  const handlePlayheadMouseDown = (e) => { e.preventDefault(); setIsDraggingPlayhead(true); handleSeek(e.clientX); };
  const handleRulerMouseDown = (e) => { handleSeek(e.clientX); setIsDraggingPlayhead(true); };

  useEffect(() => {
    const move = (e) => { if (isDraggingPlayhead) handleSeek(e.clientX); };
    const up = () => setIsDraggingPlayhead(false);
    if (isDraggingPlayhead) {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isDraggingPlayhead, pixelsPerSecond]);

  // ── Block drag/resize ─────────────────────────────────────────────────────
  const [dragBlock, setDragBlock] = useState(null);

  const handleBlockMouseDown = (e, trackId, blockId, mode) => {
    e.stopPropagation();
    e.preventDefault();
    if (trackSettings[trackId]?.locked) return;

    let target, initialStart, initialDuration;
    if (trackId === 'V1') {
      target = clips.find((c) => c.id === blockId);
      if (!target) return;
      initialStart = target.timelineStart || 0;
      initialDuration = target.duration;
    } else if (trackId === 'T1') {
      target = textLayers.find((l) => l.id === blockId);
      if (!target) return;
      initialStart = target.startTime || 0;
      initialDuration = target.duration;
    } else if (trackId === 'B1') {
      target = brollTrack.find((c) => c.id === blockId);
      if (!target) return;
      initialStart = target.start || 0;
      initialDuration = target.duration;
    } else if (trackId === 'M1') {
      target = musicTrack.find((c) => c.id === blockId);
      if (!target) return;
      initialStart = target.start || 0;
      initialDuration = target.duration;
    } else {
      return;
    }

    setDragBlock({ type: trackId, id: blockId, mode, startX: e.clientX, initialStart, initialDuration });
  };

  useEffect(() => {
    const move = (e) => {
      if (!dragBlock) return;
      const deltaX = e.clientX - dragBlock.startX;
      const deltaSec = deltaX / pixelsPerSecond;
      store.takeSnapshot();

      if (dragBlock.type === 'V1') {
        if (dragBlock.mode === 'drag') {
          store.updateClipSegment(dragBlock.id, { timelineStart: Math.max(0, dragBlock.initialStart + deltaSec) });
        } else if (dragBlock.mode === 'resize-left') {
          const newStart = Math.max(0, dragBlock.initialStart + deltaSec);
          const diff = dragBlock.initialStart - newStart;
          store.updateClipSegment(dragBlock.id, { timelineStart: newStart, duration: Math.max(0.5, dragBlock.initialDuration + diff) });
        } else if (dragBlock.mode === 'resize-right') {
          store.updateClipSegment(dragBlock.id, { duration: Math.max(0.5, dragBlock.initialDuration + deltaSec) });
        }
      } else if (dragBlock.type === 'T1') {
        if (dragBlock.mode === 'drag') {
          store.updateTextLayer(dragBlock.id, { startTime: Math.max(0, dragBlock.initialStart + deltaSec) });
        } else if (dragBlock.mode === 'resize-left') {
          const newStart = Math.max(0, dragBlock.initialStart + deltaSec);
          store.updateTextLayer(dragBlock.id, { startTime: newStart, duration: Math.max(0.5, dragBlock.initialDuration + (dragBlock.initialStart - newStart)) });
        } else if (dragBlock.mode === 'resize-right') {
          store.updateTextLayer(dragBlock.id, { duration: Math.max(0.5, dragBlock.initialDuration + deltaSec) });
        }
      } else if (dragBlock.type === 'B1') {
        const newStart = Math.max(0, dragBlock.initialStart + deltaSec);
        if (dragBlock.mode === 'drag') {
          store.updateBRollClip(dragBlock.id, { start: newStart, end: newStart + dragBlock.initialDuration });
        } else if (dragBlock.mode === 'resize-right') {
          const newDur = Math.max(0.5, dragBlock.initialDuration + deltaSec);
          store.updateBRollClip(dragBlock.id, { duration: newDur, end: dragBlock.initialStart + newDur });
        }
      } else if (dragBlock.type === 'M1') {
        const newStart = Math.max(0, dragBlock.initialStart + deltaSec);
        if (dragBlock.mode === 'drag') {
          store.updateMusicClip(dragBlock.id, { start: newStart, end: newStart + dragBlock.initialDuration });
        } else if (dragBlock.mode === 'resize-right') {
          const newDur = Math.max(0.5, dragBlock.initialDuration + deltaSec);
          store.updateMusicClip(dragBlock.id, { duration: newDur, end: dragBlock.initialStart + newDur });
        }
      }
    };
    const up = () => setDragBlock(null);
    if (dragBlock) {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragBlock, pixelsPerSecond]);

  // ── Split clip ────────────────────────────────────────────────────────────
  const handleSplitClip = async () => {
    const activeClip = clips.find(
      (c) => currentTime >= (c.timelineStart || 0) && currentTime < (c.timelineStart || 0) + (c.duration || 0)
    );
    if (!activeClip) return;
    const offset = currentTime - (activeClip.timelineStart || 0);
    if (offset <= 0.2 || offset >= activeClip.duration - 0.2) return;

    setIsSplitting(true);
    try {
      const n1 = `split_${Date.now()}_1`, n2 = `split_${Date.now()}_2`;
      const [cut1, cut2] = await Promise.all([
        api.cutClip(activeClip.videoPath || store.videoPath, 0, offset, n1),
        api.cutClip(activeClip.videoPath || store.videoPath, offset, activeClip.duration, n2),
      ]);
      const idx = clips.findIndex((c) => c.id === activeClip.id);
      const updated = [...clips];
      updated.splice(idx, 1,
        { ...activeClip, id: n1, videoPath: cut1.clipPath, videoUrl: cut1.clipUrl, duration: offset },
        { ...activeClip, id: n2, videoPath: cut2.clipPath, videoUrl: cut2.clipUrl, duration: activeClip.duration - offset, timelineStart: (activeClip.timelineStart || 0) + offset }
      );
      store.takeSnapshot();
      useEditorStore.setState({ clips: updated, selectedClipId: n1 });
    } catch (err) {
      console.error(err);
      alert('Split failed. Check server console.');
    } finally {
      setIsSplitting(false);
    }
  };

  const fmt = (secs) => {
    const m = Math.floor(secs / 60), s = Math.floor(secs % 60), ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  // ── Resize handle shared renderer ────────────────────────────────────────
  const ResizeHandle = ({ side, trackId, blockId, color }) => (
    <div
      onMouseDown={(e) => handleBlockMouseDown(e, trackId, blockId, `resize-${side}`)}
      className={`absolute ${side}-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity rounded-${side === 'left' ? 'l' : 'r'}`}
      style={{ backgroundColor: color }}
    />
  );

  return (
    <div
      className="glass-panel rounded-none border-t border-b-0 border-x-0 bg-[#0a0a10]/95 flex flex-col relative select-none z-40 overflow-hidden"
      style={{ height: `${36 + 20 + TRACK_DEFS.reduce((a, t) => a + t.height, 0) + TRACK_DEFS.length * 1}px` }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="h-9 border-b border-white/5 px-4 flex items-center justify-between text-xs text-white/50 bg-[#060608]/40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[#7c5cfc] font-semibold">{fmt(currentTime)}</span>
          <div className="h-3 w-px bg-white/10" />
          <span className="font-mono">Zoom: {zoom}%</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSplitClip}
            disabled={isSplitting || !clips.some((c) => currentTime >= (c.timelineStart || 0) && currentTime < (c.timelineStart || 0) + (c.duration || 0))}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#7c5cfc]/15 hover:bg-[#7c5cfc]/20 border border-[#7c5cfc]/30 text-white transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Scissors size={12} />
            <span>{isSplitting ? 'Splitting…' : 'Split'}</span>
          </button>
          <div className="h-3 w-px bg-white/10 mx-1" />
          <button onClick={() => store.setZoom(Math.max(10, zoom - 15))} className="p-1 rounded hover:bg-white/10 hover:text-white"><ZoomOut size={14} /></button>
          <button onClick={() => store.setZoom(Math.min(500, zoom + 15))} className="p-1 rounded hover:bg-white/10 hover:text-white"><ZoomIn size={14} /></button>
        </div>
      </div>

      {/* ── Main workspace ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Track label column */}
        <div className="w-16 flex flex-col border-r border-white/5 bg-[#09090f] z-10 flex-shrink-0">
          {/* Ruler spacer */}
          <div className="h-5 border-b border-white/5 bg-[#060608]/50" />

          {TRACK_DEFS.map((t) => {
            const s = trackSettings[t.id];
            return (
              <div
                key={t.id}
                className="border-b border-white/5 flex items-center justify-between px-2"
                style={{ height: `${t.height}px`, flexShrink: 0 }}
              >
                <span
                  className="text-[10px] font-mono font-bold truncate"
                  style={{ color: t.color, opacity: s.visible ? 1 : 0.35 }}
                  title={t.desc}
                >
                  {t.label}
                </span>
                <div className="flex gap-[3px]">
                  <button
                    onClick={() => toggleVisibility(t.id)}
                    className="hover:text-white transition-colors"
                    style={{ color: s.visible ? 'rgba(255,255,255,0.3)' : '#ff4d6a' }}
                    title={s.visible ? 'Hide track' : 'Show track'}
                  >
                    {s.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                  </button>
                  <button
                    onClick={() => toggleLock(t.id)}
                    className="hover:text-white transition-colors"
                    style={{ color: s.locked ? '#ffb300' : 'rgba(255,255,255,0.3)' }}
                    title={s.locked ? 'Unlock track' : 'Lock track'}
                  >
                    {s.locked ? <Lock size={9} /> : <Unlock size={9} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable track area */}
        <div
          ref={timelineContentRef}
          onWheel={handleWheel}
          className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#060608]/60 flex flex-col"
        >
          <div
            className="relative h-full flex flex-col"
            style={{ width: `${totalDuration * pixelsPerSecond}px` }}
          >

            {/* Ruler */}
            <div
              onMouseDown={handleRulerMouseDown}
              className="h-5 bg-[#0a0a10]/60 border-b border-white/5 cursor-ew-resize relative flex-shrink-0"
            >
              {Array.from({ length: Math.ceil(totalDuration / 5) }).map((_, i) => {
                const sec = i * 5;
                return (
                  <div
                    key={sec}
                    className="absolute top-0 bottom-0 border-l border-white/10 flex items-center pl-1 font-mono text-[9px] text-white/35"
                    style={{ left: `${sec * pixelsPerSecond}px` }}
                  >
                    {fmt(sec).split('.')[0]}
                  </div>
                );
              })}
            </div>

            {/* ── V1: Video track ────────────────────────────────────────── */}
            <div
              className="border-b border-white/5 relative"
              style={{ height: '30px', background: 'rgba(249,115,22,0.02)' }}
            >
              {trackSettings.V1.visible && clips.map((clip) => {
                const isSelected = selectedClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    onClick={(e) => { e.stopPropagation(); store.setSelectedClip(clip.id); }}
                    onMouseDown={(e) => handleBlockMouseDown(e, 'V1', clip.id, 'drag')}
                    className={`absolute top-[2px] bottom-[2px] rounded border flex items-center px-2 cursor-grab active:cursor-grabbing group overflow-hidden transition-all ${isSelected ? 'bg-[#f97316]/20 border-[#f97316] shadow-[0_0_8px_rgba(249,115,22,0.3)]' : 'bg-[#f97316]/8 border-[#f97316]/25 hover:border-[#f97316]/50'}`}
                    style={{ left: `${(clip.timelineStart || 0) * pixelsPerSecond}px`, width: `${(clip.duration || 0) * pixelsPerSecond}px` }}
                  >
                    <ResizeHandle side="left" trackId="V1" blockId={clip.id} color="#f97316" />
                    <span className="text-[10px] font-semibold text-[#f97316] truncate pointer-events-none">{clip.title || 'Video'}</span>
                    <ResizeHandle side="right" trackId="V1" blockId={clip.id} color="#f97316" />
                  </div>
                );
              })}
            </div>

            {/* ── B1: B-Roll track ───────────────────────────────────────── */}
            <div
              className={`border-b border-white/5 relative transition-all ${isDroppingOnB1 ? 'bg-[#0d9488]/15 ring-1 ring-inset ring-[#0d9488]/50' : 'bg-[#0d9488]/[0.015]'}`}
              style={{ height: '30px' }}
              onDragOver={handleB1DragOver}
              onDragLeave={handleB1DragLeave}
              onDrop={handleB1Drop}
            >
              {/* Drop hint */}
              {isDroppingOnB1 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <span className="text-[10px] text-[#0d9488] font-semibold flex items-center gap-1">
                    <Film size={10} /> Drop B-Roll here
                  </span>
                </div>
              )}

              {trackSettings.B1.visible && brollTrack.map((clip) => {
                const isSelected = selectedBRollId === clip.id;
                const w = (clip.duration || 0) * pixelsPerSecond;
                return (
                  <div
                    key={clip.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedBRollId(clip.id); }}
                    onMouseDown={(e) => handleBlockMouseDown(e, 'B1', clip.id, 'drag')}
                    className={`absolute top-[2px] bottom-[2px] rounded border flex items-center cursor-grab active:cursor-grabbing group overflow-hidden transition-all ${isSelected ? 'bg-[#0d9488]/25 border-[#0d9488] shadow-[0_0_6px_rgba(13,148,136,0.4)]' : 'bg-[#0d9488]/10 border-[#0d9488]/30 hover:border-[#0d9488]/70'}`}
                    style={{ left: `${(clip.start || 0) * pixelsPerSecond}px`, width: `${w}px` }}
                  >
                    {/* Thumbnail */}
                    {clip.thumbUrl && w > 40 && (
                      <img
                        src={clip.thumbUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                      />
                    )}
                    <ResizeHandle side="left" trackId="B1" blockId={clip.id} color="#0d9488" />
                    <Film size={9} className="text-[#0d9488] flex-shrink-0 ml-1 pointer-events-none" />
                    {w > 50 && (
                      <span className="text-[9px] font-semibold text-[#0d9488] truncate ml-1 pointer-events-none">{clip.label || 'B-Roll'}</span>
                    )}
                    <ResizeHandle side="right" trackId="B1" blockId={clip.id} color="#0d9488" />
                  </div>
                );
              })}
            </div>

            {/* ── A1: Audio track ────────────────────────────────────────── */}
            <div
              className="border-b border-white/5 relative"
              style={{ height: '30px', background: 'rgba(0,212,255,0.015)' }}
            >
              {trackSettings.A1.visible && audioTracks.map((track) => (
                <div
                  key={track.id}
                  className="absolute top-[2px] bottom-[2px] rounded border border-[#00d4ff]/30 bg-[#00d4ff]/8 overflow-hidden"
                  style={{ left: `${(track.startTime || 0) * pixelsPerSecond}px`, width: `${(track.duration || 0) * pixelsPerSecond}px` }}
                >
                  <WaveformBars color="#00d4ff" />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-[#00d4ff] pointer-events-none">
                    {track.name || 'Audio'}
                  </span>
                </div>
              ))}
            </div>

            {/* ── M1: Music track ────────────────────────────────────────── */}
            <div
              className={`border-b border-white/5 relative transition-all ${isDroppingOnM1 ? 'bg-[#7c3aed]/15 ring-1 ring-inset ring-[#7c3aed]/50' : 'bg-[#7c3aed]/[0.015]'}`}
              style={{ height: '30px' }}
              onDragOver={handleM1DragOver}
              onDragLeave={handleM1DragLeave}
              onDrop={handleM1Drop}
            >
              {isDroppingOnM1 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <span className="text-[10px] text-[#7c3aed] font-semibold flex items-center gap-1">
                    <Music size={10} /> Drop audio here
                  </span>
                </div>
              )}

              {trackSettings.M1.visible && musicTrack.map((clip) => {
                const isSelected = selectedMusicId === clip.id;
                const w = (clip.duration || 0) * pixelsPerSecond;
                return (
                  <div
                    key={clip.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedMusicId(clip.id); }}
                    onMouseDown={(e) => handleBlockMouseDown(e, 'M1', clip.id, 'drag')}
                    className={`absolute top-[2px] bottom-[2px] rounded border overflow-hidden cursor-grab active:cursor-grabbing group transition-all ${isSelected ? 'border-[#7c3aed] shadow-[0_0_6px_rgba(124,58,237,0.5)]' : 'border-[#7c3aed]/30 hover:border-[#7c3aed]/60'}`}
                    style={{ left: `${(clip.start || 0) * pixelsPerSecond}px`, width: `${w}px`, background: 'rgba(124,58,237,0.1)' }}
                  >
                    {/* Waveform bars in orange-ish purple */}
                    <WaveformBars color="#a78bfa" count={Math.max(4, Math.floor(w / 6))} />

                    {/* Ducking overlay */}
                    {clip.isDucked && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                        <Volume2 size={9} className="text-[#7c3aed] opacity-70" />
                      </div>
                    )}

                    <ResizeHandle side="left" trackId="M1" blockId={clip.id} color="#7c3aed" />
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none z-10">
                      <Music size={8} className="text-[#a78bfa] flex-shrink-0" />
                      {w > 60 && <span className="text-[9px] font-semibold text-[#a78bfa] truncate max-w-[80px]">{clip.label || 'Music'}</span>}
                    </div>
                    {/* Volume chip */}
                    {w > 80 && (
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[8px] font-mono text-[#a78bfa]/70 pointer-events-none">
                        {clip.volume ?? 80}%
                      </span>
                    )}
                    <ResizeHandle side="right" trackId="M1" blockId={clip.id} color="#7c3aed" />
                  </div>
                );
              })}
            </div>

            {/* ── T1: Text track ─────────────────────────────────────────── */}
            <div
              className="border-b border-white/5 relative"
              style={{ height: '26px', background: 'rgba(255,255,255,0.01)' }}
            >
              {trackSettings.T1.visible && textLayers.map((layer) => (
                <div
                  key={layer.id}
                  onMouseDown={(e) => handleBlockMouseDown(e, 'T1', layer.id, 'drag')}
                  className="absolute top-[2px] bottom-[2px] rounded border border-white/20 bg-white/5 flex items-center px-2 cursor-grab active:cursor-grabbing group overflow-hidden hover:border-white/40 transition-colors"
                  style={{ left: `${(layer.startTime || 0) * pixelsPerSecond}px`, width: `${(layer.duration || 0) * pixelsPerSecond}px` }}
                >
                  <ResizeHandle side="left" trackId="T1" blockId={layer.id} color="#9ca3af" />
                  <span className="text-[9px] font-semibold text-white/70 truncate pointer-events-none">{layer.text || 'Text'}</span>
                  <ResizeHandle side="right" trackId="T1" blockId={layer.id} color="#9ca3af" />
                </div>
              ))}
            </div>

            {/* ── C1: Caption track ──────────────────────────────────────── */}
            <div
              className="border-b border-white/5 relative"
              style={{ height: '26px', background: 'rgba(251,146,60,0.015)' }}
            >
              {trackSettings.C1.visible && captionGroups.map((group) => {
                const active = currentTime >= group.startTime && currentTime <= group.endTime;
                return (
                  <div
                    key={group.id}
                    className={`absolute top-[2px] bottom-[2px] rounded border text-[9px] flex items-center px-1 overflow-hidden pointer-events-none transition-all ${active ? 'bg-[#fb923c]/20 border-[#fb923c]/60 text-[#fb923c] font-semibold shadow-[0_0_6px_rgba(251,146,60,0.3)]' : 'bg-[#fb923c]/5 border-[#fb923c]/15 text-white/40'}`}
                    style={{ left: `${group.startTime * pixelsPerSecond}px`, width: `${(group.endTime - group.startTime) * pixelsPerSecond}px` }}
                  >
                    <span className="truncate">{group.text}</span>
                  </div>
                );
              })}
            </div>

            {/* ── Playhead ───────────────────────────────────────────────── */}
            <div
              className="absolute top-0 bottom-0 w-[1.5px] bg-[#7c5cfc] z-30 pointer-events-none"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              <div
                onMouseDown={handlePlayheadMouseDown}
                className="w-3 h-3 bg-[#7c5cfc] rotate-45 -translate-y-[4px] -translate-x-[5px] cursor-grab active:cursor-grabbing border border-white/20 pointer-events-auto"
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
