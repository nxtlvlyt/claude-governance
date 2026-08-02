#!/bin/bash
echo "--- files ---"
ls -la ~/bfclproj/ 2>/dev/null | head -8
echo "--- log tail ---"
tail -16 ~/bfclproj/bfcl.log 2>/dev/null || echo "(no log)"
echo "--- running? ---"
pgrep -af bfcl | head -3 || echo "(no bfcl process)"
echo "--- done marker ---"
cat ~/bfclproj/bfcl.done 2>/dev/null || echo "(not done)"
