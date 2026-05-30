const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const tempDir = path.resolve(path.join(__dirname, '..', 'temp'));
const testVideoPath = path.join(tempDir, 'youtube_test.mp4');

// Ensure test photos exist, or write dummy ones
function getTestPhotos() {
  const photos = [];
  const files = fs.readdirSync(tempDir);
  for (const f of files) {
    if (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png')) {
      photos.push(path.join(tempDir, f));
      if (photos.length === 3) break;
    }
  }
  
  // Write mock images if not enough found
  while (photos.length < 3) {
    const idx = photos.length;
    const mockPath = path.join(tempDir, `mock_photo_${idx}.jpg`);
    // Create a 1x1 black pixel JPEG or dummy file
    fs.writeFileSync(mockPath, Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
      0x00, 0x60, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
      0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
      0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08,
      0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x37, 0xFF, 0xD9
    ]));
    photos.push(mockPath);
  }
  return photos;
}

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

async function testRoute(payload, description) {
  console.log(`\nTesting Render Case: ${description}...`);
  const response = await fetch('http://localhost:3001/api/transitions/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Render failed: Status ${response.status}, Body: ${errText}`);
  }

  const result = await response.json();
  console.log(`✓ Success: Output saved at: ${result.outputPath}`);
  if (!fs.existsSync(result.outputPath)) {
    throw new Error(`Output file not found on disk at: ${result.outputPath}`);
  }
  return result.outputPath;
}

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
    await new Promise(resolve => setTimeout(resolve, 3000));
  } else {
    console.log('Server is already running on port 3001.');
  }

  const testPhotos = getTestPhotos();
  console.log('Using test photos:', testPhotos);

  const outputsToClean = [];

  try {
    // 1. Test slideshow_cuts with backward compatibility slots array
    const output1 = await testRoute({
      slots: [
        { slotIndex: 0, photoPath: testPhotos[0], duration: 1.5, motionSuggestion: 'slow_zoom_in' },
        { slotIndex: 1, photoPath: testPhotos[1], duration: 1.0, motionSuggestion: 'pan_left' }
      ],
      outputFilename: 'test_render_slideshow_compat',
      jobId: 'compat_job'
    }, 'slideshow_cuts (legacy compatibility format)');
    outputsToClean.push(output1);

    // 2. Test slideshow_cuts with new recipe schema
    const output2 = await testRoute({
      backgroundVideoPath: testVideoPath,
      recipe: {
        technique: 'slideshow_cuts',
        slots: [
          { slotIndex: 0, duration: 1.5, animationIn: 'zoom_in' },
          { slotIndex: 1, duration: 1.0, animationIn: 'slide_left' }
        ]
      },
      userMedia: [
        { slotIndex: 0, filePath: testPhotos[0], type: 'photo' },
        { slotIndex: 1, filePath: testPhotos[1], type: 'photo' }
      ],
      outputFilename: 'test_render_slideshow_recipe',
      jobId: 'recipe_job'
    }, 'slideshow_cuts (new recipe schema)');
    outputsToClean.push(output2);

    // 3. Test freeze_overlay technique
    const output3 = await testRoute({
      backgroundVideoPath: testVideoPath,
      recipe: {
        technique: 'freeze_overlay',
        slots: [
          { slotIndex: 0, startTime: 2.0, endTime: 3.5, duration: 1.5, layer: 'overlay', position: 'top_left', animationIn: 'slide_right' },
          { slotIndex: 1, startTime: 2.5, endTime: 3.5, duration: 1.0, layer: 'overlay', position: 'bottom_right', animationIn: 'fade' }
        ]
      },
      userMedia: [
        { slotIndex: 0, filePath: testPhotos[0], type: 'photo' },
        { slotIndex: 1, filePath: testPhotos[1], type: 'photo' }
      ],
      outputFilename: 'test_render_freeze_overlay',
      jobId: 'freeze_job'
    }, 'freeze_overlay technique');
    outputsToClean.push(output3);

    // 4. Test speed_ramp technique
    const output4 = await testRoute({
      backgroundVideoPath: testVideoPath,
      recipe: {
        technique: 'speed_ramp',
        speedRamps: [
          { start: 2.0, end: 4.0, speedFactor: 2.0 },
          { start: 6.0, end: 8.0, speedFactor: 0.5 }
        ]
      },
      userMedia: [],
      outputFilename: 'test_render_speed_ramp',
      jobId: 'speed_job'
    }, 'speed_ramp technique');
    outputsToClean.push(output4);

    // 5. Test zoom_transitions technique
    const output5 = await testRoute({
      recipe: {
        technique: 'zoom_transitions',
        slots: [
          { slotIndex: 0, duration: 1.5, animationIn: 'zoom_out' },
          { slotIndex: 1, duration: 1.0, animationIn: 'zoom_in' }
        ]
      },
      userMedia: [
        { slotIndex: 0, filePath: testPhotos[0], type: 'photo' },
        { slotIndex: 1, filePath: testPhotos[1], type: 'photo' }
      ],
      outputFilename: 'test_render_zoom_trans',
      jobId: 'zoom_job'
    }, 'zoom_transitions technique');
    outputsToClean.push(output5);

    // 6. Test layered_composite technique
    const output6 = await testRoute({
      backgroundVideoPath: testVideoPath,
      recipe: {
        technique: 'layered_composite',
        slots: [
          { slotIndex: 0, startTime: 1.0, endTime: 3.0, duration: 2.0, layer: 'overlay', position: 'center', animationIn: 'fade' }
        ]
      },
      userMedia: [
        { slotIndex: 0, filePath: testPhotos[0], type: 'photo' }
      ],
      outputFilename: 'test_render_layered',
      jobId: 'layered_job'
    }, 'layered_composite technique');
    outputsToClean.push(output6);

    // 7. Test hybrid technique (overlay + speed ramps)
    const output7 = await testRoute({
      backgroundVideoPath: testVideoPath,
      recipe: {
        technique: 'hybrid',
        slots: [
          { slotIndex: 0, startTime: 1.5, endTime: 3.5, duration: 2.0, layer: 'overlay', position: 'top_right', animationIn: 'slide_left' }
        ],
        speedRamps: [
          { start: 4.0, end: 6.0, speedFactor: 2.0 }
        ]
      },
      userMedia: [
        { slotIndex: 0, filePath: testPhotos[0], type: 'photo' }
      ],
      outputFilename: 'test_render_hybrid',
      jobId: 'hybrid_job'
    }, 'hybrid technique');
    outputsToClean.push(output7);

    console.log('\n✓ ALL RENDERING TESTS PASSED AND VERIFIED!');

  } catch (err) {
    console.error('\n❌ Test execution failed:', err);
  } finally {
    if (serverProcess) {
      console.log('Stopping spawned local server...');
      serverProcess.kill();
    }
    // Cleanup generated outputs
    console.log('Cleaning up test outputs...');
    for (const out of outputsToClean) {
      if (fs.existsSync(out)) {
        try { fs.unlinkSync(out); } catch (_) {}
      }
    }
  }
}

run();
