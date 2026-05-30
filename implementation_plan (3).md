# AI Video Editor — Implementation Plan (V1)
> Stack: React (Vite) + Express.js + FFmpeg + Groq API (Whisper + LLaMA 3.3)
> AI Prompts target: Claude Sonnet 4.5
> How it runs: one `npm run start` command → browser opens at localhost:5173

---

## Architecture

```
Browser (React @ :5173)
    │
    ├──→ Groq API (api.groq.com) — transcription + AI clip detection
    │    Direct from browser (Groq allows CORS)
    │
    └──→ Express Server (localhost:3001) — FFmpeg operations only
             └──→ FFmpeg binary
                  Cuts clips, burns captions, extracts audio, thumbnails, trim, speed, crop
```

---

## User Flow Summary

```
Normal Editing:
  Home → Import → Editor → [Caption Page optional] → Export (sheet)

AI Shorts Workflow:
  Home → Import → Clipping Page → AI creates shorts + captions → select clip
       → Opens in Editor → further editing → Export single / bulk
```

---

## Project Structure

```
clipai/
├── server/
│   ├── index.js
│   ├── routes/
│   │   ├── ffmpeg.js          # /api/ffmpeg/* — all FFmpeg operations
│   │   └── files.js           # /api/files/* — upload, list, cleanup
│   └── services/
│       ├── ffmpeg.js          # fluent-ffmpeg wrappers
│       └── captionRenderer.js # ASS subtitle generator
│
├── src/
│   ├── App.jsx                # Router setup
│   ├── screens/
│   │   ├── Home.jsx           # Landing — Caption / Clipping / Editor cards + recent projects
│   │   ├── Projects.jsx       # All projects — import, rename, delete, open
│   │   ├── Editor.jsx         # Main editor — timeline, tools, properties panel
│   │   ├── CaptionEditor.jsx  # Caption page — opened from Editor, returns to Editor
│   │   └── ClipsReview.jsx    # AI Shorts page — generate, preview, edit, export
│   ├── components/
│   │   ├── CaptionOverlay.jsx # CSS live caption preview
│   │   ├── StylePicker.jsx    # Caption style selector cards
│   │   ├── ExportSheet.jsx    # Bottom sheet export (used by Editor + ClipsReview)
│   │   ├── Timeline.jsx       # Multi-track timeline (extracted from Editor)
│   │   └── VideoPreview.jsx   # Shared video player with controls
│   ├── services/
│   │   ├── groq.js            # Groq API — transcription + clip detection
│   │   ├── api.js             # Express server calls + WebSocket
│   │   └── clipDetector.js    # Full AI shorts pipeline
│   └── store/
│       └── editorStore.js     # Zustand global state
│
├── temp/                      # FFmpeg outputs
├── package.json
├── server/package.json
└── .env                       # VITE_GROQ_API_KEY
```

---

## Routes Map

```
/                → Home.jsx
/projects        → Projects.jsx
/editor          → Editor.jsx         (requires videoPath in store or query)
/captions        → CaptionEditor.jsx  (opened from /editor, returns to /editor)
/clips           → ClipsReview.jsx    (requires videoPath in store or query)
```

---

## Phase 1 — Project Scaffold

### Prompt 1: Full Project Setup

```
Create a web-based AI video editor called "ClipAI" with this structure:

ROOT (frontend):
- React 18 + Vite
- react-router-dom v6 (routes: /, /projects, /editor, /captions, /clips)
- zustand + immer for state
- tailwindcss + postcss + autoprefixer
- framer-motion, lucide-react, axios
- concurrently

Root package.json scripts:
  "dev": "vite"
  "server": "node server/index.js"
  "start": "concurrently \"npm run server\" \"npm run dev\""

SERVER (server/ subfolder, own package.json):
- express, cors, multer, dotenv
- fluent-ffmpeg, ffmpeg-static, ffprobe-static
- ws, uuid

server/index.js:
- Express port 3001, CORS for http://localhost:5173
- Mount: /api/ffmpeg, /api/files
- Static serve: /temp/* from ./temp/
- WebSocket on same HTTP server
- mkdir ./temp on startup

src/App.jsx:
- BrowserRouter with all 5 routes
- Dark bg #060608 via index.css

src/index.css — Google Fonts import:
  Plus Jakarta Sans (300,400,500,600,700)
  Space Grotesk (500,600,700)
  Fira Code (400,500)

Also add all glassmorphism utility classes (.glass-panel, .glass-card, .glass-input,
.glow-accent, .glow-accent-sm, .gradient-text, .shimmer) and the body::before
ambient gradient to index.css.

Output: package.json, server/package.json, server/index.js,
vite.config.js, tailwind.config.js, src/App.jsx, src/index.css
```

---

## Phase 2 — FFmpeg Server Routes

### Prompt 2: FFmpeg Routes

```
Create server/routes/ffmpeg.js and server/services/ffmpeg.js

fluent-ffmpeg, paths from ffmpeg-static/ffprobe-static.
All outputs to ./temp/{uuid}. Emit WebSocket progress for long ops.

ROUTES:

POST /api/ffmpeg/info
  Body: { videoPath }
  ffprobe → { duration, width, height, fps, size }

POST /api/ffmpeg/extract-audio
  Body: { videoPath }
  16kHz mono mp3 → temp/{uuid}.mp3
  Return: { audioPath, audioFilename }

POST /api/ffmpeg/cut-clip
  Body: { videoPath, start, end, outputName }
  -ss {start} -to {end} -c copy
  Return: { clipPath, clipFilename }

POST /api/ffmpeg/thumbnail
  Body: { videoPath, timestamp }
  Single JPEG at timestamp → temp/{uuid}.jpg
  Return: { thumbPath, thumbFilename }

POST /api/ffmpeg/trim
  Body: { videoPath, inPoint, outPoint, outputName }
  Re-encode trim (not stream copy, for accuracy)
  Return: { outputPath, outputFilename }

POST /api/ffmpeg/speed
  Body: { videoPath, speed, outputName }
  speed: 0.25–4.0. Use setpts + atempo filters.
  Return: { outputPath, outputFilename }

POST /api/ffmpeg/crop
  Body: { videoPath, x, y, w, h, outputName }
  -vf crop={w}:{h}:{x}:{y}
  Return: { outputPath, outputFilename }

POST /api/ffmpeg/burn-captions
  Body: { videoPath, assContent, outputName, crf, resolution }
  Write assContent to temp/{uuid}.ass, burn with -vf ass=
  Broadcast WebSocket progress: { type:"progress", jobId, percent }
  On done: { type:"done", jobId, outputFilename }
  Return immediately: { jobId }

SERVICE server/services/ffmpeg.js:
  Async functions for each op, try/catch, descriptive errors.
```

---

## Phase 3 — File Routes

### Prompt 3: File Routes

```
Create server/routes/files.js

POST /api/files/upload
  multer diskStorage → temp/{uuid}_{originalname}
  fileSize limit: 4GB
  mimetypes: mp4, quicktime, x-msvideo, x-matroska
  After upload: ffprobe for video info
  Return: { filePath, filename, originalName, size, duration, width, height }

GET /api/files/list
  List temp/ files: name, size, created
  Return: { files: [...] }

DELETE /api/files/cleanup
  Delete files older than 12h
  Return: { deleted: N }
```

---

## Phase 4 — Caption Renderer

### Prompt 4: ASS Subtitle Generator

```
Create server/services/captionRenderer.js

Export: generateASS(words, stylePreset, videoWidth, videoHeight)
  words: [{word, start, end}]
  Returns: string (.ass file content)

Export: groupWordsIntoLines(words, maxWords = 5)
  Returns: [{words[], startTime, endTime, text}]

5 style presets:

1. NeonPop — Bangers 72px, white, black outline 3, shadow 2,
   karaoke word highlight yellow→white, alignment bottom center, MarginV 80

2. HinglishFire — Anton 68px bold, orange (BGR: &H000055FF),
   dark red outline 4, shadow 3, alignment 2 MarginV 80

3. BoldDevanagari — Noto Sans Devanagari 64px bold, white,
   semi-transparent black box bg (BorderStyle 4), MarginV 60

4. CleanMinimal — Montserrat 60px bold, white, outline 2 shadow 1,
   fade tag {\fad(150,150)}, alignment 2 MarginV 80

5. ReelBold — Impact 80px, white, outline 5, all caps, alignment 2 MarginV 80

ASS format: [Script Info] with dimensions, [V4+ Styles], [Events] dialogue lines.
Timestamps: H:MM:SS.cc format.
Word-level karaoke {\k} timing for NeonPop and HinglishFire.
```

---

## Phase 5 — Groq Service (Frontend)

### Prompt 5: Groq Service

```
Create src/services/groq.js

GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY

export async function transcribeAudio(audioUrl)
  Fetch blob → FormData (file, model=whisper-large-v3-turbo,
  response_format=verbose_json, timestamp_granularities=["word"])
  POST to https://api.groq.com/openai/v1/audio/transcriptions
  Returns: { words: [{word, start, end}], text, language, segments }

export async function detectClips(transcriptStr, videoDuration)
  POST https://api.groq.com/openai/v1/chat/completions
  Model: llama-3.3-70b-versatile, max_tokens: 2000, temp: 0.3
  System: "You are a viral short-form content expert for Indian social media.
    Find 5-8 engaging 30-60 second segments. Return ONLY valid JSON array.
    Format: [{start, end, title, hook, score, reason}]
    start/end in seconds, score 1-10."
  User: "Duration: {videoDuration}s\n\nTranscript:\n{transcriptStr}"
  Parse JSON, validate (start<end, end<=duration, score is number)
  Returns: validated clip array

export function detectLanguage(text)
  Check Devanagari unicode range \u0900-\u097F
  >70% → "hi", <30% → "en", else → "mixed"

Retry on 429: wait 2s, retry once.
```

---

## Phase 6 — API Service (Frontend)

### Prompt 6: API Service

```
Create src/services/api.js

BASE = "http://localhost:3001"

WebSocket:
  const ws = new WebSocket("ws://localhost:3001")
  const progressCallbacks = new Map()
  ws.onmessage: parse JSON → call progressCallbacks.get(jobId)(percent)
  export function onJobProgress(jobId, callback) { progressCallbacks.set(jobId, callback) }

export async function uploadVideo(file, onProgress)
  XMLHttpRequest for upload progress
  POST BASE/api/files/upload FormData {video: file}
  Returns: { filePath, filename, originalName, size, duration, width, height, videoUrl }
  videoUrl = `${BASE}/temp/${filename}`

export async function getVideoInfo(videoPath)
  POST BASE/api/ffmpeg/info → metadata

export async function extractAudio(videoPath)
  POST BASE/api/ffmpeg/extract-audio
  Returns: { audioPath, audioUrl: `${BASE}/temp/${audioFilename}` }

export async function cutClip(videoPath, start, end, outputName)
  POST BASE/api/ffmpeg/cut-clip
  Returns: { clipPath, clipUrl }

export async function trimClip(videoPath, inPoint, outPoint, outputName)
  POST BASE/api/ffmpeg/trim
  Returns: { outputPath, outputUrl }

export async function changeSpeed(videoPath, speed, outputName)
  POST BASE/api/ffmpeg/speed
  Returns: { outputPath, outputUrl }

export async function cropVideo(videoPath, x, y, w, h, outputName)
  POST BASE/api/ffmpeg/crop
  Returns: { outputPath, outputUrl }

export async function getThumbnail(videoPath, timestamp = 1)
  POST BASE/api/ffmpeg/thumbnail
  Returns: { thumbPath, thumbUrl }

export async function burnCaptions(videoPath, assContent, outputName, settings, onProgress)
  POST BASE/api/ffmpeg/burn-captions → { jobId }
  onJobProgress(jobId, onProgress)
  Returns Promise that resolves on 100%: { outputUrl }
```

---

## Phase 7 — Clip Detector

### Prompt 7: Clip Detection Pipeline

```
Create src/services/clipDetector.js

import * as api from './api.js'
import * as groq from './groq.js'

export async function generateClips(videoPath, onStatus) {
  onStatus("Getting video info...")
  const videoInfo = await api.getVideoInfo(videoPath)

  onStatus("Extracting audio track...")
  const { audioUrl } = await api.extractAudio(videoPath)

  onStatus("Transcribing with Whisper AI...")
  const { words, text, language } = await groq.transcribeAudio(audioUrl)

  const detectedLang = groq.detectLanguage(text)
  const stylePreset = detectedLang === 'hi' ? 'BoldDevanagari'
                    : detectedLang === 'mixed' ? 'HinglishFire'
                    : 'NeonPop'

  onStatus("AI analyzing for viral moments...")
  const transcriptStr = buildTimestampedTranscript(words)
  const suggestions = await groq.detectClips(transcriptStr, videoInfo.duration)

  const clips = []
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i]
    onStatus(`Cutting clip ${i+1}/${suggestions.length}: "${s.title}"`)
    const outputName = `clip_${Date.now()}_${i}`
    const { clipPath, clipUrl } = await api.cutClip(videoPath, s.start, s.end, outputName)
    const clipWords = words
      .filter(w => w.start >= s.start && w.end <= s.end)
      .map(w => ({ ...w, start: +(w.start - s.start).toFixed(3), end: +(w.end - s.start).toFixed(3) }))
    const { thumbUrl } = await api.getThumbnail(clipPath, 1)
    clips.push({
      id: outputName, title: s.title, hook: s.hook, score: s.score, reason: s.reason,
      start: s.start, end: s.end, duration: +(s.end - s.start).toFixed(1),
      videoPath: clipPath, videoUrl: clipUrl, thumbUrl,
      words: clipWords, language: detectedLang, stylePreset
    })
  }
  onStatus("Done!")
  return { clips, fullWords: words, language: detectedLang, videoInfo }
}

function buildTimestampedTranscript(words) {
  const lines = []
  for (let i = 0; i < words.length; i += 15) {
    const chunk = words.slice(i, i + 15)
    const m = Math.floor(chunk[0].start / 60)
    const s = Math.floor(chunk[0].start % 60)
    lines.push(`[${m}:${String(s).padStart(2,'0')}] ${chunk.map(w => w.word).join(' ')}`)
  }
  return lines.join('\n')
}
```

---

## Phase 8 — Zustand Store

### Prompt 8: State Store

```
Create src/store/editorStore.js using Zustand + immer.

State shape:
{
  // Project
  projectId: null,
  projectName: null,
  mode: null,            // 'editor' | 'caption' | 'clips'

  // Video source
  videoPath: null,
  videoUrl: null,
  videoInfo: null,       // {duration, width, height, fps}
  filename: null,

  // Editor timeline
  clips: [],             // video clip segments on V1 track
  audioTracks: [],       // audio track segments
  textLayers: [],        // text overlay elements
  captionBlocks: [],     // caption track segments
  selectedClipId: null,
  selectedTool: null,    // 'split'|'trim'|'crop'|'speed'|'audio'|'text'|'transition'|'caption'|'resize'
  zoom: 100,             // timeline zoom %

  // Transcription
  isTranscribing: false,
  transcribeStatus: '',
  words: [],
  language: null,

  // Captions
  captionGroups: [],
  originalCaptionGroups: [],
  selectedStyle: 'NeonPop',

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
  },
  exportJobs: {},
}

Actions:
  setProject(id, name, mode)
  setVideo(path, url, info, filename)
  setSelectedTool(tool)
  setZoom(level)
  
  // Timeline
  addClipSegment(clip)
  updateClipSegment(id, changes)
  removeClipSegment(id)
  addTextLayer(layer)
  updateTextLayer(id, changes)
  removeTextLayer(id)
  setSelectedClip(id)

  // Transcription
  setTranscribing(bool, status)
  setWords(words)          // also calls buildCaptionGroups
  setLanguage(lang)

  // Captions
  buildCaptionGroups()     // groups words[] into 5-word lines
  updateCaptionGroup(id, changes)
  deleteCaptionGroup(id)
  addCaptionGroup(group)
  resetCaptionsToAI()
  setSelectedStyle(preset)

  // Clips
  setGeneratedClips(clips)
  setGeneratingClips(bool, status)
  toggleClipSelection(id)
  setAllClipsSelected(bool)
  setActiveClip(id)        // sets activeClipId, copies clip words → captionGroups,
                           // sets videoUrl to clip.videoUrl

  // Playback
  setCurrentTime(t)
  setIsPlaying(bool)

  // Export
  setExportSettings(partial)
  updateExportJob(clipId, updates)

  reset()

buildCaptionGroups(): words[] → groups of 5, each:
  { id: uuid, text, startTime, endTime, words: [] }
  saves to captionGroups AND originalCaptionGroups
```

---

## Phase 9 — Home Screen

### Prompt 9: Home Screen

```
Create src/screens/Home.jsx

Three feature cards (Caption, Clipping, Editor) + Recent Projects + Continue Editing.
See design.md Screen 1 for full layout and design details.

State: read/write localStorage key "clipai_projects" as JSON array.
Each project: { id, name, videoPath, videoUrl, mode, created, lastEdited, metadata }

On feature card click: navigate to /projects with ?mode=caption|clips|editor
  (Projects page handles the import flow then navigates to the right screen)

Global top bar controls:
  Save: store.saveProject() → write current state to localStorage
  Undo/Redo: store.undo() / store.redo() (implement as action history array in store)
```

---

## Phase 10 — Projects Screen

### Prompt 10: Projects Screen

```
Create src/screens/Projects.jsx

Shows all projects from localStorage. Import new video or continue existing.
See design.md Screen 2 for full layout and design.

On video file selected (drag-drop or browse):
  1. api.uploadVideo(file, onProgress) → { filePath, videoUrl, ... }
  2. store.setVideo(filePath, videoUrl, info, filename)
  3. store.setProject(uuid(), filename, mode)  // mode from query param
  4. Save project to localStorage
  5. Navigate based on mode:
      mode=caption → /editor  (caption tool auto-selected)
      mode=clips   → /clips
      mode=editor  → /editor

On "Open" existing project:
  1. Load project state from localStorage into store
  2. Navigate to project's lastScreen (or /editor as default)

Rename: inline edit → save to localStorage
Delete: confirm modal → remove from localStorage + cleanup temp files via api
```

---

## Phase 11 — Main Editor Screen

### Prompt 11: Main Editor

```
Create src/screens/Editor.jsx

Full-featured editor with multi-track timeline.
See design.md Screen 3 for complete layout and design details.

CSS Grid: 56px tools | 1fr center | 280px right. Bottom timeline: 160px.
Redirect to /projects if no videoUrl in store.

TOP BAR:
  Caption button → navigate('/captions')
  Export button → open ExportSheet component (pass current video as single clip)

LEFT TOOLS PANEL:
  Each tool click → store.setSelectedTool(tool)
  Right panel renders tool-specific controls based on selectedTool

CENTER VIDEO PREVIEW:
  <video ref={videoRef}> synced to store.currentTime
  timeupdate → store.setCurrentTime(t)
  Text layers rendered as absolute divs on top of video
  When crop tool active: show corner drag handles (CSS resize handles or manual drag)

RIGHT PROPERTIES PANEL:
  Renders different controls based on store.selectedTool
  All changes call appropriate store actions + queue api calls
  Trim/Speed/Crop changes: call api.trimClip / api.changeSpeed / api.cropVideo
    Show mini progress indicator in panel during processing
    On done: update store.clips with new outputUrl

TIMELINE (extract to src/components/Timeline.jsx):
  4 tracks: V1 (video), A1 (audio), T1 (text), C1 (captions)
  Each clip block: draggable via mousedown+mousemove (or @dnd-kit)
  Resize handles on left/right edges of each block
  Playhead: draggable, also updates on video timeupdate
  Zoom: wheel event on timeline changes store.zoom
  Split tool: click on clip at playhead position → splits clip into two segments
    Call api.cutClip at split point, update store.clips

Auto-save: debounced 5s after any store change → write to localStorage
```

---

## Phase 12 — Caption Editor Screen

### Prompt 12: Caption Editor

```
Create src/screens/CaptionEditor.jsx

Opened from Editor via Caption button. Returns to /editor on save.
See design.md Screen 4 for complete layout and design details.

If store.words is empty:
  Show "Generate Captions" button prominently
  On click: run transcription flow (extract audio → groq.transcribeAudio → store.setWords)

If store.captionGroups empty but store.words exist:
  Auto-call store.buildCaptionGroups() on mount

Caption editing flow:
  Edit text → store.updateCaptionGroup(id, { text })
  Adjust timing → store.updateCaptionGroup(id, { startTime, endTime })
  Delete → store.deleteCaptionGroup(id)
  Add → store.addCaptionGroup({ id: uuid, text:'', startTime: currentTime, endTime: currentTime+2 })

Style change → store.setSelectedStyle(preset)
Font size / color / position → store.updateCaptionStyle({ fontSize, color, position })
  (add captionStyle: {fontSize, color, position} to store shape)

Reset → store.resetCaptionsToAI() with confirm dialog

Save & Return:
  store.captionBlocks are auto-synced from captionGroups
  navigate('/editor')
```

---

## Phase 13 — Clipping / Shorts Screen

### Prompt 13: Clips Review Screen

```
Create src/screens/ClipsReview.jsx

AI-powered shorts generator. See design.md Screen 5 for layout and design details.

On mount: if store.generatedClips empty → auto-call:
  generateClips(store.videoPath, (status) => store.setGeneratingClips(true, status))
  On done: store.setGeneratedClips(clips), store.setGeneratingClips(false, '')

Clip card "Edit" button:
  store.setActiveClip(clip.id)  // sets videoUrl to clip.videoUrl, copies caption words
  navigate('/editor')

Single export (↗ icon on card):
  Open ExportSheet with [clip] as the clips prop

Bulk export:
  "Export All" or "Export Selected" → open ExportSheet with selected/all clips

Preview modal:
  <video src={clip.videoUrl} autoplay loop>
  CaptionOverlay with clip.words + selectedStyle
  "Open in Editor" → same as Edit button
```

---

## Phase 14 — Export Sheet Component

### Prompt 14: Export Sheet

```
Create src/components/ExportSheet.jsx

See design.md Export Modal section for complete design details.

Props: clips[], isOpen, onClose, onComplete

Bottom sheet (framer-motion y:100%→0, backdrop):
  Settings: Format, Quality, Resolution, Captions, Font Size (see design.md)
  
Export flow (on "Start Export"):
  For each clip sequentially:
    1. If captions = 'burn' or 'both':
         Generate ASS: POST /api/ffmpeg/burn-captions with clip.words + stylePreset
         api.burnCaptions(clip.videoPath, assContent, outputName, settings, onProgress)
    2. Else: just re-encode with quality/resolution settings via new route:
         POST /api/ffmpeg/reencode { videoPath, crf, resolution, outputName }
    3. Track progress via WebSocket onJobProgress
    4. store.updateExportJob(clip.id, { status, percent, outputUrl })
  
  On all complete: call onComplete({ files: [{name, size, url}] })

Add to server/routes/ffmpeg.js:
  POST /api/ffmpeg/reencode
    Body: { videoPath, crf, resolution, outputName }
    Re-encode with quality/resolution only (no captions)
    WebSocket progress + done broadcast
```

---

## Implementation Order

```
1.  Prompt 1  → Scaffold → verify: :5173 opens, :3001 starts
2.  Prompt 8  → Zustand store
3.  Prompt 2  → FFmpeg routes → test: curl /api/ffmpeg/info
4.  Prompt 3  → File routes → test: upload small video
5.  Prompt 4  → Caption renderer → unit test generateASS
6.  Prompt 5  → Groq service → test in browser console
7.  Prompt 6  → API service → test upload + info
8.  Prompt 7  → Clip detector → end-to-end with real video
9.  Prompt 9  → Home screen
10. Prompt 10 → Projects screen + import flow
11. Prompt 11 → Main Editor (core layout + video player)
12. Prompt 11 (cont.) → Timeline component
13. Prompt 11 (cont.) → Tool panels (trim, speed, crop, text, transition)
14. Prompt 12 → Caption Editor screen
15. Prompt 13 → Clips Review screen
16. Prompt 14 → Export Sheet component
```

---

## Daily Usage

```bash
npm run start
# → Express: http://localhost:3001
# → React:   http://localhost:5173
```

---

## Prompt Usage Tips

- Paste each prompt one at a time into Claude Sonnet 4.5
- For Prompts 9–16: include the store file and relevant service files as context
- Test each phase in isolation before proceeding
- `.env`: `VITE_GROQ_API_KEY=gsk_xxxx`
- Never commit `.env` — add to `.gitignore`
- Timeline component is the most complex piece — build and test it before the tool panels
