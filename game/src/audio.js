// All sound is synthesised with WebAudio: no audio files, no network.
// Engine hum, sirens, gunshots, pickups and a small bass groove. Audio starts
// only after the player's first key or click, as browsers require.

import { clamp } from './util.js';

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenHigh = false;
    this.musicStep = 0;
  }

  /** Create the context on first user gesture; safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** A continuous engine drone whose pitch follows the player's speed. */
  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  /** Call every frame: speed 0..1, onFoot silences the engine. */
  engine(speed01, driving) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.045 + speed01 * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(380 + speed01 * 900, t, 0.1);
  }

  /** Two-tone police siren, on while the player is wanted. */
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      const ctx = this.ctx;
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenHigh = true;
      this.sirenTimer = setInterval(() => {
        if (!this.sirenOsc) return;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 720 : 540, this.ctx.currentTime, 0.02);
      }, 420);
    } else if (!on && this.sirenOsc) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc.disconnect();
      this.sirenGain.disconnect();
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  /** Short noise burst: a gunshot. */
  gunshot() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const dur = 0.14;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  /** A low thud: a car crash or an explosion's body. */
  thud(volume = 0.5) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  }

  /** A sine blip at a frequency, for pickups and UI. */
  blip(freq = 880, dur = 0.12, volume = 0.25) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  /** A three-note mission-complete jingle. */
  jingle() {
    if (!this.ctx) return;
    [523, 659, 784].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.22, 0.3), i * 110);
    });
  }

  /** A quiet bass groove: A minor, 100 BPM, scheduled a bar ahead. */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bassLine = [55, 0, 55, 65.41, 0, 55, 49, 0, 55, 0, 82.41, 0, 73.42, 0, 65.41, 0];
    const stepDur = 60 / 100 / 2; // eighth notes at 100 BPM
    let nextTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      while (nextTime < this.ctx.currentTime + 0.35) {
        const freq = bassLine[this.musicStep % bassLine.length];
        if (freq > 0) {
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.0001, nextTime);
          gain.gain.exponentialRampToValueAtTime(0.14, nextTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, nextTime + stepDur * 0.95);
          osc.connect(gain);
          gain.connect(this.master);
          osc.start(nextTime);
          osc.stop(nextTime + stepDur);
        }
        this.musicStep++;
        nextTime += stepDur;
      }
    }, 90);
  }

  stop() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.siren(false);
    if (this.ctx) void this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}

/** Clamp helper kept local so this module needs no other import besides util. */
export { clamp };
