# Speech model conversion

Memorization runs [Tarteel's Whisper fine-tunes for Quran recitation](https://huggingface.co/tarteel-ai)
(Apache 2.0) in the browser with transformers.js. This folder turns the Hugging Face checkpoints into
the ONNX layout transformers.js loads, 8-bit quantized.

| Model                                                  | Source                             | Revision   | WebAssembly | WebGPU |
| ------------------------------------------------------ | ---------------------------------- | ---------- | ----------- | ------ |
| `whisper-base-ar-quran` (default)                      | `tarteel-ai/whisper-base-ar-quran` | `5c3c53fd` | 110 MB      | 142 MB |
| `whisper-tiny-ar-quran` (low-memory devices, fallback) | `tarteel-ai/whisper-tiny-ar-quran` | `c3d7e624` | 67 MB       | 72 MB  |

Each folder holds both variants; a browser downloads only the one for its device.

`manifests/` records the exact files and SHA-256 checksums that were produced.

## Convert

Requires [uv](https://docs.astral.sh/uv/) (it installs Python 3.12 and the pinned packages):

```sh
cd tools/speech-model
uv run --python 3.12 --no-project --with-requirements requirements.txt \
  python convert.py tarteel-ai/whisper-base-ar-quran openai/whisper-base out/whisper-base-ar-quran
uv run --python 3.12 --no-project --with-requirements requirements.txt \
  python convert.py tarteel-ai/whisper-tiny-ar-quran openai/whisper-tiny out/whisper-tiny-ar-quran
```

What it does:

1. Exports the encoder and the merged decoder (with past key values) with Optimum.
2. Quantizes MatMul, Gemm and Gather weights to uint8, including the decoder's `If` subgraphs
   (without `EnableSubgraph` the merged decoder stays at full size). Conv layers stay float:
   ONNX Runtime Web has no `ConvInteger` kernel.
3. Copies the configs and tokenizer, and adds the language/task maps to `generation_config.json`
   from the original OpenAI checkpoint (the fine-tunes omit them).
4. Writes `MANIFEST.json` with the upstream revision and checksums.
5. Builds the WebGPU variant (`quantize_gpu.py`): fp32 encoder + 4-bit `MatMulNBits` decoder with
   a uint8 embedding. WebGPU has no integer MatMul kernels, so the uint8 files stall there.

## Use

- **Development:** copy each `out/<model>` folder to `apps/web/public/models/<model>` (gitignored).
- **Production:** upload each folder to a public bucket path, for example
  `https://models.example.com/whisper-base-ar-quran/...`, and set
  `NEXT_PUBLIC_SPEECH_MODEL_BASE_URL=https://models.example.com` before building. The origin is
  added to the Content-Security-Policy automatically. Files are immutable per revision; serve them
  with `Cache-Control: public, max-age=31536000, immutable` and CORS allowing `GET` from the site.

See `docs/MEMORIZATION.md` for the runtime design and measured accuracy.
