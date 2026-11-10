/** Sons et vibrations de l'app, synthétisés (aucun fichier audio à charger). */
export type Sound = 'move' | 'capture' | 'check' | 'success' | 'error' | 'end';

const KEY = 'sounds';

export const soundsEnabled = () => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
};

export function setSoundsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* stockage indisponible */
  }
}

/** Quel son pour ce coup (notation SAN) ? */
export const soundForSan = (san: string): Sound => (/[+#]$/.test(san) ? 'check' : san.includes('x') ? 'capture' : 'move');

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c: AudioContext, freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number } = {}) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, at);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Bruit bref filtré : le « toc » d'une pièce posée sur le bois. */
function knock(c: AudioContext, at: number, gain: number, freq: number) {
  const len = Math.floor(c.sampleRate * 0.08);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
}

export function vibrate(ms: number | number[]) {
  try {
    if (soundsEnabled()) navigator.vibrate?.(ms);
  } catch {
    /* non pris en charge */
  }
}

export function playSound(kind: Sound) {
  if (!soundsEnabled()) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  switch (kind) {
    case 'move':
      knock(c, t, 0.9, 1100);
      tone(c, 220, t, 0.06, { gain: 0.05 });
      break;
    case 'capture':
      knock(c, t, 1.6, 1800);
      tone(c, 160, t, 0.09, { gain: 0.09 });
      break;
    case 'check':
      knock(c, t, 1.2, 1500);
      tone(c, 660, t + 0.02, 0.1, { gain: 0.07 });
      tone(c, 880, t + 0.1, 0.12, { gain: 0.07 });
      break;
    case 'success':
      [523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.09, 0.18, { gain: 0.09 }));
      break;
    case 'error':
      tone(c, 190, t, 0.28, { type: 'sawtooth', gain: 0.07, to: 110 });
      break;
    case 'end':
      [392, 330, 262].forEach((f, i) => tone(c, f, t + i * 0.12, 0.3, { gain: 0.08 }));
      break;
  }
}
