#!/bin/bash
echo "--- bfcl alive? ---"
pgrep -af "bfcl (generate|evaluate)" | head -3 || echo "(no bfcl process)"
echo "--- which category is it on? ---"
pgrep -af bfcl | grep -o "test-category [a-z_]*" | head -3
echo "--- result files + sizes ---"
find ~/bfclproj/result -type f -exec ls -la {} \; 2>/dev/null | head -5
echo "--- open http connections from bfcl ---"
ss -tnp 2>/dev/null | grep 11434 | head -5 || echo "(ss unavailable)"
