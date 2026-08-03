#!/bin/bash
echo "--- running? ---"
pgrep -af "bfcl" | head -3 || echo "  none"
echo "--- rows ---"
find ~/bfclproj/result -name "*web_search*" -exec sh -c 'echo "  $(wc -l < "$1") $(basename $1)"' _ {} \; 2>/dev/null
echo "--- score files ---"
ls -la ~/bfclproj/score/ 2>/dev/null | head -6
grep -iE "web.search" ~/bfclproj/score/data_agentic.csv 2>/dev/null | head -3
