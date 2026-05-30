
# ClipAI

ClipAI is a local-first AI video editor for creating short-form social videos quickly. It combines an interactive multi-track timeline with AI-powered features: auto-captions, viral-clip extraction, and a transition template engine.

## Key Features
- Auto-generated, word-level captions with stylized burn-in presets
- AI Shorts Generator: extracts and ranks viral moments
- Transition Reel Clone: reverse-engineer trending templates and swap media
- Desktop-class multi-track timeline with trimming, speed, and transforms
- Local FFmpeg-backed export with live WebSocket progress

## Project Structure
- `server/` — Express backend, FFmpeg wrappers, file APIs
- `src/` — React + Vite frontend, screens and components
- `temp/` — Local temporary media files (ignored by git)

## Prerequisites
- Node.js (18.x or 20.x LTS)
- FFmpeg (system install recommended; `ffmpeg -version` should work)
- Git (optional)
- Recommended: 16GB RAM and sufficient disk space for media files

See `prerequisite.md` for full details on fonts, environment variables, and OS-specific notes.

## Quickstart (development)

```powershell
# from project root
npm install
cd server && npm install
cd ..
# create .env with your Groq API key (VITE_GROQ_API_KEY=...)
npm run dev
# or run frontend and server separately per package.json scripts
```

Server: http://localhost:3001
App:    http://localhost:5173

## Configuration
- Place API keys in a `.env` file (ignored by git). Example: `VITE_GROQ_API_KEY=your_key`
- Install caption fonts into `public/fonts/` (see `prerequisite.md` for required TTFs).

## How it Works (high level)
- Frontend (React + Zustand) manages UI and editing state;
- Backend (Express) spawns FFmpeg for heavy video operations and streams progress by WebSockets;
- AI calls (Groq) are used for transcription and clip analysis; audio is extracted locally and sent to the API.

## Useful Commands
- `npm run dev` — start frontend dev server
- `node server/index.js` — start local Express server
- `npm run build` — build frontend for production
- `npm run start` — run production server (if configured)

## Notes & Gotchas
- Add `.env` and `temp/` are ignored by git.
- Ensure `Noto Sans Devanagari` is present in `public/fonts/` for Hindi captions.
- Groq Whisper has a 25MB audio limit — long videos must be chunked.

## Contributing
- Open issues or PRs. Follow repository coding standards and run linters/tests before submitting.

## License
MIT

