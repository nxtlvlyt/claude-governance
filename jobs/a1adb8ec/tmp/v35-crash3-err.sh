#!/usr/bin/env bash
# The named exception in relaunch #3's section.
set -uo pipefail
awk '/######## TRAIN v3.5 2026-08-05T14:3/{found=1} found' /root/bfclproj/train-v35.log | tr '\r' '\n' | grep -nE 'Error|error|memory|terminate|Traceback|raise' | head -12
exit 0
