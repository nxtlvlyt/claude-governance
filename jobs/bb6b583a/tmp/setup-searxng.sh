#!/bin/bash
set -e
cd /root
if [ ! -f /root/searxng/requirements.txt ]; then
  rm -rf /root/searxng
  git clone https://github.com/searxng/searxng.git /root/searxng
fi
cd /root/searxng
pwd
python3 -m venv .venv
./.venv/bin/pip install -U pip setuptools wheel
./.venv/bin/pip install -e .
echo "SETUP-DONE"
