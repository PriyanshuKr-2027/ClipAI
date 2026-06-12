import os
import sys
import subprocess

# Reconfigure stdout to use UTF-8 to prevent encoding crashes on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SCRIPTS = [
    'check_deps.py',
    'clip_score.py',
    'demucs_separate.py',
    'faster_whisper_server.py',
    'insightface_thumb.py',
    'librosa_beat.py',
    'librosa_silence.py',
    'noisereduce_pass.py',
    'pedalboard_master.py',
    'scenedetect.py',
    'spacy_breaks.py',
    'translate_captions.py',
    'yolo_detect.py'
]

def test_script(script_name):
    script_path = os.path.join(os.path.dirname(__file__), script_name)
    
    # Use venv python if available, same as getPythonBin in the node bridge
    venv_python = None
    if sys.platform == 'win32':
        candidate = os.path.join(os.path.dirname(__file__), 'venv', 'Scripts', 'python.exe')
        if os.path.exists(candidate):
            venv_python = candidate
    else:
        candidate = os.path.join(os.path.dirname(__file__), 'venv', 'bin', 'python3')
        if os.path.exists(candidate):
            venv_python = candidate
            
    python_bin = venv_python if venv_python else sys.executable

    # 1. Test syntax compilation (Syntax and compilation check)
    try:
        res_import = subprocess.run(
            [python_bin, '-m', 'py_compile', script_path],
            capture_output=True,
            text=True
        )
        if res_import.returncode != 0:
            return False, f"Syntax compilation failed: {res_import.stderr.strip()}"
    except Exception as e:
        return False, f"Syntax check process failed: {str(e)}"
        
    # 2. Test execution with empty/dummy arguments (checking for unhandled crashes/Tracebacks)
    try:
        res_run = subprocess.run(
            [python_bin, script_path],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(__file__)
        )
        
        # Check if traceback is present in output, which indicates an unhandled crash
        if "Traceback" in res_run.stderr or "Traceback" in res_run.stdout:
            return False, f"Crashed with traceback:\n{res_run.stderr.strip() or res_run.stdout.strip()}"
            
        return True, "Passed"
    except Exception as e:
        return False, f"Execution process failed: {str(e)}"

def main():
    print("Running Python scripts sanity tests...\n")
    all_passed = True
    
    for script in SCRIPTS:
        passed, msg = test_script(script)
        if passed:
            # Green checkmark ✓
            print(f"\033[92m✓\033[0m {script:<30} Passed")
        else:
            all_passed = False
            # Red crossmark ✗
            print(f"\033[91m✗\033[0m {script:<30} Failed: {msg}")
            
    print("\nTest run complete.")
    if not all_passed:
        sys.exit(1)

if __name__ == '__main__':
    main()
