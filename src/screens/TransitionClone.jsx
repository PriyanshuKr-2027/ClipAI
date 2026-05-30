import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Sparkles, Upload, Play, Download, 
  Video, Loader2, CheckCircle2, AlertTriangle, 
  Clock, Scissors, Film, RefreshCw, Layers, Image as ImageIcon,
  ArrowRight, Check, Move, Trash2, ArrowLeftRight, Wand2
} from 'lucide-react';
import { 
  downloadTransitionVideo, 
  analyzeTransitionsVideo, 
  uploadPhoto, 
  uploadVideo,
  renderTransitions 
} from '../services/api';
import { analyzeVideoTechnique } from '../services/groq';
import { useEditorStore } from '../store/editorStore';

const BASE = "http://localhost:3001";

export default function TransitionClone() {
  const navigate = useNavigate();

  // Core required state shape
  const [state, setState] = useState({
    step: "input", // "input" | "downloading" | "analyzing" | "review" | "filling" | "rendering" | "done"
    url: "",
    downloadedPath: null,
    analysisSignals: null,
    recipe: null,
    userMedia: [], // { slotIndex, filePath, previewUrl, type, isUploading }
    renderProgress: 0,
    outputUrl: null
  });

  // UI state
  const [detectedPlatform, setDetectedPlatform] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [outputFilename, setOutputFilename] = useState('transition_reel_clone');
  const [analysisSubStep, setAnalysisSubStep] = useState(null); // 'extracting' | 'detecting' | 'classifying'
  const [backgroundVideoPath, setBackgroundVideoPath] = useState(null);
  const [backgroundVideoUrl, setBackgroundVideoUrl] = useState(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [bgUploadProgress, setBgUploadProgress] = useState(0);
  
  // Drag and drop state
  const [draggedSlotIndex, setDraggedSlotIndex] = useState(null);

  // Bulk upload file input ref
  const bulkInputRef = useRef(null);

  // Auto-detect platform from URL input
  useEffect(() => {
    const urlLower = state.url.toLowerCase();
    if (urlLower.includes('instagram.com')) {
      setDetectedPlatform('Instagram');
    } else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      setDetectedPlatform('YouTube');
    } else if (urlLower.includes('tiktok.com')) {
      setDetectedPlatform('TikTok');
    } else if (state.url.trim() === '') {
      setDetectedPlatform('');
    } else {
      setDetectedPlatform('Unknown');
    }
  }, [state.url]);

  // Handle URL Analysis
  const handleAnalyze = async () => {
    if (!state.url.trim()) {
      setErrorMessage('Please enter a URL');
      return;
    }

    setErrorMessage('');
    setAnalysisSubStep(null);
    setBackgroundVideoPath(null);
    setBackgroundVideoUrl(null);

    setState(prev => ({
      ...prev,
      step: 'downloading',
      downloadedPath: null,
      analysisSignals: null,
      recipe: null,
      userMedia: [],
      renderProgress: 0,
      outputUrl: null
    }));

    try {
      // 1. Download Video
      const downloadRes = await downloadTransitionVideo(state.url);
      if (!downloadRes.success) {
        throw new Error(downloadRes.error || 'Failed to download reference video');
      }

      // 2. Start deep analysis
      setState(prev => ({
        ...prev,
        step: 'analyzing',
        downloadedPath: downloadRes.filePath
      }));
      setAnalysisSubStep('extracting');

      // Add a slight delay for better UI pacing
      await new Promise(r => setTimeout(r, 1000));
      setAnalysisSubStep('detecting');

      const analyzeRes = await analyzeTransitionsVideo(downloadRes.filePath);
      if (!analyzeRes.success) {
        throw new Error(analyzeRes.error || 'Failed to extract video signals');
      }

      // 3. AI Classifying technique
      setAnalysisSubStep('classifying');

      let recipe;
      try {
        recipe = await analyzeVideoTechnique(
          analyzeRes.signals,
          analyzeRes.totalDuration,
          analyzeRes.fps,
          analyzeRes.rawFrameDiffs
        );
      } catch (groqErr) {
        console.error('Groq technique classification failed, falling back to defaults:', groqErr);
        // Fallback default recipe
        recipe = {
          technique: 'slideshow_cuts',
          techniqueDescription: 'Fallback transition sequence cut to detected timestamps.',
          slots: (analyzeRes.signals?.cuts || []).map((cut, idx) => ({
            slotIndex: idx,
            type: 'photo',
            startTime: idx === 0 ? 0 : analyzeRes.signals.cuts[idx - 1].timestamp,
            endTime: cut.timestamp,
            duration: idx === 0 ? cut.timestamp : cut.timestamp - analyzeRes.signals.cuts[idx - 1].timestamp,
            layer: 'foreground',
            position: 'full',
            animationIn: idx % 2 === 0 ? 'zoom_in' : 'slide_right',
            animationDuration: 0.3,
            beatSynced: true,
            notes: 'Auto-fallback slot'
          })),
          background: {
            hasBackground: false,
            backgroundType: 'none',
            backgroundVideoStart: 0,
            backgroundVideoEnd: analyzeRes.totalDuration
          },
          speedRamps: [],
          totalSlots: (analyzeRes.signals.cuts || []).length,
          requiresBackgroundVideo: false
        };
      }

      // If no slots generated in recipe, make at least one slot
      if (!recipe.slots || recipe.slots.length === 0) {
        recipe.slots = [
          {
            slotIndex: 0,
            type: 'photo',
            startTime: 0,
            endTime: analyzeRes.totalDuration,
            duration: analyzeRes.totalDuration,
            layer: 'foreground',
            position: 'full',
            animationIn: 'zoom_in',
            animationDuration: 0.3,
            beatSynced: false,
            notes: 'Full duration slot'
          }
        ];
      }

      // ── Normalize every slot so missing/null fields never crash the UI ──
      recipe.slots = recipe.slots.map((slot, idx) => {
        const startTime = typeof slot.startTime === 'number' ? slot.startTime : 0;
        const endTime   = typeof slot.endTime   === 'number' ? slot.endTime   : (startTime + 1);
        let duration    = typeof slot.duration  === 'number' ? slot.duration  : (endTime - startTime);
        if (!duration || duration <= 0) duration = Math.max(endTime - startTime, 0.5);
        return {
          slotIndex:         typeof slot.slotIndex === 'number' ? slot.slotIndex : idx,
          type:              slot.type              || 'photo',
          startTime,
          endTime,
          duration,
          layer:             slot.layer             || 'foreground',
          position:          slot.position          || 'full',
          animationIn:       slot.animationIn       || 'zoom_in',
          animationDuration: typeof slot.animationDuration === 'number' ? slot.animationDuration : 0.3,
          beatSynced:        !!slot.beatSynced,
          notes:             slot.notes             || ''
        };
      });

      // Ensure recipe top-level booleans / defaults are present
      if (typeof recipe.requiresBackgroundVideo !== 'boolean') {
        recipe.requiresBackgroundVideo = false;
      }
      if (!recipe.background) {
        recipe.background = { hasBackground: false, backgroundType: 'none', backgroundVideoStart: 0, backgroundVideoEnd: analyzeRes.totalDuration };
      }
      if (!recipe.speedRamps) recipe.speedRamps = [];

      // Initialize userMedia array with empty entries for all slots
      const initialUserMedia = recipe.slots.map(s => ({
        slotIndex: s.slotIndex,
        filePath: '',
        previewUrl: '',
        type: 'photo',
        isUploading: false
      }));

      // Pre-set background video path if template requires background video
      if (recipe.requiresBackgroundVideo) {
        setBackgroundVideoPath(downloadRes.filePath);
        // Compute static URL for preview
        const filename = downloadRes.filePath.replace(/\\/g, '/').split('/').pop();
        setBackgroundVideoUrl(`${BASE}/temp/${filename}`);
      }

      setState(prev => ({
        ...prev,
        step: 'review',
        analysisSignals: analyzeRes,
        recipe: recipe,
        userMedia: initialUserMedia
      }));

    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred during analysis');
      setState(prev => ({ ...prev, step: 'input' }));
    }
  };

  // Handle Photo Upload
  const handlePhotoUpload = async (slotIndex, file) => {
    if (!file) return;

    setState(prev => ({
      ...prev,
      userMedia: prev.userMedia.map(m => m.slotIndex === slotIndex ? { ...m, isUploading: true } : m)
    }));

    try {
      const res = await uploadPhoto(file);
      setState(prev => ({
        ...prev,
        userMedia: prev.userMedia.map(m => m.slotIndex === slotIndex ? {
          ...m,
          filePath: res.filePath,
          previewUrl: res.url,
          isUploading: false
        } : m)
      }));
    } catch (err) {
      console.error(err);
      alert(`Upload failed: ${err.message}`);
      setState(prev => ({
        ...prev,
        userMedia: prev.userMedia.map(m => m.slotIndex === slotIndex ? { ...m, isUploading: false } : m)
      }));
    }
  };

  // Handle Bulk Upload of multiple files at once
  const handleBulkUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!state.recipe?.slots) return;

    // Filter slots to only include photo/foreground/overlay slots (exclude background slots)
    const photoSlots = state.recipe.slots.filter(s => s.layer !== 'background' && s.type !== 'background_video');
    
    let fileIndex = 0;
    const slotsToFill = [];

    // Map files to empty slots or sequentially from slot 0
    for (const slot of photoSlots) {
      if (fileIndex >= files.length) break;
      slotsToFill.push({ slotIndex: slot.slotIndex, file: files[fileIndex] });
      fileIndex++;
    }

    // Set uploading state for slots to fill
    setState(prev => ({
      ...prev,
      userMedia: prev.userMedia.map(m => {
        const fill = slotsToFill.find(s => s.slotIndex === m.slotIndex);
        return fill ? { ...m, isUploading: true } : m;
      })
    }));

    try {
      const results = await Promise.all(
        slotsToFill.map(async (item) => {
          try {
            const res = await uploadPhoto(item.file);
            return { slotIndex: item.slotIndex, success: true, filePath: res.filePath, url: res.url };
          } catch (err) {
            console.error(`Failed upload for slot ${item.slotIndex}:`, err);
            return { slotIndex: item.slotIndex, success: false, error: err.message };
          }
        })
      );

      setState(prev => ({
        ...prev,
        userMedia: prev.userMedia.map(m => {
          const result = results.find(r => r.slotIndex === m.slotIndex);
          if (result && result.success) {
            return {
              ...m,
              filePath: result.filePath,
              previewUrl: result.url,
              isUploading: false
            };
          }
          return result ? { ...m, isUploading: false } : m;
        })
      }));

    } catch (err) {
      console.error("Bulk upload failed:", err);
      alert("Bulk upload failed: " + err.message);
    }
  };

  // Drag and Drop Swap handlers
  const handleDragStart = (e, slotIndex) => {
    setDraggedSlotIndex(slotIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedSlotIndex === null || draggedSlotIndex === targetIndex) return;

    swapSlots(draggedSlotIndex, targetIndex);
    setDraggedSlotIndex(null);
  };

  // Swap media helper
  const swapSlots = (indexA, indexB) => {
    setState(prev => {
      const mediaA = prev.userMedia.find(m => m.slotIndex === indexA);
      const mediaB = prev.userMedia.find(m => m.slotIndex === indexB);

      const newUserMedia = prev.userMedia.map(m => {
        if (m.slotIndex === indexA) {
          return {
            ...m,
            filePath: mediaB?.filePath || '',
            previewUrl: mediaB?.previewUrl || '',
            type: mediaB?.type || 'photo'
          };
        }
        if (m.slotIndex === indexB) {
          return {
            ...m,
            filePath: mediaA?.filePath || '',
            previewUrl: mediaA?.previewUrl || '',
            type: mediaA?.type || 'photo'
          };
        }
        return m;
      });

      return { ...prev, userMedia: newUserMedia };
    });
  };

  // Move left/right button triggers
  const handleMove = (slotIndex, direction) => {
    // Find only the photo slots in order
    const photoSlots = state.recipe.slots.filter(s => s.layer !== 'background' && s.type !== 'background_video');
    const currentIndex = photoSlots.findIndex(s => s.slotIndex === slotIndex);
    if (currentIndex === -1) return;

    let targetIndex = -1;
    if (direction === 'left' && currentIndex > 0) {
      targetIndex = photoSlots[currentIndex - 1].slotIndex;
    } else if (direction === 'right' && currentIndex < photoSlots.length - 1) {
      targetIndex = photoSlots[currentIndex + 1].slotIndex;
    }

    if (targetIndex !== -1) {
      swapSlots(slotIndex, targetIndex);
    }
  };

  // Background video upload handler
  const handleBgVideoUpload = async (file) => {
    if (!file) return;

    setIsUploadingBg(true);
    setBgUploadProgress(0);

    try {
      const res = await uploadVideo(file, (progress) => {
        setBgUploadProgress(progress);
      });
      setBackgroundVideoPath(res.filePath);
      setBackgroundVideoUrl(res.videoUrl);
    } catch (err) {
      console.error(err);
      alert(`Background video upload failed: ${err.message}`);
    } finally {
      setIsUploadingBg(false);
    }
  };

  // Reset background video back to reference downloaded video
  const handleResetBgToOriginal = () => {
    if (state.downloadedPath) {
      setBackgroundVideoPath(state.downloadedPath);
      const filename = state.downloadedPath.replace(/\\/g, '/').split('/').pop();
      setBackgroundVideoUrl(`${BASE}/temp/${filename}`);
    }
  };

  // Render & Export Trigger
  const handleExport = async () => {
    if (state.recipe.requiresBackgroundVideo && !backgroundVideoPath) {
      alert("Please upload a background video first.");
      return;
    }

    // Only validate visible photo slots (not hidden background slots)
    const photoSlotIndices = new Set(
      (state.recipe?.slots || [])
        .filter(s => s.layer !== 'background' && s.type !== 'background_video')
        .map(s => s.slotIndex)
    );
    const photoMedia = state.userMedia.filter(m => photoSlotIndices.has(m.slotIndex));
    const unfilledPhoto = photoMedia.filter(m => !m.filePath);
    if (unfilledPhoto.length > 0) {
      alert(`Please fill all photo slots first. (${photoMedia.length - unfilledPhoto.length}/${photoMedia.length} filled)`);
      return;
    }

    setState(prev => ({
      ...prev,
      step: 'rendering',
      renderProgress: 0
    }));

    const jobId = `render_${Date.now()}`;

    try {
      const payload = {
        backgroundVideoPath: backgroundVideoPath,
        recipe: state.recipe,
        userMedia: state.userMedia.map(m => ({
          slotIndex: m.slotIndex,
          filePath: m.filePath,
          type: m.type
        })),
        outputFilename: outputFilename,
        jobId: jobId
      };

      const renderRes = await renderTransitions(payload, (percent) => {
        setState(prev => ({
          ...prev,
          renderProgress: percent
        }));
      });

      if (!renderRes.success) {
        throw new Error(renderRes.error || 'Failed to render reel');
      }

      setState(prev => ({
        ...prev,
        step: 'done',
        renderProgress: 100,
        outputUrl: renderRes.downloadUrl,
        outputPath: renderRes.outputPath
      }));

    } catch (err) {
      console.error(err);
      alert(`Export failed: ${err.message}`);
      setState(prev => ({
        ...prev,
        step: 'filling'
      }));
    }
  };

  // Load the rendered video into the ClipAI multi-track editor screen
  const handleUseInEditor = () => {
    if (!state.outputUrl || !state.outputPath) return;

    const filename = state.outputUrl.split('/').pop();
    const info = {
      duration: state.analysisSignals?.totalDuration || 0,
      width: 1080,
      height: 1920,
      fps: state.analysisSignals?.fps || 30
    };

    // Set Zustand store values
    const editorStore = useEditorStore.getState();
    editorStore.setVideo(state.outputPath, state.outputUrl, info, filename);
    
    const newId = crypto.randomUUID();
    editorStore.setProject(newId, filename.replace('.mp4', ''), 'editor');
    editorStore.saveProject();

    // Navigate to editor
    navigate('/editor');
  };

  // Helper values — treat any slot that isn't an explicit background_video type as a fillable photo slot
  const photoSlots = state.recipe?.slots?.filter(s => s.layer !== 'background' && s.type !== 'background_video') || [];
  const photoSlotIndexSet = new Set(photoSlots.map(s => s.slotIndex));
  const filledCount = state.userMedia.filter(m => photoSlotIndexSet.has(m.slotIndex) && m.filePath).length;
  const totalSlotsCount = photoSlots.length;
  const isAllFilled = totalSlotsCount > 0 && filledCount === totalSlotsCount;

  // Render helpers
  const getPlatformClass = (platform) => {
    switch (platform) {
      case 'Instagram': return 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-400 border-pink-500/30';
      case 'YouTube': return 'bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border-red-500/30';
      case 'TikTok': return 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-400 border-cyan-500/30';
      default: return 'bg-white/10 text-white/50 border-white/20';
    }
  };

  const formatTechniqueName = (tech) => {
    if (!tech) return '';
    return tech.replace(/_/g, ' ').toUpperCase();
  };

  const getSlotColor = (slot) => {
    if (slot.layer === 'background' || slot.type === 'background_video') return 'bg-zinc-800 border-zinc-700';
    if (slot.layer === 'overlay') return 'bg-violet-600/35 border-violet-500/40 text-violet-300';
    return 'bg-cyan-500/35 border-cyan-400/40 text-cyan-300';
  };

  return (
    <div className="min-h-screen w-full flex flex-col pt-14 pb-20 bg-[#060608] text-white">
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 h-[56px] glass-panel rounded-none border-b glass-border z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')} 
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="font-display font-bold text-xl tracking-tight text-white flex items-center gap-2">
            <span className="gradient-text">✦</span> Transition Clone
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#00f5c4]/30 bg-[#00f5c4]/10 text-[#00f5c4]">
            Adaptive Engine v2
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto w-full px-6 mt-8 flex flex-col gap-6 flex-1 justify-center">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: Input Screen */}
          {state.step === 'input' && (
            <motion.div 
              key="step-input"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel p-8 border glass-border flex flex-col gap-6 max-w-2xl mx-auto w-full relative overflow-hidden"
            >
              {/* Background gradient glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#7c5cfc]/10 rounded-full blur-3xl -z-10" />
              
              <div className="text-center flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7c5cfc] to-[#00f5c4] flex items-center justify-center shadow-lg shadow-[#7c5cfc]/20">
                  <Scissors className="text-white" size={26} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mt-2">Clone Trending Transitions</h2>
                <p className="text-white/50 text-sm max-w-md">
                  Paste a link to any Reel, Short, or TikTok. ClipAI will reverse-engineer its speed, overlays, and cuts.
                </p>
              </div>

              <div className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col sm:flex-row gap-3 relative">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={state.url}
                      onChange={(e) => setState(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="Paste Reel, TikTok, or Shorts URL..."
                      className="w-full h-12 px-4 pr-24 glass-input text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    />
                    {detectedPlatform && (
                      <span className={`absolute right-3 top-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getPlatformClass(detectedPlatform)}`}>
                        {detectedPlatform}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleAnalyze}
                    className="h-12 px-6 rounded-lg bg-gradient-to-r from-[#7c5cfc] to-[#00f5c4] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity shadow-[0_0_15px_rgba(124,92,252,0.3)] shrink-0"
                  >
                    <Sparkles size={16} />
                    Analyze Template
                  </button>
                </div>
                
                <p className="text-white/40 text-xs text-center">
                  Works with any transition style — slideshow, overlays, freeze, speed ramps, or hybrid
                </p>

                {errorMessage && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 2: Downloading & Analyzing Progress */}
          {(state.step === 'downloading' || state.step === 'analyzing') && (
            <motion.div 
              key="step-progress"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel p-8 border glass-border max-w-md mx-auto w-full flex flex-col gap-6"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 size={36} className="animate-spin text-[#00f5c4] mb-2" />
                <h3 className="text-lg font-bold">Reverse Engineering Video</h3>
                <p className="text-white/50 text-xs px-4">
                  ClipAI is extracting motion and cut layers using server-side ffmpeg signal pipelines.
                </p>
              </div>

              {/* Progress Stepper */}
              <div className="flex flex-col gap-3.5 border-t border-white/5 pt-4">
                {/* Stepper item 1: Downloading */}
                <div className="flex items-center justify-between text-xs">
                  <span className={state.step === 'downloading' ? 'text-[#00f5c4] font-medium' : 'text-white/40'}>
                    ⟳ Downloading reference video...
                  </span>
                  {state.step !== 'downloading' ? (
                    <CheckCircle2 size={16} className="text-green-400" />
                  ) : (
                    <Loader2 size={12} className="animate-spin text-[#00f5c4]" />
                  )}
                </div>

                {/* Stepper item 2: Extracting frame signals */}
                <div className="flex items-center justify-between text-xs">
                  <span className={analysisSubStep === 'extracting' ? 'text-[#00f5c4] font-medium' : (state.step === 'downloading' ? 'text-white/20' : 'text-white/40')}>
                    ⟳ Extracting frame signals...
                  </span>
                  {['detecting', 'classifying'].includes(analysisSubStep) ? (
                    <CheckCircle2 size={16} className="text-green-400" />
                  ) : analysisSubStep === 'extracting' ? (
                    <Loader2 size={12} className="animate-spin text-[#00f5c4]" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-white/5 border border-white/10" />
                  )}
                </div>

                {/* Stepper item 3: Detecting scene signals */}
                <div className="flex items-center justify-between text-xs">
                  <span className={analysisSubStep === 'detecting' ? 'text-[#00f5c4] font-medium' : (['downloading', 'extracting'].includes(analysisSubStep) || state.step === 'downloading' ? 'text-white/20' : 'text-white/40')}>
                    ⟳ Detecting cuts, freezes, speed changes, overlays...
                  </span>
                  {analysisSubStep === 'classifying' ? (
                    <CheckCircle2 size={16} className="text-green-400" />
                  ) : analysisSubStep === 'detecting' ? (
                    <Loader2 size={12} className="animate-spin text-[#00f5c4]" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-white/5 border border-white/10" />
                  )}
                </div>

                {/* Stepper item 4: AI classifying technique */}
                <div className="flex items-center justify-between text-xs">
                  <span className={analysisSubStep === 'classifying' ? 'text-[#00f5c4] font-medium' : (analysisSubStep !== 'classifying' ? 'text-white/20' : 'text-white/40')}>
                    ⟳ AI classifying technique...
                  </span>
                  {analysisSubStep === 'classifying' ? (
                    <Loader2 size={12} className="animate-spin text-[#00f5c4]" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-white/5 border border-white/10" />
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Technique Review Screen */}
          {state.step === 'review' && state.recipe && (
            <motion.div 
              key="step-review"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel p-6 border glass-border flex flex-col gap-6 max-w-3xl mx-auto w-full"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Detected Template blueprint</span>
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#7c5cfc]/20 border border-[#7c5cfc]/30 text-[#9c82ff] tracking-wide">
                      {formatTechniqueName(state.recipe.technique)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/50">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-[#00f5c4]" />
                    <span>Duration: <b className="text-white">{state.analysisSignals?.totalDuration?.toFixed(2)}s</b></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers size={14} className="text-[#00f5c4]" />
                    <span>Slots: <b className="text-white">{state.recipe.slots?.length}</b></span>
                  </div>
                </div>
              </div>

              {/* Technique plain english description glass card */}
              <div className="glass-card p-4 border-white/5 text-sm leading-relaxed text-white/80">
                {state.recipe.techniqueDescription}
              </div>

              {/* Segmented Timeline */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Visual Timeline Distribution</div>
                <div className="h-9 w-full flex rounded-lg overflow-hidden border border-white/10 p-0.5 bg-black/40">
                  {state.recipe.slots.map((slot) => {
                    const totalDur = state.analysisSignals?.totalDuration || 1;
                    const slotDur  = slot.duration || 1;
                    const widthPct = Math.max((slotDur / totalDur) * 100, 1);
                    return (
                      <div
                        key={slot.slotIndex}
                        style={{ width: `${widthPct}%` }}
                        className={`h-full border-r border-black/25 flex items-center justify-center text-[10px] font-bold font-mono transition-all duration-300 hover:brightness-125 last:border-r-0 ${getSlotColor(slot)}`}
                        title={`Slot #${slot.slotIndex + 1} (${slotDur.toFixed(2)}s) - ${slot.layer}`}
                      >
                        {widthPct > 5 && (slot.slotIndex + 1)}
                      </div>
                    );
                  })}
                </div>
                
                {/* Legend */}
                <div className="flex gap-4 text-[10px] mt-1 text-white/50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-zinc-800 border border-zinc-700" />
                    <span>Background ({state.recipe.slots.filter(s => s.layer === 'background' || s.type === 'background_video').length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-violet-600/50 border border-violet-500" />
                    <span>Overlay ({state.recipe.slots.filter(s => s.layer === 'overlay').length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-cyan-500/50 border border-cyan-400" />
                    <span>Foreground/Photo ({state.recipe.slots.filter(s => s.layer === 'foreground' && s.type !== 'background_video').length})</span>
                  </div>
                </div>
              </div>

              {/* Requirements & Action row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/5 pt-4 mt-2">
                <div className="text-sm font-semibold text-white/80">
                  Required Media:{" "}
                  <span className="text-[#00f5c4]">
                    {photoSlots.length} Photo{photoSlots.length !== 1 ? 's' : ''}
                    {state.recipe.requiresBackgroundVideo ? " + 1 Background Video" : ""}
                  </span>
                </div>

                <button
                  onClick={() => setState(prev => ({ ...prev, step: 'filling' }))}
                  className="h-11 px-6 rounded-lg bg-gradient-to-r from-[#7c5cfc] to-[#00f5c4] text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity shadow-[0_0_15px_rgba(124,92,252,0.35)]"
                >
                  Use this template
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Media Filling Screen */}
          {state.step === 'filling' && state.recipe && (
            <motion.div 
              key="step-filling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-6 w-full"
            >
              {/* Header section with Bulk Upload */}
              <div className="glass-panel p-6 border glass-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Wand2 className="text-[#00f5c4]" size={22} />
                    Fill Template Media
                  </h2>
                  <p className="text-xs text-white/50 mt-1">
                    Drag and drop images to swap their ordering, or move them using the card arrows.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Bulk Select input */}
                  <input
                    type="file"
                    ref={bulkInputRef}
                    multiple
                    accept="image/*"
                    onChange={handleBulkUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => bulkInputRef.current?.click()}
                    className="h-10 px-4 rounded-lg border border-[#00f5c4]/30 bg-[#00f5c4]/5 hover:bg-[#00f5c4]/15 text-[#00f5c4] font-semibold text-xs transition-colors flex items-center gap-2"
                  >
                    <Upload size={14} />
                    Upload All Photos
                  </button>

                  <div className="text-xs px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 font-semibold">
                    {filledCount} of {totalSlotsCount} filled
                  </div>
                </div>
              </div>

              {/* Background Video Section (if required) */}
              {state.recipe.requiresBackgroundVideo && (
                <div className="glass-panel p-5 border-2 border-dashed border-[#7c5cfc]/30 bg-[#7c5cfc]/5 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <Video className="text-[#7c5cfc]" size={18} />
                      <span className="font-bold text-sm text-white">Background Video Slot</span>
                      <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-[#7c5cfc]/20 text-[#7c5cfc] border border-[#7c5cfc]/30">Required</span>
                    </div>
                    {backgroundVideoPath !== state.downloadedPath && (
                      <button
                        onClick={handleResetBgToOriginal}
                        className="text-[10px] text-white/40 hover:text-white transition-colors underline"
                      >
                        Reset to original reference video
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-white/60">
                        This transition utilizes a background video layer. By default, ClipAI uses the reference video you provided. You can replace it with your own video.
                      </p>
                      
                      <div className="flex items-center gap-3 mt-2">
                        <label className="h-9 px-4 rounded-lg bg-[#7c5cfc] hover:bg-purple-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                          <Upload size={13} />
                          Upload Custom Video
                          <input
                            type="file"
                            accept="video/*"
                            onChange={(e) => handleBgVideoUpload(e.target.files?.[0])}
                            className="hidden"
                            disabled={isUploadingBg}
                          />
                        </label>
                        {isUploadingBg && (
                          <div className="text-[11px] font-mono text-white/60 animate-pulse">
                            Uploading... {bgUploadProgress}%
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="aspect-video w-full max-w-sm rounded-xl overflow-hidden bg-black/40 border border-white/5 flex items-center justify-center relative self-center md:justify-self-end">
                      {backgroundVideoUrl ? (
                        <video 
                          src={backgroundVideoUrl} 
                          controls 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-white/20">No video selected</span>
                      )}
                      {backgroundVideoPath === state.downloadedPath && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[9px] font-bold text-[#00f5c4] border border-[#00f5c4]/30">
                          Reference Video Active
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Photo/Foreground Slots Grid */}
              <div className="flex flex-col gap-4">
                <div className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-2">
                  <ImageIcon size={14} />
                  <span>Foreground & Overlay Photo Slots ({totalSlotsCount})</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {photoSlots.map((slot, displayIdx) => {
                    const media = state.userMedia.find(m => m.slotIndex === slot.slotIndex);
                    const isFilled = !!media?.filePath;
                    const refThumbUrl = `${BASE}/temp/analysis/segment_thumb_${slot.slotIndex}.jpg`;
                    const fileInputId = `slot-file-${slot.slotIndex}`;

                    return (
                      <div
                        key={slot.slotIndex}
                        draggable={isFilled}
                        onDragStart={(e) => handleDragStart(e, slot.slotIndex)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, slot.slotIndex)}
                        className={`aspect-[9/16] w-full rounded-xl border-2 border-dashed flex flex-col relative overflow-hidden transition-all duration-300 group cursor-pointer ${
                          isFilled 
                            ? 'border-green-500/40 hover:border-green-500/60 bg-black/40 hover:scale-[1.02] shadow-lg hover:shadow-black/50' 
                            : 'border-white/10 hover:border-[#00f5c4]/30 hover:bg-[#00f5c4]/5'
                        }`}
                        onClick={() => {
                          if (!media?.isUploading) {
                            document.getElementById(fileInputId)?.click();
                          }
                        }}
                      >
                        {/* Native File Input */}
                        <input
                          type="file"
                          id={fileInputId}
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(slot.slotIndex, e.target.files?.[0])}
                          onClick={(e) => e.stopPropagation()}
                          className="hidden"
                        />

                        {/* Reference Thumbnail Placeholder (25% opacity) */}
                        {!isFilled && !media?.isUploading && (
                          <div className="absolute inset-0 z-0 opacity-25">
                            <img
                              src={refThumbUrl}
                              alt=""
                              onError={(e) => { e.target.style.display = 'none'; }}
                              className="w-full h-full object-cover grayscale"
                            />
                            <div className="absolute inset-0 bg-black/20" />
                          </div>
                        )}

                        {/* User Uploaded Image Preview */}
                        {isFilled && (
                          <div className="absolute inset-0 z-0">
                            <img 
                              src={media.previewUrl} 
                              alt={`Slot ${slot.slotIndex + 1}`} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                          </div>
                        )}

                        {/* Uploading Spinner */}
                        {media?.isUploading && (
                          <div className="absolute inset-0 z-20 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                            <Loader2 size={24} className="animate-spin text-[#00f5c4]" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Uploading</span>
                          </div>
                        )}

                        {/* Card Content Overlay */}
                        <div className="relative z-10 flex flex-col h-full p-2.5 justify-between">
                          {/* Card Header */}
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/60 border border-white/5 text-white/75">
                              #{displayIdx + 1}
                            </span>
                            
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 border border-white/5 text-white/60`}>
                              {(slot.duration || 0).toFixed(1)}s
                            </span>
                          </div>

                          {/* Reordering Controls (Only on Filled slots) */}
                          {isFilled && !media.isUploading && (
                            <div className="absolute top-[35%] left-0 right-0 flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 px-2">
                              {/* Move Left */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMove(slot.slotIndex, 'left'); }}
                                className="w-8 h-8 rounded-lg bg-black/80 border border-white/10 flex items-center justify-center text-white hover:bg-[#7c5cfc] hover:border-transparent transition-all shadow-md active:scale-95"
                                title="Move Left"
                              >
                                ←
                              </button>
                              
                              {/* Drag handle icon */}
                              <div className="w-8 h-8 rounded-lg bg-black/80 border border-white/10 flex items-center justify-center text-white cursor-grab active:cursor-grabbing shadow-md">
                                <Move size={14} />
                              </div>

                              {/* Move Right */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMove(slot.slotIndex, 'right'); }}
                                className="w-8 h-8 rounded-lg bg-black/80 border border-white/10 flex items-center justify-center text-white hover:bg-[#7c5cfc] hover:border-transparent transition-all shadow-md active:scale-95"
                                title="Move Right"
                              >
                                →
                              </button>
                            </div>
                          )}

                          {/* Upload prompt when empty */}
                          {!isFilled && !media?.isUploading && (
                            <div className="flex flex-col items-center justify-center gap-1.5 my-auto text-white/30 group-hover:text-white/60 transition-colors z-10">
                              <Upload size={22} className="group-hover:scale-105 transition-transform" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">Upload Photo</span>
                            </div>
                          )}

                          {/* Card Footer Details */}
                          <div className="mt-auto flex flex-col gap-0.5 bg-black/70 p-1.5 rounded-lg border border-white/5 backdrop-blur-xs">
                            <div className="flex justify-between items-center text-[7px] uppercase tracking-widest text-white/40">
                              <span>Animation</span>
                              <span className="text-[#00f5c4] font-semibold">{slot.layer}</span>
                            </div>
                            <div className="text-[9px] font-semibold text-white/80 capitalize truncate">
                              {(slot.animationIn || 'none').replace(/_/g, ' ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Final Export Settings bar */}
              <div className="glass-panel p-6 border glass-border flex flex-col md:flex-row gap-4 items-center justify-between mt-2">
                <div className="flex-1 w-full flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Output Filename</label>
                  <input
                    type="text"
                    value={outputFilename}
                    onChange={(e) => setOutputFilename(e.target.value)}
                    className="w-full h-11 px-4 glass-input text-sm"
                  />
                </div>

                <button
                  onClick={handleExport}
                  disabled={!isAllFilled || (state.recipe.requiresBackgroundVideo && !backgroundVideoPath)}
                  className="h-11 px-8 rounded-lg bg-gradient-to-r from-[#7c5cfc] to-[#00f5c4] text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(124,92,252,0.3)] w-full md:w-auto self-end"
                >
                  <Film size={16} />
                  Render Reel
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: Rendering Screen */}
          {state.step === 'rendering' && (
            <motion.div 
              key="step-rendering"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-panel p-8 border glass-border max-w-md mx-auto w-full flex flex-col gap-6"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 size={36} className="animate-spin text-[#7c5cfc] mb-2" />
                <h3 className="text-lg font-bold">Rendering Transition Reel</h3>
                <p className="text-white/50 text-xs px-2">
                  FFmpeg is stitching your photos, overlays, and animations into a vertical 1080x1920 MP4 file.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-mono text-white/70 px-1">
                  <span>Stitching frames...</span>
                  <span>{state.renderProgress}%</span>
                </div>
                <div className="w-full bg-white/5 border border-white/5 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#7c5cfc] via-[#00d4ff] to-[#00f5c4] rounded-full transition-all duration-300"
                    style={{ width: `${state.renderProgress}%` }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 6: Render Completed */}
          {state.step === 'done' && state.outputUrl && (
            <motion.div 
              key="step-done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-6 border glass-border max-w-xl mx-auto w-full flex flex-col gap-6"
            >
              <div className="flex items-center gap-3.5 border-b border-white/5 pb-4">
                <div className="w-11 h-11 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400">
                  <Check size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Stitch Complete!</h3>
                  <p className="text-white/50 text-xs mt-0.5">Your transition reel is ready in high-quality vertical format.</p>
                </div>
              </div>

              {/* Rendered Video Player Preview */}
              <div className="aspect-[9/16] w-full max-w-[240px] rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl mx-auto">
                <video 
                  src={state.outputUrl} 
                  controls 
                  autoPlay
                  loop
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={state.outputUrl}
                  download={`${outputFilename}.mp4`}
                  className="flex-1 h-11 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Download size={15} />
                  Download MP4
                </a>

                <button
                  onClick={handleUseInEditor}
                  className="flex-1 h-11 rounded-lg bg-gradient-to-r from-[#7c5cfc] to-[#00f5c4] text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity shadow-[0_0_15px_rgba(124,92,252,0.35)]"
                >
                  <ArrowLeftRight size={15} />
                  Use in Editor
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
