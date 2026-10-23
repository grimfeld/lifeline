/** Procedural mono 16-bit PCM WAV data URLs — the App's sounds ship as code, no assets. */

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export function floatSamplesToWavDataUrl(samples: Float32Array, sampleRate: number): string {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function sineToneDataUrl(freqHz: number, durationSec: number, sampleRate = 44100, amplitude = 0.22): string {
  const n = Math.max(1, Math.floor(sampleRate * durationSec));
  const buf = new Float32Array(n);
  const attack = Math.floor(sampleRate * 0.012);
  const release = Math.floor(sampleRate * 0.04);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (i < attack) env = i / attack;
    if (i > n - release) env *= (n - i) / release;
    buf[i] = Math.sin(2 * Math.PI * freqHz * t) * amplitude * env;
  }
  return floatSamplesToWavDataUrl(buf, sampleRate);
}

/** Three-tone "fanfare" chip for level-ups. */
export function fanfareDataUrl(sampleRate = 44100): string {
  const d = 0.18;
  const n = Math.floor(sampleRate * d);
  const buf = new Float32Array(n);
  const freqs = [523.25, 659.25, 783.99];
  const seg = Math.floor(n / 3);
  for (let i = 0; i < n; i++) {
    const fi = Math.min(2, Math.floor(i / seg));
    const f = freqs[fi] ?? 440;
    const t = i / sampleRate;
    const env = Math.min(1, i / (sampleRate * 0.02)) * Math.min(1, (n - i) / (sampleRate * 0.05));
    buf[i] = Math.sin(2 * Math.PI * f * t) * 0.18 * env;
  }
  return floatSamplesToWavDataUrl(buf, sampleRate);
}

/** Low pitch-dropping thunk for negative logs. */
export function lowThunkDataUrl(sampleRate = 44100): string {
  const n = Math.floor(sampleRate * 0.12);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const f = 120 * Math.exp(-t * 6);
    const env = Math.min(1, i / (sampleRate * 0.015)) * Math.min(1, (n - i) / (sampleRate * 0.06));
    buf[i] = Math.sin(2 * Math.PI * f * t) * 0.35 * env;
  }
  return floatSamplesToWavDataUrl(buf, sampleRate);
}
