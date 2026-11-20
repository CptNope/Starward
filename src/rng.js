// Seeded randomness + noise. Everything procedural in Starward flows from these.

export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hashInts(...nums) {
  let h = 0x9e3779b9;
  for (const n of nums) {
    h ^= Math.imul((n | 0) ^ 0x85ebca6b, 0xc2b2ae35);
    h = (h << 13) | (h >>> 19);
    h = Math.imul(h, 5) + 0xe6546b64;
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export class RNG {
  constructor(seed = 1) { this.s = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0 || 1; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  gauss() { return (this.next() + this.next() + this.next() - 1.5) / 1.5; }
  weighted(entries) { // [[item, weight], ...]
    let total = 0; for (const e of entries) total += e[1];
    let r = this.next() * total;
    for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  fork(tag) { return new RNG(hashInts(this.s, hashStr(String(tag)))); }
}

// --- 2D/3D gradient noise (compact Perlin) ---
export class Noise {
  constructor(seed = 1) {
    const r = new RNG(seed);
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    r.shuffle(p);
    this.p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.p[i] = p[i & 255];
  }
  static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  static lerp(a, b, t) { return a + (b - a) * t; }
  static grad(h, x, y, z) {
    const u = (h & 15) < 8 ? x : y;
    const v = (h & 15) < 4 ? y : ((h & 15) === 12 || (h & 15) === 14) ? x : z;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  n3(x, y, z) {
    const p = this.p;
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = Noise.fade(x), v = Noise.fade(y), w = Noise.fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    const L = Noise.lerp, G = Noise.grad;
    return L(L(L(G(p[AA], x, y, z), G(p[BA], x - 1, y, z), u), L(G(p[AB], x, y - 1, z), G(p[BB], x - 1, y - 1, z), u), v),
      L(L(G(p[AA + 1], x, y, z - 1), G(p[BA + 1], x - 1, y, z - 1), u), L(G(p[AB + 1], x, y - 1, z - 1), G(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  n2(x, y) { return this.n3(x, y, 0.5); }
  fbm2(x, y, oct = 5, lac = 2, gain = 0.5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * this.n2(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  }
  fbm3(x, y, z, oct = 5) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * this.n3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2; }
    return s / n;
  }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
