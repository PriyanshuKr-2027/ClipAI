const { selectComposition, renderMedia } = require('@remotion/renderer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

const BUNDLE_PATH = path.join(process.cwd(), 'dist-remotion');

/**
 * Renders a caption overlay video using Remotion and server-side Headless Chromium.
 */
async function renderCaptionVideo({
  words,
  style,
  duration,
  width = 1080,
  height = 1920,
  outputDir,
  jobId,
  wss,
  onProgress,
}) {
  // 1. Check bundle exists
  if (!fs.existsSync(BUNDLE_PATH)) {
    throw new Error('Remotion bundle not found. Run: npm run build:remotion');
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${uuid()}_captions.mp4`);
  
  const composition = await selectComposition({
    serveUrl: BUNDLE_PATH,
    id: style,
    inputProps: { words, videoWidth: width, videoHeight: height },
  });

  await renderMedia({
    composition,
    serveUrl: BUNDLE_PATH,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { words, videoWidth: width, videoHeight: height },
    onProgress: ({ progress }) => {
      const percent = Math.round(progress * 100);
      if (onProgress) {
        onProgress(percent);
      }
      wss?.clients?.forEach((client) => {
        // Only send progress messages if the client is connected
        if (client.readyState === 1) { // WebSocket.OPEN is 1
          client.send(
            JSON.stringify({
              type: 'progress',
              jobId,
              percent,
              stage: 'remotion_render',
            })
          );
        }
      });
    },
  });

  return { outputPath };
}

module.exports = {
  renderCaptionVideo,
};
