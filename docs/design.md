# ClipAI Design Document

## Summary
ClipAI delivers a glassmorphism-first, deep-space dark video editor with AI-assisted captioning and short-form clipping. The UI prioritizes creator flow, minimal distraction, and neon-accented calls to action. The current experience is centered on five screens—Home, Projects, Editor, CaptionEditor, and ClipsReview—connected by mode-based import and editor-driven workflows.

## Current State

### Principles
- **Glassmorphism depth**: layered translucent surfaces floating over ambient gradients.
- **Creator-first workflow**: minimal navigation, task-forward CTAs.
- **Neon accents**: violet/cyan/teal highlights for primary actions and AI moments.
- **High-contrast readability**: light text on deep black base.
- **Tactile motion**: subtle hover lift, glow, and staggered entrances.

### Design System
**Color tokens (core)**
- Base: `#060608` with violet/cyan radial gradients.
- Glass surfaces: `rgba(255,255,255,0.04–0.07)` with `rgba(255,255,255,0.10)` borders.
- Accents: Violet `#7c5cfc`, Cyan `#00d4ff`, Teal `#00f5c4`.
- Text: Primary `#f0f0f5`, Secondary `rgba(240,240,245,0.55)`.

**Typography**
- Display/Logo: **Space Grotesk**
- UI/Body: **Plus Jakarta Sans**
- Mono: **Fira Code**
- Caption styles: **Bangers**, **Anton**, **Montserrat**, **Noto Sans Devanagari**

**Global utilities**
- `.glass-panel`, `.glass-card`, `.glass-input`
- `.glow-accent`, `.glow-accent-sm`, `.gradient-text`, `.shimmer`
- Radius: 8/12/16px (inputs/cards/panels), pills: 999px

**Motion**
- Framer Motion for hover lift, subtle scale, and staggered entrances.

### Screens
**Home (/)**  
Hero cards for Caption/Clipping/Editor, Recent Projects list, Continue Editing carousel, top bar with Save/Undo/Redo.

**Projects (/projects)**  
Import hub for local file or YouTube/URL, search/filter/sort, project grid, rename/delete flows, back to Home.

**Editor (/editor)**  
Primary workspace with tools panel, preview, properties, timeline, caption CTA, and export sheet.

**CaptionEditor (/captions)**  
Phone preview + caption list, generate/re-caption, style presets, save & return to editor.

**ClipsReview (/clips)**  
AI shorts generation, clip grid, style preset, select/export, preview modal, edit in editor.

## Gaps/Decisions
- Unify naming: **Clipping** vs **Clips Review** vs **AI Shorts**.
- Define shared empty/error/processing patterns across import, AI, and export flows.
- Standardize top bar structure and breadcrumb hierarchy across screens.
- Decide responsive collapse rules for Editor panels at smaller widths.
- Confirm Editor access without an active project (currently redirects to Projects).

## Near-term Roadmap
1. Normalize top bar components and button styles across screens.
2. Formalize shared tokens for badges, cards, and CTA gradients.
3. Add consistent loading/processing overlays for AI and export tasks.
4. Improve responsive layouts (collapsible tools/panels).
5. Accessibility pass: contrast checks, focus states, keyboard parity.

## Out of Scope
- Authentication, team collaboration, or cloud sync.
- Native mobile UI redesign.
- Plugin marketplace or template store.
- Realtime multi-user editing.

## Appendix

### Routes
- `/` — Home
- `/projects` — Projects & Import
- `/editor` — Main Editor
- `/captions` — Caption Editor
- `/clips` — AI Clips Review

### Screen Flow Map
```mermaid
flowchart LR
  Home["Home /"] -->|Select mode| Projects["Projects /projects?mode=..."]
  Home -->|View All / Continue Editing| Projects
  Projects -->|Import or Resume (caption/editor)| Editor["Editor /editor"]
  Projects -->|Import or Resume (clips)| Clips["ClipsReview /clips"]
  Editor -->|Open Caption Editor| Captions["CaptionEditor /captions"]
  Captions -->|Save & Return| Editor
  Editor -->|Back to Projects| Projects
  Clips -->|Edit clip in Editor| Editor
  Clips -->|Back to Projects| Projects
  Editor -->|Export Sheet| Export["ExportSheet (modal)"]
  Clips -->|Export Sheet| Export
```
