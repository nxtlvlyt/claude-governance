"""
BFCL handler for locally-served Arch models (Ollama, OpenAI-compatible /v1).

Why this exists rather than reusing QwenHandler: QwenHandler extends OSSHandler, which
loads a HuggingFace tokenizer from `model_name` and therefore requires an HF repo id.
Our model is an Ollama tag (`arch-gov-27b-v33-bare`), not an HF repo, so OSSHandler dies
with "is not a local folder and is not a valid model identifier". We are hitting an
OpenAI-compatible API, not serving locally through vLLM, so the API base class is correct.

Endpoint comes from env so no secret or host is baked into a package file.

2026-08-03 FIX - why the placeholder key below is not a credential:
`bfcl evaluate` calls get_handler() to build a handler purely to reuse its response
DECODER; it never issues a request. But OpenAICompletionsHandler.__init__ constructs an
`OpenAI()` client from OPENAI_API_KEY, and that constructor raises when the variable is
unset - so scoring died before reading a single result row, with a credentials error that
looks like it needs a real key. It does not. Two lines later this class throws that client
away and replaces it with one pointed at local Ollama.

The value below is a placeholder to satisfy a constructor whose object is discarded. It is
never sent anywhere: self.client is overwritten before any call, and its base_url is the
local Ollama server. Setting a REAL OpenAI key here would be both useless and a violation
of the standing ruling against closed-frontier APIs outside Ollama
(~/.claude/rules/operator-rulings.md, 2026-06-09).

setdefault, not assignment: if a real key is already present in the environment for some
other tool, this must not clobber it.
"""

import os

from bfcl_eval.model_handler.api_inference.openai_completion import (
    OpenAICompletionsHandler,
)
from openai import OpenAI

# Must run before OpenAICompletionsHandler.__init__ constructs its client. See module
# docstring: placeholder for a discarded object, never transmitted.
os.environ.setdefault("OPENAI_API_KEY", "ollama-placeholder-not-a-credential")


class ArchLocalHandler(OpenAICompletionsHandler):
    def __init__(self, model_name, temperature, registry_name, is_fc_model, **kwargs) -> None:
        super().__init__(model_name, temperature, registry_name, is_fc_model, **kwargs)
        base_url = os.getenv("REMOTE_OPENAI_BASE_URL") or "http://172.30.144.1:11434/v1"
        api_key = os.getenv("REMOTE_OPENAI_API_KEY") or "ollama"  # Ollama ignores it
        self.client = OpenAI(base_url=base_url, api_key=api_key)
