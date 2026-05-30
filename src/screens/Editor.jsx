import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import Timeline from '../components/Timeline';
import CaptionOverlay from '../components/CaptionOverlay';
import ExportSheet from '../components/ExportSheet';
import { AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, CornerUpLeft, CornerUpRight, Subtitles, Film,
  Play, Pause, Volume2, Maximize, Scissors, Crop, Type, Gauge,
  VolumeX, Trash2, Plus, Sparkles, RefreshCw, SkipBack, SkipForward,
  Check, AlertTriangle
} from 'lucide-react';
import * as api from '../services/api';

export default function Editor() {
  const navigate = useNavigate();
  const store = useEditorStore();

  const {
    clips,
    textLayers,
    captionGroups,
    selectedTool,
    selectedClipId,
    currentTime,
    isPlaying,
    projectName,
    language,
  } = store;

  // Redirect to projects if no video source is present
  useEffect(() => {
    if (!store.videoUrl) {
      navigate('/projects');
    }
  }, [store.videoUrl, navigate]);

  // Sync V1 track: if videoUrl is set but clips is empty, load the full video as first V1 clip
  useEffect(() => {
    if (store.videoUrl && clips.length === 0) {
      store.addClipSegment({
        id: 'clip_original',
        title: store.filename || 'Original Clip',
        duration: store.videoInfo?.duration || 30,
        timelineStart: 0,
        videoPath: store.videoPath,
        videoUrl: store.videoUrl,
        thumbUrl: '',
      });
    }
  }, [store.videoUrl, clips]);

  // Debounced auto-save (5s)
  useEffect(() => {
    const timer = setTimeout(() => { store.saveProject(); }, 5000);
    return () => clearTimeout(timer);
  }, [clips, textLayers, captionGroups, store.selectedStyle, projectName]);

  // ── Component state ─────────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const seekRef = useRef(null);

  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);  // actual media duration
  const [isSeeking, setIsSeeking] = useState(false);

  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projNameInput, setProjNameInput] = useState(projectName || 'Untitled Project');
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');

  // Tool-specific state
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(0);
  const [speedVal, setSpeedVal] = useState(1.0);
  const [cropX, setCropX] = useState(10);
  const [cropY, setCropY] = useState(10);
  const [cropW, setCropW] = useState(80);
  const [cropH, setCropH] = useState(80);
  const [textInput, setTextInput] = useState('');
  const [textSize, setTextSize] = useState(32);
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBold, setTextBold] = useState(false);
  const [confirmDeleteClip, setConfirmDeleteClip] = useState(false);

  // ── Derived: selected clip ──────────────────────────────────────────────────
  const selectedClip = clips.find((c) => c.id === selectedClipId) || clips[0];
  const activeClip =
    clips.find(
      (c) => currentTime >= (c.timelineStart || 0) && currentTime < (c.timelineStart || 0) + (c.duration || 0)
    ) || clips[0];

  // Left tools panel list
  const tools = [
    { key: 'split',   icon: Scissors,  label: 'Split' },
    { key: 'trim',    icon: Crop,      label: 'Trim' },
    { key: 'speed',   icon: Gauge,     label: 'Speed' },
    { key: 'audio',   icon: Volume2,   label: 'Audio' },
    { key: 'text',    icon: Type,      label: 'Text' },
    { key: 'caption', icon: Subtitles, label: 'Caption', badge: true },
  ];

  // ── Sync trim in/out when clip changes ──────────────────────────────────────
  useEffect(() => {
    if (selectedClip) {
      setTrimIn(0);
      setTrimOut(+(selectedClip.duration || 0));
    }
  }, [selectedClipId]);

  // ── VIDEO ELEMENT SYNC ──────────────────────────────────────────────────────
  // React key trick would unmount/remount the video element on clip change,
  // but we avoid that. Instead we imperatively sync src and volume.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;

    // Sync Source URL
    const wantSrc = activeClip.videoUrl || '';
    const gotSrc = video.src;
    // compare without trailing / issues
    if (!gotSrc.endsWith(wantSrc.replace(/^\//, '')) && gotSrc !== wantSrc) {
      const wasPlaying = isPlaying;
      video.src = wantSrc;
      video.load();
      const clipOffset = currentTime - (activeClip.timelineStart || 0);
      video.currentTime = Math.max(0, clipOffset);
      if (wasPlaying) video.play().catch(() => {});
    } else {
      if (isPlaying && video.paused) video.play().catch(() => {});
      else if (!isPlaying && !video.paused) video.pause();

      const clipOffset = currentTime - (activeClip.timelineStart || 0);
      const drift = Math.abs(video.currentTime - clipOffset);
      if (drift > 0.3 && !isSeeking) {
        video.currentTime = Math.max(0, clipOffset);
      }
    }
  }, [activeClip, isPlaying, currentTime]);

  // Sync volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  // Sync playback rate live (speed tool preview)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speedVal;
  }, [speedVal]);

  // ── VIDEO EVENT HANDLERS ────────────────────────────────────────────────────
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setVideoDuration(video.duration);
    // Update trim out to actual duration if not yet set
    setTrimOut(prev => prev === 0 ? video.duration : prev);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !activeClip || !isPlaying || isSeeking) return;
    const timelineTime = (activeClip.timelineStart || 0) + video.currentTime;
    if (Math.abs(currentTime - timelineTime) > 0.05) {
      store.setCurrentTime(timelineTime);
    }
  };

  const handleVideoEnded = () => {
    if (!activeClip) return;
    const nextClip = clips.find(
      (c) => (c.timelineStart || 0) >= (activeClip.timelineStart || 0) + (activeClip.duration || 0)
    );
    if (nextClip) {
      store.setCurrentTime(nextClip.timelineStart);
    } else {
      store.setIsPlaying(false);
      store.setCurrentTime(activeClip.timelineStart || 0);
    }
  };

  // ── SEEK BAR ────────────────────────────────────────────────────────────────
  const seekTo = useCallback((fraction) => {
    const dur = videoDuration || activeClip?.duration || 1;
    const targetClipTime = fraction * dur;
    const timelineTime = (activeClip?.timelineStart || 0) + targetClipTime;
    store.setCurrentTime(timelineTime);
    if (videoRef.current) videoRef.current.currentTime = targetClipTime;
  }, [videoDuration, activeClip, store]);

  const handleSeekMouseDown = (e) => {
    setIsSeeking(true);
    store.setIsPlaying(false);
    handleSeekMove(e);
  };

  const handleSeekMove = (e) => {
    const bar = seekRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seekTo(frac);
  };

  const handleSeekMouseUp = () => {
    setIsSeeking(false);
  };

  useEffect(() => {
    if (isSeeking) {
      window.addEventListener('mousemove', handleSeekMove);
      window.addEventListener('mouseup', handleSeekMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleSeekMove);
        window.removeEventListener('mouseup', handleSeekMouseUp);
      };
    }
  }, [isSeeking, seekTo]);

  // ── PLAYBACK ────────────────────────────────────────────────────────────────
  const togglePlay = () => store.setIsPlaying(!isPlaying);

  const skip = (delta) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
    video.currentTime = newTime;
    store.setCurrentTime((activeClip?.timelineStart || 0) + newTime);
  };

  // ── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); skip(-5); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); skip(5);  }
      else if (e.key.toLowerCase() === 'm') setIsMuted(m => !m);
      else if (e.ctrlKey && e.key.toLowerCase() === 'z') store.undo();
      else if (e.ctrlKey && e.key.toLowerCase() === 'y') store.redo();
      else if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); store.saveProject(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, activeClip]);

  // ── HELPERS ─────────────────────────────────────────────────────────────────
  const formatTimecode = (secs) => {
    if (!isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    const el = videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  };

  // ── TOOL ACTIONS (backend) ───────────────────────────────────────────────────
  const runFFmpeg = async (label, fn) => {
    setIsProcessing(true);
    setProcessingMsg(label);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      alert(`${label} failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingMsg('');
    }
  };

  const applyTrim = () => runFFmpeg('Trimming clip', async () => {
    if (!selectedClip) return;
    const result = await api.trimClip(
      selectedClip.videoPath || store.videoPath,
      trimIn,
      trimOut,
      `trim_${Date.now()}`
    );
    store.updateClipSegment(selectedClip.id, {
      videoPath: result.outputPath,
      videoUrl: result.outputUrl,
      duration: trimOut - trimIn,
    });
  });

  const applySpeed = () => runFFmpeg('Changing speed', async () => {
    if (!selectedClip) return;
    const result = await api.changeSpeed(
      selectedClip.videoPath || store.videoPath,
      speedVal,
      `speed_${Date.now()}`
    );
    store.updateClipSegment(selectedClip.id, {
      videoPath: result.outputPath,
      videoUrl: result.outputUrl,
      duration: selectedClip.duration / speedVal,
    });
    // Reset preview rate
    if (videoRef.current) videoRef.current.playbackRate = 1;
    setSpeedVal(1.0);
  });

  const applyCrop = () => runFFmpeg('Cropping video', async () => {
    if (!selectedClip) return;
    const { width = 1080, height = 1920 } = store.videoInfo || {};
    const result = await api.cropVideo(
      selectedClip.videoPath || store.videoPath,
      Math.round((cropX / 100) * width),
      Math.round((cropY / 100) * height),
      Math.round((cropW / 100) * width),
      Math.round((cropH / 100) * height),
      `crop_${Date.now()}`
    );
    store.updateClipSegment(selectedClip.id, {
      videoPath: result.outputPath,
      videoUrl: result.outputUrl,
    });
  });

  const addText = () => {
    if (!textInput.trim()) return;
    store.addTextLayer({
      id: `text_${Date.now()}`,
      text: textInput,
      startTime: currentTime - (activeClip?.timelineStart || 0),
      duration: 5.0,
      style: { fontSize: textSize, color: textColor, fontFamily: 'Plus Jakarta Sans', bold: textBold, x: 50, y: 50 },
    });
    setTextInput('');
  };

  // Seek fraction for progress bar
  const clipDur = videoDuration || activeClip?.duration || 1;
  const clipOffset = currentTime - (activeClip?.timelineStart || 0);
  const seekFraction = Math.max(0, Math.min(1, clipOffset / clipDur));

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#060608] relative" tabIndex={-1}>

      {/* ── TOP BAR ──────────────────────────────────────────────────────────── */}
      <div className="h-[52px] border-b border-white/10 glass-panel rounded-none flex items-center justify-between px-6 z-50 flex-shrink-0">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="w-8 h-8 rounded-lg glass-card flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            title="Back to Projects"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-white/40 truncate max-w-[100px]">
              {store.filename}
            </span>
            {language && (
              <span className="text-[10px] bg-accent/20 text-[#00d4ff] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {language}
              </span>
            )}
          </div>
        </div>

        {/* Center: Project name */}
        <div className="flex-1 max-w-sm flex justify-center">
          {isEditingProjectName ? (
            <input
              autoFocus
              className="glass-input h-8 px-3 text-center text-sm font-semibold max-w-[200px]"
              value={projNameInput}
              onChange={(e) => setProjNameInput(e.target.value)}
              onBlur={() => {
                setIsEditingProjectName(false);
                if (projNameInput.trim()) store.setProject(store.projectId, projNameInput, store.mode);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingProjectName(false);
                  if (projNameInput.trim()) store.setProject(store.projectId, projNameInput, store.mode);
                }
              }}
            />
          ) : (
            <h1
              onClick={() => setIsEditingProjectName(true)}
              className="text-white hover:text-accent font-semibold text-sm cursor-pointer border border-transparent hover:border-white/10 px-3 py-1 rounded-lg transition-all truncate max-w-[220px]"
              title="Click to rename"
            >
              {projectName || 'Untitled Project'}
            </h1>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <button onClick={() => store.saveProject()} className="w-8 h-8 rounded-lg glass-card hover:bg-white/10 flex items-center justify-center text-white" title="Save (Ctrl+S)">
            <Save size={15} />
          </button>
          <button onClick={() => store.undo()} className="w-8 h-8 rounded-lg glass-card hover:bg-white/10 flex items-center justify-center text-white" title="Undo (Ctrl+Z)">
            <CornerUpLeft size={15} />
          </button>
          <button onClick={() => store.redo()} className="w-8 h-8 rounded-lg glass-card hover:bg-white/10 flex items-center justify-center text-white" title="Redo (Ctrl+Y)">
            <CornerUpRight size={15} />
          </button>

          <div className="h-6 w-[1px] bg-white/10 mx-1" />

          {/* Aspect ratio */}
          <select
            value={store.aspectRatio || '9:16'}
            onChange={(e) => store.setAspectRatio(e.target.value)}
            className="h-8 px-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-semibold cursor-pointer outline-none focus:border-accent"
          >
            <option value="9:16" className="bg-[#0f0f15]">9:16 (Vertical)</option>
            <option value="1:1"  className="bg-[#0f0f15]">1:1 (Square)</option>
            <option value="16:9" className="bg-[#0f0f15]">16:9 (Horizontal)</option>
          </select>

          <button
            onClick={() => navigate('/captions')}
            className="h-8 px-4 bg-accent-teal/15 hover:bg-accent-teal/20 text-[#00f5c4] font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors border border-accent-teal/20"
          >
            <Sparkles size={13} /> Captions
          </button>

          <button
            onClick={() => setIsExporting(true)}
            className="h-8 px-4 bg-gradient-to-r from-accent to-[#9b7dff] hover:opacity-90 transition-opacity text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-glow-sm"
          >
            Export
          </button>
        </div>
      </div>

      {/* ── MAIN WORKSPACE ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Tools Panel */}
        <div className="w-14 border-r border-white/10 bg-[#0a0a10] flex flex-col items-center py-4 gap-1.5 flex-shrink-0">
          {tools.map((t) => {
            const Icon = t.icon;
            const isActive = selectedTool === t.key;
            return (
              <button
                key={t.key}
                onClick={() => store.setSelectedTool(isActive ? null : t.key)}
                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative group ${
                  isActive
                    ? 'bg-accent/15 border border-accent text-white shadow-glow-sm'
                    : 'text-white/40 hover:bg-white/5 hover:text-white'
                }`}
                title={t.label}
              >
                <Icon size={17} />
                <span className="text-[8px] mt-0.5 font-medium leading-none">{t.label}</span>
                {t.badge && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#00f5c4] rounded-full shadow-[0_0_4px_#00f5c4]" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── CENTER PREVIEW ─────────────────────────────────────────────────── */}
        <div className="flex-1 bg-black/20 flex flex-col items-center justify-center p-4 relative overflow-hidden gap-3">

          {/* Video container */}
          <div className={`rounded-2xl border border-white/15 bg-black overflow-hidden relative shadow-2xl flex items-center justify-center transition-all duration-300 ${
            store.aspectRatio === '1:1'  ? 'aspect-[1/1]  h-[52vh]' :
            store.aspectRatio === '16:9' ? 'aspect-[16/9] h-[40vh]' :
                                           'aspect-[9/16] h-[58vh]'
          }`}>
            {store.videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleVideoEnded}
                  onLoadedMetadata={handleLoadedMetadata}
                  className="w-full h-full object-cover pointer-events-none"
                />

                {/* Caption overlay */}
                <CaptionOverlay
                  captionGroups={captionGroups}
                  currentTime={clipOffset}
                  stylePreset={store.selectedStyle}
                />

                {/* Text layers */}
                {textLayers
                  .filter((l) => clipOffset >= (l.startTime || 0) && clipOffset <= (l.startTime || 0) + (l.duration || 5))
                  .map((layer) => (
                    <div
                      key={layer.id}
                      className="absolute cursor-move select-none drop-shadow-lg"
                      style={{
                        left: `${layer.style.x}%`,
                        top:  `${layer.style.y}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${layer.style.fontSize}px`,
                        color: layer.style.color,
                        fontFamily: layer.style.fontFamily,
                        fontWeight: layer.style.bold ? 'bold' : 'normal',
                      }}
                    >
                      {layer.text}
                    </div>
                  ))}

                {/* Crop overlay (visual) */}
                {selectedTool === 'crop' && (
                  <div
                    className="absolute border-2 border-dashed border-[#7c5cfc] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] z-20 pointer-events-none rounded"
                    style={{ left: `${cropX}%`, top: `${cropY}%`, width: `${cropW}%`, height: `${cropH}%` }}
                  >
                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#7c5cfc] rounded-full" />
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#7c5cfc] rounded-full" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#7c5cfc] rounded-full" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#7c5cfc] rounded-full" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white/70 text-[10px] bg-black/50 px-2 py-0.5 rounded font-mono">
                        {cropW}% × {cropH}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Split mode overlay */}
                {selectedTool === 'split' && (
                  <div
                    className="absolute inset-0 cursor-crosshair z-10 flex items-center justify-center"
                    onClick={() => {
                      if (!selectedClip) return;
                      const splitAt = clipOffset;
                      if (splitAt <= 0.1 || splitAt >= (selectedClip.duration - 0.1)) return;
                      store.takeSnapshot();
                      const clipA = {
                        ...selectedClip,
                        id: `${selectedClip.id}_a`,
                        duration: splitAt,
                        title: selectedClip.title + ' (A)',
                      };
                      const clipB = {
                        ...selectedClip,
                        id: `${selectedClip.id}_b`,
                        duration: selectedClip.duration - splitAt,
                        timelineStart: (selectedClip.timelineStart || 0) + splitAt,
                        title: selectedClip.title + ' (B)',
                      };
                      useEditorStore.setState({
                        clips: clips.map(c => c.id === selectedClip.id ? null : c)
                          .filter(Boolean)
                          .concat([clipA, clipB])
                          .sort((a, b) => (a.timelineStart || 0) - (b.timelineStart || 0)),
                      });
                    }}
                  >
                    <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-[#ff4d6a] pointer-events-none" style={{ left: `${seekFraction * 100}%` }} />
                    <div className="bg-[#ff4d6a]/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg backdrop-blur-sm">
                      <Scissors size={12} className="inline mr-1" /> Click to split here
                    </div>
                  </div>
                )}
              </>
            ) : (
              <span className="text-white/30 text-sm">No Video Selected</span>
            )}
          </div>

          {/* ── PLAYER CONTROLS BAR ──────────────────────────────────────────── */}
          {store.videoUrl && (
            <div className="w-full max-w-[520px] flex flex-col gap-2">
              {/* Seek bar */}
              <div
                ref={seekRef}
                className="relative h-2 rounded-full bg-white/10 cursor-pointer group"
                onMouseDown={handleSeekMouseDown}
              >
                {/* Buffered / progress fill */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-accent to-[#00f5c4] transition-none"
                  style={{ width: `${seekFraction * 100}%` }}
                />
                {/* Thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${seekFraction * 100}% - 8px)` }}
                />
              </div>

              {/* Controls row */}
              <div className="h-[44px] px-4 rounded-xl border border-white/5 bg-[#0d0d12]/90 backdrop-blur-md flex items-center gap-3">
                {/* Skip back 5s */}
                <button onClick={() => skip(-5)} className="text-white/50 hover:text-white transition-colors" title="Back 5s (←)">
                  <SkipBack size={16} />
                </button>

                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title="Play/Pause (Space)"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>

                {/* Skip forward 5s */}
                <button onClick={() => skip(5)} className="text-white/50 hover:text-white transition-colors" title="Forward 5s (→)">
                  <SkipForward size={16} />
                </button>

                {/* Timecode — uses actual video element duration, not store.videoInfo */}
                <span className="font-mono text-xs text-white/60 ml-1 tabular-nums">
                  {formatTimecode(clipOffset)} / {formatTimecode(videoDuration || activeClip?.duration || 0)}
                </span>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Speed indicator */}
                {speedVal !== 1.0 && (
                  <span className="text-[10px] font-bold text-[#ffb300] bg-[#ffb300]/10 px-2 py-0.5 rounded font-mono">
                    {speedVal}x
                  </span>
                )}

                {/* Volume */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsMuted(m => !m)}
                    className="text-white/40 hover:text-white transition-colors"
                    title="Mute (M)"
                  >
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }}
                    className="w-16 h-1 bg-white/10 rounded-full accent-[#7c5cfc] cursor-pointer"
                  />
                </div>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="text-white/40 hover:text-white transition-colors ml-1"
                  title="Fullscreen"
                >
                  <Maximize size={14} />
                </button>
              </div>

              {/* Keyboard hint */}
              <p className="text-center text-[9px] text-white/20 font-mono">
                Space · ←/→ ±5s · M mute · Ctrl+Z/Y undo/redo · Ctrl+S save
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT PROPERTIES PANEL ──────────────────────────────────────────── */}
        <div className="w-[275px] border-l border-white/10 bg-[#0a0a10] flex flex-col overflow-y-auto flex-shrink-0">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <h2 className="text-[12px] font-bold text-white uppercase tracking-wider">
              {selectedTool ? selectedTool + ' tool' : 'Properties'}
            </h2>
            {selectedTool && (
              <button onClick={() => store.setSelectedTool(null)} className="text-xs text-white/40 hover:text-white w-6 h-6 flex items-center justify-center">
                ✕
              </button>
            )}
          </div>

          <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
            {isProcessing ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 gap-3">
                <RefreshCw className="animate-spin text-[#7c5cfc]" size={24} />
                <span className="text-xs text-white/60 text-center">{processingMsg || 'Processing…'}</span>
              </div>
            ) : (
              <>
                {/* ── DEFAULT PROPERTIES ── */}
                {!selectedTool && (
                  <div className="flex flex-col gap-3">
                    <div className="glass-card p-3 flex flex-col gap-1">
                      <span className="text-[10px] text-white/40 uppercase font-semibold">Clip Title</span>
                      <span className="text-[13px] font-semibold text-white truncate">{selectedClip?.title || 'Unknown'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="glass-card p-3 flex flex-col">
                        <span className="text-[9px] text-white/40 uppercase font-semibold">Duration</span>
                        <span className="text-sm font-mono font-bold text-white mt-1">
                          {(videoDuration || selectedClip?.duration || 0).toFixed(1)}s
                        </span>
                      </div>
                      <div className="glass-card p-3 flex flex-col">
                        <span className="text-[9px] text-white/40 uppercase font-semibold">Resolution</span>
                        <span className="text-sm font-mono font-bold text-white mt-1">
                          {store.videoInfo?.width || '—'} × {store.videoInfo?.height || '—'}
                        </span>
                      </div>
                    </div>
                    <div className="glass-card p-3 flex flex-col gap-1.5">
                      <span className="text-[10px] text-white/40 uppercase font-semibold">Track Overview</span>
                      <div className="flex flex-col gap-1 text-[11px] text-white/60">
                        <span>• V1 Video clips: {clips.length}</span>
                        <span>• T1 Text layers: {textLayers.length}</span>
                        <span>• C1 Caption items: {captionGroups.length}</span>
                      </div>
                    </div>
                    <div className="glass-card p-3 flex flex-col gap-1.5">
                      <span className="text-[10px] text-white/40 uppercase font-semibold">Keyboard Shortcuts</span>
                      <div className="flex flex-col gap-1 text-[10px] text-white/40 font-mono">
                        <span>Space — Play / Pause</span>
                        <span>← / → — Skip ±5 seconds</span>
                        <span>M — Toggle mute</span>
                        <span>Ctrl+Z / Y — Undo / Redo</span>
                        <span>Ctrl+S — Save project</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── SPLIT TOOL ── */}
                {selectedTool === 'split' && (
                  <div className="flex flex-col gap-3">
                    <div className="glass-card p-3 text-center">
                      <Scissors size={24} className="text-[#ff4d6a] mx-auto mb-2" />
                      <p className="text-xs text-white/60 leading-relaxed">
                        Click anywhere on the <strong className="text-white">video preview</strong> to split the clip at the current playhead position.
                      </p>
                    </div>
                    <div className="glass-card p-3 flex flex-col gap-1">
                      <span className="text-[10px] text-white/40 uppercase font-semibold">Playhead Position</span>
                      <span className="text-lg font-mono font-bold text-[#ff4d6a]">{formatTimecode(clipOffset)}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (!selectedClip) return;
                        const splitAt = clipOffset;
                        if (splitAt <= 0.1 || splitAt >= (selectedClip.duration - 0.1)) return;
                        store.takeSnapshot();
                        const clipA = { ...selectedClip, id: `${selectedClip.id}_a`, duration: splitAt, title: selectedClip.title + ' (A)' };
                        const clipB = { ...selectedClip, id: `${selectedClip.id}_b`, duration: selectedClip.duration - splitAt, timelineStart: (selectedClip.timelineStart || 0) + splitAt, title: selectedClip.title + ' (B)' };
                        useEditorStore.setState({
                          clips: clips.map(c => c.id === selectedClip.id ? null : c).filter(Boolean).concat([clipA, clipB]).sort((a, b) => (a.timelineStart || 0) - (b.timelineStart || 0)),
                        });
                        store.setSelectedTool(null);
                      }}
                      className="h-10 rounded-xl bg-[#ff4d6a]/20 border border-[#ff4d6a]/30 text-[#ff4d6a] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#ff4d6a]/30 transition-colors"
                    >
                      <Scissors size={14} /> Split at {formatTimecode(clipOffset)}
                    </button>
                  </div>
                )}

                {/* ── TRIM TOOL ── */}
                {selectedTool === 'trim' && (
                  <div className="flex flex-col gap-4">
                    <div className="glass-card p-3 text-xs text-white/50 leading-relaxed">
                      Set In / Out points to cut the beginning and end of the selected clip. The cut is permanent (server-side FFmpeg).
                    </div>

                    {/* Visual trim range */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-white/40 uppercase font-semibold">
                        <span>In Point</span><span>Out Point</span>
                      </div>
                      <div className="relative h-8 bg-white/5 rounded-lg overflow-hidden border border-white/10">
                        <div
                          className="absolute top-0 bottom-0 bg-accent/30 border-l-2 border-r-2 border-accent"
                          style={{
                            left: `${(trimIn / (videoDuration || 1)) * 100}%`,
                            right: `${100 - (trimOut / (videoDuration || 1)) * 100}%`,
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-mono text-white/60">
                            {formatTimecode(trimIn)} → {formatTimecode(trimOut)} ({(trimOut - trimIn).toFixed(1)}s)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] text-white/50 uppercase font-semibold">
                        In Point — {formatTimecode(trimIn)}
                      </label>
                      <input type="range" min="0" max={videoDuration || selectedClip?.duration || 100} step="0.1"
                        value={trimIn}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (v < trimOut) setTrimIn(v);
                        }}
                        className="h-1 bg-white/10 rounded-full accent-accent cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] text-white/50 uppercase font-semibold">
                        Out Point — {formatTimecode(trimOut)}
                      </label>
                      <input type="range" min="0" max={videoDuration || selectedClip?.duration || 100} step="0.1"
                        value={trimOut}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (v > trimIn) setTrimOut(v);
                        }}
                        className="h-1 bg-white/10 rounded-full accent-accent cursor-pointer"
                      />
                    </div>

                    {/* Quick set buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTrimIn(clipOffset)}
                        className="flex-1 h-8 rounded-lg border border-white/10 text-[10px] font-semibold text-white/60 hover:text-white hover:border-white/20 transition-colors"
                      >
                        Set In = Now
                      </button>
                      <button
                        onClick={() => setTrimOut(clipOffset)}
                        className="flex-1 h-8 rounded-lg border border-white/10 text-[10px] font-semibold text-white/60 hover:text-white hover:border-white/20 transition-colors"
                      >
                        Set Out = Now
                      </button>
                    </div>

                    <button onClick={applyTrim} className="h-10 rounded-xl bg-accent text-white text-sm font-bold shadow-glow-sm hover:opacity-90">
                      Apply Trim
                    </button>
                  </div>
                )}

                {/* ── SPEED TOOL ── */}
                {selectedTool === 'speed' && (
                  <div className="flex flex-col gap-4">
                    <div className="glass-card p-3 text-xs text-white/50 leading-relaxed">
                      Preview plays at the selected speed immediately. Click Apply to encode permanently.
                    </div>

                    {/* Speed presets */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0].map((s) => (
                        <button
                          key={s}
                          onClick={() => setSpeedVal(s)}
                          className={`h-8 rounded-lg text-xs font-bold border transition-all ${
                            speedVal === s
                              ? 'bg-accent/20 border-accent text-white'
                              : 'border-white/10 text-white/50 hover:text-white hover:border-white/20'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between">
                        <label className="text-[11px] text-white/50 uppercase font-semibold">Speed: {speedVal}x</label>
                        <span className="text-[10px] text-white/30 font-mono">
                          {(selectedClip?.duration / speedVal).toFixed(1)}s result
                        </span>
                      </div>
                      <input type="range" min="0.25" max="4.0" step="0.25" value={speedVal}
                        onChange={(e) => setSpeedVal(parseFloat(e.target.value))}
                        className="h-1 bg-white/10 rounded-full accent-accent cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-white/30 font-mono">
                        <span>0.25x slow</span><span>1x normal</span><span>4x fast</span>
                      </div>
                    </div>

                    <button onClick={applySpeed} className="h-10 rounded-xl bg-accent text-white text-sm font-bold shadow-glow-sm hover:opacity-90">
                      Apply Speed ({speedVal}x)
                    </button>
                  </div>
                )}

                {/* ── AUDIO TOOL ── */}
                {selectedTool === 'audio' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] text-white/50 uppercase font-semibold">
                        Preview Volume — {isMuted ? 'Muted' : `${volume}%`}
                      </label>
                      <input type="range" min="0" max="100" value={isMuted ? 0 : volume}
                        onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }}
                        className="h-1 bg-white/10 rounded-full accent-[#00f5c4] cursor-pointer"
                      />
                    </div>

                    <button
                      onClick={() => setIsMuted(m => !m)}
                      className={`h-10 rounded-xl text-sm font-bold border transition-colors flex items-center justify-center gap-2 ${
                        isMuted
                          ? 'bg-[#ff4d6a]/15 border-[#ff4d6a] text-[#ff4d6a]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      {isMuted ? 'Unmute' : 'Mute Preview'}
                    </button>

                    <div className="glass-card p-3 text-[10px] text-white/30 leading-relaxed">
                      Volume and mute here are preview-only. The exported video uses the original audio. Use the export settings to adjust output audio.
                    </div>
                  </div>
                )}

                {/* ── TEXT TOOL ── */}
                {selectedTool === 'text' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] text-white/50 uppercase font-semibold">Overlay Text</label>
                      <input
                        type="text"
                        className="glass-input h-9 px-3 text-sm"
                        placeholder="Enter text..."
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addText()}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] text-white/50 uppercase font-semibold">Size — {textSize}px</label>
                      <input type="range" min="12" max="96" value={textSize}
                        onChange={(e) => setTextSize(Number(e.target.value))}
                        className="h-1 bg-white/10 rounded-full accent-accent cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] text-white/50 uppercase font-semibold">Color</label>
                      <div className="flex gap-2 flex-wrap">
                        {['#ffffff', '#ffe000', '#ff5500', '#00f5c4', '#7c5cfc', '#ff4d6a', '#00d4ff'].map((color) => (
                          <button
                            key={color}
                            onClick={() => setTextColor(color)}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${
                              textColor === color ? 'border-white scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setTextBold(b => !b)}
                      className={`h-8 rounded-lg border text-xs font-bold transition-colors ${
                        textBold ? 'border-accent bg-accent/15 text-white' : 'border-white/10 text-white/50 hover:text-white'
                      }`}
                    >
                      {textBold ? 'Bold ✓' : 'Bold'}
                    </button>
                    <button
                      onClick={addText}
                      className="h-9 rounded-xl bg-accent-teal/20 border border-accent-teal/30 text-[#00f5c4] font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-accent-teal/35 transition-colors"
                    >
                      <Plus size={14} /> Add at {formatTimecode(clipOffset)}
                    </button>

                    <div className="h-[1px] bg-white/5" />

                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] text-white/40 uppercase font-semibold">Text Layers ({textLayers.length})</span>
                      {textLayers.length === 0 ? (
                        <span className="text-white/25 text-xs italic">No layers added yet</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {textLayers.map((layer) => (
                            <div key={layer.id} className="flex items-center justify-between glass-card p-2 rounded-lg">
                              <div className="flex flex-col">
                                <span className="text-xs text-white truncate max-w-[150px]">{layer.text}</span>
                                <span className="text-[9px] text-white/30 font-mono">
                                  {formatTimecode(layer.startTime)} · {layer.duration}s
                                </span>
                              </div>
                              <button
                                onClick={() => store.removeTextLayer(layer.id)}
                                className="text-white/30 hover:text-[#ff4d6a] p-1 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── CAPTION TOOL ── */}
                {selectedTool === 'caption' && (
                  <div className="flex flex-col gap-3">
                    <div className="glass-card p-3 text-center flex flex-col gap-3">
                      <Sparkles size={28} className="text-[#00f5c4] mx-auto" />
                      <div>
                        <p className="text-sm font-bold text-white mb-1">Caption Editor</p>
                        <p className="text-[11px] text-white/50 leading-relaxed">
                          Generate AI captions, edit timing, change styles, and position subtitles.
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 text-[10px] text-white/40">
                        <span>• {captionGroups.length} caption blocks</span>
                        <span>• Style: {store.selectedStyle || 'NeonPop'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/captions')}
                      className="h-10 px-4 w-full bg-gradient-to-r from-accent to-[#00d4ff] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-glow-sm"
                    >
                      <Sparkles size={13} /> Open Caption Editor
                    </button>
                  </div>
                )}

                {/* ── DELETE CLIP ── */}
                {selectedClip && clips.length > 1 && !selectedTool && (
                  <div className="mt-auto pt-2 border-t border-white/5">
                    {!confirmDeleteClip ? (
                      <button
                        onClick={() => setConfirmDeleteClip(true)}
                        className="w-full border border-dashed border-[#ff4d6a]/20 text-[#ff4d6a] hover:bg-[#ff4d6a]/10 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Trash2 size={13} /> Delete Clip
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] text-white/60 text-center">Delete "{selectedClip.title}"?</p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmDeleteClip(false)} className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white">Cancel</button>
                          <button
                            onClick={() => { store.removeClipSegment(selectedClip.id); setConfirmDeleteClip(false); }}
                            className="flex-1 h-8 rounded-lg bg-[#ff4d6a]/20 border border-[#ff4d6a] text-[#ff4d6a] text-xs font-bold"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── TIMELINE ─────────────────────────────────────────────────────────── */}
      <Timeline />

      {/* ── EXPORT SHEET ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        <ExportSheet
          clips={clips}
          isOpen={isExporting}
          onClose={() => setIsExporting(false)}
          onComplete={() => setIsExporting(false)}
        />
      </AnimatePresence>
    </div>
  );
}
