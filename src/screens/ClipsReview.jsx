import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { generateClips } from '../services/clipDetector';
import CaptionOverlay from '../components/CaptionOverlay';
import ExportSheet from '../components/ExportSheet';
import {
  ArrowLeft, Sparkles, RefreshCw, Check, Play, Edit3,
  ExternalLink, X, Eye, Film, Scissors, CheckSquare, Square
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportClipsQueue, setExportClipsQueue] = useState([]);

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
    setExportClipsQueue([clip]);
    setIsExporting(true);
  };

  const triggerSelectedExport = () => {
    const selectedClips = generatedClips.filter((c) => selectedClipIds.includes(c.id));
    if (selectedClips.length === 0) return;
    setExportClipsQueue(selectedClips);
    setIsExporting(true);
  };

  const triggerExportAll = () => {
    if (generatedClips.length === 0) return;
    setExportClipsQueue(generatedClips);
    setIsExporting(true);
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

                    {/* Viral score badge */}
                    <div
                      className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow z-20 ${getScoreBadgeClass(
                        clip.score
                      )}`}
                    >
                      <Sparkles size={9} />
                      <span>{clip.score}</span>
                    </div>

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

          <button
            onClick={triggerSelectedExport}
            disabled={selectedClipIds.length === 0}
            className="h-9 px-6 rounded-full bg-gradient-to-r from-accent to-accent-teal text-white text-xs font-bold shadow-glow-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
          >
            Export Selected ({selectedClipIds.length})
          </button>
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
                className="w-full h-full object-cover"
              />

              {/* Subtitle Overlay inside preview */}
              <CaptionOverlay
                captionGroups={activePreviewClip.words ? [
                  {
                    id: 'preview_sub',
                    startTime: 0,
                    endTime: activePreviewClip.duration,
                    text: activePreviewClip.title,
                    words: activePreviewClip.words
                  }
                ] : []}
                currentTime={previewTime}
                stylePreset={selectedStyle}
              />
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

      {/* EXPORT SHEET OVERLAY */}
      <ExportSheet
        clips={exportClipsQueue}
        isOpen={isExporting}
        onClose={() => setIsExporting(false)}
        onComplete={() => setIsExporting(false)}
      />
    </div>
  );
}
