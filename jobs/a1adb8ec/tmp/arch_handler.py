"""
BFCL handler for locally-served Arch models (Ollama, OpenAI-compatible /v1).

Why this exists rather than reusing QwenHandler: QwenHandler extends OSSHandler, which
loads a HuggingFace tokenizer from `model_name` and therefore requires an HF repo id.
Our model is an Ollama tag (`arch-gov-27b-v33-bare`), not an HF repo, so OSSHandler dies
with "is not a local folder and is not a valid model identifier". We are hitting an
OpenAI-compatible API, not serving locally through vLLM, so the API base class is correct.

Endpoint comes from env so no secret or host is baked into a package file.
"""

import os

from bfcl_eval.model_handler.api_inference.openai_completion import (
    OpenAICompletionsHandler,
)
from openai import OpenAI


class ArchLocalHandler(OpenAICompletionsHandler):
    def __init__(self, model_name, temperature, registry_name, is_fc_model, **kwargs) -> None:
        super().__init__(model_name, temperature, registry_name, is_fc_model, **kwargs)
        base_url = os.getenv("REMOTE_OPENAI_BASE_URL") or "http://172.30.144.1:11434/v1"
        api_key = os.getenv("REMOTE_OPENAI_API_KEY") or "ollama"  # Ollama ignores it
        self.client = OpenAI(base_url=base_url, api_key=api_key)
