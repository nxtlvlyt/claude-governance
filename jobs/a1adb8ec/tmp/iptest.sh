#!/bin/bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
echo "=== duckduckgo html from THIS host ==="
curl -s -A "$UA" --max-time 20 "https://html.duckduckgo.com/html/?q=qlora+catastrophic+forgetting" \
  | grep -oE "result__a[^>]*>[^<]{10,70}" | head -3
echo "=== bing from THIS host ==="
curl -s -A "$UA" --max-time 20 "https://www.bing.com/search?q=qlora+catastrophic+forgetting" \
  | grep -oiE "<h2><a[^>]*>[^<]{10,70}" | head -3
