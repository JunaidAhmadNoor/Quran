"""Convert Tarteel's Whisper Quran models to ONNX for transformers.js: a uint8 variant for
WebAssembly and an fp32-encoder + 4-bit-decoder variant for WebGPU.

Usage:
    uv run --python 3.12 --no-project --with-requirements requirements.txt \
        python convert.py tarteel-ai/whisper-base-ar-quran openai/whisper-base out/whisper-base-ar-quran

The output folder is uploaded as-is to the model host (see docs/MEMORIZATION.md).
"""
import hashlib
import json
import pathlib
import shutil
import sys
import urllib.request

from huggingface_hub import model_info
from onnxruntime.quantization import QuantType, quantize_dynamic
from optimum.exporters.onnx import main_export

import quantize_gpu

CONFIG_FILES = [
    "config.json", "preprocessor_config.json", "tokenizer.json", "tokenizer_config.json",
    "special_tokens_map.json", "added_tokens.json", "vocab.json", "merges.txt", "normalizer.json",
]


def main(model_id: str, base_id: str, out_dir: pathlib.Path) -> None:
    revision = model_info(model_id).sha  # pin the exact upstream commit
    fp32_dir = out_dir.with_name(out_dir.name + "-fp32")
    shutil.rmtree(fp32_dir, ignore_errors=True)
    shutil.rmtree(out_dir, ignore_errors=True)

    # 1. Export the encoder and the merged decoder (with past key values) to ONNX.
    main_export(model_id, output=fp32_dir, task="automatic-speech-recognition-with-past", revision=revision)

    # 2. Dynamic uint8 quantization of MatMul, Gemm and Gather weights, including the If-subgraphs
    #    of the merged decoder (without EnableSubgraph it barely shrinks). Conv stays float because
    #    ONNX Runtime Web has no ConvInteger kernel.
    (out_dir / "onnx").mkdir(parents=True)
    for name in ["encoder_model", "decoder_model_merged"]:
        quantize_dynamic(
            model_input=str(fp32_dir / f"{name}.onnx"),
            model_output=str(out_dir / "onnx" / f"{name}_quantized.onnx"),
            weight_type=QuantType.QUInt8,
            op_types_to_quantize=["MatMul", "Gemm", "Gather"],
            per_channel=False,
            reduce_range=False,
            extra_options={"EnableSubgraph": True},
        )

    # 3. Configs and tokenizer.
    for f in CONFIG_FILES:
        if (fp32_dir / f).exists():
            shutil.copy(fp32_dir / f, out_dir / f)

    # 4. Generation config: the fine-tuned repos lack the language/task maps Whisper needs; take
    #    them from the original OpenAI checkpoint of the same size (same tokenizer and vocabulary).
    with urllib.request.urlopen(f"https://huggingface.co/{base_id}/raw/main/generation_config.json") as r:
        base_gen = json.load(r)
    gen_path = fp32_dir / "generation_config.json"
    gen = json.loads(gen_path.read_text()) if gen_path.exists() else {}
    for key, value in base_gen.items():
        gen.setdefault(key, value)
    gen["forced_decoder_ids"] = None  # language and task are passed at inference time
    (out_dir / "generation_config.json").write_text(json.dumps(gen, indent=2))

    # 5. Manifest: provenance and checksums.
    files = {}
    for p in sorted(out_dir.rglob("*")):
        if p.is_file():
            files[str(p.relative_to(out_dir))] = {
                "bytes": p.stat().st_size,
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            }
    manifest = {
        "source": model_id,
        "revision": revision,
        "license": "Apache-2.0",
        "generation_config_from": base_id,
        "quantization": "dynamic uint8: MatMul, Gemm, Gather (incl. If-subgraphs); Conv stays float",
        "files": files,
    }
    (out_dir / "MANIFEST.json").write_text(json.dumps(manifest, indent=2))

    # 6. The WebGPU variant (fp32 encoder + 4-bit decoder) from the same export.
    quantize_gpu.main(fp32_dir, out_dir)
    shutil.rmtree(fp32_dir, ignore_errors=True)
    total = sum(f["bytes"] for f in files.values())
    print(f"OK {model_id}@{revision[:8]} -> {out_dir} ({total / 1e6:.1f} MB)")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3]))
