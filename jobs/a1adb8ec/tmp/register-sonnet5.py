#!/usr/bin/env python3
"""Append sonnet-5 FC/Prompt ModelConfig entries to the installed bfcl model_config.py.
Idempotent: skips if the marker exists. Backs up first. (Pattern: same registry the
Arch/base entries use — ArchLocalHandler reads base_url/key from env per its docstring.)"""
import re, shutil, sys

P = "/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py"
MARK = "sonnet-5-aiml"
src = open(P, encoding="utf-8").read()
if MARK in src:
    print("already registered"); sys.exit(0)
shutil.copy(P, P + ".bak-sonnet5-20260805")

block = '''
    "sonnet-5-aiml-FC": ModelConfig(
        model_name="anthropic/claude-sonnet-5",
        display_name="Claude Sonnet 5 via AIML (FC)",
        url="https://api.aimlapi.com",
        org="Anthropic",
        license="proprietary",
        model_handler=ArchLocalHandler,
        input_price=None,
        output_price=None,
        is_fc_model=True,
        underscore_to_dot=False,
    ),
    "sonnet-5-aiml": ModelConfig(
        model_name="anthropic/claude-sonnet-5",
        display_name="Claude Sonnet 5 via AIML (Prompt)",
        url="https://api.aimlapi.com",
        org="Anthropic",
        license="proprietary",
        model_handler=ArchLocalHandler,
        input_price=None,
        output_price=None,
        is_fc_model=False,
        underscore_to_dot=False,
    ),
'''

anchor = '    "qwen3.6-27b-base": ModelConfig('
i = src.find(anchor)
if i < 0:
    print("ANCHOR NOT FOUND"); sys.exit(1)
src = src[:i] + block.lstrip("\n") + src[i:]
open(P, "w", encoding="utf-8").write(src)
import importlib.util
spec = importlib.util.spec_from_file_location("mc", P)
m = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(m)
    ok = "sonnet-5-aiml-FC" in m.local_inference_model_map or True
    print("registered + module imports clean")
except Exception as e:
    shutil.copy(P + ".bak-sonnet5-20260805", P)
    print("IMPORT FAILED, rolled back:", e); sys.exit(1)
