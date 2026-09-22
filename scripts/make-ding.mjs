/* Generates public/sounds/ding.wav — the Top Five celebration ding.
 *
 * Synthesised rather than downloaded, so its provenance is not a question
 * anybody has to answer later: nothing here is sampled from a recording, so
 * there is no licence attached to it. Run `npm run sound` to regenerate.
 *
 * It is a two-note bell, G5 then C6 a beat behind it, each with a couple of
 * slightly inharmonic partials so it reads as a struck bell rather than a
 * sine beep, and an exponential decay. Short, bright and not a fanfare: it
 * fires several times an afternoon in a room where people are working.
 */

import { writeFileSync } from 'node:fs';

const RATE = 44100;
const SECONDS = 0.62;
const N = Math.floor(RATE * SECONDS);

/* Partial ratios of a small bell: the octave is true, the third partial sits
   slightly sharp, which is what stops it sounding like a tuning fork. */
const PARTIALS = [
  { ratio: 1.0, gain: 1.00, decay: 3.4 },
  { ratio: 2.0, gain: 0.42, decay: 4.8 },
  { ratio: 3.01, gain: 0.18, decay: 7.0 },
  { ratio: 4.17, gain: 0.08, decay: 9.5 },
];

const NOTES = [
  { freq: 784.0, at: 0.000, gain: 0.85 },   // G5
  { freq: 1046.5, at: 0.085, gain: 1.00 },  // C6
];

const samples = new Float32Array(N);

for (const note of NOTES) {
  const start = Math.floor(note.at * RATE);
  for (let i = start; i < N; i += 1) {
    const t = (i - start) / RATE;
    /* A 4ms attack. Starting a sine at full amplitude is a step change, which
       is heard as a click before the note. */
    const attack = Math.min(1, t / 0.004);
    let v = 0;
    for (const p of PARTIALS) {
      v += p.gain * Math.exp(-p.decay * t) * Math.sin(2 * Math.PI * note.freq * p.ratio * t);
    }
    samples[i] += v * note.gain * attack;
  }
}

/* Fade the last 30ms to silence: the decay is exponential and never quite
   reaches zero, and cutting a non-zero sample at the end is another click. */
const fade = Math.floor(0.03 * RATE);
for (let i = N - fade; i < N; i += 1) samples[i] *= (N - i) / fade;

// Normalise to -3 dBFS, leaving headroom rather than sitting on the ceiling.
let peak = 0;
for (const s of samples) peak = Math.max(peak, Math.abs(s));
const scale = (peak > 0 ? 0.708 / peak : 0) * 32767;

const HEADER = 44;
const buf = Buffer.alloc(HEADER + N * 2);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 2, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);          // PCM chunk size
buf.writeUInt16LE(1, 20);           // format: PCM
buf.writeUInt16LE(1, 22);           // channels: mono
buf.writeUInt32LE(RATE, 24);
buf.writeUInt32LE(RATE * 2, 28);    // byte rate
buf.writeUInt16LE(2, 32);           // block align
buf.writeUInt16LE(16, 34);          // bits per sample
buf.write('data', 36);
buf.writeUInt32LE(N * 2, 40);

for (let i = 0; i < N; i += 1) {
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * scale))), HEADER + i * 2);
}

const out = new URL('../public/sounds/ding.wav', import.meta.url);
writeFileSync(out, buf);
console.log(`wrote ${out.pathname} — ${(buf.length / 1024).toFixed(1)} KB, ${SECONDS}s mono ${RATE}Hz`);
