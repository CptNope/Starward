// Device-aware quality presets + dynamic resolution scaling.
export const PRESETS = [
  { name: 'Low', maxDpr: 1, bloom: false, bloomRes: 0.35, aa: false, lambert: true, planetRes: 160, nebulaRes: 256, terrainSeg: 100, props: 0.4, lights: 2, stars: 2500, npcCap: 9, fx: 0.5, belt: 0.4, drawDist: 160 },
  { name: 'Medium', maxDpr: 1.5, bloom: true, bloomRes: 0.4, aa: false, lambert: false, planetRes: 256, nebulaRes: 384, terrainSeg: 140, props: 0.7, lights: 4, stars: 4500, npcCap: 12, fx: 0.8, belt: 0.7, drawDist: 260 },
  { name: 'High', maxDpr: 2, bloom: true, bloomRes: 0.5, aa: true, lambert: false, planetRes: 384, nebulaRes: 512, terrainSeg: 180, props: 1, lights: 8, stars: 6000, npcCap: 14, fx: 1, belt: 1, drawDist: 420 },
];

export function detectTier(renderer) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  let gpu = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '';
  } catch (e) { /* ignore */ }
  const g = gpu.toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(g)) return 0;
  if (coarse) return (mem >= 6 && cores >= 8 && /apple|adreno \(tm\) (7|8)|mali-g7[1-9]|xclipse/.test(g)) ? 1 : 0;
  if (/intel|uhd|iris|mali|adreno|powervr/.test(g) || cores <= 4 || mem <= 4) return 1;
  return 2;
}

// Watches frame times and nudges render scale; drops a tier if scaling alone can't keep up.
export class FrameGovernor {
  constructor(game) { this.game = game; this.scale = 1; this.acc = 0; this.n = 0; this.slow = 0; this.fast = 0; this.fps = 60; this.cooldown = 2; }
  sample(dt) {
    if (dt <= 0 || dt > 0.25) return;
    this.acc += dt; this.n++;
    this.cooldown -= dt;
    if (this.acc < 0.5) return;
    const avg = this.acc / this.n; this.acc = 0; this.n = 0;
    this.fps = Math.round(1 / avg);
    const s = this.game.settings;
    if (!s.autoQuality || this.cooldown > 0) return;
    if (avg > 1 / 48) { this.slow++; this.fast = 0; } else if (avg < 1 / 58) { this.fast++; this.slow = 0; } else { this.slow = 0; this.fast = 0; }
    if (this.slow >= 2) {
      this.slow = 0; this.cooldown = 1.5;
      if (this.scale > 0.6) { this.scale = Math.max(0.6, this.scale - 0.1); this.game.applyResolution(); }
      else if (this.game.tier > 0) { this.game.setTier(this.game.tier - 1, true); this.scale = 0.85; this.game.applyResolution(); this.cooldown = 4; }
    } else if (this.fast >= 8 && this.scale < 1) {
      this.fast = 0; this.cooldown = 2; this.scale = Math.min(1, this.scale + 0.05); this.game.applyResolution();
    }
  }
}

// Live preset the rest of the code reads (mutated by setTier).
export const Q = { ...PRESETS[2], tier: 2 };
export function applyPreset(t) { Object.assign(Q, PRESETS[t], { tier: t }); }
