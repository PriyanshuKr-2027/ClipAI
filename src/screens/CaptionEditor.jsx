import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import RemotionPreview from '../components/RemotionPreview';
import StylePicker from '../components/StylePicker';
import { 
  ArrowLeft, Play, Pause, ChevronLeft, ChevronRight, 
  Trash2, Plus, Sparkles, RefreshCw, AlertTriangle, Check
} from 'lucide-react';
import * as api from '../services/api';
import * as groq from '../services/groq';

export default function CaptionEditor() {
  const navigate = useNavigate();
  const store = useEditorStore();

  const {
    captionGroups,
    currentTime,
    isPlaying,
    selectedStyle,
    captionStyle,
    words,
    videoUrl,
    projectName,
  } = store;

  // Local component states
  const videoRef = useRef(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeStep, setTranscribeStep] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmReCaption, setConfirmReCaption] = useState(false);
  const [targetLang, setTargetLang] = useState('hi');
  const [isTranslatingLang, setIsTranslatingLang] = useState(false);
  const [transcribeLanguage, setTranscribeLanguage] = useState(store.language || 'auto');

  // Auto-build caption groups if words exist but captionGroups is empty
  useEffect(() => {
    if (words && words.length > 0 && captionGroups.length === 0) {
      store.buildCaptionGroups();
    }
  }, [words, captionGroups]);

  // Video playback synchronization
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }

    const timeDrift = Math.abs(video.currentTime - currentTime);
    if (timeDrift > 0.25) {
      video.currentTime = currentTime;
    }
  }, [isPlaying, currentTime]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;
    store.setCurrentTime(video.currentTime);
  };

  const togglePlay = () => {
    store.setIsPlaying(!isPlaying);
  };

  // Map each word inside captionGroups to its translated version if showTranslated is true
  const displayGroups = React.useMemo(() => {
    if (!store.showTranslated || !store.translatedWords || store.translatedWords.length === 0) {
      return captionGroups;
    }
    return captionGroups.map((group) => {
      const mappedWords = (group.words || []).map((w) => {
        const match = store.translatedWords.find(tw => Math.abs(tw.start - w.start) < 0.01);
        return match ? { ...w, word: match.translated || match.word } : w;
      });
      return {
        ...group,
        text: mappedWords.map(w => w.word).join(' '),
        words: mappedWords
      };
    });
  }, [captionGroups, store.showTranslated, store.translatedWords]);

  // Find active caption group using displayGroups
  const activeGroup = displayGroups.find(
    (g) => currentTime >= g.startTime && currentTime <= g.endTime
  );

  // Auto-scroll active card into view
  useEffect(() => {
    if (activeGroup?.id) {
      const activeCard = document.getElementById(`caption-card-${activeGroup.id}`);
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeGroup?.id]);

  // Translate call helper
  const handleTranslate = async () => {
    if (words.length === 0) return;
    setIsTranslatingLang(true);
    try {
      const wordsJsonPath = await api.saveWordsJson(words);
      const result = await api.translateWords(wordsJsonPath, targetLang, store.language || 'auto');
      store.setTranslatedWords(result.translatedWords || []);
      store.setShowTranslated(true);
    } catch (err) {
      console.error(err);
      alert('Translation failed: ' + err.message);
    } finally {
      setIsTranslatingLang(false);
    }
  };

  // Core transcription runner (shared by first-run + Re-Caption)
  const runTranscription = async () => {
    setIsTranscribing(true);
    setTranscribeStep('Extracting audio track...');
    try {
      const { audioPath, audioUrl } = await api.extractAudio(store.videoPath);
      setTranscribeStep('Transcribing with Whisper AI...');
      const audioSrcUrl = audioUrl || `http://localhost:3001/temp/${audioPath.split(/[\\/]/).pop()}`;
      const result = await groq.transcribeAudio(audioSrcUrl);

      let finalWords = result.words;
      let detectedLang = transcribeLanguage !== 'auto' ? transcribeLanguage : groq.detectLanguage(result.text);

      if (detectedLang === 'ur' || result.language === 'ur') {
        setTranscribeStep('Translating Urdu script to Hindi...');
        try {
          const wordsJsonPath = await api.saveWordsJson(result.words);
          const transResult = await api.translateWords(wordsJsonPath, 'hi', 'ur');
          finalWords = transResult.translatedWords || result.words;
          detectedLang = 'hi';
        } catch (err) {
          console.error("Auto Urdu-to-Hindi translation failed, falling back:", err);
        }
      }

      setTranscribeStep('Building caption blocks...');
      store.setWords(finalWords);
      store.setLanguage(detectedLang);

      const preset = detectedLang === 'hi' ? 'BoldDevanagari'
                   : detectedLang === 'mixed' ? 'HinglishFire'
                   : 'NeonPop';
      store.setSelectedStyle(preset);
    } catch (err) {
      console.error(err);
      alert('Transcription failed: ' + err.message);
    } finally {
      setIsTranscribing(false);
      setTranscribeStep('');
    }
  };

  const handleGenerateCaptions = () => runTranscription();

  // Delete All Captions
  const handleDeleteAllCaptions = () => {
    store.clearAllCaptions();
    store.saveProject();
    setConfirmDeleteAll(false);
  };

  // Re-Caption: wipe everything then immediately re-transcribe
  const handleReCaption = async () => {
    store.clearAllCaptions();
    setConfirmReCaption(false);
    await runTranscription();
    store.saveProject();
  };

  // Adjust timing helper
  const adjustTiming = (id, field, delta) => {
    const group = captionGroups.find((g) => g.id === id);
    if (!group) return;

    if (field === 'start') {
      const newStart = Math.max(0, +(group.startTime + delta).toFixed(1));
      if (newStart < group.endTime) {
        store.updateCaptionGroup(id, { startTime: newStart });
      }
    } else if (field === 'end') {
      const newEnd = Math.max(group.startTime + 0.1, +(group.endTime + delta).toFixed(1));
      store.updateCaptionGroup(id, { endTime: newEnd });
    }
  };

  // Add Caption Group
  const handleAddCaption = () => {
    const newId = crypto.randomUUID();
    store.addCaptionGroup({
      id: newId,
      text: '',
      startTime: currentTime,
      endTime: currentTime + 2.0,
      words: [{ word: '', start: currentTime, end: currentTime + 2.0 }]
    });
  };

  // Save changes and return to editor
  const handleSaveAndReturn = () => {
    // Sync store.captionBlocks from displayGroups (captures translated captions if active)
    useEditorStore.setState({ captionBlocks: JSON.parse(JSON.stringify(displayGroups)) });
    store.saveProject();
    navigate('/editor');
  };

  const navigateCaption = (direction) => {
    if (displayGroups.length === 0) return;
    
    let nextIndex = 0;
    if (activeGroup) {
      const currentIndex = displayGroups.findIndex((g) => g.id === activeGroup.id);
      if (direction === 'prev') {
        nextIndex = Math.max(0, currentIndex - 1);
      } else {
        nextIndex = Math.min(displayGroups.length - 1, currentIndex + 1);
      }
    }
    
    const targetGroup = displayGroups[nextIndex];
    if (targetGroup) {
      store.setCurrentTime(targetGroup.startTime);
      if (videoRef.current) videoRef.current.currentTime = targetGroup.startTime;
    }
  };

  const formatTimestamp = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#060608] relative select-none">
      
      {/* TOP BAR */}
      <div className="h-[52px] border-b border-white/10 glass-panel rounded-none flex items-center justify-between px-6 z-50 flex-shrink-0">
        <button
          onClick={() => navigate('/editor')}
          className="h-8 px-3 rounded-lg glass-card flex items-center gap-1.5 text-white hover:bg-white/10 transition-colors text-xs font-semibold"
        >
          <ArrowLeft size={14} /> Back to Editor
        </button>

        <div className="flex items-center gap-2">
          <span className="font-body font-bold text-white text-sm">Caption Editor</span>
          <span className="text-[11px] text-white/40 max-w-[120px] truncate glass-card px-2 py-0.5 rounded">
            {projectName}
          </span>
          {store.transcriptionBackend === 'groq' && (
            <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-bold">
              Groq Whisper
            </span>
          )}
          {(store.transcriptionBackend === 'faster-whisper' || store.transcriptionBackend === 'faster_whisper' || store.transcriptionBackend === 'local') && (
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold">
              Local Whisper
            </span>
          )}
        </div>

        <div className="flex gap-2 items-center">
          {/* Delete All — always visible so user can clear a wrong project's captions */}
          <button
            onClick={() => setConfirmDeleteAll(true)}
            title="Delete all captions and transcript"
            className="h-8 px-3 rounded-xl text-xs font-semibold text-[#ff4d6a] hover:bg-[#ff4d6a]/10 border border-[#ff4d6a]/20 transition-all flex items-center gap-1.5"
          >
            <Trash2 size={12} /> Delete All
          </button>

          {/* Re-Caption — wipes + regenerates */}
          <button
            onClick={() => setConfirmReCaption(true)}
            disabled={isTranscribing}
            title="Clear all captions and re-run AI transcription"
            className="h-8 px-3 rounded-xl text-xs font-semibold text-[#00f5c4] hover:bg-[#00f5c4]/10 border border-[#00f5c4]/20 transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw size={12} className={isTranscribing ? 'animate-spin' : ''} /> Re-Caption
          </button>

          {captionGroups.length > 0 && (
            <button
              onClick={() => setConfirmReset(true)}
              className="h-8 px-3 rounded-xl text-xs font-semibold text-[#ffb300] hover:bg-[#ffb300]/10 border border-[#ffb300]/20 transition-all flex items-center gap-1.5"
            >
              Reset AI
            </button>
          )}

          <button
            onClick={handleSaveAndReturn}
            className="h-8 px-4 rounded-full bg-gradient-to-r from-accent to-accent-2 text-white text-xs font-bold shadow-glow-sm hover:opacity-90 transition-opacity"
          >
            Save & Return
          </button>
        </div>
      </div>

      {/* CORE WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: preview and controllers */}
        <div className="w-[44%] border-r border-white/10 bg-[#0a0a10]/40 flex flex-col items-center justify-center p-6 gap-5 overflow-y-auto">
          
          {/* Phone Device frame */}
          <div className="max-w-[210px] w-full aspect-[9/16] rounded-3xl border border-white/15 bg-black overflow-hidden relative shadow-[0_0_50px_rgba(124,92,252,0.15)] flex items-center justify-center">
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-cover pointer-events-none"
                  loop
                />
                
                <RemotionPreview
                  words={displayGroups.flatMap(g => g.words || [])}
                  selectedStyle={selectedStyle}
                  currentTime={currentTime}
                  duration={store.videoInfo?.duration || 60}
                  width="100%"
                  height="100%"
                  showControls={false}
                />
              </>
            ) : (
              <span className="text-white/20 text-xs">No media URL found</span>
            )}
          </div>

          {/* Subtitle Style Controller */}
          <div className="glass-panel p-3 w-full max-w-[230px] flex flex-col gap-3">
            {/* Style Preset Selector */}
            <StylePicker />

            {/* Navigation control row */}
            <div className="flex items-center justify-between border-t border-b border-white/5 py-1.5">
              <button
                onClick={() => navigateCaption('prev')}
                className="p-1 text-white/50 hover:text-white hover:bg-white/5 rounded"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={togglePlay}
                className="w-6 h-6 rounded-lg glass-card flex items-center justify-center text-white hover:bg-white/10"
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <span className="font-mono text-[10px] text-white/40">
                {formatTimestamp(currentTime)}
              </span>
              <button
                onClick={() => navigateCaption('next')}
                className="p-1 text-white/50 hover:text-white hover:bg-white/5 rounded"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Font Size slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-white/40 uppercase font-semibold">Font Size</span>
                <span className="text-white/60 font-mono">{captionStyle?.fontSize || 28}px</span>
              </div>
              <input
                type="range"
                min="14"
                max="72"
                value={captionStyle?.fontSize || 28}
                onChange={(e) => store.updateCaptionStyle({ fontSize: Number(e.target.value) })}
                className="h-1 bg-white/10 rounded-full accent-accent cursor-pointer"
              />
            </div>

            {/* Color preset swatches */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/40 uppercase font-semibold">Color Fill</span>
              <div className="flex gap-1.5 flex-wrap">
                {['#ffffff', '#ffe000', '#ff5500', '#00f5c4', '#7c5cfc'].map((color) => (
                  <button
                    key={color}
                    onClick={() => store.updateCaptionStyle({ color })}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      captionStyle?.color === color ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {captionStyle?.color === color && <Check size={10} className="text-black" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Position segmented toggle */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/40 uppercase font-semibold">Vertical Position</span>
              <div className="grid grid-cols-3 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
                {['top', 'middle', 'bottom'].map((pos) => {
                  const isSelected = captionStyle?.position === pos;
                  return (
                    <button
                      key={pos}
                      onClick={() => store.updateCaptionStyle({ position: pos })}
                      className={`h-6 text-[10px] font-bold rounded capitalize transition-all ${
                        isSelected ? 'bg-accent text-white shadow' : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {pos}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Translation Panel */}
            <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3 mt-1">
              <span className="text-[10px] text-white/40 uppercase font-semibold">Translate Captions</span>
              <div className="flex gap-1.5">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="glass-input h-8 px-2 text-xs flex-1 cursor-pointer"
                >
                  <option value="en" className="bg-[#12121a] text-white">English</option>
                  <option value="hi" className="bg-[#12121a] text-white">Hindi (हिन्दी)</option>
                  <option value="ta" className="bg-[#12121a] text-white">Tamil (தமிழ்)</option>
                  <option value="te" className="bg-[#12121a] text-white">Telugu (తెలుగు)</option>
                  <option value="pa" className="bg-[#12121a] text-white">Punjabi (ਪੰਜਾਬੀ)</option>
                  <option value="mr" className="bg-[#12121a] text-white">Marathi (ਮਰਾठी)</option>
                </select>

                <button
                  onClick={handleTranslate}
                  disabled={isTranslatingLang || words.length === 0}
                  className="h-8 px-3 rounded-lg bg-accent hover:opacity-90 disabled:opacity-40 text-[11px] font-bold text-white transition-opacity flex items-center justify-center gap-1"
                >
                  {isTranslatingLang ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <span>Translate</span>
                  )}
                </button>
              </div>

              {store.translatedWords && store.translatedWords.length > 0 && (
                <button
                  onClick={() => store.setShowTranslated(!store.showTranslated)}
                  className={`h-7 w-full rounded-lg text-[10px] font-bold border transition-all ${
                    store.showTranslated
                      ? 'bg-[#ff4400]/10 border-[#ff4400]/30 text-[#ff4400]'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {store.showTranslated ? '← Show Original' : '→ Show Translated'}
                </button>
              )}
            </div>
          </div>

          {/* Prominent Generate Subtitles button (If transcript empty) */}
          {words.length === 0 && !isTranscribing && (
            <div className="flex flex-col gap-2.5 items-center bg-[#0d0d12]/60 border border-white/10 rounded-2xl p-4 w-full max-w-sm shadow-glow-sm">
              <span className="text-[10px] text-white/50 uppercase font-semibold">Select Video Language</span>
              <select
                value={transcribeLanguage}
                onChange={(e) => setTranscribeLanguage(e.target.value)}
                className="w-full bg-[#12121a] border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white/70 outline-none focus:border-[#00f5c4]/60 cursor-pointer"
              >
                <option value="auto">Auto Detect Language</option>
                <option value="hi">Hindi (देवनागरी)</option>
                <option value="en">English</option>
              </select>
              <button
                onClick={handleGenerateCaptions}
                className="h-10 w-full rounded-xl bg-gradient-to-r from-accent to-[#00f5c4] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-glow hover:opacity-90 transition-opacity"
              >
                <Sparkles size={14} /> Auto-Generate AI Captions
              </button>
            </div>
          )}

          {isTranscribing && (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="animate-spin text-accent-teal" size={24} />
              <span className="text-xs font-mono text-[#00f5c4]">{transcribeStep}</span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Scrolling Subtitles List */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-3 bg-[#060608]/40 border-l border-white/5">
          {displayGroups.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-white/20 gap-2">
              <Sparkles size={40} className="opacity-50 mb-2 text-white/30" />
              <h4 className="font-bold text-white/40">No Subtitles Generated</h4>
              <p className="text-xs max-w-xs leading-relaxed">
                Use the Generate button on the left to transcribe the video automatically.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                  Captions ({displayGroups.length})
                </span>
                
                {/* Add Caption trigger */}
                <button
                  onClick={handleAddCaption}
                  className="h-7 px-3 rounded-lg border border-dashed border-white/20 text-white/60 hover:text-white hover:border-white/40 flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Plus size={12} /> Add Caption
                </button>
              </div>

              {/* Caption Card list */}
              <div className="flex flex-col gap-2">
                {displayGroups.map((group) => {
                  const isActive = activeGroup?.id === group.id;
                  const duration = group.endTime - group.startTime;

                  return (
                    <div
                      key={group.id}
                      id={`caption-card-${group.id}`}
                      className={`glass-card p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                        isActive
                          ? 'border-accent bg-accent/5 shadow-glow-sm scale-[1.01]'
                          : 'border-white/5 bg-[#12121a]/25 hover:border-white/10'
                      }`}
                    >
                      {/* Top bar info */}
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-accent shadow-[0_0_4px_#7c5cfc]' : 'bg-white/10'}`} />
                          <span className="font-mono text-white/60">
                            {formatTimestamp(group.startTime)} → {formatTimestamp(group.endTime)}
                          </span>
                          <span className="text-white/30">({duration.toFixed(1)}s)</span>
                        </div>
                        <button
                          onClick={() => store.deleteCaptionGroup(group.id)}
                          className="text-white/30 hover:text-[#ff4d6a] p-1 transition-colors"
                          title="Delete Segment"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Text edit textbox */}
                      <textarea
                        className="glass-input w-full p-2 text-xs h-12 leading-relaxed resize-none bg-black/20 focus:bg-black/50"
                        value={group.text}
                        onChange={(e) => {
                          if (store.showTranslated) {
                            const newTranslatedWords = [...store.translatedWords];
                            const wordsInGroup = group.words || [];
                            const newTextWords = e.target.value.split(/\s+/);
                            wordsInGroup.forEach((w, idx) => {
                              const matchIdx = newTranslatedWords.findIndex(tw => Math.abs(tw.start - w.start) < 0.01);
                              if (matchIdx !== -1 && newTextWords[idx]) {
                                newTranslatedWords[matchIdx] = {
                                  ...newTranslatedWords[matchIdx],
                                  translated: newTextWords[idx]
                                };
                              }
                            });
                            store.setTranslatedWords(newTranslatedWords);
                          } else {
                            store.updateCaptionGroup(group.id, { text: e.target.value });
                          }
                        }}
                        placeholder="Write caption text..."
                      />

                      {/* Timing adjustment details */}
                      <div className="flex items-center gap-4 text-[10px] text-white/50 justify-between">
                        <div className="flex items-center gap-1.5">
                          <span>Start:</span>
                          <button
                            onClick={() => adjustTiming(group.id, 'start', -0.1)}
                            className="w-6 h-5 glass-card flex items-center justify-center hover:bg-white/10 font-bold"
                          >
                            -0.1
                          </button>
                          <button
                            onClick={() => adjustTiming(group.id, 'start', 0.1)}
                            className="w-6 h-5 glass-card flex items-center justify-center hover:bg-white/10 font-bold"
                          >
                            +0.1
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span>End:</span>
                          <button
                            onClick={() => adjustTiming(group.id, 'end', -0.1)}
                            className="w-6 h-5 glass-card flex items-center justify-center hover:bg-white/10 font-bold"
                          >
                            -0.1
                          </button>
                          <button
                            onClick={() => adjustTiming(group.id, 'end', 0.1)}
                            className="w-6 h-5 glass-card flex items-center justify-center hover:bg-white/10 font-bold"
                          >
                            +0.1
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Reset to AI captions */}
      {confirmReset && (
        <div className="fixed inset-0 z-[100] bg-[#060608]/80 backdrop-blur-sm flex items-center justify-center" onClick={() => setConfirmReset(false)}>
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full m-4 border-white/20 bg-[#0d0d12]/95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 text-[#ffb300] mb-2">
              <AlertTriangle size={20} />
              <h3 className="text-lg font-bold text-white">Reset to AI Captions?</h3>
            </div>
            <p className="text-white/60 text-sm mb-6">
              This will overwrite all manual text edits and time adjustments with the original Whisper AI generated timestamps.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmReset(false)} className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={() => { store.resetCaptionsToAI(); setConfirmReset(false); }}
                className="px-5 py-2 rounded-xl bg-[#ffb300]/20 text-[#ffb300] font-medium hover:bg-[#ffb300]/30 transition-colors text-sm"
              >
                Reset to AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete All Captions */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-[100] bg-[#060608]/80 backdrop-blur-sm flex items-center justify-center" onClick={() => setConfirmDeleteAll(false)}>
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full m-4 border-white/20 bg-[#0d0d12]/95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 text-[#ff4d6a] mb-2">
              <Trash2 size={20} />
              <h3 className="text-lg font-bold text-white">Delete All Captions?</h3>
            </div>
            <p className="text-white/60 text-sm mb-6">
              This permanently removes all captions and the transcript from this project. You can re-generate them anytime with the AI button.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteAll(false)} className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={handleDeleteAllCaptions}
                className="px-5 py-2 rounded-xl bg-[#ff4d6a]/20 text-[#ff4d6a] font-medium hover:bg-[#ff4d6a]/30 transition-colors text-sm"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Re-Caption confirmation */}
      {confirmReCaption && (
        <div className="fixed inset-0 z-[100] bg-[#060608]/80 backdrop-blur-sm flex items-center justify-center" onClick={() => setConfirmReCaption(false)}>
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full m-4 border-white/20 bg-[#0d0d12]/95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 text-[#00f5c4] mb-2">
              <RefreshCw size={20} />
              <h3 className="text-lg font-bold text-white">Re-Caption This Video?</h3>
            </div>
            <p className="text-white/60 text-sm mb-4">
              All existing captions and manual edits will be deleted. The AI will re-transcribe the video from scratch and generate fresh captions.
            </p>
            <div className="flex flex-col gap-1.5 mb-6">
              <span className="text-[10px] text-white/50 uppercase font-semibold">Video Language</span>
              <select
                value={transcribeLanguage}
                onChange={(e) => setTranscribeLanguage(e.target.value)}
                className="w-full bg-[#12121a] border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white/70 outline-none focus:border-[#00f5c4]/60 cursor-pointer"
              >
                <option value="auto">Auto Detect Language</option>
                <option value="hi">Hindi (देवनागरी)</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmReCaption(false)} className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={handleReCaption}
                className="px-5 py-2 rounded-xl bg-[#00f5c4]/20 text-[#00f5c4] font-medium hover:bg-[#00f5c4]/30 transition-colors text-sm"
              >
                Re-Caption
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
