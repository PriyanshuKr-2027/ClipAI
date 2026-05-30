const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const multer = require('multer');

const tempDir = path.join(__dirname, '..', '..', 'temp');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer storage for photos
const photoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const id = uuidv4();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `photo_${id}_${safeName}`);
  }
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

// POST /api/transitions/upload-photo
router.post('/upload-photo', photoUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image file uploaded.' });
  }
  const { path: filePath, filename } = req.file;
  res.json({
    success: true,
    filePath,
    filename,
    url: `http://localhost:3001/temp/${filename}`
  });
}, (err, req, res, next) => {
  console.error('Photo upload error:', err);
  res.status(400).json({ success: false, error: err.message });
});

// Promise wrapper for child_process.exec
function execPromise(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

// POST /api/transitions/download
router.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'url is required' });
  }

  const urlStr = url.toLowerCase();
  let platform = '';
  if (urlStr.includes('instagram.com')) {
    platform = 'instagram';
  } else if (urlStr.includes('youtube.com') || urlStr.includes('youtu.be')) {
    platform = 'youtube';
  } else if (urlStr.includes('tiktok.com')) {
    platform = 'tiktok';
  } else {
    return res.status(400).json({ success: false, error: 'Unsupported URL platform. Only Instagram, YouTube, and TikTok are supported.' });
  }

  try {
    if (platform === 'instagram') {
      // Extract shortcode
      let shortcode = '';
      try {
        let parsedUrl = url;
        if (!/^https?:\/\//i.test(url)) {
          parsedUrl = 'https://' + url;
        }
        const pathname = new URL(parsedUrl).pathname;
        const parts = pathname.split('/').filter(Boolean);
        const index = parts.findIndex(p => p === 'reel' || p === 'reels' || p === 'p');
        if (index !== -1 && parts[index + 1]) {
          shortcode = parts[index + 1];
        }
      } catch (e) {
        // Regex fallback
        const match = url.match(/(?:\/p\/|\/reel\/|\/reels\/)([^/?#&]+)/);
        if (match) {
          shortcode = match[1];
        }
      }

      if (!shortcode) {
        return res.status(400).json({ success: false, error: 'Could not extract shortcode from Instagram URL' });
      }

      const safeShortcode = shortcode.replace(/[^a-zA-Z0-9_\-]/g, '');
      if (!safeShortcode) {
        return res.status(400).json({ success: false, error: 'Invalid shortcode' });
      }

      // Check environment variables and whether they are placeholders
      const igUsername = process.env.IG_USERNAME || '';
      const igPassword = process.env.IG_PASSWORD || '';
      const hasValidCredentials =
        igUsername &&
        igPassword &&
        igUsername !== 'your_throwaway_instagram_username' &&
        igPassword !== 'your_throwaway_instagram_password';

      let cmd = '';
      if (hasValidCredentials) {
        cmd = `instaloader --login "${igUsername}" --password "${igPassword}" -- -"${safeShortcode}"`;
      } else {
        cmd = `instaloader -- -"${safeShortcode}"`;
      }

      try {
        await execPromise(cmd, { cwd: tempDir });
      } catch (err) {
        // If login execution failed and we had credentials, try falling back to anonymous download
        if (hasValidCredentials) {
          console.warn('Instaloader login download failed. Retrying anonymously...');
          const fallbackCmd = `instaloader -- -"${safeShortcode}"`;
          await execPromise(fallbackCmd, { cwd: tempDir });
        } else {
          throw err;
        }
      }

      // Find the downloaded .mp4 file
      const targetDir = path.join(tempDir, `-${safeShortcode}`);
      let mp4FilePath = '';
      let mp4FileName = '';

      if (fs.existsSync(targetDir)) {
        const files = fs.readdirSync(targetDir);
        const mp4File = files.find(f => f.toLowerCase().endsWith('.mp4'));
        if (mp4File) {
          mp4FileName = mp4File;
          mp4FilePath = path.join(targetDir, mp4File);
        }
      }

      // Fallback search in tempDir
      if (!mp4FilePath) {
        const files = fs.readdirSync(tempDir);
        const mp4Files = files
          .map(f => ({ name: f, path: path.join(tempDir, f), stat: fs.statSync(path.join(tempDir, f)) }))
          .filter(f => f.stat.isFile() && f.name.toLowerCase().endsWith('.mp4'))
          .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

        if (mp4Files.length > 0) {
          const now = Date.now();
          if (now - mp4Files[0].stat.mtimeMs < 120000) { // last 2 minutes
            mp4FileName = mp4Files[0].name;
            mp4FilePath = mp4Files[0].path;
          }
        }
      }

      if (!mp4FilePath || !fs.existsSync(mp4FilePath)) {
        return res.status(500).json({ success: false, error: 'Downloaded .mp4 file not found.' });
      }

      // Copy/Move to standardized path in tempDir
      const uniqueId = uuidv4();
      const outputFilename = `instagram_${uniqueId}.mp4`;
      const outputPath = path.join(tempDir, outputFilename);

      fs.copyFileSync(mp4FilePath, outputPath);

      // Clean up instaloader subdirectory
      if (fs.existsSync(targetDir)) {
        try {
          fs.rmSync(targetDir, { recursive: true, force: true });
        } catch (rmErr) {
          console.error('Failed to clean up Instagram temp directory:', rmErr);
        }
      } else if (mp4FilePath !== outputPath) {
        try {
          fs.unlinkSync(mp4FilePath);
        } catch (_) {}
      }

      return res.json({
        success: true,
        filePath: outputPath,
        filename: outputFilename,
        platform: 'instagram'
      });
    } else {
      // youtube or tiktok
      const uniqueId = uuidv4();
      const outputFilename = `${platform}_${uniqueId}.mp4`;
      const outputPath = path.join(tempDir, outputFilename);

      // yt-dlp command
      const cmd = `yt-dlp -f "bestvideo[height<=720]+bestaudio/best[height<=720]/best" --ffmpeg-location "${ffmpegPath}" --merge-output-format mp4 -o "${outputPath}" "${url}"`;

      await execPromise(cmd, { cwd: tempDir });

      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ success: false, error: 'Downloaded YouTube/TikTok file not found.' });
      }

      return res.json({
        success: true,
        filePath: outputPath,
        filename: outputFilename,
        platform: platform
      });
    }
  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/transitions/detect
router.post('/detect', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ success: false, error: 'filePath is required' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ success: false, error: 'Video file does not exist at the specified path.' });
  }

  // Ensure temp/frames directory exists
  const framesDir = path.join(tempDir, 'frames');
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }

  try {
    // STEP 1 — ffprobe to get total duration and fps
    const info = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        
        const format = metadata.format || {};
        const videoStream = (metadata.streams || []).find(s => s.codec_type === 'video') || {};
        
        let fps = 30;
        if (videoStream.r_frame_rate) {
          const parts = videoStream.r_frame_rate.split('/');
          if (parts.length === 2 && +parts[1] !== 0) {
            fps = Math.round(+parts[0] / +parts[1]);
          }
        }
        
        resolve({
          duration: parseFloat(format.duration || 0),
          fps
        });
      });
    });

    const totalDuration = info.duration;
    const fps = info.fps;

    if (!totalDuration) {
      return res.status(400).json({ success: false, error: 'Could not retrieve video duration.' });
    }

    // STEP 1 cont. — Extract frames at scene changes using FFmpeg and select='gt(scene,0.3)'
    const framePattern = path.join(framesDir, 'frame_%04d.jpg');
    const ffmpegCmd = `"${ffmpegPath}" -y -i "${filePath}" -vf "select='gt(scene,0.3)',showinfo" -vsync vfr "${framePattern}"`;
    
    const { stderr } = await execPromise(ffmpegCmd);

    // STEP 2 — Get timestamps of cuts
    const timestamps = [];
    const lines = stderr.split(/\r?\n/);
    for (const line of lines) {
      if (line.includes('showinfo') || line.includes('Parsed_showinfo')) {
        const match = line.match(/pts_time:\s*([0-9.]+)/);
        if (match) {
          const val = parseFloat(match[1]);
          if (!isNaN(val)) {
            timestamps.push(val);
          }
        }
      }
    }

    // Sort cuts chronologically
    timestamps.sort((a, b) => a - b);

    // Filter out duplicates or very close values (e.g. within 0.1 seconds)
    const uniqueCuts = [];
    for (const t of timestamps) {
      if (uniqueCuts.length === 0 || t - uniqueCuts[uniqueCuts.length - 1] > 0.1) {
        uniqueCuts.push(t);
      }
    }

    // Ensure 0 is at the beginning
    if (uniqueCuts.length === 0 || uniqueCuts[0] > 0.1) {
      uniqueCuts.unshift(0);
    } else {
      uniqueCuts[0] = 0;
    }

    // Ensure totalDuration is at the end
    if (uniqueCuts[uniqueCuts.length - 1] < totalDuration - 0.1) {
      uniqueCuts.push(totalDuration);
    } else {
      uniqueCuts[uniqueCuts.length - 1] = totalDuration;
    }

    // STEP 3 — Build slots array
    const slots = [];
    for (let i = 0; i < uniqueCuts.length - 1; i++) {
      const startTime = uniqueCuts[i];
      const endTime = uniqueCuts[i + 1];
      const duration = parseFloat((endTime - startTime).toFixed(3));
      slots.push({
        slotIndex: i,
        startTime: parseFloat(startTime.toFixed(3)),
        endTime: parseFloat(endTime.toFixed(3)),
        duration
      });
    }

    // STEP 4 — Extract one representative thumbnail per slot
    const thumbPromises = slots.map(async (slot) => {
      const seekTime = (slot.startTime + 0.5 > slot.endTime)
        ? parseFloat((slot.startTime + slot.duration / 2).toFixed(3))
        : parseFloat((slot.startTime + 0.5).toFixed(3));

      const thumbFilename = `thumb_${slot.slotIndex}.jpg`;
      const thumbPath = path.join(framesDir, thumbFilename);
      
      const thumbCmd = `"${ffmpegPath}" -y -i "${filePath}" -ss ${seekTime} -vframes 1 "${thumbPath}"`;
      await execPromise(thumbCmd);

      // Return path relative to project root: "temp/frames/thumb_<slotIndex>.jpg"
      return `temp/frames/${thumbFilename}`;
    });

    const resolvedThumbPaths = await Promise.all(thumbPromises);

    // STEP 5 — Return JSON
    return res.json({
      success: true,
      totalDuration,
      fps,
      slotCount: slots.length,
      slots,
      thumbnailPaths: resolvedThumbPaths
    });

  } catch (err) {
    console.error('Detection error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/transitions/render
router.post('/render', async (req, res) => {
  let recipe = req.body.recipe;
  let slots = req.body.slots;
  let userMedia = req.body.userMedia;
  let backgroundVideoPath = req.body.backgroundVideoPath || null;
  let outputFilename = req.body.outputFilename;
  const jobId = req.body.jobId;

  // Adapt old slots layout to new recipe/userMedia layout for backward compatibility
  if (slots && !recipe) {
    recipe = {
      technique: 'slideshow_cuts',
      slots: slots.map(s => ({
        slotIndex: s.slotIndex,
        duration: s.duration,
        animationIn: s.motionSuggestion || 'none'
      }))
    };
    userMedia = slots.map(s => ({
      slotIndex: s.slotIndex,
      filePath: s.photoPath,
      type: 'photo'
    }));
  }

  if (!recipe || !recipe.technique) {
    return res.status(400).json({ success: false, error: 'recipe and recipe.technique are required' });
  }

  if (!outputFilename) {
    return res.status(400).json({ success: false, error: 'outputFilename is required' });
  }

  const technique = recipe.technique;
  const recipeSlots = recipe.slots || [];
  const speedRamps = recipe.speedRamps || [];

  const resolvedOutputFilename = outputFilename.toLowerCase().endsWith('.mp4') 
    ? outputFilename 
    : `${outputFilename}.mp4`;
  const outputPath = path.join(tempDir, resolvedOutputFilename);
  const downloadUrl = `http://localhost:3001/temp/${resolvedOutputFilename}`;

  const progress = (percent) => {
    if (jobId && global.broadcastProgress) {
      global.broadcastProgress(jobId, Math.min(100, Math.max(0, Math.round(percent))));
    }
  };

  const getAtempoFilter = (factor) => {
    let current = factor;
    const filters = [];
    while (current > 2.0) {
      filters.push('atempo=2.0');
      current /= 2.0;
    }
    while (current < 0.5) {
      filters.push('atempo=0.5');
      current /= 0.5;
    }
    if (current !== 1.0) {
      filters.push(`atempo=${current.toFixed(4)}`);
    }
    return filters.length > 0 ? filters.join(',') : '';
  };

  const renderSlot = async (slot, media, idx) => {
    const slotOutputPath = path.join(tempDir, `slot_${jobId || uuidv4()}_${idx}.mp4`);
    const duration = parseFloat(slot.duration);
    const frames = Math.round(duration * 30);
    
    let filter = '';
    const anim = slot.animationIn || 'none';

    if (media.type === 'photo') {
      if (anim === 'zoom_in' || anim === 'slow_zoom_in') {
        filter = `zoompan=z='min(zoom+0.0015,1.3)':d=${frames}:fps=30:s=1080x1920`;
      } else if (anim === 'zoom_out' || anim === 'slow_zoom_out') {
        filter = `zoompan=z='max(1.3-0.0015*on,1.0)':d=${frames}:fps=30:s=1080x1920`;
      } else if (anim === 'slide_left' || anim === 'pan_left') {
        filter = `zoompan=z=1.2:x='iw-iw/zoom-(iw-iw/zoom)*on/${frames}':d=${frames}:fps=30:s=1080x1920`;
      } else if (anim === 'slide_right' || anim === 'pan_right') {
        filter = `zoompan=z=1.2:x='(iw-iw/zoom)*on/${frames}':d=${frames}:fps=30:s=1080x1920`;
      } else if (anim === 'slide_up' || anim === 'tilt_up') {
        filter = `zoompan=z=1.2:y='ih-ih/zoom-(ih-ih/zoom)*on/${frames}':d=${frames}:fps=30:s=1080x1920`;
      } else if (anim === 'slide_down' || anim === 'tilt_down') {
        filter = `zoompan=z=1.2:y='(ih-ih/zoom)*on/${frames}':d=${frames}:fps=30:s=1080x1920`;
      } else if (anim === 'fade') {
        filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fade=t=in:st=0:d=0.3,fade=t=out:st=${duration - 0.3}:d=0.3,fps=30`;
      } else if (anim === 'spin') {
        filter = `scale=1280:2276,rotate=angle='t*0.5':ow=1080:oh=1920:c=black,fps=30`;
      } else if (anim === 'flip') {
        filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,hflip,fps=30`;
      } else {
        filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30`;
      }
      const cmd = `"${ffmpegPath}" -y -loop 1 -i "${media.filePath}" -vf "${filter}" -c:v libx264 -r 30 -t ${duration} -pix_fmt yuv420p "${slotOutputPath}"`;
      await execPromise(cmd);
    } else {
      filter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30`;
      const cmd = `"${ffmpegPath}" -y -ss 0 -i "${media.filePath}" -t ${duration} -vf "${filter}" -c:v libx264 -r 30 -pix_fmt yuv420p "${slotOutputPath}"`;
      await execPromise(cmd);
    }
    return slotOutputPath;
  };

  const tempFilesToCleanup = [];

  try {
    if (technique === 'slideshow_cuts' || technique === 'zoom_transitions') {
      const slotPaths = [];
      for (let i = 0; i < recipeSlots.length; i++) {
        const slot = recipeSlots[i];
        const media = userMedia.find(m => m.slotIndex === slot.slotIndex);
        if (!media) {
          return res.status(400).json({ success: false, error: `Missing user media for slot index ${slot.slotIndex}` });
        }
        progress((i / recipeSlots.length) * 80);
        const p = await renderSlot(slot, media, i);
        slotPaths.push(p);
        tempFilesToCleanup.push(p);
      }

      let finalVideoPath = '';
      if (slotPaths.length === 1) {
        finalVideoPath = slotPaths[0];
      } else if (technique === 'slideshow_cuts') {
        const concatListPath = path.join(tempDir, `concat_${jobId || uuidv4()}.txt`);
        const concatListContent = slotPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
        fs.writeFileSync(concatListPath, concatListContent);
        tempFilesToCleanup.push(concatListPath);

        const tempConcatOutput = path.join(tempDir, `temp_concat_${jobId || uuidv4()}.mp4`);
        const concatCmd = `"${ffmpegPath}" -y -f concat -safe 0 -i "${concatListPath}" -c copy "${tempConcatOutput}"`;
        await execPromise(concatCmd);
        finalVideoPath = tempConcatOutput;
        tempFilesToCleanup.push(tempConcatOutput);
      } else {
        // zoom_transitions
        const tempConcatOutput = path.join(tempDir, `temp_concat_${jobId || uuidv4()}.mp4`);
        tempFilesToCleanup.push(tempConcatOutput);
        
        let inputArgs = '';
        let filterComplex = '';
        let currentLabel = '[0:v]';
        let cumulativeTime = parseFloat(recipeSlots[0].duration);

        for (let i = 0; i < slotPaths.length; i++) {
          inputArgs += `-i "${slotPaths[i]}" `;
        }

        for (let i = 1; i < slotPaths.length; i++) {
          const prevSlot = recipeSlots[i - 1];
          const nextSlot = recipeSlots[i];
          const tDuration = 0.3;
          const offset = parseFloat((cumulativeTime - tDuration).toFixed(3));
          const nextLabel = `[v${i}]`;

          filterComplex += `${currentLabel}[${i}:v]xfade=transition=zoomin:duration=${tDuration}:offset=${offset}`;

          if (i === slotPaths.length - 1) {
            filterComplex += `[outv]`;
          } else {
            filterComplex += `${nextLabel}; `;
            currentLabel = nextLabel;
          }
          cumulativeTime = parseFloat((cumulativeTime + parseFloat(nextSlot.duration) - tDuration).toFixed(3));
        }

        const finalCmd = `"${ffmpegPath}" -y ${inputArgs} -filter_complex "${filterComplex}" -map "[outv]" -c:v libx264 -pix_fmt yuv420p "${tempConcatOutput}"`;
        await execPromise(finalCmd);
        finalVideoPath = tempConcatOutput;
      }

      // Merge background audio if exists, else silent
      let hasAudio = false;
      if (backgroundVideoPath && fs.existsSync(backgroundVideoPath)) {
        try {
          const bgMeta = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(backgroundVideoPath, (err, data) => {
              if (err) return reject(err);
              resolve(data);
            });
          });
          hasAudio = (bgMeta.streams || []).some(s => s.codec_type === 'audio');
        } catch (_) {}
      }

      if (hasAudio) {
        const mergeCmd = `"${ffmpegPath}" -y -i "${finalVideoPath}" -i "${backgroundVideoPath}" -map 0:v -map 1:a -c:v libx264 -crf 18 -preset fast -c:a aac -shortest "${outputPath}"`;
        await execPromise(mergeCmd);
      } else {
        const silentCmd = `"${ffmpegPath}" -y -i "${finalVideoPath}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -map 0:v -map 1:a -c:v libx264 -crf 18 -preset fast -c:a aac -shortest "${outputPath}"`;
        await execPromise(silentCmd);
      }
      progress(100);

    } else if (technique === 'freeze_overlay' || technique === 'layered_composite' || technique === 'speed_ramp' || technique === 'hybrid') {
      
      const renderComposite = async (bgVideoPath, outputDest) => {
        if (!bgVideoPath || !fs.existsSync(bgVideoPath)) {
          throw new Error('Background video file does not exist.');
        }

        const bgMeta = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(bgVideoPath, (err, data) => {
            if (err) return reject(err);
            resolve(data);
          });
        });
        const bgFormat = bgMeta.format || {};
        const bgVideoStream = (bgMeta.streams || []).find(s => s.codec_type === 'video') || {};
        const bgAudioStream = (bgMeta.streams || []).find(s => s.codec_type === 'audio') || {};
        const bgDuration = parseFloat(bgFormat.duration || 0);
        const bgHasAudio = !!bgAudioStream.codec_name;

        let bgFps = 30;
        if (bgVideoStream.r_frame_rate) {
          const parts = bgVideoStream.r_frame_rate.split('/');
          if (parts.length === 2 && +parts[1] !== 0) {
            bgFps = Math.round(+parts[0] / +parts[1]);
          }
        }

        const overlaySlots = recipeSlots.filter(s => s.layer === 'overlay');
        
        let filterComplex = '';
        let inputArgs = `-i "${bgVideoPath}" `;
        for (const slot of overlaySlots) {
          const media = userMedia.find(m => m.slotIndex === slot.slotIndex);
          if (!media) {
            throw new Error(`Missing user media for slot ${slot.slotIndex}`);
          }
          if (media.type === 'photo') {
            inputArgs += `-loop 1 -i "${media.filePath}" `;
          } else {
            inputArgs += `-i "${media.filePath}" `;
          }
        }

        let mainVideoLabel = '[0:v]';
        let mainVideoDuration = bgDuration;

        if (technique === 'freeze_overlay') {
          const freezeStart = Math.min(...overlaySlots.map(s => s.startTime));
          const freezeEnd = Math.min(Math.max(...overlaySlots.map(s => s.endTime)), bgDuration);
          const freezeDuration = freezeEnd - freezeStart;
          const freezeFrames = Math.round(freezeDuration * bgFps);

          // Split video: before, frozen loop, after
          if (freezeStart >= 0.05) {
            filterComplex += `[0:v]trim=0:${freezeStart},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[before];`;
          }
          filterComplex += `[0:v]trim=${freezeStart}:${freezeStart + 0.04},loop=${freezeFrames}:1:0,setpts=N/FR/TB,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[frozen];`;
          if (bgDuration - freezeEnd >= 0.05) {
            filterComplex += `[0:v]trim=${freezeEnd}:${bgDuration},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[after];`;
          }

          // Build overlays on frozen segment
          let overlayChain = '[frozen]';
          for (let idx = 0; idx < overlaySlots.length; idx++) {
            const slot = overlaySlots[idx];
            const inputIdx = idx + 1;
            const media = userMedia.find(m => m.slotIndex === slot.slotIndex);
            const w_pos = slot.position === 'full' ? 1080 : 540;
            const h_pos = slot.position === 'full' ? 1920 : 960;
            const anim = slot.animationIn || 'none';
            const appearTime = slot.startTime - freezeStart;

            let filterStream = `[${inputIdx}:v]scale=${w_pos}:${h_pos}`;
            if (media.type === 'video') {
              filterStream += `,trim=0:${slot.duration},setpts=PTS-STARTPTS`;
            }
            if (anim === 'fade') {
              filterStream += `,format=rgba,fade=in:st=${appearTime}:d=0.3:alpha=1`;
            }
            filterComplex += `${filterStream}[ol_${idx}];`;
          }

          for (let idx = 0; idx < overlaySlots.length; idx++) {
            const slot = overlaySlots[idx];
            const appearTime = slot.startTime - freezeStart;
            const anim = slot.animationIn || 'none';
            let xPos = 0, yPos = 0, w_pos = 540, h_pos = 960;

            if (slot.position === 'top_left') { xPos = 0; yPos = 0; }
            else if (slot.position === 'top_right') { xPos = 540; yPos = 0; }
            else if (slot.position === 'bottom_left') { xPos = 0; yPos = 960; }
            else if (slot.position === 'bottom_right') { xPos = 540; yPos = 960; }
            else if (slot.position === 'center') { xPos = 270; yPos = 480; }
            else if (slot.position === 'full') { xPos = 0; yPos = 0; w_pos = 1080; h_pos = 1920; }

            const nextLabel = idx === overlaySlots.length - 1 ? '[frozen_with_overlays]' : `[ov_${idx}]`;
            let overlayExpr = `x=${xPos}:y=${yPos}`;

            if (anim === 'slide_right') {
              overlayExpr = `x='${xPos} + 1080 - min(1080, (t-${appearTime})*1080/0.3)':y=${yPos}`;
            } else if (anim === 'slide_left') {
              overlayExpr = `x='${xPos} - ${w_pos} + min(${w_pos}, (t-${appearTime})*${w_pos}/0.3)':y=${yPos}`;
            } else if (anim === 'slide_up') {
              overlayExpr = `x=${xPos}:y='${yPos} + 1920 - min(1920, (t-${appearTime})*1920/0.3)'`;
            } else if (anim === 'slide_down') {
              overlayExpr = `x=${xPos}:y='${yPos} - ${h_pos} + min(${h_pos}, (t-${appearTime})*${h_pos}/0.3)'`;
            }

            filterComplex += `${overlayChain}[ol_${idx}]overlay=${overlayExpr}:enable='gte(t,${appearTime})'${nextLabel};`;
            overlayChain = nextLabel;
          }

          let concatInputs = '';
          let concatCount = 0;
          if (freezeStart >= 0.05) {
            concatInputs += '[before]';
            concatCount++;
          }
          concatInputs += '[frozen_with_overlays]';
          concatCount++;
          if (bgDuration - freezeEnd >= 0.05) {
            concatInputs += '[after]';
            concatCount++;
          }
          filterComplex += `${concatInputs}concat=n=${concatCount}:v=1:a=0[outv]`;
        } else {
          // layered_composite or hybrid pre-rendering
          filterComplex += `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg_base];`;
          let overlayChain = '[bg_base]';

          for (let idx = 0; idx < overlaySlots.length; idx++) {
            const slot = overlaySlots[idx];
            const inputIdx = idx + 1;
            const media = userMedia.find(m => m.slotIndex === slot.slotIndex);
            const w_pos = slot.position === 'full' ? 1080 : 540;
            const h_pos = slot.position === 'full' ? 1920 : 960;
            const anim = slot.animationIn || 'none';
            const appearTime = slot.startTime;

            let filterStream = `[${inputIdx}:v]scale=${w_pos}:${h_pos}`;
            if (media.type === 'video') {
              filterStream += `,trim=0:${slot.duration},setpts=PTS-STARTPTS`;
            }
            if (anim === 'fade') {
              filterStream += `,format=rgba,fade=in:st=${appearTime}:d=0.3:alpha=1`;
            }
            filterComplex += `${filterStream}[ol_${idx}];`;
          }

          for (let idx = 0; idx < overlaySlots.length; idx++) {
            const slot = overlaySlots[idx];
            const appearTime = slot.startTime;
            const anim = slot.animationIn || 'none';
            let xPos = 0, yPos = 0, w_pos = 540, h_pos = 960;

            if (slot.position === 'top_left') { xPos = 0; yPos = 0; }
            else if (slot.position === 'top_right') { xPos = 540; yPos = 0; }
            else if (slot.position === 'bottom_left') { xPos = 0; yPos = 960; }
            else if (slot.position === 'bottom_right') { xPos = 540; yPos = 960; }
            else if (slot.position === 'center') { xPos = 270; yPos = 480; }
            else if (slot.position === 'full') { xPos = 0; yPos = 0; w_pos = 1080; h_pos = 1920; }

            const nextLabel = idx === overlaySlots.length - 1 ? '[outv]' : `[ov_${idx}]`;
            let overlayExpr = `x=${xPos}:y=${yPos}`;

            if (anim === 'slide_right') {
              overlayExpr = `x='${xPos} + 1080 - min(1080, (t-${appearTime})*1080/0.3)':y=${yPos}`;
            } else if (anim === 'slide_left') {
              overlayExpr = `x='${xPos} - ${w_pos} + min(${w_pos}, (t-${appearTime})*${w_pos}/0.3)':y=${yPos}`;
            } else if (anim === 'slide_up') {
              overlayExpr = `x=${xPos}:y='${yPos} + 1920 - min(1920, (t-${appearTime})*1920/0.3)'`;
            } else if (anim === 'slide_down') {
              overlayExpr = `x=${xPos}:y='${yPos} - ${h_pos} + min(${h_pos}, (t-${appearTime})*${h_pos}/0.3)'`;
            }

            filterComplex += `${overlayChain}[ol_${idx}]overlay=${overlayExpr}:enable='gte(t,${appearTime})'${nextLabel};`;
            overlayChain = nextLabel;
          }
        }

        let cmd = '';
        if (bgHasAudio) {
          cmd = `"${ffmpegPath}" -y ${inputArgs} -filter_complex "${filterComplex}" -map "[outv]" -map 0:a -c:v libx264 -crf 18 -preset fast -c:a copy -pix_fmt yuv420p -t ${mainVideoDuration} "${outputDest}"`;
        } else {
          cmd = `"${ffmpegPath}" -y ${inputArgs} -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -filter_complex "${filterComplex}" -map "[outv]" -map ${overlaySlots.length + 1}:a -c:v libx264 -crf 18 -preset fast -c:a aac -pix_fmt yuv420p -t ${mainVideoDuration} -shortest "${outputDest}"`;
        }
        await execPromise(cmd);
      };

      const renderSpeedRamp = async (srcVideoPath, speedSegments, outputDest) => {
        const bgMeta = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(srcVideoPath, (err, data) => {
            if (err) return reject(err);
            resolve(data);
          });
        });
        const bgFormat = bgMeta.format || {};
        const bgAudioStream = (bgMeta.streams || []).find(s => s.codec_type === 'audio') || {};
        const hasAudio = !!bgAudioStream.codec_name;
        const totalDur = parseFloat(bgFormat.duration || 0);

        const segments = [];
        let lastEnd = 0;
        speedSegments.sort((a, b) => a.start - b.start);

        for (const r of speedSegments) {
          if (r.start > lastEnd + 0.01) {
            segments.push({ start: lastEnd, end: r.start, speedFactor: 1.0 });
          }
          segments.push(r);
          lastEnd = r.end;
        }
        if (totalDur > lastEnd + 0.01) {
          segments.push({ start: lastEnd, end: totalDur, speedFactor: 1.0 });
        }

        let filterComplex = '';
        for (let i = 0; i < segments.length; i++) {
          const s = segments[i];
          filterComplex += `[0:v]trim=start=${s.start}:end=${s.end},setpts=(PTS-STARTPTS)/${s.speedFactor},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fifo[v_${i}];`;
          if (hasAudio) {
            let audioFilter = `atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS`;
            const atempo = getAtempoFilter(s.speedFactor);
            if (atempo) {
              audioFilter += `,${atempo}`;
            }
            filterComplex += `[0:a]${audioFilter}[a_${i}];`;
          }
        }

        let concatInputs = '';
        for (let i = 0; i < segments.length; i++) {
          concatInputs += `[v_${i}]`;
          if (hasAudio) {
            concatInputs += `[a_${i}]`;
          }
        }
        const audioConcatFlag = hasAudio ? ':a=1' : ':a=0';
        const audioOutputLabel = hasAudio ? '[outa]' : '';
        filterComplex += `${concatInputs}concat=n=${segments.length}:v=1${audioConcatFlag}[outv]${audioOutputLabel}`;

        let cmd = '';
        if (hasAudio) {
          cmd = `"${ffmpegPath}" -y -i "${srcVideoPath}" -filter_complex "${filterComplex}" -map "[outv]" -map "[outa]" -c:v libx264 -crf 18 -preset fast -c:a aac -pix_fmt yuv420p "${outputDest}"`;
        } else {
          cmd = `"${ffmpegPath}" -y -i "${srcVideoPath}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -filter_complex "${filterComplex}" -map "[outv]" -map 1:a -c:v libx264 -crf 18 -preset fast -c:a aac -pix_fmt yuv420p -shortest "${outputDest}"`;
        }
        await execPromise(cmd);
      };

      if (technique === 'freeze_overlay' || technique === 'layered_composite') {
        progress(30);
        await renderComposite(backgroundVideoPath, outputPath);
        progress(100);
      } else if (technique === 'speed_ramp') {
        progress(30);
        await renderSpeedRamp(backgroundVideoPath, speedRamps, outputPath);
        progress(100);
      } else {
        // hybrid: process freeze frame/overlays first, then speed ramps
        progress(20);
        const tempComposite = path.join(tempDir, `temp_composite_${jobId || uuidv4()}.mp4`);
        tempFilesToCleanup.push(tempComposite);

        const overlaySlots = recipeSlots.filter(s => s.layer === 'overlay');
        if (overlaySlots.length > 0) {
          console.log('Hybrid: Rendering overlays...');
          await renderComposite(backgroundVideoPath, tempComposite);
        } else {
          fs.copyFileSync(backgroundVideoPath, tempComposite);
        }
        progress(60);

        if (speedRamps.length > 0) {
          console.log('Hybrid: Applying speed ramps...');
          await renderSpeedRamp(tempComposite, speedRamps, outputPath);
        } else {
          fs.copyFileSync(tempComposite, outputPath);
        }
        progress(100);
      }
    } else {
      return res.status(400).json({ success: false, error: `Unsupported technique: ${technique}` });
    }

    if (jobId && global.broadcastDone) {
      global.broadcastDone(jobId, resolvedOutputFilename);
    }

    return res.json({
      success: true,
      outputPath,
      downloadUrl
    });

  } catch (err) {
    console.error('Render error:', err);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    // Cleanup temporary files
    for (const p of tempFilesToCleanup) {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (cleanupErr) {
          console.error(`Failed to clean up temp file ${p}:`, cleanupErr);
        }
      }
    }
  }
});

// POST /api/transitions/analyze
// Accepts: { filePath: string }
router.post('/analyze', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ success: false, error: 'filePath is required' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ success: false, error: 'Video file does not exist.' });
  }

  const analysisDir = path.join(tempDir, 'analysis');
  if (!fs.existsSync(analysisDir)) {
    fs.mkdirSync(analysisDir, { recursive: true });
  }

  try {
    // 1. Probe video metadata
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });

    const format = metadata.format || {};
    const videoStream = (metadata.streams || []).find(s => s.codec_type === 'video') || {};
    const audioStream = (metadata.streams || []).find(s => s.codec_type === 'audio') || {};
    const hasAudio = !!audioStream.codec_name;

    const totalDuration = parseFloat(format.duration || 0);
    const width = parseInt(videoStream.width || 0);
    const height = parseInt(videoStream.height || 0);
    
    let fps = 30;
    if (videoStream.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split('/');
      if (parts.length === 2 && +parts[1] !== 0) {
        fps = Math.round(+parts[0] / +parts[1]);
      }
    }

    if (!totalDuration) {
      return res.status(400).json({ success: false, error: 'Could not retrieve video duration.' });
    }

    // SIGNAL 1 — Hard cuts (scene changes)
    const cutsPattern = path.join(analysisDir, 'cut_%04d.jpg');
    const cmd1 = `"${ffmpegPath}" -y -i "${filePath}" -vf "select='gt(scene,0.3)',showinfo" -vsync vfr "${cutsPattern}" -f null -`;
    const { stderr: stderr1 } = await execPromise(cmd1);

    const parsedCuts = [];
    const lines1 = stderr1.split(/\r?\n/);
    let cutIndex = 1;
    for (const line of lines1) {
      if (line.includes('showinfo') || line.includes('Parsed_showinfo')) {
        const match = line.match(/pts_time:\s*([0-9.]+)/);
        if (match) {
          const val = parseFloat(match[1]);
          if (!isNaN(val)) {
            const filename = `cut_${String(cutIndex).padStart(4, '0')}.jpg`;
            parsedCuts.push({
              timestamp: val,
              thumbnailPath: `temp/analysis/${filename}`
            });
            cutIndex++;
          }
        }
      }
    }

    // Sort and filter out cuts too close to each other (within 0.1s)
    parsedCuts.sort((a, b) => a.timestamp - b.timestamp);
    const cuts = [];
    let idx = 1;
    for (const c of parsedCuts) {
      if (cuts.length === 0 || c.timestamp - cuts[cuts.length - 1].timestamp > 0.1) {
        const newFilename = `cut_${String(idx).padStart(4, '0')}.jpg`;
        const oldPath = path.join(analysisDir, c.thumbnailPath.split('/').pop());
        const newPath = path.join(analysisDir, newFilename);
        if (fs.existsSync(oldPath) && oldPath !== newPath) {
          fs.renameSync(oldPath, newPath);
        }
        cuts.push({
          timestamp: parseFloat(c.timestamp.toFixed(3)),
          thumbnailPath: `temp/analysis/${newFilename}`
        });
        idx++;
      } else {
        const oldPath = path.join(analysisDir, c.thumbnailPath.split('/').pop());
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) {}
        }
      }
    }

    // SIGNAL 2 — Freeze frames
    const cmd2 = `"${ffmpegPath}" -y -i "${filePath}" -vf "freezedetect=n=-60dB:d=0.3" -f null -`;
    const { stderr: stderr2 } = await execPromise(cmd2);

    const freezes = [];
    const lines2 = stderr2.split(/\r?\n/);
    let currentFreeze = null;
    for (const line of lines2) {
      if (line.includes('freezedetect')) {
        const startMatch = line.match(/freeze_start:\s*([0-9.]+)/);
        if (startMatch) {
          currentFreeze = {
            start: parseFloat(startMatch[1]),
            end: null,
            duration: null
          };
        }
        const endMatch = line.match(/freeze_end:\s*([0-9.]+)/);
        if (endMatch && currentFreeze) {
          currentFreeze.end = parseFloat(endMatch[1]);
          const durMatch = line.match(/freeze_duration:\s*([0-9.]+)/);
          if (durMatch) {
            currentFreeze.duration = parseFloat(durMatch[1]);
          } else {
            currentFreeze.duration = parseFloat((currentFreeze.end - currentFreeze.start).toFixed(3));
          }
          freezes.push(currentFreeze);
          currentFreeze = null;
        }
      }
    }
    if (currentFreeze) {
      currentFreeze.end = totalDuration;
      currentFreeze.duration = parseFloat((totalDuration - currentFreeze.start).toFixed(3));
      freezes.push(currentFreeze);
    }

    // SIGNAL 3 — Speed changes (slow-mo or speed ramp)
    const cmd3 = `"${ffmpegPath}" -y -i "${filePath}" -vf "signalstats,metadata=print" -f null -`;
    const { stderr: stderr3 } = await execPromise(cmd3);

    const frameData = [];
    let currentPtsTime = null;
    let currentYavg = null;
    let currentYdif = null;
    const lines3 = stderr3.split(/\r?\n/);
    for (const line of lines3) {
      const ptsMatch = line.match(/pts_time:\s*([0-9.]+)/);
      if (ptsMatch) {
        if (currentPtsTime !== null && currentYavg !== null && currentYdif !== null) {
          frameData.push({
            timestamp: parseFloat(currentPtsTime),
            yavg: parseFloat(currentYavg),
            ydif: parseFloat(currentYdif)
          });
        }
        currentPtsTime = ptsMatch[1];
        currentYavg = null;
        currentYdif = null;
        continue;
      }
      const yavgMatch = line.match(/lavfi\.signalstats\.YAVG=\s*([0-9.]+)/);
      if (yavgMatch) {
        currentYavg = yavgMatch[1];
        continue;
      }
      const ydifMatch = line.match(/lavfi\.signalstats\.YDIF=\s*([0-9.]+)/);
      if (ydifMatch) {
        currentYdif = ydifMatch[1];
        continue;
      }
    }
    if (currentPtsTime !== null && currentYavg !== null && currentYdif !== null) {
      frameData.push({
        timestamp: parseFloat(currentPtsTime),
        yavg: parseFloat(currentYavg),
        ydif: parseFloat(currentYdif)
      });
    }

    // Sample YAVG and YDIF every 0.1s
    const speedSamples = [];
    for (let t = 0.0; t <= totalDuration; t += 0.1) {
      let closestFrame = null;
      let minDiff = Infinity;
      for (const f of frameData) {
        const diff = Math.abs(f.timestamp - t);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = f;
        }
      }
      if (closestFrame && minDiff < 0.1) {
        speedSamples.push({
          timestamp: parseFloat(t.toFixed(1)),
          brightness: closestFrame.yavg,
          frameDiff: closestFrame.ydif
        });
      }
    }

    const rawFrameDiffs = frameData.map(f => ({
      timestamp: parseFloat(f.timestamp.toFixed(3)),
      diff: f.ydif
    }));

    // SIGNAL 4 — Overlay detection (something appearing on top of background)
    const quadrants = [
      { name: 'top_left', crop: 'iw/2:ih/2:0:0' },
      { name: 'top_right', crop: 'iw/2:ih/2:iw/2:0' },
      { name: 'bottom_left', crop: 'iw/2:ih/2:0:ih/2' },
      { name: 'bottom_right', crop: 'iw/2:ih/2:iw/2:ih/2' }
    ];

    const quadrantPromises = quadrants.map(async (quad) => {
      const qCmd = `"${ffmpegPath}" -y -i "${filePath}" -vf "crop=${quad.crop},signalstats,metadata=print" -f null -`;
      const { stderr } = await execPromise(qCmd);
      const frames = [];
      const qLines = stderr.split(/\r?\n/);
      let qPtsTime = null;
      let qYdif = null;
      for (const line of qLines) {
        const ptsMatch = line.match(/pts_time:\s*([0-9.]+)/);
        if (ptsMatch) {
          if (qPtsTime !== null && qYdif !== null) {
            frames.push({ timestamp: parseFloat(qPtsTime), ydif: parseFloat(qYdif) });
          }
          qPtsTime = ptsMatch[1];
          qYdif = null;
          continue;
        }
        const ydifMatch = line.match(/lavfi\.signalstats\.YDIF=\s*([0-9.]+)/);
        if (ydifMatch) {
          qYdif = ydifMatch[1];
          continue;
        }
      }
      if (qPtsTime !== null && qYdif !== null) {
        frames.push({ timestamp: parseFloat(qPtsTime), ydif: parseFloat(qYdif) });
      }
      return { quadrant: quad.name, frames };
    });

    const quadrantResults = await Promise.all(quadrantPromises);

    const alignedFrames = {};
    for (const res of quadrantResults) {
      for (const f of res.frames) {
        const tKey = f.timestamp.toFixed(3);
        if (!alignedFrames[tKey]) {
          alignedFrames[tKey] = { timestamp: f.timestamp };
        }
        alignedFrames[tKey][res.quadrant] = f.ydif;
      }
    }
    const sortedAligned = Object.values(alignedFrames).sort((a, b) => a.timestamp - b.timestamp);

    const overlayEvents = [];
    const activeSpans = {
      top_left: null,
      top_right: null,
      bottom_left: null,
      bottom_right: null
    };
    const quadNames = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];

    for (let i = 0; i < sortedAligned.length; i++) {
      const frame = sortedAligned[i];
      for (const q of quadNames) {
        const val = frame[q];
        if (val === undefined) continue;

        let othersLow = true;
        for (const otherQ of quadNames) {
          if (otherQ === q) continue;
          if (frame[otherQ] === undefined || frame[otherQ] >= 2.0) {
            othersLow = false;
            break;
          }
        }

        const isOverlayActive = val > 5.0 && othersLow;

        if (isOverlayActive) {
          if (activeSpans[q] === null) {
            activeSpans[q] = { start: frame.timestamp, last: frame.timestamp };
          } else {
            activeSpans[q].last = frame.timestamp;
          }
        } else {
          if (activeSpans[q] !== null) {
            const duration = parseFloat((activeSpans[q].last - activeSpans[q].start).toFixed(3));
            overlayEvents.push({
              timestamp: parseFloat(activeSpans[q].start.toFixed(3)),
              quadrant: q,
              duration: duration > 0 ? duration : parseFloat((1 / fps).toFixed(3))
            });
            activeSpans[q] = null;
          }
        }
      }
    }
    for (const q of quadNames) {
      if (activeSpans[q] !== null) {
        const duration = parseFloat((activeSpans[q].last - activeSpans[q].start).toFixed(3));
        overlayEvents.push({
          timestamp: parseFloat(activeSpans[q].start.toFixed(3)),
          quadrant: q,
          duration: duration > 0 ? duration : parseFloat((1 / fps).toFixed(3))
        });
      }
    }
    overlayEvents.sort((a, b) => a.timestamp - b.timestamp);

    // SIGNAL 5 — Audio beat timestamps (for beat-synced transitions)
    const beatTimestamps = [];
    if (hasAudio) {
      const cmd5 = `"${ffmpegPath}" -y -i "${filePath}" -af "ebur128=peak=true" -f null -`;
      const { stderr: stderr5 } = await execPromise(cmd5);
      const loudnessData = [];
      const lines5 = stderr5.split(/\r?\n/);
      for (const line of lines5) {
        const match = line.match(/t:\s*([0-9.]+)\s+.*M:\s*([\-0-9.]+)/);
        if (match) {
          loudnessData.push({
            timestamp: parseFloat(match[1]),
            m: parseFloat(match[2])
          });
        }
      }
      const neighborhood = 3; // ±0.3s
      for (let i = 0; i < loudnessData.length; i++) {
        const current = loudnessData[i];
        if (current.m < -35) continue;
        let isLocalMax = true;
        const startIdx = Math.max(0, i - neighborhood);
        const endIdx = Math.min(loudnessData.length - 1, i + neighborhood);
        for (let j = startIdx; j <= endIdx; j++) {
          if (j === i) continue;
          if (loudnessData[j].m > current.m) {
            isLocalMax = false;
            break;
          }
        }
        if (isLocalMax) {
          beatTimestamps.push(parseFloat(current.timestamp.toFixed(3)));
        }
      }
    }

    // SIGNAL 6 — Extract representative frame for each detected segment
    const segmentBoundaries = [0, ...cuts.map(c => c.timestamp), totalDuration];
    for (let i = 0; i < segmentBoundaries.length - 1; i++) {
      const start = segmentBoundaries[i];
      const end = segmentBoundaries[i + 1];
      const duration = end - start;
      const seekTime = (start + 0.5 > end) ? parseFloat((start + duration / 2).toFixed(3)) : parseFloat((start + 0.5).toFixed(3));
      const thumbFilename = `segment_thumb_${i}.jpg`;
      const thumbPath = path.join(analysisDir, thumbFilename);
      const thumbCmd = `"${ffmpegPath}" -y -ss ${seekTime} -i "${filePath}" -vframes 1 "${thumbPath}"`;
      await execPromise(thumbCmd);
    }

    // 8. Return response
    return res.json({
      success: true,
      totalDuration,
      fps,
      resolution: { width, height },
      signals: {
        cuts,
        freezes,
        speedSamples,
        overlayEvents,
        beatTimestamps
      },
      rawFrameDiffs
    });

  } catch (err) {
    console.error('Deep analysis error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
