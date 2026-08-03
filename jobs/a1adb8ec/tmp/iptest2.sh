#!/bin/bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
for U in "https://html.duckduckgo.com/html/?q=qlora+catastrophic+forgetting" \
         "https://www.bing.com/search?q=qlora+catastrophic+forgetting" \
         "https://lite.duckduckgo.com/lite/?q=qlora+catastrophic+forgetting"; do
  R=$(curl -s -A "$UA" --max-time 25 -w "|HTTP:%{http_code}|BYTES:%{size_download}" "$U")
  META=$(echo "$R" | tail -c 40)
  BODY=$(echo "$R" | head -c 100000)
  HITS=$(echo "$BODY" | grep -oic "qlora" 2>/dev/null)
  CAP=$(echo "$BODY" | grep -oicE "captcha|unusual traffic|are you a robot|blocked" 2>/dev/null)
  echo "  ${U:8:40} $META  qlora_mentions=$HITS captcha_words=$CAP"
done
