#!/usr/bin/env bash
# Holdout eval + teacher spec dispatch, run FROM NXTBEAST so no laptop task kill can touch it.
#
# Two local background tasks were killed mid-run within minutes of starting (the third and
# fourth such kills today). The one launch mode that has survived everything is a Windows
# scheduled task on nxtbeast driving WSL. So both jobs move there. This script is stdlib-only
# python3 (urllib/json) — no venv needed for the eval; the dispatch is pure API calls.
#
# Order: spec dispatch first (cloud, ~5 min), then holdout eval (GPU, ~40-60 min), because a
# kill after the dispatch still leaves the drafts banked.
set -uo pipefail
LOG=/root/bfclproj/eval-and-spec.log
exec > >(tee -a "$LOG") 2>&1
echo "######## EVAL+SPEC $(date -Is) ########"

cd /mnt/c/Users/marka/cq-v34

echo "=== 1. teacher spec drafts (cloud; conductor judges later) ==="
python3 phase4/dispatch-spec-draft.py || echo "  dispatch rc=$?"

echo
echo "=== 2. holdout eval: v3.4 vs v3.3 vs base on the 66 valid unseen rows ==="
python3 phase4/holdout-eval.py || echo "  eval rc=$?"

echo
echo "######## EVAL+SPEC DONE $(date -Is) ########"
