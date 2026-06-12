import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { generateClips } from '../services/clipDetector';
import CaptionOverlay from '../components/CaptionOverlay';
import ScoreCard from '../components/ScoreCard';
import RemotionPreview from '../components/RemotionPreview';
import * as beatSync from '../services/beatSync';
import {
  ArrowLeft, Sparkles, RefreshCw, Check, Play, Edit3,
  ExternalLink, X, Eye, Film, Scissors, CheckSquare, Square, Smile
} from 'lucide-react';

export default function ClipsReview() {
  const navigate = useNavigate();
  const store = useEditorStore();

  const {
    generatedClips,
    selectedClipIds,
    isGeneratingClips,
    clipStatus,
    videoPath,
    selectedStyle,
    projectName,
  } = store;

  // Local component states
  const [activePreviewClip, setActivePreviewClip] = useState(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [beatSyncDiff, setBeatSyncDiff] = useState(null);

  const handleBeatSyncClick = () => {
    if (!store.beats || store.beats.length === 0) return;
    const syncedClips = beatSync.generateBeatSyncCuts(store.beats, generatedClips);
    setBeatSyncDiff(syncedClips);
  };

  const handleApplyBeatSync = () => {
    if (!beatSyncDiff) return;
    store.updateClips(beatSyncDiff);
    setBeatSyncDiff(null);
  };

  const handleCancelBeatSync = () => {
    setBeatSyncDiff(null);
  };

  const handleExportAllWithRemotion = () => {
    store.setExportSettings({ useRemotionCaptions: true });
    triggerSelectedExport();
  };

  // Auto-generate shorts on mount if generatedClips is empty
  useEffect(() => {
    if (videoPath && generatedClips.length === 0) {
      triggerGeneration();
    }
  }, [videoPath, generatedClips]);

  const triggerGeneration = async () => {
    store.setGeneratingClips(true, 'Initializing AI shorts pipeline...');
    try {
      const result = await generateClips(videoPath, (status) => {
        store.setGeneratingClips(true, status);
      });
      store.setGeneratedClips(result.clips);
      store.setWords(result.fullWords);
      store.setLanguage(result.language);
    } catch (e) {
      console.error(e);
      alert('Failed to generate AI clips: ' + e.message);
    } finally {
      store.setGeneratingClips(false, '');
    }
  };

  // Checkbox selectors
  const toggleSelect = (id, e) => {
    e.stopPropagation();
    store.toggleClipSelection(id);
  };

  const selectAll = () => {
    store.setAllClipsSelected(true);
  };

  const deselectAll = () => {
    store.setAllClipsSelected(false);
  };

  // Card CTA: Edit clip inside Main Editor
  const handleEditClip = (clip) => {
    store.takeSnapshot();
    store.setActiveClip(clip.id);

    // Swap Timeline tracks with this specific clip as the single source
    const activeTimelineClip = {
      id: clip.id,
      title: clip.title,
      duration: clip.duration,
      timelineStart: 0,
      videoPath: clip.videoPath,
      videoUrl: clip.videoUrl,
      thumbUrl: clip.thumbUrl,
      words: clip.words,
    };

    // Load this clip's words (already time-offset to 0..duration) into the store
    // so the Caption Editor only sees captions for this clip, not the full video.
    // Also swap videoUrl/videoPath to the cut clip file so the Caption Editor
    // previews and transcribes the correct 60s file instead of the full source.
    useEditorStore.setState({
      clips: [activeTimelineClip],
      captionBlocks: [],
      captionGroups: [],          // will be rebuilt from words on Caption Editor mount
      originalCaptionGroups: [],
      words: clip.words || [],    // ← clip-scoped, 0-based timestamps
      language: clip.language || store.language || null,
      // Point active video to the cut clip file (not the full source video)
      videoUrl: clip.videoUrl,
      videoPath: clip.videoPath,
    });

    navigate('/editor');
  };

  // Export triggers
  const triggerSingleExport = (clip, e) => {
    if (e) e.stopPropagation();
    navigate('/export', { state: { clips: [clip] } });
  };

  const triggerSelectedExport = () => {
    const selectedClips = generatedClips.filter((c) => selectedClipIds.includes(c.id));
    if (selectedClips.length === 0) return;
    navigate('/export', { state: { clips: selectedClips } });
  };

  const triggerExportAll = () => {
    if (generatedClips.length === 0) return;
    navigate('/export', { state: { clips: generatedClips } });
  };

  const formatDuration = (secs) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Color-coded AI grades
  const getScoreBadgeClass = (score) => {
    if (score >= 8.0) return 'bg-gradient-to-r from-[#00e676] to-[#00f5c4] text-black';
    if (score >= 6.0) return 'bg-gradient-to-r from-[#ffb300] to-[#ffd600] text-black';
    return 'bg-gradient-to-r from-[#ff4d6a] to-[#ff85a1] text-white';
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#060608] relative select-none">
      
      {/* TOP BAR */}
      <div className="h-[52px] border-b border-white/10 glass-panel rounded-none flex items-center justify-between px-6 z-50 flex-shrink-0">
        <button
          onClick={() => navigate('/projects')}
          className="h-8 px-3 rounded-lg glass-card flex items-center gap-1.5 text-white hover:bg-white/10 transition-colors text-xs font-semibold"
        >
          <ArrowLeft size={14} /> Back to Projects
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="text-accent-teal" size={16} />
          <span className="font-body font-bold text-white text-sm">
            {generatedClips.length} AI Shorts Suggested
          </span>
          <span className="text-[11px] text-white/40 max-w-[120px] truncate glass-card px-2 py-0.5 rounded">
            {projectName}
          </span>
        </div>

        <div className="flex gap-2 items-center">
          {generatedClips.length > 0 && (
            <>
              {beatSyncDiff ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-orange-400 font-bold uppercase tracking-wider animate-pulse mr-1">
                    ⚡ Previewing Sync
                  </span>
                  <button
                    onClick={handleApplyBeatSync}
                    className="h-8 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-full flex items-center justify-center shadow-glow-sm transition-colors"
                  >
                    Apply Beat Sync
                  </button>
                  <button
                    onClick={handleCancelBeatSync}
                    className="h-8 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-full flex items-center justify-center transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  {/* Beat Sync Trigger */}
                  {store.beats && store.beats.length > 0 && (
                    <button
                      onClick={handleBeatSyncClick}
                      className="h-8 px-3.5 bg-orange-500/10 border border-orange-500/25 hover:bg-orange-500/20 text-orange-400 font-bold text-xs rounded-full flex items-center gap-1.5 shadow-glow-sm transition-all"
                    >
                      ⚡ Beat Sync
                    </button>
                  )}

                  {/* Style Presetter */}
                  <select
                    value={selectedStyle}
                    onChange={(e) => store.setSelectedStyle(e.target.value)}
                    className="glass-input h-8 px-2 text-xs w-32 cursor-pointer"
                  >
                    {['NeonPop', 'HinglishFire', 'BoldDevanagari', 'CleanMinimal', 'ReelBold'].map((preset) => (
                      <option key={preset} value={preset} className="bg-[#12121a] text-white">
                        {preset}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={triggerExportAll}
                    className="h-8 px-4 rounded-full bg-gradient-to-r from-accent to-[#9b7dff] text-white text-xs font-bold shadow-glow-sm hover:opacity-90 transition-opacity"
                  >
                    Export All
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* WORKSPACE CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pb-[72px]">
        {/* Pipeline Loading overlay */}
        {isGeneratingClips && (
          <div className="absolute inset-0 z-50 bg-[#060608]/90 backdrop-blur-md flex flex-col items-center justify-center">
            {/* Spinning conics */}
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-t-accent border-r-transparent border-b-accent border-l-transparent animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-t-accent-2 border-r-transparent border-b-accent-2 border-l-transparent animate-spin duration-1000 reverse" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">Analyzing Viral Content...</h3>
            <p className="text-[#00f5c4] font-mono text-xs mb-8">{clipStatus}</p>

            <div className="flex gap-2 max-w-lg w-full px-8 justify-center">
              {[
                { name: 'Extract Audio', done: !clipStatus.includes('Extracting') },
                { name: 'Transcribing', done: !clipStatus.includes('Extracting') && !clipStatus.includes('Transcribing') },
                { name: 'AI Grading', done: clipStatus.includes('Cutting') || clipStatus.includes('Done') },
                { name: 'Cutting Clips', done: clipStatus.includes('Done') },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className={`flex-1 glass-card py-2 px-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                    step.done ? 'border-accent-teal bg-accent-teal/5 text-accent-teal' : 'border-white/5 text-white/30'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">{step.name}</span>
                  {step.done ? (
                    <Check size={12} className="text-accent-teal" />
                  ) : (
                    <RefreshCw className="animate-spin text-white/20" size={12} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested gallery list */}
        {generatedClips.length === 0 && !isGeneratingClips ? (
          <div className="flex-1 h-[80vh] flex flex-col items-center justify-center text-center text-white/20 gap-2">
            <Sparkles size={48} className="opacity-50 mb-2 text-white/30" />
            <h4 className="font-bold text-white/40">Suggestion Pipeline Failed</h4>
            <p className="text-xs max-w-xs leading-relaxed">
              Ensure your media was correctly transcribed and LLM API keys are active.
            </p>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {generatedClips.map((clip) => {
              const isSelected = selectedClipIds.includes(clip.id);
              const syncedClip = beatSyncDiff ? beatSyncDiff.find(c => c.id === clip.id) : null;
              const hasStartShift = syncedClip && Math.abs(syncedClip.start - clip.start) > 0.01;
              const hasEndShift = syncedClip && Math.abs(syncedClip.end - clip.end) > 0.01;
              const hasShifted = hasStartShift || hasEndShift;

              return (
                <div
                  key={clip.id}
                  onClick={() => setActivePreviewClip(clip)}
                  className={`glass-card rounded-2xl overflow-hidden cursor-pointer flex flex-col group relative transition-all border ${
                    isSelected
                      ? 'border-accent bg-accent/5 shadow-glow-sm scale-[1.02]'
                      : 'border-white/5 bg-[#12121a]/25 hover:border-white/10 hover:scale-[1.02] hover:shadow-lg'
                  }`}
                >
                  {/* Thumbnail / Mock Phone video */}
                  <div className="aspect-[9/16] relative bg-black/40 overflow-hidden">
                    <img
                      src={clip.thumbUrl || 'https://via.placeholder.com/200x350/12121a/333344?text=AI+Short'}
                      className="w-full h-full object-cover"
                    />

                    {/* Checkbox */}
                    <button
                      onClick={(e) => toggleSelect(clip.id, e)}
                      className={`absolute top-3 right-3 w-6 h-6 rounded-lg glass-card flex items-center justify-center transition-colors z-20 hover:bg-white/10 ${
                        isSelected ? 'bg-accent border-accent text-white shadow-glow-sm' : 'text-white/30 border-white/20'
                      }`}
                    >
                      {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                    </button>

                    {/* Face Detected Icon */}
                    {clip.faceScore > 0.8 && (
                      <div 
                        className="absolute top-3 right-11 w-6 h-6 rounded-lg bg-black/60 border border-white/20 flex items-center justify-center text-[#00f5c4] z-20" 
                        title="Face Detected"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Smile size={13} />
                      </div>
                    )}

                    {/* Score Card Badge */}
                    <div className="absolute top-3 left-3 z-20">
                      <ScoreCard score={clip.score} size="sm" />
                    </div>

                    {/* Transcribed Hover Badge */}
                    {store.transcriptionBackend && (
                      <div className="absolute top-12 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                          store.transcriptionBackend.toLowerCase() === 'groq'
                            ? 'bg-green-500/20 border-green-500/30 text-green-400'
                            : 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        }`}>
                          {store.transcriptionBackend.toLowerCase() === 'groq' ? 'Groq Whisper' : 'Local Whisper'}
                        </div>
                      </div>
                    )}

                    {/* Beat Sync Diff Overlay */}
                    {beatSyncDiff && syncedClip && (
                      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-30 flex flex-col justify-center p-4 text-[10px] font-mono text-white/95 leading-relaxed" onClick={(e) => e.stopPropagation()}>
                        <p className="text-orange-400 font-bold mb-2 flex items-center gap-1.5 uppercase tracking-wide text-xs">
                          <span>⚡</span> {hasShifted ? 'Timing Shifted' : 'Locked to Beat'}
                        </p>
                        <div className="flex flex-col gap-1.5 mt-1 border-t border-white/5 pt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-white/40">Start:</span>
                            <span>
                              {clip.start.toFixed(2)}s
                              {hasStartShift && <span className="text-orange-400 font-bold ml-1.5">→ {syncedClip.start.toFixed(2)}s</span>}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/40">End:</span>
                            <span>
                              {clip.end.toFixed(2)}s
                              {hasEndShift && <span className="text-orange-400 font-bold ml-1.5">→ {syncedClip.end.toFixed(2)}s</span>}
                            </span>
                          </div>
                          <div className="flex justify-between items-center border-t border-white/5 pt-1.5 mt-1">
                            <span className="text-white/40">Duration:</span>
                            <span>
                              {clip.duration.toFixed(1)}s
                              {Math.abs(syncedClip.duration - clip.duration) > 0.05 && (
                                <span className="text-orange-400 font-bold ml-1.5">→ {syncedClip.duration.toFixed(1)}s</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Aspect Ratio Selector */}
                    <div className="absolute top-3 left-16 z-20">
                      <select
                        value={clip.aspectRatio || '9:16'}
                        onChange={(e) => {
                          e.stopPropagation();
                          store.updateClipAspectRatio(clip.id, e.target.value);
                        }}
                        className="h-5 px-1 rounded bg-black/60 border border-white/20 text-white text-[9px] font-bold cursor-pointer outline-none focus:border-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="9:16">9:16</option>
                        <option value="1:1">1:1</option>
                        <option value="16:9">16:9</option>
                      </select>
                    </div>

                    {/* Duration badge */}
                    <div className="absolute bottom-3 right-3 glass-card px-2 py-0.5 rounded text-[10px] font-mono text-white/80 backdrop-blur-md z-20">
                      {formatDuration(clip.duration)}
                    </div>

                    {/* Bottom gradient description */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 flex flex-col gap-1 z-10">
                      <span className="text-[12px] font-bold text-white truncate line-clamp-2 leading-snug">
                        {clip.title}
                      </span>
                      <span className="text-[10px] text-white/50 truncate font-mono">
                        {clip.hook}
                      </span>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div className="p-2 flex gap-1.5 z-20 bg-[#0d0d12]/60">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePreviewClip(clip);
                      }}
                      className="h-8 rounded-lg glass-card flex-1 flex items-center justify-center text-xs font-semibold text-white/80 hover:text-white transition-colors hover:bg-white/10"
                    >
                      <Eye size={12} className="mr-1" /> Preview
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClip(clip);
                      }}
                      className="h-8 rounded-lg glass-card flex-1 flex items-center justify-center text-xs font-semibold text-white/80 hover:text-white transition-colors hover:bg-white/10"
                    >
                      <Edit3 size={12} className="mr-1" /> Edit
                    </button>
                    <button
                      onClick={(e) => triggerSingleExport(clip, e)}
                      className="w-8 h-8 rounded-lg glass-card flex items-center justify-center text-white/60 hover:text-white transition-colors hover:bg-white/10"
                      title="Export Clip"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FIXED BOTTOM ACTION PANEL */}
      {generatedClips.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 h-14 glass-panel rounded-none border-t border-b-0 border-x-0 bg-[#0a0a10]/95 flex items-center justify-between px-6 z-40">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-white/60 font-semibold">{selectedClipIds.length} Clips Selected</span>
            <div className="h-3 w-[1px] bg-white/10" />
            <button onClick={selectAll} className="text-accent hover:text-accent-2 transition-colors font-medium">
              Select All
            </button>
            <button onClick={deselectAll} className="text-white/40 hover:text-white transition-colors font-medium">
              Deselect All
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportAllWithRemotion}
              disabled={selectedClipIds.length === 0}
              className="h-9 px-6 rounded-full bg-gradient-to-r from-[#7c5cfc] to-[#9b7dff] text-white text-xs font-bold shadow-glow-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
            >
              Export All with Remotion
            </button>

            <button
              onClick={triggerSelectedExport}
              disabled={selectedClipIds.length === 0}
              className="h-9 px-6 rounded-full bg-gradient-to-r from-accent to-accent-teal text-white text-xs font-bold shadow-glow-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
            >
              Export Selected ({selectedClipIds.length})
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW DIALOG MODAL */}
      {activePreviewClip && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center"
          onClick={() => {
            setActivePreviewClip(null);
            setPreviewTime(0);
          }}
        >
          <div
            className="glass-panel p-6 rounded-3xl max-w-[320px] w-full m-4 border-white/20 bg-[#0d0d12]/95 relative flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setActivePreviewClip(null);
                setPreviewTime(0);
              }}
              className="absolute top-4 right-4 w-7 h-7 rounded-full glass-card hover:bg-white/10 flex items-center justify-center text-white"
            >
              <X size={14} />
            </button>

            <h3 className="text-sm font-bold text-white max-w-[200px] truncate mb-1">
              Preview: {activePreviewClip.title}
            </h3>

            {/* Aspect Ratio Select */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] text-white/50">Format:</span>
              <select
                value={activePreviewClip.aspectRatio || '9:16'}
                onChange={(e) => {
                  const targetAspect = e.target.value;
                  store.updateClipAspectRatio(activePreviewClip.id, targetAspect);
                  setActivePreviewClip({ ...activePreviewClip, aspectRatio: targetAspect });
                }}
                className="h-6 px-1.5 rounded bg-white/5 border border-white/10 text-white text-xs font-semibold cursor-pointer outline-none focus:border-accent"
              >
                <option value="9:16" className="bg-[#0f0f15]">9:16 (Vertical)</option>
                <option value="1:1" className="bg-[#0f0f15]">1:1 (Square)</option>
                <option value="16:9" className="bg-[#0f0f15]">16:9 (Horizontal)</option>
              </select>
            </div>

            {/* Video Mobile player frame */}
            <div className={`w-[180px] rounded-2xl border border-white/15 bg-black overflow-hidden relative shadow-2xl transition-all duration-300 ${
              activePreviewClip.aspectRatio === '1:1' ? 'aspect-[1/1]' : 
              activePreviewClip.aspectRatio === '16:9' ? 'aspect-[16/9]' : 'aspect-[9/16]'
            }`}>
              <video
                src={activePreviewClip.videoUrl}
                autoPlay
                loop
                onTimeUpdate={(e) => setPreviewTime(e.target.currentTime)}
                className="w-full h-full object-cover absolute inset-0"
              />

              {/* Remotion Overlay preview synced to currentTime */}
              <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                <RemotionPreview
                  words={activePreviewClip.words || []}
                  selectedStyle={selectedStyle || activePreviewClip.stylePreset || 'NeonPop'}
                  currentTime={previewTime}
                  duration={activePreviewClip.duration || 5}
                  videoWidth={1080}
                  videoHeight={1920}
                  width="100%"
                  height="100%"
                  showControls={false}
                  loop={true}
                />
              </div>
            </div>

            {/* Modal actions */}
            <div className="w-full flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  const clip = activePreviewClip;
                  setActivePreviewClip(null);
                  handleEditClip(clip);
                }}
                className="h-10 w-full bg-gradient-to-r from-accent to-[#00d4ff] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-glow-sm"
              >
                <Scissors size={12} /> Open in Editor
              </button>
              <button
                onClick={() => {
                  const clip = activePreviewClip;
                  setActivePreviewClip(null);
                  triggerSingleExport(clip);
                }}
                className="h-10 w-full bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs font-semibold rounded-xl"
              >
                Export this Clip
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
