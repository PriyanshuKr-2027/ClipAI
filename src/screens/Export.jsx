import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Download, 
  GripVertical, 
  Settings2, 
  Music, 
  Subtitles, 
  Sparkles, 
  Instagram, 
  Youtube, 
  Twitter, 
  Linkedin, 
  Check, 
  Video, 
  RefreshCw, 
  FileText 
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import * as api from '../services/api';
import RemotionPreview from '../components/RemotionPreview';

// Custom icons for brand badges that are not standard Lucide
const TikTokIcon = () => (
  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.09-1.51-.15-.11-.29-.24-.44-.36v6.52c-.05 2.1-.8 4.22-2.34 5.67-1.74 1.66-4.32 2.29-6.63 1.66-2.58-.7-4.66-2.91-5.11-5.56-.63-3.71 1.73-7.53 5.4-8.32 1-.22 2.04-.18 3.02.1v4.02c-.89-.31-1.89-.35-2.77.06-1.39.65-2.22 2.2-1.95 3.73.23 1.34 1.41 2.37 2.76 2.37 1.48.06 2.78-1.07 2.92-2.54.02-1.33.01-10.97.01-10.97z"/>
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

// Helper for local absolute path mapping (temp directory)
const getLocalPathFromFilename = (filename, baseVideoPath) => {
  if (!baseVideoPath) return filename;
  const lastSlash = Math.max(baseVideoPath.lastIndexOf('/'), baseVideoPath.lastIndexOf('\\'));
  if (lastSlash === -1) return filename;
  const tempDir = baseVideoPath.substring(0, lastSlash);
  return `${tempDir}/${filename}`;
};

// Subtitle generator helpers
function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const cs = Math.floor((secs % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

function groupWordsIntoLines(words, maxWords = 5) {
  const groups = [];
  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords);
    groups.push({
      words: chunk,
      startTime: chunk[0].start,
      endTime: chunk[chunk.length - 1].end,
      text: chunk.map((w) => w.word).join(' '),
    });
  }
  return groups;
}

function generateASS(words, stylePreset, videoWidth, videoHeight) {
  const groups = groupWordsIntoLines(words, 5);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: NeonPop,Bangers,72,&H0000FFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,10,10,80,1
Style: HinglishFire,Anton,68,&H000055FF,&H00FFFFFF,&H0000008B,&H00000000,1,0,0,0,100,100,0,0,1,4,3,2,10,10,80,1
Style: BoldDevanagari,Noto Sans Devanagari,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,4,0,0,2,10,10,60,1
Style: CleanMinimal,Montserrat,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,2,1,2,10,10,80,1
Style: ReelBold,Impact,80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,5,0,2,10,10,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let events = '';
  for (const group of groups) {
    const startStr = formatTime(group.startTime);
    const endStr = formatTime(group.endTime);
    let dialogueText = '';

    if (stylePreset === 'NeonPop' || stylePreset === 'HinglishFire') {
      let lastWordEnd = group.startTime;
      for (let i = 0; i < group.words.length; i++) {
        const w = group.words[i];
        const gap = w.start - lastWordEnd;
        const dur = w.end - w.start;

        if (i > 0) {
          if (gap > 0) {
            dialogueText += `{\\k${Math.round(gap * 100)}} `;
          } else {
            dialogueText += ' ';
          }
        }

        dialogueText += `{\\k${Math.round(dur * 100)}}${w.word}`;
        lastWordEnd = w.end;
      }
    } else if (stylePreset === 'CleanMinimal') {
      dialogueText = `{\\fad(150,150)}${group.text}`;
    } else if (stylePreset === 'ReelBold') {
      dialogueText = group.text.toUpperCase();
    } else {
      dialogueText = group.text;
    }

    events += `Dialogue: 0,${startStr},${endStr},${stylePreset},,0,0,0,,${dialogueText}\n`;
  }

  return header + events;
}

function formatSRTTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function generateSRT(words) {
  const groups = groupWordsIntoLines(words, 5);
  let srt = '';
  groups.forEach((group, index) => {
    srt += `${index + 1}\n`;
    srt += `${formatSRTTime(group.startTime)} --> ${formatSRTTime(group.endTime)}\n`;
    srt += `${group.text}\n\n`;
  });
  return srt;
}

const triggerSrtDownload = (words, filename) => {
  const srtContent = generateSRT(words);
  const blob = new Blob([srtContent], { type: 'text/srt;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const triggerDownload = async (url, filename) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

export default function Export() {
  const location = useLocation();
  const navigate = useNavigate();
  const store = useEditorStore();

  const [queue, setQueue] = useState([]);
  const [activeClipId, setActiveClipId] = useState(null);
  const [previewTime, setPreviewTime] = useState(0);

  // Settings State
  const [format, setFormat] = useState('h264');
  const [quality, setQuality] = useState(23); // CRF 15 - 35
  const [resolution, setResolution] = useState('1080x1920'); // Original / 1080x1920 / 720x1280 / 1080x1080
  const [captionMode, setCaptionMode] = useState('remotion'); // remotion / ass / none
  const [usePedalboardMaster, setUsePedalboardMaster] = useState(false);
  const [exportSRT, setExportSRT] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState(store.selectedStyle || 'NeonPop');

  // Collapsible Settings
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Selection mapping
  const [selectedIds, setSelectedIds] = useState([]);

  // Job statuses: { [clipId]: { status: 'Pending' | 'Rendering' | 'Done' | 'Error', percent: number, stage: string, outputUrl: string, errorMsg: string } }
  const [jobs, setJobs] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [pythonReady, setPythonReady] = useState(true);

  // Load backend capabilities and routing state
  useEffect(() => {
    api.getSystemStatus()
      .then(status => {
        if (status.features && status.features.pedalboard === false) {
          setPythonReady(false);
        }
      })
      .catch(err => {
        console.warn("Failed checking system features, assuming ready:", err);
      });
  }, []);

  useEffect(() => {
    let initialClips = [];
    if (location.state && location.state.clips) {
      initialClips = location.state.clips;
    } else if (store.selectedClipIds && store.selectedClipIds.length > 0) {
      initialClips = store.generatedClips.filter(c => store.selectedClipIds.includes(c.id));
    } else if (store.generatedClips && store.generatedClips.length > 0) {
      initialClips = store.generatedClips;
    } else {
      initialClips = store.clips || [];
    }

    // Format queue with safe IDs
    const formatted = initialClips.map((clip, index) => ({
      ...clip,
      id: clip.id || clip.key || `clip_${index}`
    }));

    setQueue(formatted);
    if (formatted.length > 0) {
      setActiveClipId(formatted[0].id);
      setSelectedIds(formatted.map(c => c.id));
    }
  }, [location.state, store.clips, store.generatedClips, store.selectedClipIds]);

  const activeClip = queue.find(c => c.id === activeClipId);

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, index) => {
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const updated = [...queue];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(index, 0, moved);
    setQueue(updated);
  };

  const toggleSelectClip = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Quick Preset Fills
  const applyPreset = (presetName) => {
    switch (presetName) {
      case 'instagram':
        setFormat('h264');
        setQuality(23);
        setResolution('1080x1920');
        setCaptionMode('remotion');
        break;
      case 'youtube':
        setFormat('h264');
        setQuality(20);
        setResolution('1080x1920');
        setCaptionMode('remotion');
        break;
      case 'tiktok':
        setFormat('h264');
        setQuality(23);
        setResolution('1080x1920');
        setCaptionMode('remotion');
        break;
      case 'linkedin':
        setFormat('h264');
        setQuality(20);
        setResolution('1080x1920');
        setCaptionMode('remotion');
        break;
      case 'twitter':
        setFormat('h264');
        setQuality(23);
        setResolution('1080x1920');
        setCaptionMode('remotion');
        break;
      default:
        break;
    }
  };

  // Main Sequential Export Orchestration
  const handleExport = async (targetIds) => {
    if (targetIds.length === 0) return;
    setIsExporting(true);

    const targetClips = queue.filter(c => targetIds.includes(c.id));
    
    // Initialize job metrics
    const initialJobs = { ...jobs };
    targetClips.forEach(clip => {
      initialJobs[clip.id] = {
        status: 'Pending',
        percent: 0,
        stage: 'Pending',
        outputUrl: null,
        errorMsg: null
      };
    });
    setJobs(initialJobs);

    for (const clip of targetClips) {
      // Mark as Rendering
      setJobs(prev => ({
        ...prev,
        [clip.id]: {
          status: 'Rendering',
          stage: 'Initializing',
          percent: 0,
          outputUrl: null,
          errorMsg: null
        }
      }));

      try {
        let currentVideoPath = clip.videoPath || store.videoPath;
        let masteredAudioPath = null;

        // Resolution targets
        let targetWidth = store.videoInfo?.width || 1080;
        let targetHeight = store.videoInfo?.height || 1920;
        if (resolution !== 'original') {
          const [w, h] = resolution.split('x');
          targetWidth = parseInt(w, 10);
          targetHeight = parseInt(h, 10);
        }

        const settings = {
          crf: quality,
          resolution,
        };

        // Stage 1: Captions (Remotion Render or ASS burn)
        if (captionMode === 'remotion') {
          setJobs(prev => ({
            ...prev,
            [clip.id]: { ...prev[clip.id], stage: 'Remotion Render', percent: 5 }
          }));

          const clipWords = clip.words || store.words || [];
          const renderResult = await api.renderRemotion(
            clipWords,
            selectedStyle,
            clip.duration || 10,
            targetWidth,
            targetHeight,
            (pct) => {
              setJobs(prev => ({
                ...prev,
                [clip.id]: { ...prev[clip.id], percent: Math.round(pct * 0.7) } // Map to first 70%
              }));
            }
          );

          setJobs(prev => ({
            ...prev,
            [clip.id]: { ...prev[clip.id], stage: 'Compositing', percent: 75 }
          }));

          const captionsLocalPath = getLocalPathFromFilename(renderResult.outputFilename, store.videoPath);
          const compositeResult = await api.compositeVideo(
            currentVideoPath,
            captionsLocalPath,
            `composite_${clip.id}`
          );

          currentVideoPath = compositeResult.outputPath;

        } else if (captionMode === 'ass') {
          setJobs(prev => ({
            ...prev,
            [clip.id]: { ...prev[clip.id], stage: 'Compositing', percent: 5 }
          }));

          const clipWords = clip.words || store.words || [];
          const assContent = generateASS(clipWords, selectedStyle, targetWidth, targetHeight);
          
          const burnResult = await api.burnCaptions(
            currentVideoPath,
            assContent,
            `burn_${clip.id}`,
            settings,
            (pct) => {
              setJobs(prev => ({
                ...prev,
                [clip.id]: { ...prev[clip.id], percent: Math.round(pct * 0.8) }
              }));
            }
          );

          const outputFilename = burnResult.outputUrl.split('/').pop();
          currentVideoPath = getLocalPathFromFilename(outputFilename, store.videoPath);
        }

        // Stage 2: Audio Master
        if (usePedalboardMaster && pythonReady) {
          setJobs(prev => ({
            ...prev,
            [clip.id]: { ...prev[clip.id], stage: 'Audio Master', percent: 80 }
          }));

          const extractResult = await api.extractAudio(currentVideoPath);
          setJobs(prev => ({
            ...prev,
            [clip.id]: { ...prev[clip.id], percent: 85 }
          }));

          const masterResult = await api.masterAudio(extractResult.audioPath, -14);
          masteredAudioPath = masterResult.masteredPath;
        }

        // Stage 3: Encoding & Final Output
        setJobs(prev => ({
          ...prev,
          [clip.id]: { ...prev[clip.id], stage: 'Encoding', percent: 90 }
        }));

        const encodeResult = await api.reencodeVideo(
          currentVideoPath,
          settings,
          (pct) => {
            setJobs(prev => ({
              ...prev,
              [clip.id]: { ...prev[clip.id], percent: 90 + Math.round(pct * 0.09) }
            }));
          },
          masteredAudioPath
        );

        // Download SRT file if toggle enabled
        if (exportSRT) {
          try {
            const clipWords = clip.words || store.words || [];
            triggerSrtDownload(clipWords, `${clip.title || 'clip'}_subtitles.srt`);
          } catch (srtErr) {
            console.error("SRT export failed:", srtErr);
          }
        }

        const finalUrl = encodeResult.outputUrl;
        const finalFilename = finalUrl.split('/').pop();

        setJobs(prev => ({
          ...prev,
          [clip.id]: {
            status: 'Done',
            stage: 'Done',
            percent: 100,
            outputUrl: finalUrl,
            errorMsg: null
          }
        }));

        // Trigger auto download in browser
        triggerDownload(finalUrl, finalFilename);

      } catch (err) {
        console.error("Export pipeline failed for clip id:", clip.id, err);
        setJobs(prev => ({
          ...prev,
          [clip.id]: {
            status: 'Error',
            stage: 'Error',
            percent: 0,
            outputUrl: null,
            errorMsg: err.message || "Failed to process clip"
          }
        }));
      }
    }

    setIsExporting(false);
  };

  const getStageNumber = (stage) => {
    switch (stage) {
      case 'Pending': return 0;
      case 'Initializing': return 0;
      case 'Remotion Render': return 1;
      case 'Compositing': return 2;
      case 'Audio Master': return 3;
      case 'Encoding': return 4;
      case 'Done': return 5;
      default: return 0;
    }
  };

  const activeJob = activeClipId ? jobs[activeClipId] : null;
  const activeStageNum = activeJob ? getStageNumber(activeJob.stage) : 0;

  return (
    <div className="min-h-screen bg-[#060608] flex flex-col font-sans select-none text-white relative">
      {/* Top Header Bar */}
      <div className="h-16 border-b border-white/10 bg-[#0d0d12]/80 backdrop-blur-md flex items-center justify-between px-6 z-30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/clips')} 
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 text-sm font-semibold glass-card px-3 py-1.5"
          >
            <ArrowLeft size={16} />
            <span>Back to Clips</span>
          </button>
          <div className="h-4 w-px bg-white/20" />
          <h1 className="text-lg font-bold font-display tracking-tight flex items-center gap-2">
            <span>Export Workflow</span>
            <span className="text-xs bg-[#7c5cfc]/20 text-[#00d4ff] border border-[#7c5cfc]/30 px-2 py-0.5 rounded-full font-mono">
              {queue.length} Clip{queue.length !== 1 ? 's' : ''} in Queue
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40 font-mono">Project: {store.projectName || 'Untitled'}</span>
        </div>
      </div>

      {/* 3-Column Content Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Column: Clip Queue Panel (280px) */}
        <div className="w-[280px] border-r border-white/10 bg-[#0d0d12]/40 backdrop-blur-md flex flex-col z-20">
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Export List</span>
            <span className="text-xs text-[#7c5cfc] font-bold">{selectedIds.length} Selected</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {queue.map((clip, index) => {
              const job = jobs[clip.id];
              const isSelected = selectedIds.includes(clip.id);
              const isActive = activeClipId === clip.id;

              return (
                <div 
                  key={clip.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  onClick={() => setActiveClipId(clip.id)}
                  className={`glass-panel p-2.5 flex items-center gap-3 cursor-pointer group transition-all duration-200 relative ${
                    isActive ? 'border-[#7c5cfc]/60 bg-[#7c5cfc]/5 shadow-glow-sm' : 'border-white/5 hover:border-white/15 hover:bg-white/5'
                  }`}
                >
                  {/* Reorder Grip */}
                  <div className="text-white/20 group-hover:text-white/50 cursor-grab active:cursor-grabbing transition-colors duration-150">
                    <GripVertical size={16} />
                  </div>

                  {/* Thumbnail */}
                  <div className="w-[60px] h-[80px] bg-black rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center relative border border-white/10">
                    {clip.thumbUrl ? (
                      <img src={clip.thumbUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <Video size={20} className="text-white/20" />
                    )}
                    <span className="absolute bottom-1 right-1 text-[9px] bg-black/75 px-1 rounded text-white/80 font-mono">
                      {(clip.duration || 0).toFixed(1)}s
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="text-xs font-semibold truncate text-white/90">
                      {clip.title || `Clip ${index + 1}`}
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {!job && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-white/5 border border-white/10 text-white/40">
                          Pending
                        </span>
                      )}
                      {job && job.status === 'Pending' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-white/5 border border-white/10 text-white/40 animate-pulse">
                          Pending
                        </span>
                      )}
                      {job && job.status === 'Rendering' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1">
                          <Loader2 size={8} className="animate-spin" />
                          <span>{job.percent}%</span>
                        </span>
                      )}
                      {job && job.status === 'Done' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          Done
                        </span>
                      )}
                      {job && job.status === 'Error' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                          Error
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selector checkbox */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectClip(clip.id);
                    }}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors duration-150 ${
                      isSelected ? 'bg-[#7c5cfc] border-[#7c5cfc]' : 'border-white/20 hover:border-white/40 bg-black/40'
                    }`}
                  >
                    {isSelected && <Check size={10} className="text-white font-bold" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Live Preview + Settings (1fr) */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-[#060608]">
          {activeClip ? (
            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full gap-6">
              
              {/* Phone preview card frame */}
              <div className="relative aspect-[9/16] w-full max-w-[280px] rounded-3xl border border-white/10 bg-black overflow-hidden shadow-2xl glow-accent-sm transition-all duration-300">
                <video
                  src={activeClip.videoUrl}
                  autoPlay
                  loop
                  muted
                  onTimeUpdate={(e) => setPreviewTime(e.target.currentTime)}
                  className="w-full h-full object-cover absolute inset-0"
                />
                
                {/* Remotion Overlay preview synced to currentTime */}
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                  <RemotionPreview
                    words={activeClip.words || []}
                    selectedStyle={selectedStyle}
                    currentTime={previewTime}
                    duration={activeClip.duration || 5}
                    videoWidth={1080}
                    videoHeight={1920}
                    width="100%"
                    height="100%"
                    showControls={false}
                    loop={true}
                  />
                </div>

                {/* Mobile visual border sheen */}
                <div className="absolute inset-0 border border-white/5 rounded-3xl pointer-events-none z-20" />
              </div>

              {/* Progress Tracker below preview */}
              <div className="w-full bg-[#0d0d12]/60 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-glow-sm">
                <div className="flex justify-between items-center text-xs text-white/50 uppercase tracking-wider font-semibold">
                  <span>Pipeline Track</span>
                  {activeJob && activeJob.status === 'Rendering' && (
                    <span className="text-[#00d4ff] flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" />
                      {activeJob.stage}...
                    </span>
                  )}
                  {activeJob && activeJob.status === 'Done' && (
                    <span className="text-emerald-400">Completed</span>
                  )}
                </div>

                {/* Steps Indicator Progress bar */}
                <div className="relative flex justify-between items-center w-full mt-2 px-2">
                  {/* Progress Connector Line */}
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2 z-0" />
                  
                  {/* Colored active progress connector */}
                  <div 
                    className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-[#7c5cfc] to-[#00d4ff] -translate-y-1/2 z-0 transition-all duration-300"
                    style={{ width: `${(activeStageNum / 5) * 100}%` }}
                  />

                  {/* Stage points */}
                  {[
                    { label: 'Render', stage: 'Remotion Render' },
                    { label: 'Composite', stage: 'Compositing' },
                    { label: 'Audio Master', stage: 'Audio Master' },
                    { label: 'Encode', stage: 'Encoding' },
                    { label: 'Done', stage: 'Done' }
                  ].map((step, idx) => {
                    const stepNum = idx + 1;
                    const isActive = activeStageNum >= stepNum;
                    const isCurrent = activeStageNum === stepNum && activeJob?.status === 'Rendering';

                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 z-10 relative">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 border ${
                          isCurrent 
                            ? 'bg-[#060608] border-[#00d4ff] text-[#00d4ff] ring-4 ring-[#00d4ff]/25 animate-pulse'
                            : isActive 
                            ? 'bg-gradient-to-r from-[#7c5cfc] to-[#00d4ff] border-transparent text-white'
                            : 'bg-[#0d0d12] border-white/15 text-white/30'
                        }`}>
                          {isActive && !isCurrent ? <Check size={10} strokeWidth={3} /> : stepNum}
                        </div>
                        <span className={`text-[10px] font-semibold transition-colors duration-200 ${
                          isCurrent ? 'text-[#00d4ff]' : isActive ? 'text-white' : 'text-white/30'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar line percentages */}
                {activeJob && activeJob.status === 'Rendering' && (
                  <div className="w-full mt-2">
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-[#7c5cfc] to-[#00d4ff] transition-all duration-300"
                        style={{ width: `${activeJob.percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[11px] font-mono text-white/40">
                      <span>Progress Stage: {activeJob.percent}%</span>
                      <span>1080p output</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <Video size={48} className="text-white/20 mb-4" />
              <h2 className="text-md font-bold text-white mb-1">No Active Clip Selected</h2>
              <p className="text-xs text-white/40">Select a clip from the Left Panel queue to view it in the active live editor panel.</p>
            </div>
          )}
        </div>

        {/* Right Column: Platform Presets & Export Options (300px) */}
        <div className="w-[300px] border-l border-white/10 bg-[#0d0d12]/40 backdrop-blur-md flex flex-col overflow-y-auto p-5 z-20">
          
          {/* Quick-fill presets */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Platform Presets</span>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => applyPreset('instagram')}
                className="h-10 rounded-xl glass-card flex items-center justify-between px-4 hover:bg-white/10 hover:border-white/20 transition-all text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <Instagram size={14} className="text-[#e1306c]" />
                  <span>Instagram Reels</span>
                </div>
                <span className="text-[10px] text-white/40">1080×1920</span>
              </button>

              <button 
                onClick={() => applyPreset('youtube')}
                className="h-10 rounded-xl glass-card flex items-center justify-between px-4 hover:bg-white/10 hover:border-white/20 transition-all text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <Youtube size={14} className="text-rose-600" />
                  <span>YouTube Shorts</span>
                </div>
                <span className="text-[10px] text-white/40">CRF 20</span>
              </button>

              <button 
                onClick={() => applyPreset('tiktok')}
                className="h-10 rounded-xl glass-card flex items-center justify-between px-4 hover:bg-white/10 hover:border-white/20 transition-all text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <TikTokIcon />
                  <span>TikTok Video</span>
                </div>
                <span className="text-[10px] text-white/40">30 fps</span>
              </button>

              <button 
                onClick={() => applyPreset('linkedin')}
                className="h-10 rounded-xl glass-card flex items-center justify-between px-4 hover:bg-white/10 hover:border-white/20 transition-all text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <Linkedin size={14} className="text-[#0a66c2]" />
                  <span>LinkedIn Post</span>
                </div>
                <span className="text-[10px] text-white/40">CRF 20</span>
              </button>

              <button 
                onClick={() => applyPreset('twitter')}
                className="h-10 rounded-xl glass-card flex items-center justify-between px-4 hover:bg-white/10 hover:border-white/20 transition-all text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <XIcon />
                  <span>Twitter / X</span>
                </div>
                <span className="text-[10px] text-white/40">H.264</span>
              </button>
            </div>
          </div>

          <div className="h-px bg-white/10 my-4" />

          {/* Advanced configurations collapsible drawer */}
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center justify-between text-xs text-white/60 hover:text-white font-semibold uppercase tracking-wider"
            >
              <div className="flex items-center gap-1.5">
                <Settings2 size={12} />
                <span>Advanced Settings</span>
              </div>
              <span className="text-[10px] text-[#7c5cfc]">{advancedOpen ? 'Hide' : 'Show'}</span>
            </button>

            {advancedOpen && (
              <div className="flex flex-col gap-4 mt-2 bg-white/5 border border-white/10 rounded-xl p-3">
                {/* Format selection */}
                <div>
                  <label className="text-[10px] text-white/50 uppercase font-semibold tracking-wider block mb-1">Format</label>
                  <div className="grid grid-cols-3 gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                    {['h264', 'h265', 'webm'].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setFormat(fmt)}
                        className={`py-1 rounded text-[10px] font-semibold transition-all ${
                          format === fmt ? 'bg-[#7c5cfc] text-white' : 'text-white/50 hover:text-white'
                        }`}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption mode selection */}
                <div>
                  <label className="text-[10px] text-white/50 uppercase font-semibold tracking-wider block mb-1">Caption Mode</label>
                  <div className="grid grid-cols-3 gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                    {[
                      { key: 'remotion', label: 'Remotion' },
                      { key: 'ass', label: 'ASS' },
                      { key: 'none', label: 'None' }
                    ].map((cap) => (
                      <button
                        key={cap.key}
                        onClick={() => setCaptionMode(cap.key)}
                        className={`py-1 rounded text-[10px] font-semibold transition-all ${
                          captionMode === cap.key ? 'bg-[#7c5cfc] text-white' : 'text-white/50 hover:text-white'
                        }`}
                        title={cap.label === 'Remotion' ? 'Animated Captions' : (cap.label === 'ASS' ? 'Static Captions' : 'No Captions')}
                      >
                        {cap.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution override */}
                <div>
                  <label className="text-[10px] text-white/50 uppercase font-semibold tracking-wider block mb-1">Resolution</label>
                  <select 
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg py-1 px-2 text-xs text-white/70 outline-none focus:border-[#7c5cfc]/60"
                  >
                    <option value="original">Original Aspect Ratio</option>
                    <option value="1080x1920">1080 × 1920 (9:16 vertical)</option>
                    <option value="720x1280">720 × 1280 (9:16 dynamic)</option>
                    <option value="1080x1080">1080 × 1080 (1:1 square)</option>
                  </select>
                </div>

                {/* Style preset override */}
                {captionMode !== 'none' && (
                  <div>
                    <label className="text-[10px] text-white/50 uppercase font-semibold tracking-wider block mb-1">Style Template</label>
                    <select 
                      value={selectedStyle}
                      onChange={(e) => setSelectedStyle(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-1 px-2 text-xs text-white/70 outline-none focus:border-[#7c5cfc]/60"
                    >
                      <option value="NeonPop">NeonPop (Yellow Bangers)</option>
                      <option value="HinglishFire">HinglishFire (Red-White Anton)</option>
                      <option value="BoldDevanagari">BoldDevanagari (Hindi White)</option>
                      <option value="CleanMinimal">CleanMinimal (Montserrat Fad)</option>
                      <option value="ReelBold">ReelBold (Caps Impact)</option>
                    </select>
                  </div>
                )}

                {/* Quality CRF slider */}
                <div>
                  <div className="flex justify-between mb-1 text-[10px] text-white/50 uppercase font-semibold tracking-wider">
                    <span>Quality (CRF)</span>
                    <span className="font-mono text-white">{quality}</span>
                  </div>
                  <input 
                    type="range" 
                    min="15" 
                    max="35" 
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                    className="w-full accent-[#7c5cfc]"
                  />
                  <div className="flex justify-between text-[9px] text-white/30 font-mono mt-0.5">
                    <span>15 (Best)</span>
                    <span>35 (Lowest)</span>
                  </div>
                </div>

                {/* Audio Master Toggle */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50 uppercase font-semibold tracking-wider flex items-center gap-1">
                      <Music size={10} />
                      <span>Audio Mastering</span>
                    </span>
                    <input 
                      type="checkbox" 
                      checked={usePedalboardMaster}
                      onChange={(e) => setUsePedalboardMaster(e.target.checked)}
                      disabled={!pythonReady}
                      className="w-3.5 h-3.5 accent-[#7c5cfc] cursor-pointer disabled:opacity-50"
                    />
                  </div>
                  {!pythonReady && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2 rounded-lg text-[9px] flex gap-1.5">
                      <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                      <span>Python dependencies not ready on server. Pedalboard audio mastering disabled.</span>
                    </div>
                  )}
                </div>

                {/* Export SRT toggle */}
                <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                  <span className="text-[10px] text-white/50 uppercase font-semibold tracking-wider flex items-center gap-1">
                    <FileText size={10} />
                    <span>Export SRT File</span>
                  </span>
                  <input 
                    type="checkbox" 
                    checked={exportSRT}
                    onChange={(e) => setExportSRT(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#7c5cfc] cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-white/10 my-4" />

          {/* Action CTAs */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleExport(selectedIds)}
              disabled={isExporting || selectedIds.length === 0}
              className="h-12 w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-glow shadow-orange-500/10 transition-all duration-200"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>Export Selected ({selectedIds.length})</span>
            </button>

            <button
              onClick={() => {
                const all = queue.map(c => c.id);
                setSelectedIds(all);
                handleExport(all);
              }}
              disabled={isExporting || queue.length === 0}
              className="h-10 w-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs"
            >
              <span>Export All ({queue.length})</span>
            </button>
          </div>

          {/* Completed output links per-clip */}
          {Object.keys(jobs).length > 0 && (
            <div className="flex-1 flex flex-col min-h-[140px] mt-6 gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Downloads</span>
              <div className="flex-1 border border-white/10 bg-white/5 rounded-2xl p-3 overflow-y-auto max-h-[220px] flex flex-col gap-2">
                {queue.map((clip) => {
                  const job = jobs[clip.id];
                  if (!job || (job.status !== 'Done' && job.status !== 'Error')) return null;

                  return (
                    <div key={clip.id} className="glass-card p-2.5 flex items-center justify-between border-white/10">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="text-[11px] font-semibold text-white truncate">{clip.title || 'Clip Output'}</div>
                        {job.status === 'Done' ? (
                          <div className="text-[9px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                            <CheckCircle size={8} />
                            <span>Ready to download</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-rose-400 font-mono flex items-center gap-1 mt-0.5" title={job.errorMsg}>
                            <XCircle size={8} />
                            <span className="truncate">{job.errorMsg || 'Failed'}</span>
                          </div>
                        )}
                      </div>

                      {job.status === 'Done' ? (
                        <button
                          onClick={() => {
                            const filename = job.outputUrl.split('/').pop();
                            triggerDownload(job.outputUrl, filename);
                          }}
                          className="w-7 h-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-colors border border-emerald-500/20"
                          title="Download Video"
                        >
                          <Download size={12} />
                        </button>
                      ) : (
                        <button
                          onClick={() => retryClip(clip)}
                          className="w-7 h-7 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 flex items-center justify-center transition-colors border border-rose-500/20"
                          title="Retry Export"
                        >
                          <RefreshCw size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {Object.values(jobs).filter(j => j.status === 'Done' || j.status === 'Error').length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-white/30 text-[10px]">
                    No completed jobs yet.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
