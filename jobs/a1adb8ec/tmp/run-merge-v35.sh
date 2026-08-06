#!/usr/bin/env bash
# Launcher for merge-v35.py — foreground under this shell (the caller backgrounds the ssh).
cd /mnt/c/Users/marka/cq-v34
exec /root/cq-venv/bin/python3 /mnt/c/Users/marka/merge-v35.py > /root/bfclproj/merge-v35.log 2>&1
