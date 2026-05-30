import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, CheckCircle, Copy, AlertTriangle, Download } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import * as api from '../services/api';

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

export default function ExportSheet({ clips = [], isOpen, onClose, onComplete }) {
  const store = useEditorStore();
  const [format, setFormat] = useState(store.exportSettings.format || 'h264');
  const [quality, setQuality] = useState(store.exportSettings.quality || 'high');
  const [resolution, setResolution] = useState(store.exportSettings.resolution || 'clip');
  const [captions, setCaptions] = useState(store.exportSettings.captions || 'burn');

  // 'idle' | 'exporting' | 'complete' | 'error'
  const [exportState, setExportState] = useState('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [exportedFiles, setExportedFiles] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  if (!isOpen) return null;

  const startExport = async () => {
    setExportState('exporting');
    setExportProgress(0);
    setErrorMsg('');

    const crfValue = quality === 'high' ? 18 : quality === 'medium' ? 23 : 28;

    const results = [];
    try {
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        
        // Progress weight calculation: split progress between clips
        const baseProgress = (i / clips.length) * 100;
        const weight = 100 / clips.length;

        // Initialize store export job state
        store.updateExportJob(clip.id, { status: 'exporting', percent: 0 });

        const onClipProgress = (pct) => {
          const totalProgress = baseProgress + (pct * weight) / 100;
          setExportProgress(Math.min(99, Math.round(totalProgress)));
          
          // Update store export job progress
          store.updateExportJob(clip.id, { status: 'exporting', percent: pct });
        };

        let clipResolution = resolution;
        if (resolution === 'clip') {
          const aspect = clip.aspectRatio || '9:16';
          if (aspect === '9:16') clipResolution = '1080x1920';
          else if (aspect === '1:1') clipResolution = '1080x1080';
          else if (aspect === '16:9') clipResolution = '1920x1080';
          else clipResolution = 'original';
        }

        const settings = {
          crf: crfValue,
          resolution: clipResolution,
        };

        // Determine target video dimensions for captions scaling
        let targetWidth = store.videoInfo?.width || 1080;
        let targetHeight = store.videoInfo?.height || 1920;
        if (clipResolution !== 'original') {
          const [w, h] = clipResolution.split('x');
          targetWidth = parseInt(w, 10);
          targetHeight = parseInt(h, 10);
        }

        let result;
        if (captions === 'burn' || captions === 'both') {
          // Get subtitle words: if clip already has words, use them, otherwise use store words
          const clipWords = clip.words || store.words || [];

          // Generate ASS file contents (PlayResX/PlayResY match the target resolution)
          const assContent = generateASS(clipWords, store.selectedStyle || 'NeonPop', targetWidth, targetHeight);
          
          // Burn subtitles
          result = await api.burnCaptions(
            clip.videoPath || store.videoPath,
            assContent,
            `export_${clip.id || 'project'}`,
            settings,
            onClipProgress
          );
        } else {
          // Reencode without captions
          result = await api.reencodeVideo(
            clip.videoPath || store.videoPath,
            settings,
            onClipProgress
          );
        }

        const outputUrl = result.outputUrl || result.clipUrl;
        
        // Update store export job complete state
        store.updateExportJob(clip.id, { status: 'complete', percent: 100, outputUrl });

        results.push({
          name: clip.title || store.projectName || 'Exported Clip',
          url: outputUrl,
          filename: outputUrl.split('/').pop(),
        });
      }

      setExportProgress(100);
      setExportedFiles(results);
      setExportState('complete');

      // Auto-trigger browser downloads for all exported files
      results.forEach(file => {
        triggerDownload(file.url, file.filename);
      });

      if (onComplete) onComplete({ files: results });
    } catch (err) {
      console.error(err);
      // Update failed clips
      clips.forEach(clip => {
        const job = store.exportJobs[clip.id];
        if (job && job.status === 'exporting') {
          store.updateExportJob(clip.id, { status: 'failed', percent: 0 });
        }
      });
      setErrorMsg(err.message || 'FFmpeg failed during exporting.');
      setExportState('error');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={exportState === 'exporting' ? null : onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Sheet Container */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-3xl glass-panel bg-[#0d0d12]/95 border-b-0 border-x-0 rounded-t-3xl p-6 relative z-10 max-h-[85vh] flex flex-col shadow-2xl"
      >
        {/* Drag Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {exportState === 'idle' && (
          <div className="flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-body font-bold text-white">
                Export {clips.length} clip{clips.length > 1 ? 's' : ''}
              </h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full glass-card hover:bg-white/10 flex items-center justify-center text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Content Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Left Settings */}
              <div className="flex flex-col gap-4">
                {/* Format */}
                <div>
                  <label className="text-[13px] text-white/50 font-semibold uppercase tracking-wider block mb-2">Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['h264', 'h265', 'webm'].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setFormat(fmt)}
                        className={`h-11 rounded-xl text-sm font-semibold border flex items-center justify-center transition-all ${
                          format === fmt
                            ? 'bg-accent/15 border-accent text-white shadow-glow-sm'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {fmt === 'h264' ? 'MP4 (H.264)' : fmt === 'h265' ? 'MP4 (H.265)' : 'WebM'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality */}
                <div>
                  <label className="text-[13px] text-white/50 font-semibold uppercase tracking-wider block mb-2">Quality</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'high', label: 'High', desc: 'CRF 18' },
                      { key: 'medium', label: 'Medium', desc: 'CRF 23' },
                      { key: 'low', label: 'Low', desc: 'CRF 28' },
                    ].map((q) => (
                      <button
                        key={q.key}
                        onClick={() => setQuality(q.key)}
                        className={`h-12 rounded-xl border flex flex-col items-center justify-center transition-all ${
                          quality === q.key
                            ? 'bg-accent/15 border-accent text-white shadow-glow-sm'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-sm font-semibold">{q.label}</span>
                        <span className="text-[10px] text-white/40">{q.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution */}
                <div>
                  <label className="text-[13px] text-white/50 font-semibold uppercase tracking-wider block mb-2">Resolution</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'clip', label: 'Use Clip Aspect Ratio' },
                      { key: 'original', label: 'Original Size (No Crop)' },
                      { key: '1080x1920', label: 'Force 1080 × 1920 (9:16)' },
                      { key: '1080x1080', label: 'Force 1080 × 1080 (1:1)' },
                      { key: '1920x1080', label: 'Force 1920 × 1080 (16:9)' },
                    ].map((res) => (
                      <button
                        key={res.key}
                        onClick={() => setResolution(res.key)}
                        className={`h-11 px-3 rounded-xl text-sm font-semibold border flex items-center justify-center transition-all ${
                          resolution === res.key
                            ? 'bg-accent/15 border-accent text-white shadow-glow-sm'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Settings */}
              <div className="flex flex-col gap-4">
                {/* Captions */}
                <div>
                  <label className="text-[13px] text-white/50 font-semibold uppercase tracking-wider block mb-2">Captions</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'burn', label: 'Burn-In Subtitles' },
                      { key: 'none', label: 'None' },
                    ].map((cap) => (
                      <button
                        key={cap.key}
                        onClick={() => setCaptions(cap.key)}
                        className={`h-11 rounded-xl text-sm font-semibold border flex items-center justify-center transition-all ${
                          captions === cap.key
                            ? 'bg-accent/15 border-accent text-white shadow-glow-sm'
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {cap.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clips list preview */}
                <div className="flex-1 flex flex-col min-h-[140px]">
                  <label className="text-[13px] text-white/50 font-semibold uppercase tracking-wider block mb-2">Clips List</label>
                  <div className="flex-1 border border-white/10 bg-white/5 rounded-2xl p-3 overflow-y-auto max-h-[160px] flex flex-col gap-2">
                    {clips.map((c, i) => (
                      <div key={c.id || i} className="flex items-center gap-3 glass-card p-2 rounded-xl">
                        <div className="w-[56px] h-[36px] bg-black/40 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-white/30 relative">
                          {c.thumbUrl ? (
                            <img src={c.thumbUrl} className="w-full h-full object-cover" />
                          ) : (
                            <Play size={14} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-white truncate">{c.title || `Clip ${i+1}`}</div>
                          <div className="text-[11px] text-white/40">{(c.duration || store.videoInfo?.duration || 0).toFixed(1)}s</div>
                        </div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/50">
                          Ready
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Export CTA */}
            <button
              onClick={startExport}
              className="h-12 w-full bg-gradient-to-r from-accent to-accent-2 text-white font-bold rounded-2xl flex items-center justify-center shadow-glow hover:opacity-90 transition-opacity mt-2"
            >
              Start Export
            </button>
          </div>
        )}

        {exportState === 'exporting' && (
          <div className="py-8 flex flex-col items-center justify-center">
            <h3 className="text-xl font-bold text-white mb-2">Exporting Video...</h3>
            <p className="text-white/60 text-sm mb-6">Running FFmpeg processes on backend...</p>
            
            {/* Progress circle or large bar */}
            <div className="w-full max-w-md bg-white/10 h-3 rounded-full overflow-hidden mb-3 relative">
              <motion.div
                className="h-full bg-gradient-to-r from-[#7c5cfc] to-[#00d4ff] shimmer"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <div className="text-lg font-mono font-bold text-[#00d4ff] mb-8">{exportProgress}%</div>

            <div className="glass-panel p-4 w-full max-w-md bg-black/40 border-white/5 text-center text-xs font-mono text-[#00e676]/80 max-h-[120px] overflow-y-auto">
              [SYSTEM] Processing output formats...<br/>
              [FFMPEG] CRF set to {quality === 'high' ? '18' : quality === 'medium' ? '23' : '28'}<br/>
              [FFMPEG] Rendering style: {captions === 'burn' ? store.selectedStyle : 'none'}
            </div>
          </div>
        )}

        {exportState === 'complete' && (
          <div className="py-6 flex flex-col items-center justify-center overflow-y-auto">
            <CheckCircle className="text-[#00e676] w-16 h-16 mb-4 animate-bounce" />
            <h3 className="text-2xl font-bold text-white mb-1">Export Complete!</h3>
            <p className="text-white/50 text-sm mb-6">Your clips have been saved in the temp directory.</p>

            {/* File List */}
            <div className="w-full max-w-md flex flex-col gap-2 mb-6 max-h-[160px] overflow-y-auto pr-1">
              {exportedFiles.map((file, i) => (
                <div key={i} className="glass-card p-3 flex items-center justify-between border-white/15">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-[13px] font-semibold text-white truncate">{file.name}</div>
                    <div className="text-[11px] text-white/40 truncate font-mono">{file.filename}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => triggerDownload(file.url, file.filename)}
                      className="w-8 h-8 rounded-lg glass-card flex items-center justify-center text-white/60 hover:text-white transition-colors hover:bg-white/10"
                      title="Download File"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => copyToClipboard(`http://localhost:3001/temp/${file.filename}`, i)}
                      className="w-8 h-8 rounded-lg glass-card flex items-center justify-center text-white/60 hover:text-white transition-colors hover:bg-white/10"
                      title="Copy URL"
                    >
                      {copiedId === i ? (
                        <span className="text-[10px] text-[#00e676] font-semibold">Copied</span>
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="h-11 px-8 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl border border-white/10 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {exportState === 'error' && (
          <div className="py-8 flex flex-col items-center justify-center">
            <AlertTriangle className="text-[#ff4d6a] w-16 h-16 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Export Failed</h3>
            <p className="text-[#ff4d6a] text-sm text-center max-w-md mb-6">{errorMsg}</p>

            <div className="flex gap-4">
              <button
                onClick={() => setExportState('idle')}
                className="h-11 px-6 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl border border-white/10 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={onClose}
                className="h-11 px-6 bg-[#ff4d6a]/20 hover:bg-[#ff4d6a]/30 text-[#ff4d6a] font-semibold rounded-xl border border-[#ff4d6a]/20 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
