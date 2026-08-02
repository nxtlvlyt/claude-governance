#!/bin/bash
~/bfclenv/bin/python -c "import qwen_agent.llm.base" 2>&1 | tail -8
echo "=== versions ==="
~/bfclenv/bin/pip list 2>/dev/null | grep -Ei "qwen-agent|pydantic|openai|transformers|tiktoken" 
