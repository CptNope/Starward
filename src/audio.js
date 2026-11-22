// Tiny synthesized sound effects (no assets).
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.35; this.last = {}; }
  ensure() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination); } catch (e) { this.ctx = null; }
  }
  tone(freq, dur, type = 'square', vol = 0.2, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  }
  noise(dur, vol = 0.3) {
    if (!this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * dur), b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g); g.connect(this.master); s.start();
  }
  throttle(key, gap) { const now = performance.now(); if (now - (this.last[key] || 0) < gap) return false; this.last[key] = now; return true; }
  shot(dtype) {
    if (!this.throttle('shot', 55)) return;
    const f = { energy: 880, kinetic: 220, ion: 600, plasma: 420, explosive: 160 }[dtype] || 700;
    this.tone(f, 0.08, dtype === 'kinetic' ? 'sawtooth' : 'square', 0.06, 0.4);
  }
  boom(big = false) { if (this.throttle('boom', 80)) { this.noise(big ? 0.9 : 0.4, big ? 0.5 : 0.25); this.tone(80, big ? 0.7 : 0.3, 'sine', 0.3, 0.3); } }
  // Short rising whine when an enemy starts aiming at you, quieter the farther away it is.
  aimIn(dist) { if (this.throttle('aimIn', 250)) this.tone(420, 0.32, 'sine', 0.07 * Math.max(0.25, 1 - dist / 45), 2.2); }
  ui() { this.tone(1200, 0.05, 'sine', 0.05); }
  loot(tier) { this.tone(500 + tier * 120, 0.12, 'triangle', 0.1, 1.6); }
  level() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.12), i * 90)); }
  warp() { this.tone(90, 1.4, 'sawtooth', 0.15, 8); }
}
