import * as THREE from 'three';
import { RNG, Noise } from './rng.js';
import { BIOMES } from './data.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Q } from './quality.js';

const texCache = {};
export function glowTexture(inner = 'rgba(255,255,255,1)', key = 'glow') {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[key] = t);
}
export function glowSprite(color, scale, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity });
  const s = new THREE.Sprite(m); s.scale.setScalar(scale); return s;
}

// Lit material that becomes a cheap Lambert on the Low preset.
export function litMat(params) {
  if (Q.lambert) { const p = { ...params }; delete p.metalness; delete p.roughness; return new THREE.MeshLambertMaterial(p); }
  return new THREE.MeshStandardMaterial(params);
}
const matCache = {};
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts) + (Q.lambert ? 'L' : 'S');
  if (matCache[key]) return matCache[key];
  const m = litMat({ color, flatShading: true, metalness: opts.metal ?? 0.45, roughness: opts.rough ?? 0.55, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1 });
  m.userData.shared = true;
  return (matCache[key] = m);
}
// Shared vertex-coloured materials: a whole model becomes 1-2 draw calls.
const vcMats = {};
function vcLit() { const k = Q.lambert ? 'L' : 'S'; if (!vcMats[k]) { vcMats[k] = litMat({ vertexColors: true, flatShading: true, metalness: 0.45, roughness: 0.55 }); vcMats[k].userData.shared = true; } return vcMats[k]; }
function vcGlow() { if (!vcMats.G) { vcMats.G = new THREE.MeshBasicMaterial({ vertexColors: true }); vcMats.G.userData.shared = true; } return vcMats.G; }
const _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4(), _c = new THREE.Color();
// Bake every Mesh under `root` (except those in `skip`) into vertex-coloured geometry.
export function bake(root, skip = new Set()) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const lit = [], glow = [], dead = [];
  root.traverse((o) => {
    if (o === root || !o.isMesh || o.isInstancedMesh || skip.has(o)) return;
    for (let p = o.parent; p && p !== root; p = p.parent) if (skip.has(p)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    _rel.multiplyMatrices(_inv, o.matrixWorld); g.applyMatrix4(_rel);
    const m = o.material; const em = m.emissive && m.emissiveIntensity > 0.5 && m.emissive.getHex() !== 0;
    if (em) _c.copy(m.emissive).multiplyScalar(m.emissiveIntensity * 0.8).add(m.color.clone().multiplyScalar(0.35)); else _c.copy(m.color);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (em ? glow : lit).push(g); dead.push(o);
  });
  for (const o of dead) { o.parent.remove(o); if (!o.material.userData.shared) o.material.dispose(); o.geometry.dispose(); }
  if (lit.length) root.add(new THREE.Mesh(mergeGeometries(lit), vcLit()));
  if (glow.length) root.add(new THREE.Mesh(mergeGeometries(glow), vcGlow()));
  lit.concat(glow).forEach(g => g.dispose());
  return root;
}
// One Points draw for all engine flares of a ship.
export function glowPoints(positions, color, size, opacity = 0.8) {
  const geo = new THREE.BufferGeometry().setFromPoints(positions);
  const m = new THREE.PointsMaterial({ map: glowTexture(), color, size, sizeAttenuation: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  return new THREE.Points(geo, m);
}

// ---------- Ships (nose points to -Z) ----------
export function buildShip(seed, size = 1, color = 0x88aaff) {
  const r = new RNG(seed);
  const g = new THREE.Group();
  const hullCol = new THREE.Color().setHSL(r.next(), r.range(0.05, 0.25), r.range(0.35, 0.6)).getHex();
  const hull = mat(hullCol, { metal: 0.6, rough: 0.4 });
  const trim = mat(color, { metal: 0.3, rough: 0.5, emissive: color, ei: 0.25 });
  const dark = mat(0x222831, { metal: 0.7, rough: 0.6 });
  const L = r.range(5, 9) * size, W = r.range(1.2, 2.2) * size, H = r.range(0.9, 1.6) * size;
  const style = r.int(0, 2);
  // fuselage
  let body;
  if (style === 0) body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), hull);
  else if (style === 1) { body = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.5, W * 0.7, L, r.int(5, 8)), hull); body.rotation.x = Math.PI / 2; }
  else { body = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), hull); body.scale.set(W * 0.8, H * 0.7, L * 0.6); }
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(W * 0.5, L * r.range(0.3, 0.6), r.int(4, 8)), hull);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -L * 0.62; g.add(nose);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(W * 0.35, 8, 6), mat(0x7fd8ff, { metal: 0.9, rough: 0.1, emissive: 0x1a5a7a, ei: 0.8 }));
  cockpit.scale.set(1, 0.6, 1.8); cockpit.position.set(0, H * 0.45, -L * 0.2); g.add(cockpit);
  // wings
  const ws = r.range(1.5, 3.5) * size, wd = r.range(1.5, 3.5) * size, sweep = r.range(-0.6, 0.4);
  const wingY = r.range(-0.3, 0.2) * H;
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(ws, 0.18 * size, wd), r.chance(0.5) ? hull : dark);
    wing.position.set(sx * (W * 0.5 + ws * 0.45), wingY, L * 0.1); wing.rotation.y = sx * sweep; wing.rotation.z = sx * r.range(-0.25, 0.25);
    g.add(wing);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(ws * 0.9, 0.2 * size, 0.25 * size), trim);
    stripe.position.copy(wing.position); stripe.position.z += wd * 0.35; stripe.rotation.copy(wing.rotation); g.add(stripe);
    if (r.chance(0.5)) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15 * size, r.range(0.8, 2) * size, wd * 0.6), hull);
      fin.position.set(sx * (W * 0.5 + ws * 0.85), wingY + 0.5 * size, L * 0.2); g.add(fin);
    }
  }
  if (r.chance(0.6)) { const tf = new THREE.Mesh(new THREE.BoxGeometry(0.2 * size, r.range(1, 2.4) * size, L * 0.3), trim); tf.position.set(0, H * 0.8, L * 0.3); g.add(tf); }
  // engines
  const nEng = r.pick([1, 2, 2, 3, 4]);
  const flares = [];
  for (let i = 0; i < nEng; i++) {
    const ex = nEng === 1 ? 0 : (i / (nEng - 1) - 0.5) * W * 1.6;
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * size, 0.45 * size, 1.6 * size, 8), dark);
    eng.rotation.x = Math.PI / 2; eng.position.set(ex, 0, L * 0.5 + 0.4 * size); g.add(eng);
    flares.push(new THREE.Vector3(ex, 0, L * 0.5 + 1.1 * size));
  }
  bake(g);
  const fl = glowPoints(flares, color, 1.5 * size, 0.75); g.add(fl);
  g.userData.engines = [fl];
  g.userData.radius = Math.max(L * 0.6, W + ws);
  g.userData.muzzles = [new THREE.Vector3(-W * 0.6, wingY, -L * 0.4), new THREE.Vector3(W * 0.6, wingY, -L * 0.4)];
  return g;
}

export function buildStation(seed, color) {
  const r = new RNG(seed);
  const g = new THREE.Group();
  const hull = mat(0x9aa3ad, { metal: 0.7, rough: 0.35 });
  const trim = mat(color, { emissive: color, ei: 0.6 });
  const R = r.range(70, 120);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, r.range(8, 14), 8, 32), hull); ring.rotation.x = Math.PI / 2; g.add(ring);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, R * 1.6, 12), hull); g.add(core);
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 4, 6), hull); sp.rotation.y = i * Math.PI / 4; g.add(sp);
  }
  for (const y of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(26, 12, 8), hull); cap.position.y = y * R * 0.8; g.add(cap);
    const lt = glowSprite(color, 60); lt.position.y = y * (R * 0.8 + 26); g.add(lt);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(R, 2, 4, 48), trim); band.rotation.x = Math.PI / 2; band.position.y = 10; g.add(band);
  if (r.chance(0.6)) { const ring2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 6, 6, 24), hull); ring2.position.y = R * 0.5; ring2.rotation.x = Math.PI / 2; g.add(ring2); }
  bake(g);
  g.userData.radius = R + 20;
  return g;
}

// ---------- Characters ----------
export function buildCharacter(sp, seed, outfit = 0x445566) {
  const r = new RNG(seed);
  const g = new THREE.Group();
  const skin = new THREE.Color().setHSL(sp.skin[0], sp.skin[1], sp.skin[2] * r.range(0.85, 1.1)).getHex();
  const sm = mat(skin, { metal: 0.05, rough: 0.8 });
  const om = mat(outfit, { metal: 0.3, rough: 0.6 });
  const h = sp.height, w = sp.width;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8 * w, 0.95 * h, 0.45 * w), om); torso.position.y = 1.35 * h; g.add(torso);
  const head = new THREE.Group(); head.position.y = 2.05 * h; g.add(head);
  let hm;
  if (sp.head === 'long') { hm = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 3, 6), sm); }
  else if (sp.head === 'flat') { hm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.45), sm); }
  else if (sp.head === 'crest') { hm = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 6), sm); }
  else if (sp.head === 'dome') { hm = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), sm); hm.scale.y = 1.25; }
  else { hm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), sm); }
  head.add(hm);
  const em = mat(0x111111, { emissive: sp.id === 0 ? 0x000000 : new THREE.Color().setHSL(r.next(), 1, 0.5).getHex(), ei: 1.5 });
  for (let i = 0; i < sp.eyes; i++) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), em);
    e.position.set((i - (sp.eyes - 1) / 2) * 0.13, 0.05 + (sp.eyes > 2 && i % 2 ? 0.08 : 0), -0.25); head.add(e);
  }
  for (let i = 0; i < sp.horns; i++) {
    const hn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 5), mat(sp.color2)); hn.position.set(sp.horns === 1 ? 0 : (i ? 0.18 : -0.18), 0.3, 0); hn.rotation.z = sp.horns === 1 ? 0 : (i ? -0.4 : 0.4); head.add(hn);
  }
  const limb = (wd, len, m) => { const geo = new THREE.BoxGeometry(wd, len, wd); geo.translate(0, -len / 2, 0); const grp = new THREE.Group(); grp.add(new THREE.Mesh(geo, m)); return grp; };
  const armL = limb(0.2 * w, 0.85 * h, sm), armR = limb(0.2 * w, 0.85 * h, sm);
  armL.position.set(-0.52 * w, 1.75 * h, 0); armR.position.set(0.52 * w, 1.75 * h, 0); g.add(armL, armR);
  const legL = limb(0.26 * w, 0.9 * h, om), legR = limb(0.26 * w, 0.9 * h, om);
  legL.position.set(-0.2 * w, 0.9 * h, 0); legR.position.set(0.2 * w, 0.9 * h, 0); g.add(legL, legR);
  if (sp.tail) { const t = limb(0.12, 0.9, sm); t.position.set(0, 0.95 * h, 0.25); t.rotation.x = -1.0; g.add(t); }
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.7), mat(0x2a2f36)); gun.position.set(0, -0.75 * h, -0.3); armR.add(gun);
  const limbs = new Set([armL, armR, legL, legR]);
  bake(g, limbs); for (const l of limbs) bake(l);
  g.userData = { armL, armR, legL, legR, head, height: 2.3 * h, radius: 0.5 * w };
  return g;
}
export function animateWalk(ch, t, speed) {
  const u = ch.userData; const a = Math.sin(t * 9) * Math.min(1, speed / 6) * 0.7;
  u.legL.rotation.x = a; u.legR.rotation.x = -a; u.armL.rotation.x = -a * 0.7;
}

export function buildCreature(seed, level = 1) {
  const r = new RNG(seed);
  const g = new THREE.Group();
  const c1 = new THREE.Color().setHSL(r.next(), r.range(0.4, 0.9), r.range(0.3, 0.55)).getHex();
  const c2 = new THREE.Color().setHSL(r.next(), 0.8, 0.5).getHex();
  const m1 = mat(c1, { metal: 0.1, rough: 0.8 }), m2 = mat(c2, { emissive: c2, ei: 0.6 });
  const s = r.range(0.7, 1.8) * (1 + level * 0.02);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), m1); body.scale.set(r.range(0.7, 1.2) * s, r.range(0.5, 0.9) * s, r.range(1, 1.8) * s);
  const legs = r.pick([2, 4, 4, 6]); const legLen = r.range(0.6, 1.6) * s;
  body.position.y = legLen + 0.3 * s; g.add(body);
  const head = new THREE.Mesh(r.chance(0.5) ? new THREE.SphereGeometry(0.5 * s, 7, 5) : new THREE.ConeGeometry(0.45 * s, 1 * s, 6), m1);
  head.position.set(0, body.position.y + 0.3 * s, -body.scale.z * 0.95); head.rotation.x = -Math.PI / 2; g.add(head);
  for (let i = 0; i < r.int(1, 3); i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 5, 4), m2); e.position.set((i - 1) * 0.2 * s, head.position.y + 0.15 * s, head.position.z - 0.35 * s); g.add(e); }
  const legMeshes = [];
  for (let i = 0; i < legs; i++) {
    const geo = new THREE.CylinderGeometry(0.1 * s, 0.07 * s, legLen, 5); geo.translate(0, -legLen / 2, 0);
    const lg = new THREE.Mesh(geo, m1);
    const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
    lg.position.set(side * body.scale.x * 0.7, body.position.y, (row / Math.max(1, legs / 2 - 1) - 0.5) * body.scale.z * 1.2);
    g.add(lg); legMeshes.push(lg);
  }
  if (r.chance(0.5)) for (let i = 0; i < r.int(2, 5); i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.7 * s, 4), m2); sp.position.set(0, body.position.y + body.scale.y * 0.9, (i / 4 - 0.5) * body.scale.z); g.add(sp); }
  const ud = { legs: legMeshes, height: body.position.y + body.scale.y, radius: Math.max(body.scale.x, body.scale.z) };
  bake(g, new Set(legMeshes));
  g.userData = ud;
  return g;
}

// ---------- Time-sliced texture generation ----------
// Big procedural textures are filled a few rows per frame so loading never freezes the game.
export const texJobs = {
  q: [],
  add(gen) { this.q.push(gen); },
  run(budgetMs = 4) {
    const t0 = performance.now();
    while (this.q.length && performance.now() - t0 < budgetMs) { if (this.q[0].next().done) this.q.shift(); }
  },
  clear() { this.q = []; },
};
const texLRU = new Map();
function cached(key, make) {
  if (texLRU.has(key)) { const t = texLRU.get(key); texLRU.delete(key); texLRU.set(key, t); return t; }
  const t = make(); t.userData.keep = true; texLRU.set(key, t);
  while (texLRU.size > 28) { const [k, old] = texLRU.entries().next().value; texLRU.delete(k); old.dispose(); }
  return t;
}
function sphereTex(key, W, H, preview, pixel) {
  return cached(key, () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    // quick low-res preview drawn immediately, then refined progressively
    const pw = 48, ph = 24, pc = document.createElement('canvas'); pc.width = pw; pc.height = ph;
    const pg = pc.getContext('2d'), pimg = pg.createImageData(pw, ph), out = [0, 0, 0];
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { preview(x / pw, y / ph, out); const i = (y * pw + x) * 4; pimg.data[i] = out[0]; pimg.data[i + 1] = out[1]; pimg.data[i + 2] = out[2]; pimg.data[i + 3] = 255; }
    pg.putImageData(pimg, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(pc, 0, 0, W, H);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    texJobs.add((function* () {
      const img = g.createImageData(W, H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) { pixel(x / W, y / H, out); const i = (y * W + x) * 4; img.data[i] = out[0]; img.data[i + 1] = out[1]; img.data[i + 2] = out[2]; img.data[i + 3] = 255; }
        yield;
      }
      g.putImageData(img, 0, 0); t.needsUpdate = true;
    })());
    return t;
  });
}

export function planetTexture(planet, res = Q.planetRes) {
  const biome = BIOMES.find(b => b.id === planet.biome);
  const n = new Noise(planet.seed);
  const cols = biome.ground.map(h => new THREE.Color(h));
  const water = biome.water ? new THREE.Color(biome.id === 'toxic' ? 0x6a8a1a : 0x1f5fa8) : null;
  const tmp = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  const shade = (u, v, out, detail) => {
    const lat = v * Math.PI, lon = u * Math.PI * 2;
    const px = Math.sin(lat) * Math.cos(lon), py = Math.cos(lat), pz = Math.sin(lat) * Math.sin(lon);
    const h = n.fbm3(px * 2.2, py * 2.2, pz * 2.2, detail ? 5 : 3) * 0.5 + 0.5;
    const d = detail ? n.fbm3(px * 9, py * 9, pz * 9, 2) * 0.5 + 0.5 : 0.5;
    if (water && h < 0.47) tmp.copy(water).multiplyScalar(0.6 + h);
    else if (h < 0.55) tmp.copy(cols[1]).lerp(cols[0], (h - 0.4) * 6);
    else tmp.copy(cols[0]).lerp(cols[2], Math.min(1, (h - 0.55) * 4));
    tmp.multiplyScalar(0.8 + d * 0.4);
    if (Math.abs(py) > 0.88 && biome.id !== 'volcanic') tmp.lerp(white, 0.7);
    out[0] = Math.min(255, tmp.r * 255); out[1] = Math.min(255, tmp.g * 255); out[2] = Math.min(255, tmp.b * 255);
  };
  return sphereTex(`p${planet.seed}:${planet.biome}:${res}`, res, res / 2, (u, v, o) => shade(u, v, o, false), (u, v, o) => shade(u, v, o, true));
}

export function nebulaTexture(seed, hue, res = Q.nebulaRes) {
  const n = new Noise(seed);
  const a = new THREE.Color().setHSL(hue, 0.7, 0.3), b = new THREE.Color().setHSL((hue + 0.15) % 1, 0.8, 0.25), tmp = new THREE.Color();
  const shade = (u, v, out, detail) => {
    const lat = v * Math.PI, lon = u * Math.PI * 2;
    const px = Math.sin(lat) * Math.cos(lon), py = Math.cos(lat), pz = Math.sin(lat) * Math.sin(lon);
    const x = Math.max(0, n.fbm3(px * 1.6, py * 1.6, pz * 1.6, detail ? 5 : 3) * 1.4);
    const w = Math.max(0, n.fbm3(px * 3 + 9, py * 3, pz * 3, detail ? 4 : 2));
    tmp.setRGB(0.01, 0.012, 0.03); tmp.r += a.r * x * x * 1.2 + b.r * w * w * 0.9; tmp.g += a.g * x * x * 1.2 + b.g * w * w * 0.9; tmp.b += a.b * x * x * 1.2 + b.b * w * w * 0.9;
    out[0] = Math.min(255, tmp.r * 255); out[1] = Math.min(255, tmp.g * 255); out[2] = Math.min(255, tmp.b * 255);
  };
  return sphereTex(`n${seed}:${hue.toFixed(3)}:${res}`, res, res / 2, (u, v, o) => shade(u, v, o, false), (u, v, o) => shade(u, v, o, true));
}

export function starfield(count = Q.stars, radius = 90000) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const r = new RNG(42);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = r.next() * 2 - 1, th = r.next() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos[i * 3] = s * Math.cos(th) * radius; pos[i * 3 + 1] = u * radius; pos[i * 3 + 2] = s * Math.sin(th) * radius;
    c.setHSL(r.range(0.55, 0.7) + (r.chance(0.2) ? 0.4 : 0), r.range(0, 0.5), r.range(0.35, 0.75)); col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { if (!m.userData.shared) { if (m.map && !m.map.userData.keep && !Object.values(texCache).includes(m.map)) m.map.dispose(); m.dispose(); } }
    }
  });
}
