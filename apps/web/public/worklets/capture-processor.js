// AudioWorklet: microphone audio at the device rate → 16 kHz mono Float32 frames (~100 ms each).
// Plain JavaScript because worklets are loaded by URL, not bundled.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; // `sampleRate` is a global in AudioWorkletGlobalScope
    this.position = 0; // fractional read position into the incoming stream
    this.carry = new Float32Array(0);
    this.out = [];
    this.outLength = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels || channels.length === 0) return true;
    // Mix to mono.
    const frames = channels[0].length;
    const mono = new Float32Array(this.carry.length + frames);
    mono.set(this.carry);
    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (const ch of channels) sum += ch[i];
      mono[this.carry.length + i] = sum / channels.length;
    }
    // Resample by averaging each output sample's source window (a simple low-pass for speech).
    const produced = [];
    while (this.position + this.ratio <= mono.length) {
      const start = Math.floor(this.position);
      const end = Math.floor(this.position + this.ratio);
      let sum = 0;
      for (let i = start; i < end; i++) sum += mono[i];
      produced.push(sum / Math.max(1, end - start));
      this.position += this.ratio;
    }
    const consumed = Math.floor(this.position);
    this.carry = mono.slice(consumed);
    this.position -= consumed;
    if (produced.length > 0) {
      this.out.push(Float32Array.from(produced));
      this.outLength += produced.length;
    }
    if (this.outLength >= 1600) {
      const frame = new Float32Array(this.outLength);
      let offset = 0;
      for (const part of this.out) {
        frame.set(part, offset);
        offset += part.length;
      }
      this.port.postMessage(frame, [frame.buffer]);
      this.out = [];
      this.outLength = 0;
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
