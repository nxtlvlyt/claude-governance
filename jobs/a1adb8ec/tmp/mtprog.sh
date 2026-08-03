#!/bin/bash
echo "--- rows so far ---"
find ~/bfclproj/result -name "*multi_turn*" -exec sh -c 'echo "  $(wc -l < "$1") $(basename $1)"' _ {} \; 2>/dev/null
echo "--- running ---"
pgrep -af "bfcl generate" | grep -o "test-category [a-z_]*" | head -2
echo "--- dataset sizes ---"
for f in base miss_func miss_param; do
  n=$(wc -l < /root/bfclenv/lib/python3.12/site-packages/bfcl_eval/data/BFCL_v4_multi_turn_$f.json 2>/dev/null)
  echo "  multi_turn_$f: $n cases"
done
