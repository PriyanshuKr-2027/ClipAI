const { spawn } = require('child_process');
const path = require('path');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const axios = require('axios');

async function importFromYtDlp(url, outputDir, onProgress) {
  const outputTemplate = path.join(outputDir, `${uuid()}.%(ext)s`);
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--output', outputTemplate,
      '--print', 'after_move:filepath',
      '--no-playlist',
      '--progress',
      url
    ]);
    let finalPath = null;

    proc.stdout.on('data', d => {
      const output = d.toString();
      const line = output.trim();
      if (line.endsWith('.mp4') || line.endsWith('.mkv') || line.endsWith('.webm')) {
        finalPath = line;
      }
      
      const pctMatch = output.match(/(\d+\.\d+)%/);
      const speedMatch = output.match(/at\s+([\d\.]+\w+\/s)/i);
      const etaMatch = output.match(/ETA\s+([\d:]+)/i);

      if (pctMatch && onProgress) {
        onProgress({
          percent: parseFloat(pctMatch[1]),
          speed: speedMatch ? speedMatch[1] : null,
          eta: etaMatch ? etaMatch[1] : null
        });
      }
    });

    proc.stderr.on('data', d => {
      const output = d.toString();
      const pctMatch = output.match(/(\d+\.\d+)%/);
      const speedMatch = output.match(/at\s+([\d\.]+\w+\/s)/i);
      const etaMatch = output.match(/ETA\s+([\d:]+)/i);

      if (pctMatch && onProgress) {
        onProgress({
          percent: parseFloat(pctMatch[1]),
          speed: speedMatch ? speedMatch[1] : null,
          eta: etaMatch ? etaMatch[1] : null
        });
      }
    });

    proc.on('close', code => {
      if (code !== 0 || !finalPath) {
        return reject(new Error('yt-dlp download failed'));
      }
      resolve({ filePath: finalPath });
    });
  });
}

async function importFromInstagram(url, outputDir, onProgress) {
  const shortcodeMatch = url.match(/reel\/([A-Za-z0-9_-]+)|\/p\/([A-Za-z0-9_-]+)/);
  if (!shortcodeMatch) {
    throw new Error('Could not extract Instagram shortcode from URL');
  }
  const shortcode = shortcodeMatch[1] || shortcodeMatch[2];
  const prefix = uuid();

  return new Promise((resolve, reject) => {
    const args = [
      '--dirname-pattern', outputDir,
      '--filename-pattern', prefix,
      '--no-metadata-json',
      '--no-captions'
    ];

    if (process.env.INSTAGRAM_USERNAME && process.env.INSTAGRAM_PASSWORD) {
      args.push('--login', process.env.INSTAGRAM_USERNAME, '--password', process.env.INSTAGRAM_PASSWORD);
    }

    args.push(`:${shortcode}`);

    if (onProgress) {
      onProgress(0); // Start progress
    }

    const proc = spawn('instaloader', args);

    proc.stdout.on('data', d => {
      const output = d.toString();
      // Instaloader prints status messages, we can feed minor progress updates
      if (onProgress && output.includes('Retrieving')) {
        onProgress(30);
      } else if (onProgress && output.includes('Downloading')) {
        onProgress(60);
      }
    });

    proc.on('close', code => {
      if (onProgress) {
        onProgress(100); // Complete
      }
      // Find the downloaded .mp4 file
      const files = fs.readdirSync(outputDir).filter(f => f.startsWith(prefix) && f.endsWith('.mp4'));
      if (!files.length) {
        return reject(new Error('Instagram download: no .mp4 file found'));
      }
      resolve({ filePath: path.join(outputDir, files[0]) });
    });
  });
}

async function importFromPlaywright(url, outputDir, onProgress) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  let videoUrl = null;
  page.on('response', async (response) => {
    const ct = response.headers()['content-type'] || '';
    if (ct.startsWith('video/') && response.url().includes('mp4')) {
      videoUrl = response.url();
    }
  });

  if (onProgress) {
    onProgress(10); // Launched browser
  }
  
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await browser.close();
  
  if (!videoUrl) {
    throw new Error('Playwright could not find a video stream on this page');
  }

  if (onProgress) {
    onProgress(40); // Stream located, starting download
  }
  
  // Download the intercepted video URL using axios
  const outputPath = path.join(outputDir, `${uuid()}.mp4`);
  const writer = fs.createWriteStream(outputPath);

  const response = await axios({
    url: videoUrl,
    method: 'GET',
    responseType: 'stream'
  });

  const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
  let receivedBytes = 0;

  response.data.on('data', chunk => {
    receivedBytes += chunk.length;
    if (totalBytes > 0 && onProgress) {
      // Scale progress between 40% and 100%
      const downloadPct = (receivedBytes / totalBytes) * 60;
      onProgress(parseFloat((40 + downloadPct).toFixed(1)));
    }
  });

  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  
  return { filePath: outputPath };
}

module.exports = {
  importFromYtDlp,
  importFromInstagram,
  importFromPlaywright
};
