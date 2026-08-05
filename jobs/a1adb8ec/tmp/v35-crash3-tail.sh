#!/usr/bin/env bash
# The error lines just before the newest rc=134.
set -uo pipefail
awk '/######## TRAIN v3.5 2026-08-05T14:3/{found=1} found' /root/bfclproj/train-v35.log | tr '\r' '\n' | grep -vE '^\s*$|/720 \[' | tail -25
exit 0
