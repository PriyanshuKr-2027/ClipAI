# System Architecture Document — ClipAI

This document outlines the system architecture, component relationships, data flow patterns, and directory structure for the ClipAI application.

---

## 1. High-Level Architecture Overview

ClipAI is structured as a **hybrid local-first application**. It combines a client-side Single Page Application (SPA), a local Node.js/Express server executing native utility binaries (FFmpeg/FFprobe), and lightweight, low-latency calls to external AI APIs (Groq Whisper + LLaMA 3.3).

```
 ┌─────────────────────────────────────────────────────────────┐
 │                    Client Browser (React)                   │
 │                  Runs on http://localhost:5173              │
 └──────────────┬──────────────────────────────┬───────────────┘
                │                              │
                │ HTTP / WebSocket             │ HTTPS (CORS)
                │ (Port 3001)                  │
                v                              v
 ┌──────────────────────────────┐    ┌─────────────────────────┐
 │    Local Express Server      │    │     Groq Cloud API      │
 │  Runs on http://localhost:3001│    │   (api.groq.com/v1)     │
 └──────────────┬───────────────┘    └─────────────────────────┘
                │
                │ Process Spawn (CLI)
                v
 ┌──────────────────────────────┐
 │    Native FFmpeg Binaries    │
 │   (ffmpeg / ffprobe processes)│
 └──────────────────────────────┘
```

### Key Architectural Pillars:
1.  **Local Media Storage:** To avoid expensive server hosting and upload bandwidth limitations, all raw and processed video files are stored locally in the `./temp/` directory.
2.  **Stateless API Design:** The Express backend does not maintain a database. Instead, metadata, editing states, and project properties are managed in the client browser's memory and persisted in `localStorage`.
3.  **Real-Time Bi-directional Feedback:** Heavy video processes run asynchronously in the background. The server streams progress updates and terminal logs to the frontend via a WebSocket connection.
4.  **Language-Specific Automation:** System pipelines automatically detect Devanagari and Hinglish scripts, applying targeted rendering overlays based on the detected language.

---

## 2. Directory & Component Mapping

The codebase is organized into client and server folders:

```
clipai/
├── server/                     # Express.js Backend Application
│   ├── index.js                # Server entry point (HTTP + WebSocket servers)
│   ├── routes/                 # API Endpoint Routers
│   │   ├── ffmpeg.js           # Video cutting, cropping, speed adjustments, and rendering
│   │   ├── files.js            # Media file uploads, downloads, list, and cleanup
│   │   └── transitions.js      # Reference downloads and motion signature detection
│   └── services/               # Core Backend Business Logic
│       ├── ffmpeg.js           # Fluent-ffmpeg commands execution wrapper
│       ├── captionRenderer.js  # Compiles .ass sub-title files for styling
│       ├── verify_analyze.js   # Script verifying transition analytical models
│       └── verify_render.js    # Script verifying transition image-to-video render loops
│
├── src/                        # React Frontend Application
│   ├── App.jsx                 # Router entry and layout definitions
│   ├── main.jsx                # DOM mounting entrypoint
│   ├── index.css               # Design system rules & glassmorphism variables
│   ├── screens/                # Main Application Screen Components
│   │   ├── Home.jsx            # Landing dashboard and project list
│   │   ├── Projects.jsx        # Import uploader and sorting grids
│   │   ├── Editor.jsx          # Full multi-track video canvas editor
│   │   ├── CaptionEditor.jsx   # Styled subtitle word-level synchronization panel
│   │   ├── ClipsReview.jsx     # AI Shorts compilation and selection reviews
│   │   └── TransitionClone.jsx # Visual transition template designer
│   ├── components/             # Reusable UI Components
│   │   ├── Timeline.jsx        # Multi-track audio/video timeline component
│   │   ├── VideoPreview.jsx    # Custom video player framework
│   │   ├── CaptionOverlay.jsx  # CSS text-shadow caption synchronization component
│   │   ├── StylePicker.jsx     # Horizontal subtitle layout selection track
│   │   └── ExportSheet.jsx     # Export sheet with terminal log outputs
│   ├── services/               # Browser API Abstractions
│   │   ├── api.js              # Server HTTP / WS hooks
│   │   ├── groq.js             # Groq Whisper and LLM prompts
│   │   └── clipDetector.js     # Viral clipping pipeline orchestration
│   └── store/                  # Global State Engine
│       └── editorStore.js      # Zustand store using Immer mutators
│
└── temp/                       # Temporary folder for local media files
```

---

## 3. Client-Side (Frontend) Architecture

### 3.1 State Management (Zustand + Immer)
The frontend uses **Zustand** combined with **Immer** for state management. This approach provides:
*   **Centralized Source of Truth:** All project settings, active tracks, and playback states are stored in a single, accessible store.
*   **Immutability with Simple Syntax:** Immer allows code to safely perform nested modifications without manual spread operations.
*   **Reactivity:** Controls only re-render when their specific observed slice of state changes.

```
Zustand State Store Map:
┌─────────────────────────────────────────────────────────────────────────┐
│                           useEditorStore                                │
├─────────────────────────────────────────────────────────────────────────┤
│  • Project Settings: projectId, projectName, mode                      │
│  • Media Properties: videoPath, videoUrl, videoInfo, filename           │
│  • Timeline Arrays: clips[], audioTracks[], textLayers[], captionBlocks[]│
│  • Captions State: captionGroups[], selectedStyle, language             │
│  • UI States: selectedTool, zoom, isTranscribing, currentTime, isPlaying│
│  • Export Tracking: exportSettings{}, exportJobs{}                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Routing Configuration (`App.jsx`)
`react-router-dom` handles application navigation. Routes map directly to screen components:
*   `/` ──> `Home.jsx`
*   `/projects` ──> `Projects.jsx`
*   `/editor` ──> `Editor.jsx`
*   `/captions` ──> `CaptionEditor.jsx`
*   `/clips` ──> `ClipsReview.jsx`
*   `/transitions` ──> `TransitionClone.jsx`

---

## 4. Server-Side (Backend) Architecture

### 4.1 Server Startup & Middleware
The entrypoint `server/index.js` initializes the local environment:
1.  **Temp Directory Enforcement:** Validates the presence of the `./temp` folder, creating it if missing.
2.  **Express Application:** Boots an HTTP server on port 3001.
3.  **CORS Policy:** Allows credentials and configures origins for `http://localhost:5173`.
4.  **Static Serving:** Serves files in `./temp/*` via the `/temp` route.
5.  **WebSocket Server:** Mounts a WS handler on top of the HTTP server instance to stream job updates.

### 4.2 API Router Layers
Endpoints are categorized into three routers:
*   `/api/files`: Handles file operations (multipart uploads via Multer, YouTube reference downloads, folder listings, and temporary file cleanup).
*   `/api/ffmpeg`: Wraps CLI executions (metadata probing, audio extraction, trimming, speed scaling, crop transforms, and subtitle burn-ins).
*   `/api/transitions`: Manages URL parsing, frame-difference signature analysis, and template compilation recipes.

---

## 5. Architectural Data Flows

### 5.1 Asynchronous Job Execution & WebSocket Progress Flow

Heavy video processing operations (like subtitle burn-ins or transitions rendering) are run asynchronously to prevent blocking the HTTP connection:

```
Client (Vite App)                   Express Server                   FFmpeg CLI
   │                                      │                              │
   │ 1. POST /api/ffmpeg/burn-captions    │                              │
   ├─────────────────────────────────────>│                              │
   │                                      │ 2. Spawns FFmpeg Process     │
   │                                      ├─────────────────────────────>│
   │ 3. Returns immediate { jobId }       │                              │
   │<─────────────────────────────────────┤                              │
   │                                      │ 4. Track CLI stdout progress │
   │                                      │<─────────────────────────────┤
   │                                      │                              │
   │ 5. WS Broadcast: "progress", 12%     │                              │
   │<─────────────────────────────────────┤                              │
   │                                      │ 6. WS Broadcast: "progress", 50%     │
   │<─────────────────────────────────────┤                              │
   │                                      │                              │
   │                                      │ 7. FFmpeg Process Complete   │
   │                                      │<─────────────────────────────┤
   │ 8. WS Broadcast: "done", filename    │                              │
   │<─────────────────────────────────────┤                              │
```

### 5.2 Transition Template Analysis & Stitched Rendering Flow

```
1. Paste URL ──> Server: download-youtube / ytdl-core ──> Ref Video File
                                                              │
                                                              v
2. Analysis ──> FFmpeg Frame-Difference Filters ──> Frame Change Signals JSON
                                                              │
                                                              v
3. Classify ──> Groq LLM Classifier ──> Slot Timings / Visual Cuts Recipe JSON
                                                              │
                                                              v
4. Client ──> User Uploads Custom Photos/Videos ──> Populated Slot Array
                                                              │
                                                              v
5. Render ──> Backend image-to-video loop + audio mix ──> Custom Stitched Output
```

---

## 6. Security and Sandbox Considerations

*   **Local Scope:** Since the application runs on `localhost`, media uploads are kept locally on the user's machine, ensuring data privacy.
*   **Environment Variable Security:** The Groq API key is managed via a `.env` file located in the project root. Only variables prefixed with `VITE_` are exposed to the client.
*   **Input Validation:** The backend uses security measures such as limiting file sizes via Multer configuration limits and validating query paths to prevent directory traversal vulnerabilities.
