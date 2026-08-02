import io, os, re, sys

C = os.path.expanduser("~/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py")
t = io.open(C, encoding="utf-8").read()

if "arch-gov-27b" in t:
    print("ALREADY-REGISTERED")
    sys.exit(0)

anchor = '    "Qwen/Qwen3-0.6B": ModelConfig('
i = t.find(anchor)
if i < 0:
    print("ANCHOR-NOT-FOUND")
    sys.exit(1)

# Two registrations on purpose:
#   arch-gov-27b      -> PROMPT mode. This is how the model is actually used today and how
#                        every result in V33-SCORECARD.md was produced.
#   arch-gov-27b-FC   -> NATIVE function-calling. The model was NOT trained on tool-call
#                        format (0/360 corpus rows are multi-turn), so this is expected to
#                        score badly. That is the DIAGNOSTIC: it measures the exact gap.
new = '''    "arch-gov-27b": ModelConfig(
        model_name="arch-gov-27b-v33-bare",
        display_name="Arch-Gov-27B v3.3 (Prompt)",
        url="local://arch-gov-27b-v33-bare",
        org="local",
        license="apache-2.0",
        model_handler=QwenHandler,
        input_price=None,
        output_price=None,
        is_fc_model=False,
        underscore_to_dot=False,
    ),
    "arch-gov-27b-FC": ModelConfig(
        model_name="arch-gov-27b-v33-bare",
        display_name="Arch-Gov-27B v3.3 (FC)",
        url="local://arch-gov-27b-v33-bare",
        org="local",
        license="apache-2.0",
        model_handler=QwenHandler,
        input_price=None,
        output_price=None,
        is_fc_model=True,
        underscore_to_dot=False,
    ),
    "qwen3.6-27b-base": ModelConfig(
        model_name="qwen3.6:27b",
        display_name="Qwen3.6-27B untuned control (Prompt)",
        url="local://qwen3.6-27b",
        org="Qwen",
        license="apache-2.0",
        model_handler=QwenHandler,
        input_price=None,
        output_price=None,
        is_fc_model=False,
        underscore_to_dot=False,
    ),
'''
t = t[:i] + new + t[i:]
io.open(C, "w", encoding="utf-8").write(t)
print("REGISTERED arch-gov-27b, arch-gov-27b-FC, qwen3.6-27b-base")
