#!/bin/bash
set -e
cd /opt/searxng
python3 -m venv .venv
./.venv/bin/pip install -U pip setuptools wheel
./.venv/bin/pip install -e .
echo "SETUP-DONE"
