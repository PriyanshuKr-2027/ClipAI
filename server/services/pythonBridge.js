const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PYTHON_DIR = path.join(__dirname, '../python');

// Use venv python if it exists, fall back to system python3.
function getPythonBin() {
  const venvPython = process.platform === 'win32'
    ? path.join(PYTHON_DIR, 'venv/Scripts/python.exe')
    : path.join(PYTHON_DIR, 'venv/bin/python3');

  try {
    fs.accessSync(venvPython);
    return venvPython;
  } catch {
    return process.platform === 'win32' ? 'python' : 'python3';
  }
}

async function runPythonScript(scriptName, args = [], timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PYTHON_DIR, scriptName);
    const proc = spawn(getPythonBin(), [scriptPath, ...args.map(String)]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Python script timed out: ${scriptName}`));
    }, timeoutMs);

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`Python script failed (${scriptName}): ${stderr.slice(-500)}`));
      }

      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`Failed to parse Python output from ${scriptName}: ${stdout.slice(-200)}`));
      }
    });
  });
}

async function checkPythonAvailable() {
  const pythonBin = getPythonBin();
  const venvPython = process.platform === 'win32'
    ? path.join(PYTHON_DIR, 'venv/Scripts/python.exe')
    : path.join(PYTHON_DIR, 'venv/bin/python3');

  return new Promise((resolve) => {
    const proc = spawn(pythonBin, ['--version']);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('error', () => {
      resolve({ available: false, version: '', venvFound: fs.existsSync(venvPython) });
    });

    proc.on('close', (code) => {
      const version = `${stdout}${stderr}`.trim();
      resolve({
        available: code === 0,
        version,
        venvFound: fs.existsSync(venvPython)
      });
    });
  });
}

module.exports = {
  runPythonScript,
  checkPythonAvailable
};
