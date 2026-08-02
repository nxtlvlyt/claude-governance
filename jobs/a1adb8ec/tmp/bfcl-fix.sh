#!/bin/bash
~/bfclenv/bin/pip install --quiet soundfile 2>&1 | tail -2
echo "=== retry CLI ==="
~/bfclenv/bin/bfcl --help 2>&1 | head -14
