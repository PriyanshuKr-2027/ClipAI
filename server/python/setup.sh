#!/bin/bash
cd "$(dirname "$0")"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python3 -m spacy download en_core_web_sm
echo "Setup complete. Run: source server/python/venv/bin/activate"
