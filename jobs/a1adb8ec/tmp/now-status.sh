#!/usr/bin/env bash
# One-shot live status: base-Prompt lane progress + trainer queue state.
set -uo pipefail
R=/root/bfclproj/result/qwen3.6-27b-base/agentic/BFCL_v4_web_search_base_result.json
echo -n "base-Prompt entries banked: "; [ -f "$R" ] && wc -l < "$R" || echo 0
echo -n "bfcl lane proc: "; ps -eo args | grep -c '[b]fcl generate' || true
echo -n "trainer chain waiting: "; ps -eo args | grep -c '[t]rain-v35' || true
exit 0
