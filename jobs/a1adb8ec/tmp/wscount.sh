#!/bin/bash
echo "  cases in web_search dataset:"
wc -l /root/bfclenv/lib/python3.12/site-packages/bfcl_eval/data/BFCL_v4_web_search*.json 2>/dev/null | tail -3
echo "  progress so far:"
find ~/bfclproj/result -name "*web_search*" -exec sh -c 'echo "    $(wc -l < "$1") rows in $(basename $1)"' _ {} \; 2>/dev/null
echo "  running:"
pgrep -af "bfcl generate" | head -2
