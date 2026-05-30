# AI Video Editor — Prerequisites (V1)
> Web App + Local Express Server stack
> No Electron, no packaging — just run in your browser

---

## 1. System Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| OS | Windows 10, macOS 12, Ubuntu 20.04 | Windows 11 / macOS 14 |
| RAM | 8GB | 16GB+ |
| Storage | 5GB free | 50GB+ (video files are large) |
| GPU | Not required | Any (FFmpeg uses it for faster encoding if available) |
| Internet | Required for Groq API | Stable broadband |
| Browser | Chrome 110+ / Edge 110+ | Chrome latest |

---

## 2. Software to Install

### Node.js
- **Version**: 18.x or 20.x LTS
- **Download**: https://nodejs.org/en/download
- **Why not 21+?**: Minor compatibility issues with some npm packages; stick to LTS
- **Verify after install**:
  ```bash
  node --version   # → v18.x.x or v20.x.x
  npm --version    # → 9.x or 10.x
  ```

### FFmpeg
The only native binary you need. All video operations run through it.

**Windows:**
```bash
# Option 1 — Chocolatey (easiest, if you have it):
choco install ffmpeg

# Option 2 — Scoop:
scoop install ffmpeg

# Option 3 — Manual:
# 1. Go to https://www.gyan.dev/ffmpeg/builds/
# 2. Download ffmpeg-release-essentials.zip
# 3. Extract to C:\ffmpeg\
# 4. Add C:\ffmpeg\bin to Windows PATH (System → Advanced → Environment Variables)
```

**macOS:**
```bash
brew install ffmpeg
# If no Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install ffmpeg
```

**Verify:**
```bash
ffmpeg -version    # → ffmpeg version 5.x or 6.x
ffprobe -version   # → same version
```

> **Note**: The project also uses `ffmpeg-static` npm package as a fallback binary,
> but having system FFmpeg is cleaner and faster. If system FFmpeg is installed,
> the Express server will use it directly.

### Git (optional but recommended)
```bash
# Windows: https://git-scm.com/download/win
# macOS:   brew install git
# Linux:   sudo apt install git
```

---

## 3. npm Packages (Reference)

These are installed automatically via `npm install`. Listed here so you know what's coming.

### Frontend (root package.json)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "zustand": "^4.4.7",
    "immer": "^10.0.3",
    "framer-motion": "^10.18.0",
    "lucide-react": "^0.303.0",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "vite": "^5.0.8",
    "@vitejs/plugin-react": "^4.2.1",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16",
    "concurrently": "^8.2.2"
  }
}
```

### Backend (server/package.json)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "fluent-ffmpeg": "^2.1.2",
    "ffmpeg-static": "^5.2.0",
    "ffprobe-static": "^3.1.0",
    "dotenv": "^16.3.1",
    "ws": "^8.16.0",
    "uuid": "^9.0.0"
  }
}
```

**Total node_modules size**: ~350–500MB (most of it is ffmpeg-static binary)

---

## 4. Fonts to Download

Download these and place in `public/fonts/` in your project. They're used to burn captions into video via FFmpeg (not just CSS — the actual TTF files need to be on disk).

### Caption Fonts (required for burning into video)

| Font | Style | Download URL | Filename needed |
|---|---|---|---|
| Bangers | NeonPop style | https://fonts.google.com/specimen/Bangers | `Bangers-Regular.ttf` |
| Anton | HinglishFire style | https://fonts.google.com/specimen/Anton | `Anton-Regular.ttf` |
| Noto Sans Devanagari | Hindi captions ⚠️ | https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari | `NotoSansDevanagari-Bold.ttf` |
| Montserrat | CleanMinimal style | https://fonts.google.com/specimen/Montserrat | `Montserrat-Bold.ttf` |
| Impact | ReelBold style | System font (pre-installed) | `impact.ttf` |

**How to download from Google Fonts:**
1. Go to the URL
2. Click "Download family" (top right)
3. Unzip → find the `.ttf` file you need
4. Copy to `public/fonts/`

**Impact on Linux** (not pre-installed):
```bash
sudo apt install ttf-mscorefonts-installer
# Then find it at: /usr/share/fonts/truetype/msttcorefonts/Impact.ttf
# Copy to your public/fonts/impact.ttf
```

**⚠️ Critical — Noto Sans Devanagari:**
Without this font, Hindi text in burned captions will appear as empty boxes/squares.
This is the most commonly missed step. Download it even if you primarily make English content.

### Font Directory After Setup
```
clipai/
└── public/
    └── fonts/
        ├── Bangers-Regular.ttf
        ├── Anton-Regular.ttf
        ├── NotoSansDevanagari-Bold.ttf
        ├── Montserrat-Bold.ttf
        └── impact.ttf
```

### UI Fonts (loaded from CDN — no download needed)
These load automatically from Google Fonts when the app runs in the browser:
- **Syne** — app headers and logo
- **DM Sans** — all body text and UI
- **JetBrains Mono** — timestamps and code

---

## 5. API Keys

### Groq API Key
- **Sign up**: https://console.groq.com (free account)
- **Free tier limits**:
  - Whisper: ~7,000 requests/day, max 25MB per audio file
  - LLaMA 3.3 70B: 14,400 req/day, 6,000 tokens/min
- **Models used**:
  - `whisper-large-v3-turbo` — transcription (fast + accurate)
  - `llama-3.3-70b-versatile` — clip detection AI
- **Where to put it**:
  ```bash
  # In project root, create .env file:
  VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
  ```
- ⚠️ `VITE_` prefix is required — Vite only exposes env vars with this prefix to the browser
- ⚠️ Add `.env` to `.gitignore` immediately

---

## 6. Full Setup Steps (in order)

```bash
# 1. Verify prerequisites
node --version      # v18 or v20
npm --version       # 9 or 10
ffmpeg -version     # 5.x or 6.x

# 2. Create project (Scaffold Prompt 1 will give you all the files,
#    but here's the init command to run first)
mkdir clipai && cd clipai

# 3. After Prompt 1 gives you package.json files, install deps:
npm install                    # frontend deps
cd server && npm install       # backend deps
cd ..

# 4. Create .env in project root
echo "VITE_GROQ_API_KEY=your_key_here" > .env

# 5. Create fonts directory and add fonts
mkdir -p public/fonts
# (manually copy TTF files here)

# 6. Run the app
npm run start
# → Server: http://localhost:3001
# → App:    http://localhost:5173

# 7. Open in browser: http://localhost:5173
```

---

## 7. Verifying Each Piece Works

Run these checks before building the app screens:

**FFmpeg works:**
```bash
ffmpeg -i your_test_video.mp4 -vn -ar 16000 -ac 1 test_audio.mp3
# Should produce test_audio.mp3
```

**Groq transcription works:**
```bash
# Quick test (paste in browser console after app starts):
const fd = new FormData()
fd.append('file', await fetch('http://localhost:3001/temp/test_audio.mp3').then(r => r.blob()), 'audio.mp3')
fd.append('model', 'whisper-large-v3-turbo')
fd.append('response_format', 'verbose_json')
const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
  method: 'POST',
  headers: { Authorization: 'Bearer YOUR_KEY_HERE' },
  body: fd
})
console.log(await r.json())
```

**Express server works:**
```bash
# After npm run start:
curl http://localhost:3001/api/ffmpeg/info \
  -X POST -H "Content-Type: application/json" \
  -d '{"videoPath": "/absolute/path/to/test.mp4"}'
# Should return JSON with video metadata
```

---

## 8. Groq File Size Limit Handling

Groq Whisper accepts max **25MB** audio files. For long videos:

| Video Length | Audio Size (approx) | Action needed |
|---|---|---|
| < 30 min | < 25MB | ✅ Works directly |
| 30–90 min | 25–75MB | ⚠️ Need to chunk audio |
| > 90 min | > 75MB | ⚠️ Must chunk |

For V1 (personal use), chunking isn't implemented yet. If your video is long:
- Extract audio with FFmpeg → check file size
- If > 25MB: manually split with `ffmpeg -ss 0 -t 1800 -i audio.mp3 part1.mp3` etc.
- Future V2 feature: auto-chunking with transcript stitching

---

## 9. Known Gotchas

| Gotcha | Solution |
|---|---|
| `VITE_GROQ_API_KEY` not loading | Must have `VITE_` prefix; restart dev server after editing `.env` |
| Groq returns 429 | Rate limit hit — add delays or reduce request frequency |
| FFmpeg burns empty captions | .ass file is malformed — test it in VLC first |
| Hindi renders as boxes | Missing Noto Sans Devanagari font in `public/fonts/` |
| Video can't be served in browser | Check server/index.js serves `/temp/*` statically |
| CORS error from browser | Express server must have `cors({ origin: 'http://localhost:5173' })` |
| `ffmpeg-static` vs system FFmpeg | `fluent-ffmpeg` uses system FFmpeg if on PATH; `ffmpeg-static` is fallback |
| Large video upload hangs | Multer default limit is 1MB — set `limits: { fileSize: 4 * 1024 * 1024 * 1024 }` |
| WebSocket not connecting | Both frontend and backend must be running; check port 3001 is free |

---

## 10. VS Code Extensions (Optional but Helpful)

- **ES7+ React/Redux Snippets** — component shortcuts
- **Tailwind CSS IntelliSense** — autocomplete for classes
- **Prettier** — auto-format on save
- **Thunder Client** — test Express API endpoints without leaving VS Code
