import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const initialState = {
  // Project
  projectId: null,
  projectName: null,
  mode: null, // 'editor' | 'caption' | 'clips'

  // Video source
  videoPath: null,
  videoUrl: null,
  videoInfo: null, // {duration, width, height, fps}
  filename: null,

  // Editor timeline
  clips: [], // video clip segments on V1 track
  audioTracks: [], // audio track segments
  textLayers: [], // text overlay elements
  captionBlocks: [], // caption track segments
  selectedClipId: null,
  selectedTool: null, // 'split'|'trim'|'crop'|'speed'|'audio'|'text'|'transition'|'caption'|'resize'
  zoom: 100, // timeline zoom %

  // Transcription
  isTranscribing: false,
  transcribeStatus: '',
  words: [],
  language: null,
  translatedWords: null, // was [] originally
  showTranslated: false,
  transcriptionBackend: null,
  transcribeStage: null,        // 'demucs' | 'denoise' | 'whisper' | 'spacy' | 'done'
  audioPath: null,              // path to extracted audio file (WAV)

  // Import tracking
  importSource: null,           // 'file' | 'youtube' | 'instagram' | 'x' | 'playwright'

  // Caption rendering mode
  useRemotionRender: true,      // false = ASS fallback

  // Translation
  translateTargetLang: null,

  // Audio analysis
  beats: [],
  bpm: null,
  silenceRanges: [],
  energyBySecond: [],

  // Scene detection
  scenes: [],

  // Visual intelligence
  compositeScores: {},          // { [clipId]: number }

  // Remotion jobs
  remotionJobs: {},             // { [jobId]: { status, percent, outputUrl } }

  // B-Roll track
  brollTrack: [],  // [{id, filePath, videoUrl, thumbUrl, start, end, duration, label}]

  // Music track
  musicTrack: [],  // [{id, filePath, audioUrl, start, end, duration, volume, isDucked}]

  // Captions
  captionGroups: [],
  selectedStyle: 'NeonPop',
  captionStyle: {
    fontSize: 28,
    color: '#ffffff',
    position: 'bottom', // 'bottom' | 'middle' | 'top'
  },
  aspectRatio: '9:16', // '9:16' | '1:1' | '16:9'

  // AI Clips (Clipping page)
  isGeneratingClips: false,
  clipStatus: '',
  generatedClips: [],
  selectedClipIds: [],
  activeClipId: null,

  // Playback
  currentTime: 0,
  isPlaying: false,

  // Export
  exportSettings: {
    format: 'h264',
    quality: 'high',
    resolution: 'original',
    captions: 'burn',
    fontSize: 72,
    platform: null,               // 'reels' | 'shorts' | 'tiktok' | 'linkedin' | 'twitter'
    useRemotionCaptions: true,
    usePedalboardMaster: false,
  },
  exportJobs: {},

  // History
  past: [],
  future: [],

  // AI Prompt History (last 20 AI actions run in this session)
  aiHistory: [], // [{ prompt, description, actions, timestamp }]
};

export const useEditorStore = create(
  immer((set, get) => ({
    ...initialState,

    setProject: (id, name, mode) => set(state => {
      state.projectId = id;
      state.projectName = name;
      state.mode = mode;
    }),

    setVideo: (path, url, info, filename) => set(state => {
      state.videoPath = path;
      state.videoUrl = url;
      state.videoInfo = info;
      state.filename = filename;
    }),

    setSelectedTool: (tool) => set(state => {
      state.selectedTool = tool;
    }),

    setZoom: (level) => set(state => {
      state.zoom = level;
    }),

    // History Snapshots
    takeSnapshot: () => set(state => {
      const snapshot = {
        projectName: state.projectName,
        clips: JSON.parse(JSON.stringify(state.clips)),
        audioTracks: JSON.parse(JSON.stringify(state.audioTracks)),
        textLayers: JSON.parse(JSON.stringify(state.textLayers)),
        selectedStyle: state.selectedStyle,
        captionStyle: JSON.parse(JSON.stringify(state.captionStyle || { fontSize: 28, color: '#ffffff', position: 'bottom' })),
        aspectRatio: state.aspectRatio,
      };

      if (state.past.length > 0) {
        const last = state.past[state.past.length - 1];
        if (JSON.stringify(last) === JSON.stringify(snapshot)) return;
      }

      state.past.push(snapshot);
      state.future = []; // Clear redo stack
    }),

    undo: () => set(state => {
      if (state.past.length === 0) return;

      const current = {
        projectName: state.projectName,
        clips: JSON.parse(JSON.stringify(state.clips)),
        audioTracks: JSON.parse(JSON.stringify(state.audioTracks)),
        textLayers: JSON.parse(JSON.stringify(state.textLayers)),
        selectedStyle: state.selectedStyle,
        captionStyle: JSON.parse(JSON.stringify(state.captionStyle || { fontSize: 28, color: '#ffffff', position: 'bottom' })),
        aspectRatio: state.aspectRatio,
      };
      state.future.push(current);

      const prev = state.past.pop();
      state.projectName = prev.projectName;
      state.clips = prev.clips;
      state.audioTracks = prev.audioTracks;
      state.textLayers = prev.textLayers;
      state.selectedStyle = prev.selectedStyle;
      state.captionStyle = prev.captionStyle || { fontSize: 28, color: '#ffffff', position: 'bottom' };
      state.aspectRatio = prev.aspectRatio || '9:16';
    }),

    redo: () => set(state => {
      if (state.future.length === 0) return;

      const current = {
        projectName: state.projectName,
        clips: JSON.parse(JSON.stringify(state.clips)),
        audioTracks: JSON.parse(JSON.stringify(state.audioTracks)),
        textLayers: JSON.parse(JSON.stringify(state.textLayers)),
        selectedStyle: state.selectedStyle,
        captionStyle: JSON.parse(JSON.stringify(state.captionStyle || { fontSize: 28, color: '#ffffff', position: 'bottom' })),
        aspectRatio: state.aspectRatio,
      };
      state.past.push(current);

      const next = state.future.pop();
      state.projectName = next.projectName;
      state.clips = next.clips;
      state.audioTracks = next.audioTracks;
      state.textLayers = next.textLayers;
      state.selectedStyle = next.selectedStyle;
      state.captionStyle = next.captionStyle || { fontSize: 28, color: '#ffffff', position: 'bottom' };
      state.aspectRatio = next.aspectRatio || '9:16';
    }),

    saveProject: () => {
      const state = get();
      if (!state.projectId) return;

      try {
        const stored = JSON.parse(localStorage.getItem('clipai_projects') || '[]');
        const projectIndex = stored.findIndex(p => p.id === state.projectId);

        const projectData = {
          id: state.projectId,
          name: state.projectName,
          mode: state.mode,
          videoPath: state.videoPath,
          videoUrl: state.videoUrl,
          videoInfo: state.videoInfo,
          filename: state.filename,
          clips: state.clips,
          audioTracks: state.audioTracks,
          textLayers: state.textLayers,
          selectedStyle: state.selectedStyle,
          captionStyle: state.captionStyle,
          aspectRatio: state.aspectRatio,
          // ── Per-project caption data ──────────────────────────────────────
          words: state.words || [],
          captionGroups: state.captionGroups || [],
          language: state.language || null,
          // ── Visual / Audio / Ingestion state ──────────────────────────────
          beats: state.beats || [],
          bpm: state.bpm || null,
          silenceRanges: state.silenceRanges || [],
          energyBySecond: state.energyBySecond || [],
          scenes: state.scenes || [],
          compositeScores: state.compositeScores || {},
          translatedWords: state.translatedWords || null,
          translateTargetLang: state.translateTargetLang || null,
          audioPath: state.audioPath || null,
          importSource: state.importSource || null,
          // ─────────────────────────────────────────────────────────────────
          created: state.created || Date.now(),
          lastEdited: Date.now(),
          metadata: {
            duration: state.videoInfo?.duration || 0,
            size: state.videoInfo?.size || 0,
            thumbUrl: state.clips?.[0]?.thumbUrl || '',
            progress: state.clips?.length > 0 ? `${state.clips.length} clips` : 'Ready to edit'
          }
        };

        if (projectIndex !== -1) {
          projectData.created = stored[projectIndex].created;
          stored[projectIndex] = projectData;
        } else {
          stored.push(projectData);
        }

        localStorage.setItem('clipai_projects', JSON.stringify(stored));
      } catch (err) {
        console.error("Failed to save project:", err);
      }
    },

    loadProjectState: (proj) => set(state => {
      // ── Fully wipe ALL stale state first ─────────────────────────────────
      // This prevents caption/word/clip data from one project bleeding into
      // another when the user switches between projects.
      state.projectId = proj.id;
      state.projectName = proj.name || 'Untitled';
      state.mode = proj.mode || 'editor';

      // Video source
      state.videoPath = proj.videoPath;
      state.videoUrl = proj.videoUrl;
      state.videoInfo = proj.videoInfo || { duration: proj.metadata?.duration || 0 };
      state.filename = proj.filename || proj.videoPath?.split('/').pop() || '';

      // Timeline — restore saved, default empty arrays (never carry over previous project)
      state.clips = proj.clips || [];
      state.audioTracks = proj.audioTracks || [];
      state.textLayers = proj.textLayers || [];
      state.captionBlocks = [];
      state.selectedClipId = null;
      state.selectedTool = null;
      state.zoom = 100;

      // Transcription — always reset to fresh (words are stored per project below)
      state.isTranscribing = false;
      state.transcribeStatus = '';
      state.words = proj.words || [];
      state.language = proj.language || null;

      // Visual / Audio / Ingestion state
      state.beats = proj.beats || [];
      state.bpm = proj.bpm || null;
      state.silenceRanges = proj.silenceRanges || [];
      state.energyBySecond = proj.energyBySecond || [];
      state.scenes = proj.scenes || [];
      state.compositeScores = proj.compositeScores || {};
      state.translatedWords = proj.translatedWords || null;
      state.translateTargetLang = proj.translateTargetLang || null;
      state.audioPath = proj.audioPath || null;
      state.importSource = proj.importSource || null;
      state.transcribeStage = null; // reset per session
      state.remotionJobs = {}; // reset per session

      // Captions
      state.captionGroups = proj.captionGroups || [];
      state.originalCaptionGroups = proj.captionGroups || [];
      state.selectedStyle = proj.selectedStyle || 'NeonPop';
      state.captionStyle = proj.captionStyle || { fontSize: 28, color: '#ffffff', position: 'bottom' };
      state.aspectRatio = proj.aspectRatio || '9:16';

      // AI Clips — always reset, regenerated per session
      state.isGeneratingClips = false;
      state.clipStatus = '';
      state.generatedClips = [];
      state.selectedClipIds = [];
      state.activeClipId = null;

      // Playback
      state.currentTime = 0;
      state.isPlaying = false;

      // Export
      state.exportJobs = {};

      // History — clear so undo can't reach the previous project
      state.past = [];
      state.future = [];
    }),

    clearAllCaptions: () => {
      get().takeSnapshot();
      set(state => {
        state.captionGroups = [];
        state.originalCaptionGroups = [];
        state.words = [];
        state.language = null;
      });
    },

    // Timeline
    addClipSegment: (clip) => {
      get().takeSnapshot();
      set(state => {
        state.clips.push(clip);
      });
    },
    updateClipSegment: (id, changes) => {
      get().takeSnapshot();
      set(state => {
        const idx = state.clips.findIndex(c => c.id === id);
        if (idx !== -1) Object.assign(state.clips[idx], changes);
      });
    },
    removeClipSegment: (id) => {
      get().takeSnapshot();
      set(state => {
        state.clips = state.clips.filter(c => c.id !== id);
      });
    },
    addTextLayer: (layer) => {
      get().takeSnapshot();
      set(state => {
        state.textLayers.push(layer);
      });
    },
    updateTextLayer: (id, changes) => {
      get().takeSnapshot();
      set(state => {
        const idx = state.textLayers.findIndex(l => l.id === id);
        if (idx !== -1) Object.assign(state.textLayers[idx], changes);
      });
    },
    removeTextLayer: (id) => {
      get().takeSnapshot();
      set(state => {
        state.textLayers = state.textLayers.filter(l => l.id !== id);
      });
    },
    setSelectedClip: (id) => set(state => {
      state.selectedClipId = id;
    }),

    // Transcription
    setTranscribing: (bool, status) => set(state => {
      state.isTranscribing = bool;
      if (status !== undefined) state.transcribeStatus = status;
    }),
    setWords: (words) => {
      // First, commit the new words to state
      set(state => { state.words = words; });
      // Then invoke the group builder
      get().buildCaptionGroups();
    },
    setLanguage: (lang) => set(state => {
      state.language = lang;
    }),
    setTranslatedWords: (words, lang) => set(state => {
      state.translatedWords = words;
      if (lang !== undefined) state.translateTargetLang = lang;
    }),
    setShowTranslated: (bool) => set(state => {
      state.showTranslated = bool;
    }),
    setTranscriptionBackend: (backend) => set(state => {
      state.transcriptionBackend = backend;
    }),
    setTranscribeStage: (stage) => set(state => {
      state.transcribeStage = stage;
    }),
    setAudioPath: (path) => set(state => {
      state.audioPath = path;
    }),
    setImportSource: (source) => set(state => {
      state.importSource = source;
    }),
    setBeats: (beats, bpm) => set(state => {
      state.beats = beats;
      state.bpm = bpm;
    }),
    setSilenceRanges: (ranges) => set(state => {
      state.silenceRanges = ranges;
    }),
    setEnergyBySecond: (energy) => set(state => {
      state.energyBySecond = energy;
    }),
    setScenes: (scenes) => set(state => {
      state.scenes = scenes;
    }),
    setCompositeScore: (clipId, score) => set(state => {
      state.compositeScores[clipId] = score;
    }),
    setRemotionJob: (jobId, status) => set(state => {
      if (!state.remotionJobs[jobId]) {
        state.remotionJobs[jobId] = {};
      }
      if (typeof status === 'object') {
        Object.assign(state.remotionJobs[jobId], status);
      } else {
        state.remotionJobs[jobId].status = status;
      }
    }),
    toggleRemotionRender: () => set(state => {
      state.useRemotionRender = !state.useRemotionRender;
    }),

    // Captions
    buildCaptionGroups: () => set(state => {
      const groups = [];
      const words = state.words || [];
      const MAX_WORDS = 5;

      for (let i = 0; i < words.length; i += MAX_WORDS) {
        const chunk = words.slice(i, i + MAX_WORDS);
        groups.push({
          id: crypto.randomUUID(),
          text: chunk.map(w => w.word).join(' '),
          startTime: chunk[0].start,
          endTime: chunk[chunk.length - 1].end,
          words: chunk
        });
      }

      state.captionGroups = groups;
      state.originalCaptionGroups = JSON.parse(JSON.stringify(groups));
    }),
    updateCaptionGroup: (id, changes) => {
      get().takeSnapshot();
      set(state => {
        const idx = state.captionGroups.findIndex(g => g.id === id);
        if (idx !== -1) Object.assign(state.captionGroups[idx], changes);
      });
    },
    deleteCaptionGroup: (id) => {
      get().takeSnapshot();
      set(state => {
        state.captionGroups = state.captionGroups.filter(g => g.id !== id);
      });
    },
    addCaptionGroup: (group) => {
      get().takeSnapshot();
      set(state => {
        state.captionGroups.push(group);
        state.captionGroups.sort((a, b) => a.startTime - b.startTime);
      });
    },
    resetCaptionsToAI: () => {
      get().takeSnapshot();
      set(state => {
        state.captionGroups = JSON.parse(JSON.stringify(state.originalCaptionGroups));
      });
    },
    setSelectedStyle: (preset) => {
      get().takeSnapshot();
      set(state => {
        state.selectedStyle = preset;
      });
    },
    updateCaptionStyle: (style) => {
      get().takeSnapshot();
      set(state => {
        if (!state.captionStyle) {
          state.captionStyle = { fontSize: 28, color: '#ffffff', position: 'bottom' };
        }
        Object.assign(state.captionStyle, style);
      });
    },

    // Clips
    setGeneratedClips: (clips) => set(state => {
      state.generatedClips = clips;
    }),
    updateClips: (clips) => set(state => {
      state.generatedClips = clips;
    }),
    setGeneratingClips: (bool, status) => set(state => {
      state.isGeneratingClips = bool;
      if (status !== undefined) state.clipStatus = status;
    }),
    toggleClipSelection: (id) => set(state => {
      const idx = state.selectedClipIds.indexOf(id);
      if (idx !== -1) {
        state.selectedClipIds.splice(idx, 1);
      } else {
        state.selectedClipIds.push(id);
      }
    }),
    setAllClipsSelected: (bool) => set(state => {
      state.selectedClipIds = bool ? state.generatedClips.map(c => c.id) : [];
    }),
    setActiveClip: (id) => {
      set(state => {
        state.activeClipId = id;
        const clip = state.generatedClips.find(c => c.id === id);
        if (clip) {
          state.videoUrl = clip.videoUrl;
          state.words = clip.words;
        }
      });
      get().buildCaptionGroups();
    },

    // Playback
    setCurrentTime: (t) => set(state => {
      state.currentTime = t;
    }),
    setIsPlaying: (bool) => set(state => {
      state.isPlaying = bool;
    }),

    // Export
    setExportSettings: (partial) => set(state => {
      Object.assign(state.exportSettings, partial);
    }),
    setAspectRatio: (ratio) => {
      get().takeSnapshot();
      set(state => {
        state.aspectRatio = ratio;
      });
    },
    updateClipAspectRatio: (clipId, ratio) => set(state => {
      const gIdx = state.generatedClips.findIndex(c => c.id === clipId);
      if (gIdx !== -1) {
        state.generatedClips[gIdx].aspectRatio = ratio;
      }
      const cIdx = state.clips.findIndex(c => c.id === clipId);
      if (cIdx !== -1) {
        state.clips[cIdx].aspectRatio = ratio;
      }
    }),
    updateExportJob: (clipId, updates) => set(state => {
      if (!state.exportJobs[clipId]) {
        state.exportJobs[clipId] = {};
      }
      Object.assign(state.exportJobs[clipId], updates);
    }),

    // B-Roll track
    addBRollClip: (clip) => {
      get().takeSnapshot();
      set(state => { state.brollTrack.push(clip); });
    },
    updateBRollClip: (id, changes) => {
      get().takeSnapshot();
      set(state => {
        const idx = state.brollTrack.findIndex(c => c.id === id);
        if (idx !== -1) Object.assign(state.brollTrack[idx], changes);
      });
    },
    removeBRollClip: (id) => {
      get().takeSnapshot();
      set(state => { state.brollTrack = state.brollTrack.filter(c => c.id !== id); });
    },

    // Music track
    addMusicClip: (clip) => {
      get().takeSnapshot();
      set(state => { state.musicTrack.push(clip); });
    },
    updateMusicClip: (id, changes) => {
      get().takeSnapshot();
      set(state => {
        const idx = state.musicTrack.findIndex(c => c.id === id);
        if (idx !== -1) Object.assign(state.musicTrack[idx], changes);
      });
    },
    removeMusicClip: (id) => {
      get().takeSnapshot();
      set(state => { state.musicTrack = state.musicTrack.filter(c => c.id !== id); });
    },

    // AI Prompt History
    addAiHistory: (prompt, description, actions = []) => set(state => {
      state.aiHistory.unshift({
        id: crypto.randomUUID(),
        prompt,
        description,
        actions,
        timestamp: Date.now(),
      });
      // Keep last 20
      if (state.aiHistory.length > 20) state.aiHistory.length = 20;
    }),
    clearAiHistory: () => set(state => { state.aiHistory = []; }),

    reset: () => set(initialState)
  }))
);
