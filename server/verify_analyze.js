const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error("VITE_GROQ_API_KEY is not defined in your .env file!");
  process.exit(1);
}

const testVideoPath = path.resolve(path.join(__dirname, '..', 'temp', 'youtube_test.mp4'));
if (!fs.existsSync(testVideoPath)) {
  console.error(`Test video not found at: ${testVideoPath}`);
  process.exit(1);
}

// Check if port is in use helper
const isPortInUse = (port) => {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
};

async function run() {
  let serverProcess = null;
  const port = 3001;

  console.log('Checking if server is running on port 3001...');
  const inUse = await isPortInUse(port);
  if (!inUse) {
    console.log('Starting local Express server on port 3001...');
    serverProcess = spawn('node', ['server/index.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    // Wait for server to boot
    await new Promise(resolve => setTimeout(resolve, 3000));
  } else {
    console.log('Server is already running on port 3001.');
  }

  try {
    console.log(`\nSending POST /api/transitions/analyze for: ${testVideoPath}...`);
    const response = await fetch(`http://localhost:${port}/api/transitions/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: testVideoPath })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Analyze request failed: Status ${response.status}, Body: ${errText}`);
    }

    const result = await response.json();
    console.log('\n✓ Analysis completed successfully!');
    console.log(`Total Duration: ${result.totalDuration}s`);
    console.log(`FPS: ${result.fps}`);
    console.log(`Resolution: ${result.resolution.width}x${result.resolution.height}`);
    console.log('Signals extracted:', {
      cutsCount: result.signals.cuts.length,
      freezesCount: result.signals.freezes.length,
      speedSamplesCount: result.signals.speedSamples.length,
      overlayEventsCount: result.signals.overlayEvents.length,
      beatTimestampsCount: result.signals.beatTimestamps.length
    });

    // Invoke Llama-3.3-70b-versatile via Groq using the prompt template
    console.log('\nCalling Groq Llama-3.3 model to reverse-engineer transition technique...');

    const systemPrompt = `You are an expert short-form video editor who can reverse-engineer any video transition technique just from its technical signal data.`;

    const userPrompt = `I analyzed a trending video and extracted these raw signals:

Total duration: ${result.totalDuration}s
FPS: ${result.fps}

Cut timestamps (scene changes): ${JSON.stringify(result.signals.cuts.map(c => c.timestamp))}

Freeze windows: ${JSON.stringify(result.signals.freezes)}

Frame difference samples (0=frozen, high=fast motion):
${JSON.stringify(result.rawFrameDiffs)}

Overlay events (region of screen that suddenly changed independently):
${JSON.stringify(result.signals.overlayEvents)}

Beat timestamps: ${JSON.stringify(result.signals.beatTimestamps)}

---

Based on these signals, do the following:

TASK 1 — Identify the primary technique of this video.
Choose the ONE that best describes it (or "hybrid" if multiple):
- "slideshow_cuts": simple photos/clips cut to beat, no special effects
- "freeze_overlay": video freezes, photos appear as overlays on top
- "speed_ramp": video speeds up and slows down dramatically  
- "freeze_resume": video plays, pauses, photos shown, video resumes
- "text_reveal": content appears word by word or element by element
- "zoom_transitions": each clip zooms in/out to transition to next
- "whip_pan": fast directional motion between clips
- "layered_composite": multiple elements layered simultaneously
- "hybrid": combination — describe which ones

TASK 2 — Build a SLOT TIMELINE.
A slot is one "beat" in the template where the user needs to provide a photo or clip.
For each slot provide:
{
  slotIndex: number,
  type: "photo" | "video_clip" | "text" | "background_video",
  startTime: number,
  endTime: number, 
  duration: number,
  layer: "background" | "overlay" | "foreground",
  position: "full" | "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center",
  animationIn: "none" | "slide_left" | "slide_right" | "slide_up" | "slide_down" | "zoom_in" | "zoom_out" | "fade" | "spin" | "flip",
  animationDuration: number,
  beatSynced: boolean,
  notes: string
}

TASK 3 — Identify any BACKGROUND elements that persist across slots.
{ 
  hasBackground: boolean, 
  backgroundType: "none" | "original_video" | "solid_color" | "blurred_video",
  backgroundVideoStart: number,
  backgroundVideoEnd: number
}

TASK 4 — Identify speed ramp segments if any.
[{ start: number, end: number, speedFactor: number }]
speedFactor: 0.5 = slow-mo, 2.0 = 2x speed, etc.

TASK 5 — Write a plain English description of the technique for the user to see.
Example: "The background video plays normally until 3.2s, then freezes. 5 photos slide in from the right one by one (0.3s apart), stacking on the frozen frame. At 6.8s the video resumes at normal speed."

Respond ONLY with valid JSON, no markdown, no explanation outside the JSON:
{
  "technique": string,
  "techniqueDescription": string,
  "slots": [...],
  "background": {...},
  "speedRamps": [...],
  "totalSlots": number,
  "requiresBackgroundVideo": boolean
}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 4000,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!groqRes.ok) {
      const groqErr = await groqRes.text();
      throw new Error(`Groq API request failed: Status ${groqRes.status}, Body: ${groqErr}`);
    }

    const groqData = await groqRes.json();
    let content = groqData.choices[0]?.message?.content?.trim() || '{}';

    // Clean markdown JSON ticks if present
    if (content.startsWith('```json')) {
      content = content.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (content.startsWith('```')) {
      content = content.replace(/^```/, '').replace(/```$/, '').trim();
    }

    console.log('\n======================================');
    console.log('REVERSE-ENGINEERED TEMPLATE JSON:');
    console.log('======================================\n');
    console.log(content);
    console.log('\n======================================');

    // Save output to artifact folder
    const outputPath = path.join(__dirname, '..', 'temp', 'analysis_result.json');
    fs.writeFileSync(outputPath, content);
    console.log(`Saved output to: ${outputPath}`);

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    if (serverProcess) {
      console.log('Stopping spawned local server...');
      serverProcess.kill();
    }
  }
}

run();
