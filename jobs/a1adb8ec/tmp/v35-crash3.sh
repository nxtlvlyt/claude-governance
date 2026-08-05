#!/usr/bin/env bash
# Relaunch #3's death: error lines above the newest rc=134 marker.
set -uo pipefail
awk '/######## TRAIN v3.5 2026-08-05T14:3/{found=1} found' /root/bfclproj/train-v35.log | tr '\r' '\n' | grep -vE '^\s*$|Loading weights|it/s\]$' | head -50
exit 0
