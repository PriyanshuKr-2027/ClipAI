import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import CaptionOverlay from '../components/CaptionOverlay';
import WaveformDisplay from '../components/WaveformDisplay';
import BeatMarkers from '../components/BeatMarkers';
import RemotionPreview from '../components/RemotionPreview';
import AIPromptBar from '../components/AIPromptBar';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Save, CornerUpLeft, CornerUpRight, Subtitles, Film,
  Play, Pause, Volume2, Maximize, Scissors, Crop, Type, Gauge,
  VolumeX, Trash2, Plus, Sparkles, RefreshCw, SkipBack, SkipForward,
  Check, AlertTriangle, Globe, Zap, ChevronDown, ChevronUp, Clock
} from 'lucide-react';
import * as api from '../services/api';

const platformBadges = {
  youtube: {
    label: 'YouTube',
    bg: 'bg-[#FF0000]/10 border-[#FF0000]/25 text-[#FF0000]',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
        <path d="M23.498 6.163c-.272-.98-1.04-1.755-2.008-2.03C19.703 3.62 12 3.62 12 3.62s-7.703 0-9.49.512c-.967.275-1.736 1.05-2.008 2.03C0 7.973 0 12 0 12s0 4.027.502 5.837c.272.98 1.04 1.755 2.008 2.03C4.297 20.38 12 20.38 12 20.38s7.703 0 9.49-.513c.968-.274 1.736-1.05 2.008-2.03C24 16.027 24 12 24 12s0-4.027-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    )
  },
  instagram: {
    label: 'Instagram',
    bg: 'bg-gradient-to-r from-[#833ab4]/15 via-[#fd1d1d]/15 to-[#fcb045]/15 border-[#fd1d1d]/25 text-[#fd1d1d]',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-current fill-none stroke-[2.5]">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    )
  },
  x: {
    label: 'X',
    bg: 'bg-black/40 border-white/20 text-white',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  },
  tiktok: {
    label: 'TikTok',
    bg: 'bg-black/40 border-white/20 text-white',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.62 4.17 1.22 1.32 2.97 2.09 4.77 2.23v3.88c-1.89-.09-3.72-.8-5.08-2.11-.11-.11-.21-.22-.31-.34V14.5c.02 2.3-.9 4.54-2.58 6.09A9.13 9.13 0 0 1 9 23c-2.42-.02-4.73-1.07-6.27-2.94a9.26 9.26 0 0 1-1.7-7.79A9.13 9.13 0 0 1 5.56 6.38a9.23 9.23 0 0 1 8.87.56V11.2a5.2 5.2 0 0 0-4.46-.72c-1.2.33-2.22 1.15-2.76 2.26A5.28 5.28 0 0 0 7 14.5c.01 1.45.68 2.82 1.8 3.69a5.19 5.19 0 0 0 6.64-.32 5.22 5.22 0 0 0 1.08-5.37V.02z"/>
      </svg>
    )
  },
  reddit: {
    label: 'Reddit',
    bg: 'bg-[#FF4500]/10 border-[#FF4500]/25 text-[#FF4500]',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
        <path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.85-1.64-6.23-1.72l1.24-3.92 3.65.77c.12 1.02 1 1.8 2.07 1.8 1.15 0 2.1-0.94 2.1-2.1s-0.95-2.1-2.1-2.1c-1.02 0-1.88.73-2.07 1.7l-3.99-.84c-.21-.04-.42.09-.48.3l-1.4 4.41c-2.43.04-4.69.69-6.37 1.71-.56-.74-1.44-1.21-2.43-1.21-1.65 0-3 1.35-3 3 0 1.17.68 2.18 1.66 2.67-.06.33-.09.68-.09 1.03 0 4.14 4.93 7.5 11 7.5s11-3.36 11-7.5c0-.35-.03-.7-.09-1.03.98-.49 1.66-1.5 1.66-2.67zM7.5 13c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm9 6c-1.83 1.83-5.17 1.83-7 0-.19-.2-.19-.51 0-.71.2-.2.51-.2.71 0 1.43 1.43 4.14 1.43 5.58 0 .2-.2.51-.2.71 0 .2.2.2.51 0 .71zm-.5-3c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
      </svg>
    )
  },
  playwright: {
    label: 'Web',
    bg: 'bg-white/5 border-white/10 text-white/60',
    icon: <Globe size={14} />
  }
};

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

  const [aiChatOpen, setAiChatOpen] = useState(true);

  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);  // actual media duration
  const [isSeeking, setIsSeeking] = useState(false);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeLanguage, setTranscribeLanguage] = useState('auto');
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [isDetectingScenes, setIsDetectingScenes] = useState(false);

  const [isSilenceRemoving, setIsSilenceRemoving] = useState(false);
  const [silenceProgress, setSilenceProgress] = useState(0);

  const timelineScrubberRef = useRef(null);
  const [isScrubbingTimeline, setIsScrubbingTimeline] = useState(false);

  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projNameInput, setProjNameInput] = useState(projectName || 'Untitled Project');
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

  // ── HELPER FUNCTIONS & CALLBACKS FOR THE NEW TIMELINE & UTILITIES ─────────
  
  // WebSocket Stage listener for transcription
  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname || 'localhost'}:3001`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'transcribe') {
          store.setTranscribeStage(data.stage);
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };
    return () => ws.close();
  }, [store]);

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    store.setTranscribeStage('starting');
    try {
      let aPath = store.audioPath;
      if (!aPath) {
        const { audioPath } = await api.extractAudio(store.videoPath);
        aPath = audioPath;
        store.setAudioPath(audioPath);
      }
      store.setTranscribeStage('transcribing');
      const result = await api.transcribeAudio(aPath, transcribeLanguage);
      let finalWords = result.words;
      let finalLang = result.language;

      if (result.language === 'ur') {
        store.setTranscribeStage('translating');
        try {
          const wordsJsonPath = await api.saveWordsJson(result.words);
          const transResult = await api.translateWords(wordsJsonPath, 'hi', 'ur');
          finalWords = transResult.translatedWords || result.words;
          finalLang = 'hi';
        } catch (err) {
          console.error("Auto Urdu-to-Hindi translation failed, falling back:", err);
        }
      }

      store.setWords(finalWords);
      store.setLanguage(finalLang);
      if (result.backend) {
        store.setTranscriptionBackend(result.backend);
      }
      store.setTranscribeStage('done');
    } catch (err) {
      console.error(err);
      alert('Transcription failed: ' + err.message);
      store.setTranscribeStage(null);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAnalyzeAudio = async () => {
    setIsAnalyzingAudio(true);
    try {
      let aPath = store.audioPath;
      if (!aPath) {
        const { audioPath } = await api.extractAudio(store.videoPath);
        aPath = audioPath;
        store.setAudioPath(audioPath);
      }
      const beatRes = await api.analyzeBeatsWithEnergy(aPath);
      store.setBeats(beatRes.beats, beatRes.bpm);
      if (beatRes.energyBySecond) {
        store.setEnergyBySecond(beatRes.energyBySecond);
      }
      const silenceRes = await api.analyzeSilence(aPath);
      store.setSilenceRanges(silenceRes.silenceRanges);
    } catch (err) {
      console.error(err);
      alert('Audio analysis failed: ' + err.message);
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  const handleDetectScenes = async () => {
    setIsDetectingScenes(true);
    try {
      const res = await api.detectScenes(store.videoPath);
      store.setScenes(res.scenes);
    } catch (err) {
      console.error(err);
      alert('Scene detection failed: ' + err.message);
    } finally {
      setIsDetectingScenes(false);
    }
  };

  const getLocalPathFromFilename = (filename) => {
    if (!store.videoPath) return filename;
    const lastSlash = Math.max(store.videoPath.lastIndexOf('/'), store.videoPath.lastIndexOf('\\'));
    if (lastSlash === -1) return filename;
    const dir = store.videoPath.substring(0, lastSlash);
    const separator = store.videoPath.includes('\\') ? '\\' : '/';
    return `${dir}${separator}${filename}`;
  };

  const handleRemoveSilence = async () => {
    if (!store.silenceRanges || store.silenceRanges.length === 0) return;
    
    const totalSilence = store.silenceRanges.reduce((acc, r) => acc + (r.end - r.start), 0);
    const confirmed = window.confirm(
      `Are you sure you want to remove all ${store.silenceRanges.length} silent segments (${totalSilence.toFixed(1)}s total) from the video? This will re-encode the video.`
    );
    if (!confirmed) return;

    setIsSilenceRemoving(true);
    setSilenceProgress(0);

    try {
      const outputName = `nosilence_${Date.now()}`;
      const result = await api.removeSilence(
        store.videoPath,
        store.silenceRanges,
        outputName,
        (percent) => {
          setSilenceProgress(percent);
        }
      );

      const filename = result.outputUrl.split('/').pop();
      const localPath = getLocalPathFromFilename(filename);

      const videoInfo = await api.getVideoInfo(localPath);

      store.setVideo(localPath, result.outputUrl, videoInfo, filename);
      
      store.clearAllCaptions();
      store.setSilenceRanges([]);
      store.setBeats([], null);
      store.setScenes([]);
      
      await handleTranscribeAfterSilenceRemoval(localPath);
    } catch (err) {
      console.error(err);
      alert('Silence removal failed: ' + err.message);
    } finally {
      setIsSilenceRemoving(false);
      setSilenceProgress(0);
    }
  };

  const handleTranscribeAfterSilenceRemoval = async (newVideoPath) => {
    setIsTranscribing(true);
    store.setTranscribeStage('extracting');
    try {
      const { audioPath } = await api.extractAudio(newVideoPath);
      store.setAudioPath(audioPath);
      store.setTranscribeStage('transcribing');
      const result = await api.transcribeAudio(audioPath, transcribeLanguage);
      let finalWords = result.words;
      let finalLang = result.language;

      if (result.language === 'ur') {
        store.setTranscribeStage('translating');
        try {
          const wordsJsonPath = await api.saveWordsJson(result.words);
          const transResult = await api.translateWords(wordsJsonPath, 'hi', 'ur');
          finalWords = transResult.translatedWords || result.words;
          finalLang = 'hi';
        } catch (err) {
          console.error("Auto Urdu-to-Hindi translation failed, falling back:", err);
        }
      }

      store.setWords(finalWords);
      store.setLanguage(finalLang);
      if (result.backend) {
        store.setTranscriptionBackend(result.backend);
      }
      store.setTranscribeStage('done');
    } catch (err) {
      console.error(err);
      alert('Automatic transcription failed: ' + err.message);
      store.setTranscribeStage(null);
    } finally {
      setIsTranscribing(false);
    }
  };

  const getAudioUrl = () => {
    if (!store.audioPath) return null;
    const filename = store.audioPath.split(/[\\/]/).pop();
    return `${api.BASE}/temp/${filename}`;
  };

  // ── AI PROMPT ACTIONS HANDLER ──────────────────────────────────────────────
  const handleActionsConfirmed = async (actions) => {
    if (!actions || actions.length === 0) return;

    for (const { action, params = {} } of actions) {
      try {
        switch (action) {

          case 'remove_silence':
            if (!store.silenceRanges || store.silenceRanges.length === 0) {
              await handleAnalyzeAudio();
            }
            if (store.silenceRanges && store.silenceRanges.length > 0) {
              await handleRemoveSilence();
            }
            break;

          case 'beat_sync_cuts': {
            if (!store.beats || store.beats.length === 0) {
              await handleAnalyzeAudio();
            }
            const beats = store.beats || [];
            if (beats.length > 0 && selectedClip) {
              store.takeSnapshot();
              const dur = videoDuration || selectedClip.duration || 30;
              let prev = 0;
              const newClips = [];
              beats
                .filter((b) => b > 0.1 && b < dur - 0.1)
                .slice(0, 20)
                .forEach((beat, i) => {
                  newClips.push({
                    ...selectedClip,
                    id: `beat_clip_${i}`,
                    timelineStart: prev,
                    duration: beat - prev,
                    title: `Beat ${i + 1}`,
                  });
                  prev = beat;
                });
              if (newClips.length > 0) {
                useEditorStore.setState({ clips: newClips });
              }
            }
            break;
          }

          case 'translate_captions': {
            const targetLang = params.targetLang || 'hi';
            if (!store.words || store.words.length === 0) break;
            try {
              setIsProcessing(true);
              setProcessingMsg(`Translating captions to ${targetLang}…`);
              const wordsJsonPath = await api.saveWordsJson(store.words);
              const result = await api.translateWords(wordsJsonPath, targetLang);
              store.setTranslatedWords(result.translatedWords, targetLang);
              store.setShowTranslated(true);
            } finally {
              setIsProcessing(false);
              setProcessingMsg('');
            }
            break;
          }

          case 'set_caption_style':
            if (params.style) store.setSelectedStyle(params.style);
            break;

          case 'set_font_size':
            if (params.size) {
              store.setExportSettings({ ...store.exportSettings, fontSize: params.size });
              store.updateCaptionStyle({ fontSize: params.size });
            }
            break;

          case 'reframe_to_portrait':
            store.setAspectRatio('9:16');
            navigate('/captions');
            break;

          case 'set_speed': {
            const multiplier = params.multiplier || 1.5;
            setSpeedVal(multiplier);
            break;
          }

          case 'trim_start': {
            const secs = params.seconds || 0;
            setTrimIn(secs);
            store.setSelectedTool('trim');
            break;
          }

          case 'trim_end': {
            const secs = params.seconds || 0;
            const dur = videoDuration || selectedClip?.duration || 0;
            setTrimOut(Math.max(0, dur - secs));
            store.setSelectedTool('trim');
            break;
          }

          case 'set_export_platform':
            if (params.platform) {
              store.setExportSettings({ ...store.exportSettings, platform: params.platform });
            }
            break;

          case 'make_cinematic':
            store.setSelectedStyle('CleanMinimal');
            store.setAspectRatio('16:9');
            break;

          case 'add_music':
            navigate('/export', { state: { clips: store.clips, musicMood: params.mood } });
            break;

          case 'auto_edit':
            navigate('/auto-edit');
            break;

          case 'add_zoom':
            console.info('[AI] add_zoom — params:', params);
            break;

          default:
            console.warn('[AI] Unknown action:', action);
        }
      } catch (err) {
        console.error(`[AI] Action "${action}" failed:`, err);
      }
    }

    // Record in AI history
    const description = actions.map(a => a.action.replace(/_/g, ' ')).join(' • ');
    const promptLabel = actions[0]?.action?.replace(/_/g, ' ') || 'AI action';
    store.addAiHistory(promptLabel, description, actions);
  };

  const handleTimelineSeek = (time) => {
    const clampedTime = Math.min(clipDur, Math.max(0, time));
    store.setCurrentTime((activeClip?.timelineStart || 0) + clampedTime);
    if (videoRef.current) {
      videoRef.current.currentTime = clampedTime;
    }
  };

  const handleTimelineScrubMove = useCallback((e) => {
    const bar = timelineScrubberRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = frac * clipDur;
    store.setCurrentTime((activeClip?.timelineStart || 0) + targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  }, [clipDur, activeClip, store]);

  const handleTimelineScrubMouseUp = useCallback(() => {
    setIsScrubbingTimeline(false);
  }, []);

  const handleTimelineScrubberMouseDown = (e) => {
    setIsScrubbingTimeline(true);
    store.setIsPlaying(false);
    const rect = timelineScrubberRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = frac * clipDur;
    store.setCurrentTime((activeClip?.timelineStart || 0) + targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  };

  useEffect(() => {
    if (isScrubbingTimeline) {
      window.addEventListener('mousemove', handleTimelineScrubMove);
      window.addEventListener('mouseup', handleTimelineScrubMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleTimelineScrubMove);
        window.removeEventListener('mouseup', handleTimelineScrubMouseUp);
      };
    }
  }, [isScrubbingTimeline, handleTimelineScrubMove, handleTimelineScrubMouseUp]);

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
            <span className="text-[12px] font-semibold text-white/40 truncate max-w-[100px]" title={store.filename}>
              {store.filename}
            </span>
            
            {/* Import Source Badge */}
            {store.importSource && platformBadges[store.importSource] && (
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 ${platformBadges[store.importSource].bg}`}>
                {platformBadges[store.importSource].icon}
                {platformBadges[store.importSource].label}
              </span>
            )}

            {/* Transcription Backend Badge */}
            {store.transcriptionBackend && (
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                store.transcriptionBackend.toLowerCase() === 'groq' 
                  ? 'bg-green-500/10 border-green-500/25 text-green-400' 
                  : 'bg-blue-500/10 border-blue-500/25 text-blue-400'
              }`}>
                {store.transcriptionBackend.toLowerCase() === 'groq' ? 'Groq' : 'Local'}
              </span>
            )}

            {language && (
              <span className="text-[10px] bg-accent/20 text-[#00d4ff] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {language}
              </span>
            )}
          </div>
        </div>

        {/* Center: Project name */}
        <div className="flex-1 max-w-[150px] flex justify-center">
          {isEditingProjectName ? (
            <input
              autoFocus
              className="glass-input h-8 px-3 text-center text-sm font-semibold max-w-[120px]"
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
              className="text-white hover:text-accent font-semibold text-sm cursor-pointer border border-transparent hover:border-white/10 px-3 py-1 rounded-lg transition-all truncate max-w-[150px]"
              title="Click to rename"
            >
              {projectName || 'Untitled Project'}
            </h1>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* New Audio & Visual Analysis Actions */}
          <div className="flex items-center gap-1.5 border-r border-white/10 pr-2">
            {/* Language Selector */}
            <select
              value={transcribeLanguage}
              onChange={(e) => setTranscribeLanguage(e.target.value)}
              disabled={isTranscribing}
              className="h-8 px-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-semibold outline-none cursor-pointer transition-all disabled:opacity-50"
            >
              <option value="auto" className="bg-[#12121a] text-white">Auto Detect</option>
              <option value="hi" className="bg-[#12121a] text-white">Hindi (हिन्दी)</option>
              <option value="en" className="bg-[#12121a] text-white">English</option>
            </select>

            {/* Transcribe Button */}
            <button
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className="h-8 px-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              {isTranscribing ? (
                <RefreshCw size={13} className="animate-spin text-accent" />
              ) : (
                <Subtitles size={13} />
              )}
              {isTranscribing ? `Transcribing... (${store.transcribeStage || 'starting'})` : 'Transcribe'}
            </button>

            {/* Analyze Audio Button / Chip */}
            {store.bpm ? (
              <div className="h-8 px-3 rounded-full bg-[#ffb300]/10 border border-[#ffb300]/25 text-[#ffb300] text-xs font-semibold flex items-center gap-1.5 select-none">
                <span>♩ {Math.round(store.bpm)} BPM · {store.beats?.length || 0} beats</span>
              </div>
            ) : (
              <button
                onClick={handleAnalyzeAudio}
                disabled={isAnalyzingAudio}
                className="h-8 px-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                {isAnalyzingAudio ? (
                  <RefreshCw size={13} className="animate-spin text-[#ffb300]" />
                ) : (
                  <Volume2 size={13} />
                )}
                {isAnalyzingAudio ? 'Analyzing...' : 'Analyze Audio'}
              </button>
            )}

            {/* Detect Scenes Button / Chip */}
            {store.scenes && store.scenes.length > 0 ? (
              <div className="h-8 px-3 rounded-full bg-[#00f5c4]/10 border border-[#00f5c4]/25 text-[#00f5c4] text-xs font-semibold flex items-center gap-1.5 select-none">
                <span>✂ {store.scenes.length} scenes</span>
              </div>
            ) : (
              <button
                onClick={handleDetectScenes}
                disabled={isDetectingScenes}
                className="h-8 px-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                {isDetectingScenes ? (
                  <RefreshCw size={13} className="animate-spin text-[#00f5c4]" />
                ) : (
                  <Film size={13} />
                )}
                {isDetectingScenes ? 'Detecting...' : 'Detect Scenes'}
              </button>
            )}

            {/* Remove Silence Button */}
            {store.silenceRanges && store.silenceRanges.length > 0 && (
              <button
                onClick={handleRemoveSilence}
                className="h-8 px-3 rounded-full bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-all animate-pulse"
              >
                <Scissors size={13} />
                <span>Found {store.silenceRanges.length} silences ({store.silenceRanges.reduce((acc, r) => acc + (r.end - r.start), 0).toFixed(1)}s total)</span>
              </button>
            )}
          </div>

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
            onClick={() => navigate('/export', { state: { clips: store.clips } })}
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

                {/* Caption overlay or Remotion preview */}
                {store.useRemotionRender ? (
                  <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                    <RemotionPreview
                      words={store.words || []}
                      selectedStyle={store.selectedStyle || 'NeonPop'}
                      currentTime={clipOffset}
                      duration={clipDur}
                      videoWidth={store.videoInfo?.width || 1080}
                      videoHeight={store.videoInfo?.height || 1920}
                      width="100%"
                      height="100%"
                      showControls={false}
                      loop={isPlaying}
                    />
                  </div>
                ) : (
                  <CaptionOverlay
                    captionGroups={captionGroups}
                    currentTime={clipOffset}
                    stylePreset={store.selectedStyle}
                  />
                )}

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

          {/* ── AI CHAT LOG ──────────────────────────────────────────────────── */}
          {store.aiHistory && store.aiHistory.length > 0 && (
            <div className="border-t border-white/5 flex-shrink-0">
              <button
                onClick={() => setAiChatOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/3 transition-colors"
              >
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={10} className="text-orange-400" />
                  AI History ({store.aiHistory.length})
                </span>
                {aiChatOpen
                  ? <ChevronDown size={12} className="text-white/30" />
                  : <ChevronUp size={12} className="text-white/30" />}
              </button>

              <AnimatePresence>
                {aiChatOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-2 flex flex-col gap-1 max-h-36 overflow-y-auto">
                      {store.aiHistory.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className="group flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-default"
                        >
                          <Zap size={10} className="text-orange-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-white/70 truncate font-medium">{item.description}</p>
                            <p className="text-[9px] text-white/25 flex items-center gap-1 mt-0.5 font-mono">
                              <Clock size={8} />
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── AI PROMPT BAR — pinned bottom ────────────────────────────────── */}
          <div className="border-t border-white/5 p-3 flex-shrink-0 bg-[#08080e]/60">
            <AIPromptBar
              currentState={{
                language: store.language,
                selectedStyle: store.selectedStyle,
                fontSize: store.exportSettings?.fontSize || store.captionStyle?.fontSize,
                hasBeats: store.beats && store.beats.length > 0,
                hasSilences: store.silenceRanges && store.silenceRanges.length > 0,
                silenceCount: store.silenceRanges?.length,
                duration: videoDuration || activeClip?.duration,
                platform: store.exportSettings?.platform,
                speed: speedVal,
              }}
              onActionsConfirmed={handleActionsConfirmed}
            />
          </div>
        </div>
      </div>

      {/* ── TIMELINE ─────────────────────────────────────────────────────────── */}
      <div className="h-[140px] border-t border-white/10 bg-[#0a0a10] flex flex-col relative select-none z-40 overflow-hidden flex-shrink-0">
        {/* Row 1 (32px): Full-width scrubber + time markers */}
        <div 
          ref={timelineScrubberRef}
          className="h-8 bg-[#0d0d14] border-b border-white/5 relative cursor-ew-resize flex items-center"
          onMouseDown={handleTimelineScrubberMouseDown}
        >
          {/* Time markers every 5 seconds */}
          {Array.from({ length: Math.ceil(clipDur / 5) }).map((_, i) => {
            const sec = i * 5;
            const pct = (sec / clipDur) * 100;
            return (
              <div 
                key={sec} 
                className="absolute top-0 bottom-0 border-l border-white/10 flex items-center pl-1.5 font-mono text-[9px] text-white/35"
                style={{ left: `${pct}%` }}
              >
                {formatTimecode(sec)}
              </div>
            );
          })}
        </div>

        {/* Row 2 (40px): WaveformDisplay */}
        <div className="h-10 bg-[#07070a] relative border-b border-white/5 flex items-center">
          <WaveformDisplay 
            audioUrl={getAudioUrl()} 
            beats={store.beats || []} 
            scenes={store.scenes || []} 
            onSeek={handleTimelineSeek} 
            duration={clipDur} 
            currentTime={clipOffset}
            height={40}
          />
        </div>

        {/* Row 3 (16px): BeatMarkers — orange tick marks */}
        <div className="h-4 bg-[#08080c] relative border-b border-white/5">
          <BeatMarkers beats={store.beats || []} duration={clipDur} />
        </div>

        {/* Row 4 (52px): Caption segment blocks (existing proportional orange blocks) */}
        <div className="h-[52px] bg-[#050508] relative">
          {captionGroups.map((group) => {
            const isActive = currentTime >= group.startTime && currentTime <= group.endTime;
            const leftPct = (group.startTime / clipDur) * 100;
            const widthPct = ((group.endTime - group.startTime) / clipDur) * 100;

            return (
              <div
                key={group.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTimelineSeek(group.startTime);
                }}
                className={`absolute top-[6px] bottom-[6px] rounded-lg border text-[10px] font-semibold flex items-center px-2 overflow-hidden transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-[#f97316] border-[#ea580c] text-white shadow-[0_0_8px_rgba(249,115,22,0.4)] font-bold'
                    : 'bg-[#f97316]/10 border-[#f97316]/30 text-orange-300 hover:bg-[#f97316]/20'
                }`}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                }}
                title={group.text}
              >
                <span className="truncate">{group.text}</span>
              </div>
            );
          })}
        </div>

        {/* Playhead vertical line overlay spanning the entire timeline height */}
        <div 
          className="absolute top-0 bottom-0 w-[1.5px] bg-[#7c5cfc] z-30 pointer-events-none"
          style={{ left: `${seekFraction * 100}%` }}
        >
          {/* Small playhead flag at the top */}
          <div className="w-2.5 h-2.5 bg-[#7c5cfc] rotate-45 transform -translate-y-[2px] -translate-x-[4.5px]" />
        </div>
      </div>



      {/* ── SILENCE REMOVAL PROGRESS MODAL ────────────────────────────────────── */}
      {isSilenceRemoving && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 gap-4 animate-fade-in">
          <div className="bg-[#0f0f15] border border-white/10 rounded-2xl p-6 max-w-sm w-full flex flex-col items-center gap-4 shadow-glow">
            <RefreshCw className="animate-spin text-accent" size={32} />
            <h3 className="text-white font-bold text-sm">Removing Silences...</h3>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-accent h-full transition-all duration-300" style={{ width: `${silenceProgress}%` }} />
            </div>
            <span className="text-xs text-white/60 font-mono">{silenceProgress}% complete</span>
          </div>
        </div>
      )}
    </div>
  );


}
