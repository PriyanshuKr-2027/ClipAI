# Technical Features Document — ClipAI

This document provides an in-depth breakdown of all technical features in the ClipAI application, mapping each feature to its corresponding tech stack, API endpoints, and logic flows.

---

## 1. Core Feature Matrix

| Feature Name | Primary Purpose | Tech Stack Components | APIs / Models Used |
| :--- | :--- | :--- | :--- |
| **Auto-Generated Captions** | Transcribes video audio and burns styled subtitles. | React, Axios, Express, `fluent-ffmpeg`, `captionRenderer.js` | Groq `whisper-large-v3-turbo`, POST `/api/ffmpeg/burn-captions` |
| **AI Shorts Generator** | Extracts viral clips & auto-generates hooks. | React, Zustand, Express, `fluent-ffmpeg`, `clipDetector.js` | Groq `llama-3.3-70b-versatile` & `whisper-large-v3-turbo` |
| **Transition Reel Clone** | Reverse-engineers video templates to swap media. | React, Framer Motion, Express, `ffmpeg-static`, `ytdl-core` | Groq `llama-3.3-70b-versatile`, POST `/api/transitions/*` |
| **Multi-Track Timeline** | Visual editor with drag-and-drop, splitting, and trimming. | React, Zustand + Immer, HTML5 Drag & Drop, `fluent-ffmpeg` | POST `/api/ffmpeg/cut-clip`, `/trim`, `/speed`, `/crop` |
| **Real-Time Export Engine** | Configures and renders final video assets. | React, WebSockets (`ws`), `fluent-ffmpeg`, Express | WS `progress` / `done`, POST `/api/ffmpeg/reencode` |

---

## 2. In-Depth Feature Breakdown

---

### 2.1 AI Auto-Generated Captions (Subtitles)

#### Description
ClipAI automates transcription and subtitles styling. The system extracts the audio track from the video, submits it for transcription, segments the words into coherent lines, renders a live CSS simulation, and burns the chosen subtitle style into the final exported video.

#### 1. Detailed Functionality & User Controls
*   **Audio Extraction:** Strips audio from the uploaded video track to reduce bandwidth before submitting it to Whisper.
*   **Transcription:** Auto-transcribes the audio with precise, word-level timestamps.
*   **Timing Adjustments:** Users can edit the text and timing boundaries of individual captions in increments of `±0.1` seconds.
*   **Style Presets:** Users can choose from 5 styled presets:
    1.  `NeonPop`: Yellow-glowing active word overlays on Bangers font.
    2.  `HinglishFire`: Red/orange neon strokes on bold Anton font, with word-scale pulsing.
    3.  `BoldDevanagari`: Semi-translucent black backgrounds styled for Hindi Noto Sans Devanagari text.
    4.  `CleanMinimal`: Sleek white Montserrat font with subtle shadows and animations.
    5.  `ReelBold`: Impact font, all-caps, with a text-shake animation for active words.

#### 2. Tech Stack & Architecture
*   **Frontend Components:** [CaptionEditor.jsx](file:///c:/Users/10pri/Downloads/clip%20ai/src/screens/CaptionEditor.jsx), [CaptionOverlay.jsx](file:///c:/Users/10pri/Downloads/clip%20ai/src/components/CaptionOverlay.jsx), [StylePicker.jsx](file:///c:/Users/10pri/Downloads/clip%20ai/src/components/StylePicker.jsx).
*   **Frontend Services & Store:** [groq.js](file:///c:/Users/10pri/Downloads/clip%20ai/src/services/groq.js), [editorStore.js](file:///c:/Users/10pri/Downloads/clip%20ai/src/store/editorStore.js) (`buildCaptionGroups`, `updateCaptionGroup`).
*   **Backend Services:** [captionRenderer.js](file:///c:/Users/10pri/Downloads/clip%20ai/server/services/captionRenderer.js) (writes Advanced SubStation Alpha `.ass` files).
*   **Models:** `whisper-large-v3-turbo` (Groq API).

#### 3. API Endpoints
*   `POST /api/ffmpeg/extract-audio`: Converts raw video into a `16kHz mono mp3` at `./temp/`.
*   `POST https://api.groq.com/openai/v1/audio/transcriptions`: Sends the audio file to Groq with `timestamp_granularities=["word"]`.
*   `POST /api/ffmpeg/burn-captions`: Takes the generated `.ass` subtitle text and encodes the subtitles directly into the video stream via FFmpeg's `-vf ass` filter.

#### 4. Logic Flow
```
[User Clicks Generate] ──> API: Extract Audio ──> API: Groq Whisper (Transcribe)
       │
       v
Zustand: buildCaptionGroups() ──> Render Live CSS Previews on Screens
       │
[User Customizes Style & Saves]
       │
       v
API: Burn Captions (via Express & FFmpeg) ──> WebSockets: Broadcast Render % ──> Final Video
```

---

### 2.2 AI Shorts / Clips Generator (Viral Detection Pipeline)

#### Description
Analyzes long-form videos to extract short, highly-engaging video segments (30-60 seconds) optimized for social media platforms. The pipeline processes the video transcript using LLaMA 3.3 to score highlights and automatically extract them into independent clips.

#### 1. Detailed Functionality & User Controls
*   **Engaging Moments Scoring:** The AI scores segments on a scale of 1–10 based on viral potential.
*   **Hook & Title Extraction:** For each segment, the AI generates a title and a social media hook description.
*   **Auto-Language Detection:** The system parses the transcript unicode ranges to identify English, Hindi, or Hinglish, applying language-specific subtitle styling automatically.
*   **Bulk & Single Selection:** Interactive gallery allowing users to select, preview, edit, or batch-export clips.

#### 2. Tech Stack & Architecture
*   **Frontend Screen:** [ClipsReview.jsx](file:///c:/Users/10pri/Downloads/clip%20ai/src/screens/ClipsReview.jsx).
*   **Frontend Pipeline:** [clipDetector.js](file:///c:/Users/10pri/Downloads/clip%20ai/src/services/clipDetector.js) (manages the pipeline flow).
*   **State Management:** Zustand `editorStore.js` (`generatedClips`, `toggleClipSelection`, `setActiveClip`).
*   **Models:** `llama-3.3-70b-versatile` (Groq API) for NLP segment classification, and `whisper-large-v3-turbo` for timing alignment.

#### 3. API Endpoints
*   `POST /api/ffmpeg/info`: Fetches duration, fps, resolution.
*   `POST /api/ffmpeg/extract-audio`: Obtains the audio track.
*   `POST /api/ffmpeg/cut-clip`: Cuts the raw video from `start` to `end` timestamps using stream-copy `-c copy`.
*   `POST /api/ffmpeg/thumbnail`: Extracts a keyframe JPEG at a specific timestamp for video card cover displays.

#### 4. Logic Flow
```
Upload Video ──> Extract Audio ──> Transcribe ──> Build Transcript with Timestamps
                                                         │
                                                         v
                                              Groq: LLaMA 3.3 Analysis
                                                         │
                                                         v
                                              [JSON list of suggestions]
                                                         │
                                                         v
                                           For each: Cut Clip + Extract Thumb
                                                         │
                                                         v
                                              Render Gallery (ClipsReview)
```

---

### 2.3 Transition Reel Clone (Adaptive Template Engine)

#### Description
An advanced video-recreation workflow. It downloads a public video from social media, extracts its frame-by-frame structural signatures to detect cuts and speed adjustments, builds a template blueprint, and lets users fill slots with their own media to generate a styled clone.

#### 1. Detailed Functionality & User Controls
*   **Video Downloader:** Supports direct video downloading from Instagram, TikTok, and YouTube URLs.
*   **Motion Signature Extraction:** Runs a server-side FFmpeg pipeline analyzing raw frame-pixel differences to isolate camera transitions, motion spikes, and beat drops.
*   **Dynamic Media Slots:** The recipe is split into visual blocks. Users can bulk-upload photos or videos into these blocks.
*   **Visual Layout Controls:** Drag-and-drop slots to swap image order, edit duration notes, select transition directions, or replace the background video track.

#### 2. Tech Stack & Architecture
*   **Frontend Screen:** [TransitionClone.jsx](file:///c:/Users/10pri/Downloads/clip%20ai/src/screens/TransitionClone.jsx).
*   **Backend Services:** [transitions.js](file:///c:/Users/10pri/Downloads/clip%20ai/server/routes/transitions.js) (downloads videos, runs frame analyses, and compiles scenes), `verify_analyze.js`, `verify_render.js`.
*   **Libraries:** `ytdl-core` (or equivalent YouTube/Reel streaming parsers), `fluent-ffmpeg` for motion analysis and rendering.

#### 3. API Endpoints
*   `POST /api/transitions/download`: Downloads video streams to `./temp/`.
*   `POST /api/transitions/analyze`: Extracts frame differences and outputs JSON signal arrays.
*   `POST /api/transitions/upload-photo`: Handles multipart photo uploads.
*   `POST /api/transitions/render`: Performs image-to-video conversions and stitches them over the template audio track.

#### 4. Logic Flow
```
User Paste Link ──> Server Downloader ──> FFmpeg Frame-Difference Signal Analysis
                                                     │
                                                     v
                                          Groq Recipe Classifier
                                                     │
                                                     v
                                        Display Fillable Photo Grid
                                                     │
                                            [Drag-Swap Slots]
                                                     │
                                                     v
                                    FFmpeg Multi-layer Render Process
                                                     │
                                                     v
                                          Download Custom Reel
```

---

### 2.4 Multi-Track Timeline Editor

#### Description
A desktop-class video editor featuring a layout similar to CapCut. Users have full control over visual arrangements, cuts, text positioning, audio settings, and clip transformations on a scale-zoomed timeline.

#### 1. Detailed Functionality & User Controls
*   **Timeline Tracks:** 
    *   `V1`: Video tracks featuring thumbnail Previews.
    *   `A1`: Audio tracks displaying wave structures.
    *   `T1`: Text overlay blocks.
    *   `C1`: Captions/Subtitles overlay segments.
*   **Playhead Seeking:** Clicking anywhere on the track seeks the video; dragging the playhead updates the preview canvas in real-time.
*   **Visual Trimming:** Dragging the edges of a track segment adjusts its duration boundaries.
*   **Cuts/Splits:** Splits a clip at the playhead position into two independent, editable segments.
*   **Transformations:** Scale, position, speed adjustments (0.25x to 4.0x), and volume parameters in the Properties panel.

#### 2. Tech Stack & Architecture
*   **Frontend Screen & Components:** [Editor.jsx](file:///c:/Users/10pri/Downloads/clip%20ai/src/screens/Editor.jsx), [Timeline.jsx](file:///c:/Users/10pri/Downloads/clip%20ai/src/components/Timeline.jsx), [VideoPreview.jsx](file:///c:/Users/10pri/Downloads/clip%20ai/src/components/VideoPreview.jsx).
*   **State Store:** Zustand `editorStore.js` (`clips`, `currentTime`, `selectedTool`, `zoom`).
*   **Video Processing:** Backend `ffmpeg.js` routes executing command-line flags.

#### 3. API Endpoints
*   `POST /api/ffmpeg/trim`: Cuts/trims segments.
*   `POST /api/ffmpeg/speed`: Adjusts clip speed via `-vf setpts` and `-af atempo` filters.
*   `POST /api/ffmpeg/crop`: Crops coordinate dimensions using `-vf crop`.

---

### 2.5 Real-Time Export Engine

#### Description
Handles final video compilation, combining the timeline layers, burning subtitles, adjusting quality metrics, and streaming progress logs to the user via WebSockets.

#### 1. Detailed Functionality & User Controls
*   **Export Settings Configuration:** Adjust output formats (H.264 MP4, H.265 MP4, WebM), quality compression levels (High, Medium, Low CRFs), target resolutions (Original, 1080x1920, 720x1280, 1080x1080), and caption styles.
*   **Progress Streaming:** Live progress bar and detailed terminal command output log.
*   **Bulk Exports:** Compiles multiple selected video segments in sequential queues.

#### 2. Tech Stack & Architecture
*   **Frontend Components:** [ExportSheet.jsx](file:///c:/Users/10pri/Downloads/clip%20ai/src/components/ExportSheet.jsx).
*   **WebSocket Interface:** Browser WebSocket client linked to Zustand.
*   **Backend Server:** `server/index.js` (WebSocket Server via `ws` package), and `server/routes/ffmpeg.js`.

#### 3. API Endpoints & WS Events
*   `POST /api/ffmpeg/reencode`: Compiles a video clip using resolution and quality constraints.
*   `POST /api/ffmpeg/burn-captions`: Compiles video with hard-coded subtitles.
*   `WS Event: { type: "progress", jobId, percent }`: Streams encoding progress percentage.
*   `WS Event: { type: "done", jobId, outputFilename }`: Notifies client of export completion.

---

## 3. Technology Stack & Dependencies

### 3.1 Frontend (Client)
*   **Framework:** React 18 (Vite build system).
*   **Styling:** TailwindCSS 3.4, PostCSS, and vanilla CSS variables (for frosted glass backdrop blurs).
*   **Animations:** Framer Motion 10.18 (handles slide-up panels, transitions, list staggers, and modals).
*   **State Management:** Zustand 4.4 + Immer 10.0 (provides transactional state modification).
*   **Icons:** Lucide React (vector asset controls).
*   **Communication:** Axios (HTTP) + WebSockets (Real-time progress).

### 3.2 Backend (Server)
*   **Runtime:** Node.js, Express.js.
*   **Video Engine:** Native system FFmpeg/FFprobe binaries, with `ffmpeg-static` and `ffprobe-static` npm packages as fallback options.
*   **FFmpeg Handler:** `fluent-ffmpeg` (provides an API for building FFmpeg filtergraphs).
*   **File Uploader:** Multer (streamed disk uploads up to 4GB).
*   **Networking:** `ws` (Node.js WebSocket implementation).
*   **Config:** `dotenv` for environment isolation, `uuid` for unique file names.
