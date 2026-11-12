"""Build the WebGPU variant of a converted model: fp32 encoder + 4-bit (MatMulNBits) decoder.

ONNX Runtime's WebGPU backend has no integer MatMul kernels, so the uint8 files (the WebAssembly
variant) stall there. MatMulNBits is supported on WebGPU and keeps the decoder small.

Usage: python quantize_gpu.py <fp32-export-dir> <model-out-dir>
"""
import hashlib
import json
import pathlib
import shutil
import sys

import onnx
from onnxruntime.quantization.matmul_nbits_quantizer import MatMulNBitsQuantizer
from onnxruntime.quantization import QuantType, quantize_dynamic
from optimum.onnx import merge_decoders


def main(fp32_dir: pathlib.Path, out_dir: pathlib.Path) -> None:
    onnx_dir = out_dir / "onnx"
    shutil.copy(fp32_dir / "encoder_model.onnx", onnx_dir / "encoder_model.onnx")
    # The quantizer skips If-subgraphs, so quantize the two plain decoders and merge them after.
    work = out_dir.with_name(out_dir.name + "-q4work")
    work.mkdir(exist_ok=True)
    for name in ["decoder_model", "decoder_with_past_model"]:
        quantizer = MatMulNBitsQuantizer(onnx.load(str(fp32_dir / f"{name}.onnx")), block_size=32, is_symmetric=True)
        quantizer.process()
        quantizer.model.save_model_to_file(str(work / f"{name}.onnx"), use_external_data_format=False)
    merge_decoders(
        str(work / "decoder_model.onnx"),
        str(work / "decoder_with_past_model.onnx"),
        save_path=str(work / "merged.onnx"),
        strict=False,
    )
    # The token embedding (a Gather, ~70% of the decoder) to uint8 with a static DequantizeLinear,
    # which WebGPU supports (no dynamic integer ops).
    quantize_dynamic(
        model_input=str(work / "merged.onnx"),
        model_output=str(onnx_dir / "decoder_model_merged_q4.onnx"),
        weight_type=QuantType.QUInt8,
        op_types_to_quantize=["Gather"],
        extra_options={"EnableSubgraph": True},
    )
    shutil.rmtree(work)

    manifest_path = out_dir / "MANIFEST.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["webgpu"] = "encoder fp32 + decoder MatMulNBits 4-bit (block 32, symmetric), embedding uint8"
    files = {}
    for p in sorted(out_dir.rglob("*")):
        if p.is_file() and p.name != "MANIFEST.json":
            files[str(p.relative_to(out_dir))] = {
                "bytes": p.stat().st_size,
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            }
    manifest["files"] = files
    manifest_path.write_text(json.dumps(manifest, indent=2))
    for name in ["encoder_model.onnx", "decoder_model_merged_q4.onnx"]:
        print(f"{out_dir.name}/onnx/{name}: {(onnx_dir / name).stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
