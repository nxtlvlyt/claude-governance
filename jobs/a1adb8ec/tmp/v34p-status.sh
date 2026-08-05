#!/usr/bin/env bash
# v3.4-Prompt lane progress: banked rows + timeout count so far.
set -uo pipefail
R=/root/bfclproj/result/arch-gov-27b-v34/agentic/BFCL_v4_web_search_base_result.json
echo -n "v34-Prompt entries banked: "; [ -f "$R" ] && wc -l < "$R" || echo 0
echo -n "timeouts so far          : "; [ -f "$R" ] && (grep -c 'APITimeoutError\|Request timed out' "$R" || true) || echo -
exit 0
