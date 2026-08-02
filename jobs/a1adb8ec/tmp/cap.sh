#!/bin/bash
H=~/bfclenv/lib/python3.12/site-packages/bfcl_eval/model_handler/api_inference/openai_completion.py
grep -n "max_tokens\|max_completion_tokens\|def _query_prompting\|temperature=" $H | head -12
