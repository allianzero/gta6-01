// Palmira Bay — all sound is synthesized live with WebAudio: no audio files.
// Engine hum, sirens, gunshots, pickups and a looping coastal groove.
export function createAudio() {
  const audio = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    muted: false, musicOn: true, step: 0, nextNote: 0, engineOsc: null, engineGain: null,
  };
  return audio;
}
export function initAudio(audio) {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    audio.musicGain = audio.ctx.createGain();
    audio.musicGain.gain.value = 0.16;
    audio.musicGain.connect(audio.master);
    audio.sfxGain = audio.ctx.createGain();
    audio.sfxGain.gain.value = 0.9;
    audio.sfxGain.connect(audio.master);
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.nextNote = audio.ctx.currentTime + 0.1;
  } catch (e) { audio.ctx = null; }
}
function tone(audio, freq, dur, type, vol, slideTo, when) {
  if (!audio.ctx || audio.muted) return;
  const t0 = when ?? audio.ctx.currentTime;
  const o = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol || 0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(audio.sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noiseBurst(audio, dur, vol, low) {
  if (!audio.ctx || audio.muted) return;
  const len = Math.floor(audio.ctx.sampleRate * dur);
  const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buf;
  const f = audio.ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = low || 1200;
  const g = audio.ctx.createGain();
  g.gain.value = vol || 0.3;
  src.connect(f); f.connect(g); g.connect(audio.sfxGain);
  src.start();
}
export function playSfx(audio, name) {
  if (!audio.ctx || audio.muted) return;
  switch (name) {
    case 'shot': noiseBurst(audio, 0.12, 0.5, 2600); tone(audio, 190, 0.09, 'square', 0.25, 60); break;
    case 'punch': noiseBurst(audio, 0.08, 0.35, 700); break;
    case 'pickup': tone(audio, 660, 0.09, 'sine', 0.25); tone(audio, 990, 0.14, 'sine', 0.25, null, audio.ctx.currentTime + 0.09); break;
    case 'cash': tone(audio, 880, 0.08, 'triangle', 0.25); tone(audio, 1174, 0.08, 'triangle', 0.25, null, audio.ctx.currentTime + 0.08); tone(audio, 1568, 0.16, 'triangle', 0.25, null, audio.ctx.currentTime + 0.16); break;
    case 'crash': noiseBurst(audio, 0.3, 0.5, 500); tone(audio, 90, 0.25, 'sawtooth', 0.3, 40); break;
    case 'door': tone(audio, 320, 0.06, 'square', 0.15, 180); break;
    case 'siren': tone(audio, 750, 0.45, 'sine', 0.12, 1150); tone(audio, 1150, 0.45, 'sine', 0.12, 750, audio.ctx.currentTime + 0.45); break;
    case 'mission': [523, 659, 784, 1046].forEach((f, i) => tone(audio, f, 0.16, 'triangle', 0.25, null, audio.ctx.currentTime + i * 0.11)); break;
    case 'fail': tone(audio, 220, 0.4, 'sawtooth', 0.2, 110); break;
    case 'busted': tone(audio, 440, 0.3, 'square', 0.2, 220); tone(audio, 330, 0.5, 'square', 0.2, 165, audio.ctx.currentTime + 0.3); break;
    case 'horn': tone(audio, 370, 0.18, 'square', 0.18); tone(audio, 466, 0.18, 'square', 0.15); break;
    case 'click': tone(audio, 1200, 0.04, 'square', 0.12); break;
    default: tone(audio, 440, 0.1, 'sine', 0.2);
  }
}
export function setEngine(audio, speedNorm, on) {
  if (!audio.ctx || !audio.engineOsc) return;
  const target = on ? 0.02 + speedNorm * 0.06 : 0;
  audio.engineGain.gain.setTargetAtTime(audio.muted ? 0 : target, audio.ctx.currentTime, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(50 + speedNorm * 140, audio.ctx.currentTime, 0.08);
}
const BASS = [55, 0, 55, 65.4, 55, 0, 82.4, 73.4];
const LEAD = [220, 261.6, 329.6, 392, 329.6, 261.6, 196, 246.9];
export function updateMusic(audio) {
  if (!audio.ctx || audio.muted || !audio.musicOn) return;
  const stepDur = 0.22;
  while (audio.nextNote < audio.ctx.currentTime + 0.15) {
    const t = audio.nextNote;
    const i = audio.step % 8;
    const b = BASS[i];
    if (b) {
      const o = audio.ctx.createOscillator(); const g = audio.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = b;
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
      o.connect(g); g.connect(audio.musicGain); o.start(t); o.stop(t + stepDur);
    }
    if (audio.step % 2 === 0) {
      const o = audio.ctx.createOscillator(); const g = audio.ctx.createGain();
      o.type = 'sine'; o.frequency.value = LEAD[Math.floor(audio.step / 2) % 8] * 2;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.8);
      o.connect(g); g.connect(audio.musicGain); o.start(t); o.stop(t + stepDur * 2);
    }
    if (audio.step % 4 === 2) {
      const len = Math.floor(audio.ctx.sampleRate * 0.05);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
      const src = audio.ctx.createBufferSource(); src.buffer = buf;
      const g = audio.ctx.createGain(); g.gain.value = 0.25;
      src.connect(g); g.connect(audio.musicGain); src.start(t);
    }
    audio.step++;
    audio.nextNote += stepDur;
  }
}
export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  return audio.muted;
}
