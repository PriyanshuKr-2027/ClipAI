# AI Video Editor — Design Document (V1)
> All screens, layouts, and Claude Sonnet 4.5 design prompts
> Theme: Glassmorphism · Deep Space Dark · CapCut / VN Editor Style

---

## Design Philosophy

Inspired by **CapCut**, **VN Editor**, and **DaVinci Resolve** — a premium creator tool feel with translucent glass panels, glowing accents, and smooth motion. Everything floats over a deep dark background with layered depth. Panels use frosted glass (`backdrop-filter: blur`). Accent colors pulse and glow. Interactions feel tactile and fluid.

**Reference**: CapCut's timeline editor + VN's clean panel UI + Figma's dark mode precision.

---

## Design System

### Colors
```css
/* Base layers */
--bg-base: #060608
--bg-depth-1: #0d0d12           /* App background */
--bg-depth-2: #12121a           /* Panel base */
--bg-depth-3: #18181f           /* Nested containers */

/* Glassmorphism surfaces */
--glass-1: rgba(255,255,255,0.04)
--glass-2: rgba(255,255,255,0.07)
--glass-3: rgba(255,255,255,0.10)
--glass-border: rgba(255,255,255,0.10)
--glass-border-strong: rgba(255,255,255,0.18)

/* Accent */
--accent-primary: #7c5cfc       /* Neon violet — primary CTA */
--accent-secondary: #00d4ff     /* Cyan — secondary highlights */
--accent-glow: rgba(124,92,252,0.35)
--accent-teal: #00f5c4          /* AI / smart feature badges */

/* Semantic */
--success: #00e676
--warning: #ffb300
--error: #ff4d6a

/* Text */
--text-primary: #f0f0f5
--text-secondary: rgba(240,240,245,0.55)
--text-tertiary: rgba(240,240,245,0.30)

/* Timeline */
--timeline-bg: #0a0a10
--waveform-fill: rgba(124,92,252,0.5)
--caption-block: rgba(0,212,255,0.75)
--playhead: #7c5cfc
```

### Typography
```
Display / Logo    : "Space Grotesk" 500/600/700 (Google Fonts)
Headers / UI      : "Plus Jakarta Sans" 300–700 (Google Fonts)
Body / Labels     : "Plus Jakarta Sans" 400
Mono / Timestamps : "Fira Code" 400/500 (Google Fonts)
Caption Preview   : Loaded dynamically per style preset
```

### Glassmorphism Utilities (global CSS)
```css
.glass-panel {
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 16px;
}
.glass-card {
  background: rgba(255,255,255,0.07);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
}
.glass-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  color: #f0f0f5;
  outline: none;
}
.glass-input:focus {
  border-color: rgba(124,92,252,0.6);
  box-shadow: 0 0 0 3px rgba(124,92,252,0.15);
}
.glow-accent { box-shadow: 0 0 20px rgba(124,92,252,0.35), 0 0 40px rgba(124,92,252,0.15); }
.glow-accent-sm { box-shadow: 0 0 10px rgba(124,92,252,0.35); }
.gradient-text {
  background: linear-gradient(135deg, #7c5cfc, #00d4ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Ambient Background (every screen)
```css
body::before {
  content: '';
  position: fixed; inset: 0; z-index: -1;
  background:
    radial-gradient(ellipse 80% 50% at 20% -10%, rgba(124,92,252,0.12) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 110%, rgba(0,212,255,0.08) 0%, transparent 55%),
    #060608;
}
```

### Motion Principles
```
Panel entry      : y:12→0, opacity:0→1, duration:0.3, ease:[0.16,1,0.3,1]
Card hover       : scale:1→1.02, y:0→-3, duration:0.2
Button press     : scale:0.97, duration:0.1
Modal entry      : scale:0.94→1, opacity:0→1, duration:0.25
Stagger children : delayChildren:0.05, staggerChildren:0.04
```

### Spacing & Radius
```
Base unit: 4px
Component padding: 12 / 16 / 20 / 24px
Border radius: 8px (inputs/chips) · 12px (cards) · 16px (panels) · 20px (modals) · 999px (pills)
```

---

## Screen 1 — Home Page

### Description
The landing screen. Three prominent feature cards (Caption, Clipping, Editor) plus Recent Projects and Continue Editing sections. Feels like CapCut's home with glass cards floating on the ambient dark background.

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│  ✦ ClipAI                        [Save] [↩ Undo] [↪ Redo]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│   │  ✦ Caption   │  │  ✂ Clipping  │  │  🎬 Editor   │      │
│   │              │  │              │  │              │      │
│   │  Auto-gen    │  │  AI Shorts   │  │  Full Editor │      │
│   │  captions    │  │  Generator   │  │  Workspace   │      │
│   └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│   Recent Projects                           [View All →]    │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ [thumb]  vlog_raw.mp4       45min  2d ago  [→ Open]  │  │
│   │ [thumb]  podcast_ep3.mp4   1h2m   5d ago  [→ Open]  │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                              │
│   Continue Editing                                           │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ [thumb]  reels_edit_v2     Caption  30%  [Continue→] │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Claude Prompt (Design)
```
Build src/screens/Home.jsx — the home/landing screen for ClipAI, a premium AI video editor.

Design: Glassmorphism + deep space dark. Background: #060608 with two large ambient radial
gradients — violet top-left (rgba(124,92,252,0.12)), cyan bottom-right (rgba(0,212,255,0.08)).
Font: Plus Jakarta Sans throughout, Space Grotesk for logo.

TOP BAR (56px, glass-panel style, border-bottom glass-border):
  Left: "✦ ClipAI" — "✦" in gradient text (violet→cyan), "ClipAI" in Space Grotesk 700
  Right: three icon buttons (glass-card 32x32 each, gap-2):
    Save (Save icon), Undo (CornerUpLeft icon), Redo (CornerUpRight icon)
    Tooltip on hover each

HERO SECTION — Feature Cards (3 cards, equal width, gap-4, mx-auto max-w-4xl, mt-10):
  Each card (glass-card p-6 rounded-2xl, cursor-pointer, flex-col gap-3):
    Hover: glass-3 fill, border brightens to glass-border-strong, y:-4px (framer-motion)
    Icon area: 48x48 glass-card rounded-xl flex items-center justify-center
      Caption: Subtitles icon, violet glow
      Clipping: Scissors icon, cyan glow
      Editor: Film icon, teal glow
    Title: Plus Jakarta Sans 700 18px white
    Description: text-secondary 14px, 2 lines
    Tag pill: bottom of card, text-[10px] uppercase tracking-wide
      Caption → "AI Powered" (violet bg/15%)
      Clipping → "Auto Shorts" (cyan bg/15%)
      Editor → "Full Control" (teal bg/15%)
    On click:
      Caption → navigate('/import?mode=caption')
      Clipping → navigate('/import?mode=clips')
      Editor → navigate('/import?mode=editor')

RECENT PROJECTS SECTION (mt-10, max-w-4xl mx-auto):
  Header row: "Recent Projects" Plus Jakarta Sans 600 16px + "View All →" ghost link
  List (flex-col gap-2):
    Each project row (glass-card p-3 rounded-xl flex items-center gap-3, hover glass-3):
      Thumbnail: 56x40px rounded-lg object-cover (or gradient placeholder by filename hash)
      Info: filename (semibold 14px) + metadata row (duration · date · mode badge)
      Mode badge: pill — "Caption" violet / "Clipping" cyan / "Editor" teal
      Actions (appear on row hover): rename icon · trash icon · "Open →" ghost button
    Show last 4 projects. If none: muted empty state "No recent projects"

CONTINUE EDITING SECTION (mt-6, max-w-4xl mx-auto):
  Header: "Continue Editing" Plus Jakarta Sans 600 16px
  Cards (horizontal scroll row, gap-3):
    Each: glass-card 200px wide p-3 rounded-xl flex-col
      Thumbnail 16:9 rounded-lg with play icon overlay
      Project name truncated (semibold 13px)
      Progress chip: "Caption 30%" / "Clips 5/8" / "Editing"
      "Continue →" gradient primary button, full width, h-8 text-sm rounded-xl
  If none: hide section

framer-motion: feature cards stagger entrance (y:20→0), hover spring, row hover transitions.
Store: read projects from localStorage (key: "clipai_projects").
```

---

## Screen 2 — Import / Projects Page

### Description
All projects in one place. Import new video or continue an existing one. Acts as the gateway into each workflow mode (Editor, Caption, Clipping). Rename and delete projects inline.

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│  ← Home   Projects                              [+ Import]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Search projects...]           [Filter: All ▼] [Sort ▼]    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  + Import New Video                                  │   │
│  │  Drop here or browse — MP4 · MOV · AVI · MKV        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  All Projects (12)                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ [thumb]  │  │ [thumb]  │  │ [thumb]  │  │ [thumb]  │   │
│  │ vlog.mp4 │  │ ep3.mp4  │  │ reel.mp4 │  │ clip.mp4 │   │
│  │ Editor   │  │ Clipping │  │ Caption  │  │ Editor   │   │
│  │ 2d ago   │  │ 5d ago   │  │ 1w ago   │  │ 2w ago   │   │
│  │ [⋯]      │  │ [⋯]      │  │ [⋯]      │  │ [⋯]      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Claude Prompt (Design)
```
Build src/screens/Projects.jsx — the import and projects manager screen for ClipAI.

Dark theme + ambient gradients. Full viewport. Padding 24px.

TOP BAR (52px, glass-panel border-bottom):
  Left: ← back icon + "Projects" Plus Jakarta Sans 600
  Right: "+ Import Video" gradient-primary button (violet→purple, rounded-full)

SEARCH + FILTER ROW (mt-4 flex gap-3):
  Search input: glass-input flex-1, Search icon prefix, placeholder "Search projects..."
  Filter dropdown: glass-input w-36, "All · Caption · Clipping · Editor"
  Sort dropdown: glass-input w-36, "Recent · Name · Size"

IMPORT CARD (mt-4, glass-card dashed-border rounded-2xl p-6 flex items-center gap-4,
  hover: glass-3 fill, border-violet/40, cursor-pointer):
  Left: Upload icon 36px in glass-card 52x52 rounded-xl, violet color
  Middle: "Import New Video" semibold 16px + "MP4 · MOV · AVI · MKV — up to 10GB" text-secondary
  Right: "Browse →" gradient-primary button rounded-full
  Drag-over state: border becomes rgba(124,92,252,0.6), bg tints violet

PROJECTS GRID (mt-6, CSS grid auto-fill minmax(200px,1fr), gap-4):
  Each project card (glass-card rounded-2xl overflow-hidden, cursor-pointer, flex-col):
    THUMBNAIL (aspect-video, relative):
      <img> or gradient placeholder (hue varies by name hash)
      Bottom overlay: duration badge (glass-card, bottom-right, text-xs Fira Code)
      Top-right: "⋯" menu icon button (glass-card 24x24, appears on hover)
        Dropdown menu (glass-panel shadow-xl, p-1 rounded-xl):
          "✎ Rename" | "🗑 Delete" | "↗ Export" items (each glass-card hover p-2 rounded-lg)
    CARD BODY (p-3 flex-col gap-1):
      Filename: semibold 13px white, single line truncate
      Meta row: mode badge pill (Caption/Clipping/Editor with matching colors) + date text-tertiary
      Progress/status: text-xs text-secondary (e.g. "5 clips generated" / "32 captions")
    CARD FOOTER (p-2 pt-0 flex gap-2):
      "Open" button: glass-card flex-1 h-8 text-sm
      Mode icon button: glass-card 32x32, shows the mode icon (scissors/subtitles/film)

RENAME INLINE: clicking "✎ Rename" on a card transforms the filename into an editable
glass-input, blur saves to localStorage.

DELETE CONFIRMATION: small glass modal (framer-motion scale entrance), "Delete {name}?" 
with Cancel + Delete (text-error) buttons.

EMPTY STATE (if no projects):
  Center of grid area: Upload icon 64px (text-tertiary), "No projects yet" h3,
  "Import your first video to get started" text-secondary,
  "+ Import Video" gradient-primary button

framer-motion: grid stagger entrance, card hover (scale 1.02, y -3px), menu dropdown spring.
Projects persisted in localStorage as JSON array: [{id, name, path, mode, created, metadata}].
```

---

## Screen 3 — Main Editor Page

### Description
The primary workspace — a full-featured timeline editor. CapCut-style multi-track timeline at the bottom, floating glass panels for video preview and properties. Caption button opens the Caption Page as an overlay/modal flow. Export button lives directly here, no separate page.

### Layout
```
┌────────────────────────────────────────────────────────────────────┐
│ ← Projects  |  vlog_raw.mp4  [Hindi ●]  |  [Save][Undo][Redo]  [↗ Export] │
├──────────────────────┬──────────────────────────┬──────────────────┤
│  TOOLS PANEL         │   VIDEO PREVIEW           │  PROPERTIES      │
│  (glass, 56px wide)  │   (center, 16:9)          │  (glass, 280px)  │
│                      │                           │                  │
│  [Split]             │   ┌─────────────────────┐ │  Layer / Clip    │
│  [Trim]              │   │                     │ │  Properties      │
│  [Crop]              │   │   [video frame]     │ │                  │
│  [Speed]             │   │                     │ │  Transform:      │
│  [Audio]             │   └─────────────────────┘ │  Scale / Pos     │
│  [Text]              │   [▶ 0:23 / 45:00] [vol]  │                  │
│  [Transition]        │                           │  Speed: 1x       │
│  [Caption ✦]         │                           │  Audio: ████░    │
│  [Resize]            │                           │                  │
│                      │                           │  [Caption ✦]     │
├──────────────────────┴──────────────────────────┴──────────────────┤
│  TIMELINE (multi-track, glass-panel, ~160px tall)                   │
│  V1 ─────────────[clip1]──────────────[clip2]─────────────         │
│  A1 ──────────[audio wave]────────────────────────────────         │
│  T1 ────────────[text overlay]─────────────                        │
│  C1 ──────[cap]──────[cap]──────[cap]──────                        │
│       ▐▌ (playhead)                                                │
└────────────────────────────────────────────────────────────────────┘
```

### Claude Prompt (Design)
```
Build src/screens/Editor.jsx — the main editor workspace for ClipAI.

Full viewport height. CSS Grid: 56px tools | 1fr center | 280px right. Bottom timeline: 160px.
Background: #060608 + ambient gradients.

TOP BAR (52px, glass-panel border-bottom):
  Left: ← back icon + filename chip (glass-card, truncated) + language badge pill
  Center (absolute centered): project name editable on click (glass-input when editing)
  Right: 
    [Save] [↩] [↪] icon buttons (glass-card 32x32 gap-1)
    Divider
    [✦ Caption] glass button (teal accent, Subtitles icon) — opens Caption Page
    [↗ Export] gradient-primary button (violet→purple, rounded-full)

LEFT TOOLS PANEL (glass-panel, flex-col items-center gap-1, py-3, border-right glass-border):
  Each tool button (40x40 glass-card rounded-xl, icon centered, tooltip on hover):
    Split (Scissors), Trim (Crop icon), Crop (Square), Speed (Gauge), Audio (Music),
    Text (Type), Transition (Shuffle), Caption ✦ (Subtitles, teal glow), Resize (Maximize)
  Active tool: glow-accent-sm, border-violet/60, bg rgba(124,92,252,0.12)
  Clicking a tool shows its property controls in the RIGHT PANEL

CENTER PANEL (overflow-hidden flex-col items-center justify-center gap-3 bg-black/20):
  Video preview wrapper:
    16:9 aspect ratio, max-h ~60% of panel, rounded-2xl overflow-hidden
    <video> absolute inset-0 object-contain bg-black
    Text overlay elements rendered as absolute positioned divs over video
    Crop/resize handles shown when crop tool active (draggable corner handles, violet)
  
  Playback controls bar (glass-panel rounded-2xl px-4 py-2 flex items-center gap-3, mt-2):
    Skip-back icon | Play/Pause icon (larger, glow on hover) | Skip-forward icon
    Time display: Fira Code 13px "0:23 / 45:00" text-secondary
    Volume slider (glass track, violet thumb, 80px wide)
    Fullscreen icon button

RIGHT PROPERTIES PANEL (glass-panel p-4 flex-col gap-4 overflow-y-auto border-left glass-border):
  Header: active tool name + close "✕" to deselect tool
  Default (no tool): "Clip Properties" — selected clip transform controls
  
  Each tool's property panel (shown when that tool active):
    TRIM: in/out time inputs (glass-input Fira Code), preview mini-timeline
    CROP: aspect ratio presets (1:1, 9:16, 16:9, free), visual crop box indicator  
    SPEED: speed slider 0.25x–4x, pitch correction toggle
    AUDIO: volume slider, fade in/out toggles, mute button
    TEXT: text input (glass-input), font family select, size slider, color picker (swatches),
           alignment buttons, animation preset picker
    TRANSITION: grid of transition thumbnails (fade, slide, zoom, wipe...), duration slider
    CAPTION ✦: shortcut button "Open Caption Editor →" (navigates to /captions)
    RESIZE: preset buttons (9:16, 16:9, 1:1, 4:5), custom W×H inputs
  
  Bottom: clip-level actions — "Duplicate" | "Delete" ghost buttons (text-error for delete)

TIMELINE (glass-panel, border-top glass-border, overflow-x-scroll):
  Track labels column (64px fixed left, flex-col):
    Each track row (40px tall, px-3 flex items-center justify-between):
      Track name "V1" "A1" "T1" "C1" (Fira Code text-xs text-secondary)
      Track controls: visibility eye icon + lock icon (both glass-card 20x20)
  
  Track content area (flex-1, relative, min-w-0):
    Scrollable horizontally. Scale: px per second, zoom level stored in state.
    Playhead: absolute, full height, 1.5px violet line + triangle handle top
    Click to seek.
    
    Each track row (40px tall, relative, border-bottom rgba(255,255,255,0.04)):
      V1 (video): clip blocks — glass-card rounded-md h-32px, bg gradient violet/20,
                  draggable left/right, resize handles on edges, thumbnail inside
      A1 (audio): waveform visualization blocks (rgba(0,212,255,0.4))
      T1 (text):  text overlay blocks (glass-card teal/20)
      C1 (captions): caption blocks (glass-card cyan/20), one per caption group
    
    Add track "+" button below last track (glass-card dashed, full width, h-8)
  
  Timeline controls bar (below tracks, flex items-center gap-3 px-3 py-1):
    Zoom: "−" slider "+" | "Fit" button | timecode display Fira Code

  DRAG/DROP: clips draggable across timeline (HTML5 drag or @dnd-kit). 
  SPLIT: when Split tool active + user clicks on a clip, splits it at playhead position.
  TRIM: drag clip edges to trim.

State: editorStore — selectedTool, clips[], audioTracks[], textLayers[], captionBlocks[],
currentTime, zoom, selectedClipId.

Use Tailwind + lucide-react + framer-motion (spring for panel transitions).
```

---

## Screen 4 — Caption Page

### Description
Opens from the Main Editor (via the Caption button). Two-column layout — phone preview left, caption list right. Workflow: edit captions → save → returns to Editor. Full CapCut caption editor feel.

### Layout
```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Editor   Caption Editor   [↺ Reset AI]  [✓ Save & Return] │
├───────────────────────────┬──────────────────────────────────────┤
│   PHONE PREVIEW (9:16)    │   CAPTION LIST                       │
│                           │                                      │
│   ┌──────────────────┐    │   [✦ Generate Captions]              │
│   │  [video]         │    │   ─────────────────────              │
│   │                  │    │   ┌──────────────────────────────┐   │
│   │  "aapko"         │    │   │ ● 0:00.0 → 0:04.2   [2.4s]  │   │
│   │  (glow word)     │    │   │   "Aaj main aapko"           │   │
│   └──────────────────┘    │   │   [−0.1] start 0.0 [+0.1]   │   │
│                           │   └──────────────────────────────┘   │
│   Style: [NeonPop ▼]      │   ┌──────────────────────────────┐   │
│   [◀ Prev]   [Next ▶]     │   │   0:04.2 → 0:07.8  [3.6s]   │   │
│   [▶ Play] 0:02 / 0:47    │   │   "batana chahta hun"        │   │
│                           │   └──────────────────────────────┘   │
│   Font  Color  Position   │                                      │
│   [controls below]        │   [+ Add caption at 0:07.8s]        │
├───────────────────────────┴──────────────────────────────────────┤
│  [↺ Reset to AI]                          [✓ Save & Return →]   │
└──────────────────────────────────────────────────────────────────┘
```

### Claude Prompt (Design)
```
Build src/screens/CaptionEditor.jsx — the caption editing page for ClipAI.
Opened from Main Editor. On save: returns to /editor with updated captions.

Layout: 44% left | 56% right. Full viewport. Dark bg + ambient gradients.

TOP BAR (52px, glass-panel border-bottom):
  Left: ← "Back to Editor" (glass button, arrow icon)
  Center: "Caption Editor" Plus Jakarta Sans 600 + clip name chip (glass-card sm)
  Right: "↺ Reset AI" ghost button (text-warning) | "✓ Save & Return" gradient-primary rounded-full

LEFT COLUMN (flex-col items-center justify-center gap-4 px-6):
  Phone preview wrapper (max-w-[220px] w-full aspect-[9/16] relative):
    Outer glow: box-shadow 0 0 60px rgba(124,92,252,0.2)
    <video> absolute inset-0 rounded-2xl object-cover
    Caption overlay (CaptionOverlay component) bottom-[15%]
    Device frame border: 1px solid rgba(255,255,255,0.12) rounded-2xl
  
  Style controls bar (glass-panel rounded-2xl p-3 w-full max-w-[220px] flex-col gap-2):
    Row 1: Style dropdown (glass-input full width, 5 presets)
    Row 2: Prev/Next caption buttons (text-sm ghost) + play/pause + time (Fira Code 12px)
    Row 3: Font size mini-slider, color swatch row (6 preset colors + custom picker)
    Row 4: Position toggle — Bottom / Middle / Top (segmented glass control)
  
  "✦ Generate Captions" button if no captions exist:
    Full width gradient-primary rounded-xl h-10, Sparkles icon
    Clicking calls groq.transcribeAudio flow, shows inline loading state

RIGHT COLUMN (flex-col p-4 gap-3 overflow-y-auto custom scrollbar):
  If no captions: centered empty state with ✦ icon + "Click Generate Captions to start"

  Caption cards list (flex-col gap-2):
    Each card (glass-card p-3 rounded-xl framer-motion layout):
      ROW 1: colored dot (active=violet glow) + time range Fira Code 12px text-secondary
              + duration badge + pencil icon + trash icon (on hover)
      ROW 2: caption text — click to edit (becomes textarea glass-input auto-height)
      ROW 3 (edit mode, framer-motion height animation):
        Start: [−0.1s] value [+0.1s] | End: [−0.1s] value [+0.1s]
        Buttons: glass-card 24x24, ±0.1s per click
      
      ACTIVE CARD (currentTime in range):
        border-left: 2px solid #7c5cfc + rgba(124,92,252,0.08) bg
        Auto scrollIntoView on currentTime change
    
    "+ Add caption at {currentTime}s" (glass-card dashed full width rounded-xl mt-1)

BOTTOM BAR (glass-panel h-14 px-6 border-top flex justify-between items-center):
  "↺ Reset to AI captions" — text-warning, AlertTriangle icon, confirm modal before action
  "✓ Save & Return →" — gradient-primary rounded-full
    On click: saves captionGroups back to store, navigate('/editor')

framer-motion: card list stagger, active card border spring, edit mode height expansion.
```

---

## Screen 5 — Clipping / Shorts Page

### Description
AI-powered shorts generator. User picks a video, AI simultaneously generates clips AND captions. All generated shorts appear as a gallery. Each short can be opened in the Main Editor or exported directly. Bulk export supported.

### Layout
```
┌──────────────────────────────────────────────────────────────────┐
│  ← Projects   AI Shorts   [Style ▼]  [Select All]  [↗ Export All]│
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ [THUMB]  │  │ [THUMB]  │  │ [THUMB]  │  │ [THUMB]  │         │
│  │ ★ 9.2  ✓ │  │ ★ 8.7  ✓ │  │ ★ 7.1   │  │ ★ 6.3   │         │
│  │ "Hook"   │  │ "Moment" │  │ "Bit"   │  │ "Quote" │         │
│  │ 0:45     │  │ 0:52     │  │ 0:38    │  │ 0:51    │         │
│  │ [▶][✎][↗]│  │ [▶][✎][↗]│  │ [▶][✎][↗]│  │ [▶][✎][↗]│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│  ...                                                             │
├──────────────────────────────────────────────────────────────────┤
│  4 selected  [Deselect All]               [↗ Export Selected (4)]│
└──────────────────────────────────────────────────────────────────┘
```

### Claude Prompt (Design)
```
Build src/screens/ClipsReview.jsx — AI clips/shorts generator page for ClipAI.

Full viewport dark bg + ambient gradients.
On mount: if clips[] empty in store → auto-call generateClips(videoPath, onStatus).

TOP BAR (52px, glass-panel border-bottom):
  Left: ← back + "{N} AI Shorts" Plus Jakarta Sans 600 + AI sparkle badge (teal)
  Center: Style dropdown (glass-input 160px) — applies caption preview style to all cards
  Right: "Select All" ghost button | "↗ Export All" gradient-primary button

LOADING STATE (full screen centered, AbsoluteCenter):
  Spinning ring: conic-gradient #7c5cfc→#00d4ff, 64px, CSS animation spin
  Status text: current pipeline step, Plus Jakarta Sans 500 16px white
  Pipeline progress pills (4 pills, flex row, glass-card each):
    [✦ Extracting Audio] → [Transcribing] → [AI Analysis] → [Cutting Clips]
    Active pill: glow-accent-sm, gradient-text
    Completed: checkmark icon, success color

LOADED STATE:
  GRID (auto-fill minmax(190px,1fr) gap-4 p-6):
    Each clip card (glass-card rounded-2xl overflow-hidden cursor-pointer):
      THUMBNAIL AREA (aspect-[9/16] relative):
        <img> or gradient placeholder (hue = 240 + index*35 degrees)
        
        TOP-LEFT: Score badge (pill glass-card px-2 py-0.5 text-xs font-bold):
          ≥8 → gradient bg green→teal
          6-7 → gradient bg orange→yellow
          <6 → gradient bg red→orange
          "✦ {score}"
        
        TOP-RIGHT: Checkbox (22x22 rounded-md):
          Unselected: glass-card border glass-border-strong
          Selected: bg violet, checkmark, glow-accent-sm (framer spring)
        
        CAPTION PREVIEW (bottom 30%, dark gradient overlay):
          Mini caption text preview (styled per selectedStyle, tiny)
        
        BOTTOM INFO OVERLAY (h-2/5 gradient black):
          Title: Plus Jakarta Sans 600 13px white 2-line clamp
          Row: duration (Fira Code text-xs) + language badge pill
          Hook text: text-xs text-tertiary 1-line truncate
        
        SELECTED: border 1.5px rgba(124,92,252,0.8), glow-accent-sm
      
      CARD ACTIONS (p-2 flex gap-1):
        "▶ Preview" (glass-card flex-1 h-8 text-xs)
        "✎ Edit" (glass-card flex-1 h-8 text-xs) → setActiveClip + navigate('/editor')
        "↗" export icon button (glass-card 32x32) → single clip export modal
    
    Hover: scale(1.03) y(-4px) glow shadow increase

  PREVIEW MODAL (AnimatePresence):
    Backdrop: fixed inset-0 bg-black/60 backdrop-blur-sm
    Card: glass-panel w-80 rounded-3xl p-4 flex-col items-center (scale 0.92→1 spring)
    Phone preview (w-full aspect-[9/16] relative rounded-2xl overflow-hidden):
      <video> + CaptionOverlay
      Outer glow rgba(124,92,252,0.25)
    Style segmented control (5 options, active pill slides, glass-panel)
    "✎ Open in Editor →" gradient-primary full width rounded-full mt-3
    "↗ Export this clip" glass-card full width rounded-full
    "✕" close ghost button text-tertiary

  SINGLE EXPORT MODAL (AnimatePresence):
    Small glass-panel modal centered:
      Format/Quality radio cards (compact), "↗ Export" gradient-primary button
      Progress bar + WebSocket progress if exporting

BOTTOM FIXED BAR (glass-panel h-14 border-top px-6 flex items-center justify-between):
  Left: "{N} selected" Plus Jakarta Sans 500 + "Select All" · "Deselect All" ghost text buttons
  Right: "↗ Export Selected ({N})" gradient-primary rounded-full, disabled if N=0

EXPORT ALL flow:
  Opens an Export Settings bottom sheet (framer-motion slide up from bottom):
    Format / Quality / Resolution compact radio groups
    "↗ Start Bulk Export" button
    Progress: shows per-clip progress list inline in the sheet
    On complete: "All done! {N} clips exported" + close

"✎ Edit" on any card: setActiveClip(id) → navigate('/editor') — editor loads that clip as
its video source, retaining all generated captions in store.captionGroups.

framer-motion: grid stagger, card hover spring, modal entrance, selection spring.
```

---

## Export Modal / Sheet (inline on Editor + Clipping pages)

### Description
No separate Export screen. Instead, a bottom sheet or modal triggered from the Export button on the Editor or individual/bulk export on the Clipping page.

### Claude Prompt (Design)
```
Build src/components/ExportSheet.jsx — a bottom sheet component for export.

Triggered by: Export button on Editor, single clip export on Clipping page, bulk export on Clipping page.

Props: clips[] (array of clip objects to export), onClose, onComplete

BOTTOM SHEET (framer-motion, slides up from bottom):
  Backdrop: fixed inset-0 bg-black/50 backdrop-blur-sm
  Sheet: fixed bottom-0 left-0 right-0 max-h-[80vh], glass-panel rounded-t-3xl p-6
  Drag handle bar at top center (32x4px, rounded, rgba(255,255,255,0.2))

  IDLE STATE (settings):
    Header: "Export {N} clip(s)" Plus Jakarta Sans 700 20px + ✕ close
    
    Two-column settings (gap-6):
      Left:
        Format: compact radio cards — MP4 H.264 (default) · H.265 · WebM
        Quality: compact radio cards — High · Medium · Low with CRF labels
        Resolution: compact radio cards — Original · 1080×1920 (Reels) · 720×1280 · 1080×1080
      Right:
        Captions: segmented control — Burn In · SRT · Both · None
        Font Size (if Burn In): mini slider 40–120px
        Clips list (scrollable): each row thumbnail + name + duration + status "Ready"
    
    "↗ Start Export" gradient-primary full width h-12 rounded-2xl mt-4

  EXPORTING STATE (replaces settings):
    Each clip row: thumbnail + name + progress bar (gradient violet→cyan, shimmer) + %
    Overall progress at top: larger bar + "{N} / {total} clips"
    FFmpeg log (collapsible glass-card, Fira Code 11px green terminal text)
    "✕ Cancel" text-error ghost button

  COMPLETE STATE (framer-motion entrance):
    Animated SVG checkmark (stroke-dashoffset animation, green)
    "Export Complete!" 24px bold
    File list: name + size + copy-path icon
    "✓ Done" glass button → onComplete() → sheet closes
    
Sheet closes on backdrop click or ✕. 
Progress via WebSocket (api.onJobProgress).
```

---

## Component Prompts

### Caption Overlay Component

```
Build src/components/CaptionOverlay.jsx

Props: words[], currentTime, stylePreset, videoWidth, videoHeight

Logic:
- Determine active word and current line (4-5 words) from currentTime
- Highlight active word per style
- Animate line transition: old line exits up, new line enters from below

Style implementations (CSS only):
1. NeonPop — Bangers font, white, black stroke text-shadow, active word #FFE000 + glow
2. HinglishFire — Anton font, gradient text orange→red, active word scale(1.15) + glow
3. BoldDevanagari — Noto Sans Devanagari, white on black pill bg rgba(0,0,0,0.75)
4. CleanMinimal — Montserrat 600, white, subtle shadow, violet active word
5. ReelBold — Impact all-caps, white -webkit-text-stroke black, active word CSS shake keyframe

Position: absolute bottom-[15%] left-0 right-0 flex justify-center px-4
Use framer-motion AnimatePresence for line enter/exit.
```

### Style Picker Component

```
Build src/components/StylePicker.jsx

Props: selectedStyle, onChange

Compact horizontal scrollable row of 5 mini style preview cards.
Each card (58x94px, glass-card, rounded-xl, flex-col):
  Top (68px): 9:16 mini caption preview (CSS only, fake caption text in that style, font-size 9px)
  Bottom (26px): style name text-[10px] text-center

Selected: border-violet/80 glow-accent-sm bg rgba(124,92,252,0.12) name text-primary
framer-motion whileTap scale(0.95), whileHover scale(1.04).
```

---

## Screen Flow Diagram

```
Home (/)
    │
    ├──→ Caption card → Import (/import?mode=caption) → Editor (/editor)
    │                                                       └──→ Caption Page (/captions) → back to Editor
    │
    ├──→ Clipping card → Import (/import?mode=clips) → Clipping Page (/clips)
    │                                                       ├──→ Edit → Editor (/editor)
    │                                                       └──→ Export (ExportSheet component)
    │
    └──→ Editor card → Import (/import?mode=editor) → Editor (/editor)
                                                           ├──→ Caption Page (/captions) → back to Editor
                                                           └──→ Export (ExportSheet component)

Projects Page (/projects):
    ├──→ Any project card → resumes at its last screen
    └──→ Import new → same as above
```

---

## Global CSS

```css
body {
  background: #060608;
  min-height: 100vh;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #f0f0f5;
}
body::before {
  content: ''; position: fixed; inset: 0; z-index: -1;
  background:
    radial-gradient(ellipse 80% 50% at 20% -10%, rgba(124,92,252,0.12) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 110%, rgba(0,212,255,0.08) 0%, transparent 55%);
}
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(124,92,252,0.4); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: rgba(124,92,252,0.7); }
.glass-panel { background: rgba(255,255,255,0.04); backdrop-filter: blur(20px) saturate(180%); border: 1px solid rgba(255,255,255,0.10); border-radius: 16px; }
.glass-card { background: rgba(255,255,255,0.07); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.10); border-radius: 12px; }
.glass-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; backdrop-filter: blur(8px); color: #f0f0f5; outline: none; }
.glass-input:focus { border-color: rgba(124,92,252,0.6); box-shadow: 0 0 0 3px rgba(124,92,252,0.15); }
.glow-accent { box-shadow: 0 0 20px rgba(124,92,252,0.35), 0 0 40px rgba(124,92,252,0.15); }
.glow-accent-sm { box-shadow: 0 0 10px rgba(124,92,252,0.35); }
.gradient-text { background: linear-gradient(135deg, #7c5cfc, #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
@keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
.shimmer { background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
```

## Tailwind Config

```js
module.exports = {
  theme: { extend: {
    colors: { accent: '#7c5cfc', 'accent-2': '#00d4ff', 'accent-teal': '#00f5c4' },
    fontFamily: {
      display: ['"Space Grotesk"', 'sans-serif'],
      body: ['"Plus Jakarta Sans"', 'sans-serif'],
      mono: ['"Fira Code"', 'monospace'],
    },
    boxShadow: {
      glow: '0 0 20px rgba(124,92,252,0.35), 0 0 40px rgba(124,92,252,0.15)',
      'glow-sm': '0 0 10px rgba(124,92,252,0.35)',
    },
    backgroundImage: {
      'gradient-accent': 'linear-gradient(135deg, #7c5cfc, #9b7dff)',
      'gradient-teal': 'linear-gradient(135deg, #00d4ff, #00f5c4)',
    }
  }}
}
```
