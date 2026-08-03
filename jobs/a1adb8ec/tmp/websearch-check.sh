#!/bin/bash
echo "=== what does BFCL web_search need? ==="
grep -rn "SERPAPI\|serpapi\|SERP_API\|search_api\|WEB_SEARCH\|tavily\|brave" ~/bfclenv/lib/python3.12/site-packages/bfcl_eval/ 2>/dev/null | head -8
echo "=== env keys it looks for ==="
grep -rn "getenv\|environ" ~/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/*.py 2>/dev/null | grep -i "search\|serp" | head -5
echo "=== .env.example search-related lines ==="
grep -i "search\|serp" ~/bfclenv/lib/python3.12/site-packages/bfcl_eval/.env.example 2>/dev/null | head -8
