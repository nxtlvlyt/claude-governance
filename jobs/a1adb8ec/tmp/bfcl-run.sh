#!/bin/bash
export BFCL_PROJECT_ROOT=~/bfclproj
mkdir -p $BFCL_PROJECT_ROOT
cat > $BFCL_PROJECT_ROOT/.env <<'ENVEOF'
OPENAI_API_KEY=ollama
REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
REMOTE_OPENAI_API_KEY=ollama
LOCAL_SERVER_ENDPOINT=172.30.144.1
LOCAL_SERVER_PORT=11434
ENVEOF
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
timeout 2700 ~/bfclenv/bin/bfcl generate --model arch-gov-27b --test-category irrelevance --skip-server-setup --num-threads 1 2>&1 | tail -16
