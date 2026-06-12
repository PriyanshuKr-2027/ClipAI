@echo off
cd /d "%~dp0"
python -m venv venv
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt
python -m spacy download en_core_web_sm
echo Setup complete.
