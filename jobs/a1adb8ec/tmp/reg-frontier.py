import io, os
C = os.path.expanduser("~/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py")
t = io.open(C, encoding='utf-8').read()
if 'deepseek-v4-pro-local' in t:
    print("ALREADY"); raise SystemExit
anchor = '    "arch-gov-27b": ModelConfig('
new = '''    "deepseek-v4-pro-local": ModelConfig(
        model_name="deepseek-v4-pro:cloud",
        display_name="DeepSeek-V4-Pro 1.6T (Prompt)",
        url="local://deepseek-v4-pro",
        org="DeepSeek",
        license="mit",
        model_handler=ArchLocalHandler,
        input_price=None,
        output_price=None,
        is_fc_model=False,
        underscore_to_dot=False,
    ),
    "nemotron-ultra-local": ModelConfig(
        model_name="nemotron-3-ultra:cloud",
        display_name="Nemotron-3-Ultra 550B (Prompt)",
        url="local://nemotron-3-ultra",
        org="NVIDIA",
        license="nvidia-open-model-license",
        model_handler=ArchLocalHandler,
        input_price=None,
        output_price=None,
        is_fc_model=False,
        underscore_to_dot=False,
    ),
'''
i = t.find(anchor)
t = t[:i] + new + t[i:]
io.open(C, 'w', encoding='utf-8').write(t)
print("REGISTERED deepseek-v4-pro-local, nemotron-ultra-local")
