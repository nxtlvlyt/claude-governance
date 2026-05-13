# KV cache RAM budget — compute before invocation, not after failure

**Ruling:** When invoking a large local model (Ollama or equivalent), the model's native `context_length` field is not a safe allocation claim. It is the architecture's theoretical maximum, not what fits in the current RAM budget after model weights are already resident. Passing eligibility on context_length and then failing at runtime with "memory layout cannot be allocated" or equivalent OOM is the predictable failure mode of skipping the RAM budget check.

The pre-invocation check is: **does the KV cache for the requested context window fit in the RAM that remains after system overhead and model weights?** If that question isn't answered before the call, the runtime answers it the hard way.

---

## The formula (web-verified 2026-05-04)

```
kv_bytes_per_token = num_layers × num_kv_heads × head_dim × 2 × 2
```

Where:
- `num_layers` = transformer block count (`block_count` in Ollama model_info)
- `num_kv_heads` = KV attention heads (`attention.head_count_kv` in Ollama model_info)
- `head_dim` = `embedding_length / attention.head_count` (derived; not returned directly)
- `× 2` = both K and V tensors
- `× 2` = fp16 bytes per element

KV cache total bytes for a given context window: `kv_bytes_per_token × num_ctx`

Verified against: https://www.omrimallis.com/posts/techniques-for-kv-cache-optimization/ — identical derivation.

---

## Dynamic RAM budget

Static "context headroom" fields in config files are wrong as soon as model weights change. The correct budget is:

```
kv_budget_bytes = (total_ram_gb - system_reserved_gb - model_weight_gb) × 0.80
```

The 0.80 factor accounts for OS memory pressure, buffer space, and non-KV model state. Do not compute against total_ram - system_reserved only; the model weights are the single largest variable and they change per model.

**The test:** `kv_bytes_per_token × num_ctx ≤ kv_budget_bytes`

If it fails, reduce `num_ctx` to the largest power-of-two that passes.

---

## Mamba hybrid caveat

Mamba SSM hybrid models (nemotron-h, nemotron-super, and similar) report `attention.head_count_kv = null` in Ollama model_info because Mamba SSM layers do not use traditional KV cache. The key exists; its value is None — not "key absent."

When `head_count_kv` is None, fall back to `head_count` (full attention head count). This produces a **conservative (pessimistic) estimate** — the true KV footprint is smaller because some layers are SSM not attention. The calculator will compute a lower `max_safe_num_ctx` than empirically achievable. That is the correct failure direction: safe floor, not unsafe ceiling.

Do not skip the calculation because `head_count_kv` is None. Falling back to `head_count` is the specified behavior.

---

## Root cause of the ruling (2026-05-04 incident)

`mistral-medium-3.5:128b-q8_0` at 128K context passed eligibility (native context_length = 128K) and failed at runtime with "memory layout cannot be allocated." Post-hoc arithmetic:

```
model weights:    ~126 GB  (128B params × 8.5 bpp ÷ 8)
KV cache @ 128K:  ~44 GB   (88 layers × 8 KV heads × 128 head_dim × 2 × 2B × 131072)
total needed:     ~170 GB
available budget:  ~40 GB  (192 - 16 system - 126 model = 50 GB × 0.80)
result:           FAILS
```

`mistral-large:latest` at 128K passes (model weights ~14 GB, budget ~129 GB available, KV ~44 GB → fits). Same context window, same hardware, opposite outcomes — because model weight size dominates the budget.

---

## Operational checklist

Before invoking any local model at a large context window:

1. Query `/api/show` for architecture params: `block_count`, `attention.head_count`, `attention.head_count_kv`, `embedding_length`
2. Compute `head_dim = embedding_length / head_count`
3. Compute `kv_bytes_per_token`
4. Compute `kv_budget_bytes` using actual model weight size (from `general.parameter_count × bpp / 8` or from profile)
5. Verify `kv_bytes_per_token × num_ctx ≤ kv_budget_bytes`
6. If fails: halve `num_ctx` and re-test

Do not rely on context_length from model_info as a proxy for "this context window is safe to attempt."

---

## Scope

Applies whenever large local models are invoked: auditions, preflight probes, witness dispatches, any context-sensitive call. The formula is hardware-agnostic. The budget numbers are machine-specific — use the operator's `resources.yaml` (or equivalent) for `total_ram_gb` and `system_reserved_gb`, not hardcoded values.

**Warroom implementation:** `C:\warroom\core\kv_calculator.py` — queries Ollama live, writes computed fields (`max_safe_num_ctx`, `recommended_num_ctx`, `kv_bytes_per_token`, `kv_bytes_at_80k_ctx`) to `config/model_profiles.yaml` at registration time. See decision log `C:\warroom\logs\decisions\2026\05\04\kv-calculator-added.md`.
