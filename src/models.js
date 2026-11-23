import * as THREE from 'three';
import { RNG, Noise } from './rng.js';
import { BIOMES } from './data.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Q } from './quality.js';
import { PROFILES, loft, wing } from './geo.js';

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

// ---------- Characters ----------
// Rigged like a skeleton made of plain Object3Ds: each joint is a Group whose origin is the pivot
// (shoulder, elbow, hip, knee), children hang along -Y, and the gun is parented to the right hand
// so it follows every pose. Characters face -Z; +X is their right. Each segment bakes to one draw.
const _taper = (geo, bx, bz) => { // narrow the bottom of a box (chest V-shape, sleeves)
  const p = geo.attributes.position; const box = new THREE.Box3().setFromBufferAttribute(p);
  for (let i = 0; i < p.count; i++) { const t = (p.getY(i) - box.min.y) / (box.max.y - box.min.y || 1); p.setX(i, p.getX(i) * (bx + (1 - bx) * t)); p.setZ(i, p.getZ(i) * (bz + (1 - bz) * t)); }
  p.needsUpdate = true; geo.computeVertexNormals(); return geo;
};
const _box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const _joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };

// What each job wears. helm: full | pilot | cap | hood | none; armor 0-2; pack: support | radio | jet | ammo | none.
const KITS = {
  soldier: { helm: 'full', armor: 2, pack: 'support', pauld: 1.25, holster: true },
  gunner: { helm: 'full', armor: 2, pack: 'ammo', pauld: 1.1 },
  pilot: { helm: 'pilot', armor: 1, pack: 'jet', pauld: 0.85, holster: true },
  engineer: { helm: 'cap', armor: 1, pack: 'radio', pauld: 0.75 },
  scientist: { helm: 'none', armor: 0, pack: 'none', pauld: 0, coat: true },
  medic: { helm: 'cap', armor: 0, pack: 'support', pauld: 0.7, white: true },
  merchant: { helm: 'none', armor: 0, pack: 'none', pauld: 0, coat: true },
  smuggler: { helm: 'hood', armor: 1, pack: 'none', pauld: 1, oneSide: true, coat: true, holster: true },
  captain: { helm: 'pilot', armor: 2, pack: 'jet', pauld: 1, holster: true },
};
const HEAD_BOX = { round: [0.28, 0.28, 0.28], dome: [0.36, 0.45, 0.36], flat: [0.3, 0.15, 0.225], long: [0.22, 0.4, 0.22], crest: [0.3, 0.35, 0.3] }; // half extents
const HAIR = [0x1c1612, 0x3a2716, 0x6b4a2a, 0xb08a4a, 0x8a8f96, 0x7a2f22, 0x2f5f7a];
// loft standing up: sections are [y, width, depth, z = 0]
// (the Low preset uses four-sided limbs instead of eight-sided ones)
const _vl = (secs, prof = 'oct') => loft(secs.map(([y, w, d, z = 0]) => [y, w, d, -z]), PROFILES[prof === 'oct' && Q.tier === 0 ? 'box' : prof]).rotateX(-Math.PI / 2);
const _m = (geo, m, x = 0, y = 0, z = 0) => { if (x || y || z) geo.translate(x, y, z); return new THREE.Mesh(geo, m); };

export function buildCharacter(sp, seed, outfit = 0x445566, opts = {}) {
  const r = new RNG(seed);
  const g = new THREE.Group();
  const jointed = opts.jointed ?? Q.tier > 0; // Low preset folds elbows/knees into one segment each
  const skin = new THREE.Color().setHSL(sp.skin[0], sp.skin[1], sp.skin[2] * r.range(0.85, 1.1)).getHex();
  const role = KITS[opts.role] ? opts.role : r.pick(['soldier', 'pilot', 'engineer', 'merchant', 'smuggler', 'scientist']);
  const kit = KITS[role];
  const oc = new THREE.Color(outfit);
  const sm = mat(skin, { metal: 0.05, rough: 0.8 });
  const om = mat(outfit, { metal: 0.3, rough: 0.6 });                                                           // suit
  const um = mat(oc.clone().lerp(new THREE.Color(0x10141a), 0.55).getHex(), { metal: 0.15, rough: 0.8 });       // under-suit at the joints
  const am = mat(oc.clone().lerp(new THREE.Color(kit.white ? 0xf2f5f8 : 0xd8e0ea), kit.white ? 0.75 : 0.3).getHex(), { metal: 0.55, rough: 0.4 }); // armour plates
  const tm = mat(oc.clone().lerp(new THREE.Color(0xffffff), 0.25).multiplyScalar(1.5).getHex(), { metal: 0.2, rough: 0.5 }); // bright trim
  const dm = mat(0x1c2026, { metal: 0.5, rough: 0.7 }); // gloves, boots, belt, pack
  const accent = new THREE.Color().setHSL(r.next(), 0.85, 0.55).getHex();
  const lm = mat(0x111111, { emissive: accent, ei: 1.6 }); // suit lights
  const vm = mat(0x111111, { emissive: kit.white ? 0x7dffb0 : 0x7fd8ff, ei: 1.2 }); // visor glass
  const h = sp.height, w = sp.width;
  const ud = { height: 2.3 * h, radius: 0.5 * w, jointed, role };
  const segs = []; // [group, Set of child joints to skip when baking]
  const variant = r.int(0, 2);
  const fine = Q.tier > 0; // small plates and pouches are skipped on the Low preset

  // --- hips (root) and legs ---
  const hips = _joint(g, 0, 0.95 * h, 0); ud.hips = hips;
  hips.add(_m(_vl([[-0.15 * h, 0.46 * w, 0.3 * w], [-0.02 * h, 0.62 * w, 0.37 * w], [0.1 * h, 0.56 * w, 0.33 * w]]), um));
  hips.add(_box(0.64 * w, 0.07 * h, 0.39 * w, dm, 0, 0.03 * h)); // belt
  hips.add(_box(0.12 * w, 0.09 * h, 0.05 * w, am, 0, 0.03 * h, -0.2 * w)); // buckle
  if (kit.armor && fine) for (const sx of [-1, 1]) hips.add(_box(0.13 * w, 0.11 * h, 0.1 * w, dm, sx * 0.23 * w, -0.01 * h, -0.2 * w)); // pouches
  if (kit.pack === 'none') { hips.add(_box(0.16 * w, 0.2 * h, 0.28 * w, dm, -0.4 * w, -0.08 * h, 0.02 * w)); hips.add(_box(0.17 * w, 0.03 * h, 0.1 * w, tm, -0.4 * w, -0.02 * h, 0.02 * w)); } // satchel
  if (kit.coat) { // coat tails: a back panel and two side panels
    hips.add(_m(_vl([[-0.5 * h, 0.72 * w, 0.05 * w, 0.31 * w], [0.02 * h, 0.6 * w, 0.05 * w, 0.19 * w]], 'box'), om));
    for (const sx of [-1, 1]) hips.add(_m(_vl([[-0.46 * h, 0.05 * w, 0.36 * w, 0.12 * w], [0.02 * h, 0.05 * w, 0.3 * w, 0.03 * w]], 'box'), om, sx * 0.35 * w));
    hips.add(_m(_vl([[-0.5 * h, 0.74 * w, 0.055 * w, 0.31 * w], [-0.44 * h, 0.73 * w, 0.055 * w, 0.3 * w]], 'box'), tm)); // hem
  }
  const leg = (side) => {
    const hip = _joint(hips, side * 0.18 * w, -0.06 * h, 0);
    const thighL = 0.42 * h, shinL = 0.4 * h;
    hip.add(_m(_vl([[-thighL, 0.2 * w, 0.22 * w], [-thighL * 0.45, 0.25 * w, 0.27 * w], [0, 0.26 * w, 0.28 * w]]), kit.armor ? um : om));
    if (kit.armor && fine) hip.add(_m(_vl([[-thighL * 0.82, 0.19 * w, 0.06 * w, -0.125 * w], [-thighL * 0.2, 0.24 * w, 0.07 * w, -0.14 * w]], 'slab'), kit.armor > 1 ? am : om)); // thigh plate
    if (kit.holster && side > 0) { hip.add(_box(0.07 * w, 0.2 * h, 0.15 * w, dm, 0.16 * w, -thighL * 0.45, 0)); hip.add(_box(0.3 * w, 0.03 * h, 0.3 * w, dm, 0, -thighL * 0.3, 0)); }
    const knee = jointed ? _joint(hip, 0, -thighL, 0) : hip;
    const ky = jointed ? 0 : -thighL;
    knee.add(_box(0.2 * w, 0.11 * h, 0.09 * w, am, 0, ky - 0.01 * h, -0.13 * w)); // knee pad
    knee.add(_m(_vl([[-shinL, 0.17 * w, 0.19 * w], [-shinL * 0.4, 0.22 * w, 0.24 * w, 0.01 * w], [0, 0.2 * w, 0.22 * w]]), om, 0, ky, 0));
    if (kit.armor && fine) knee.add(_m(_vl([[-shinL * 0.92, 0.15 * w, 0.05 * w, -0.1 * w], [-shinL * 0.2, 0.2 * w, 0.06 * w, -0.125 * w]], 'slab'), am, 0, ky, 0)); // shin guard
    knee.add(_m(loft([[-0.3 * w, 0.19 * w, 0.08 * h], [-0.12 * w, 0.25 * w, 0.14 * h, 0.03 * h], [0.14 * w, 0.23 * w, 0.17 * h, 0.045 * h]], PROFILES.slab), dm, 0, ky - shinL - 0.07 * h, 0)); // boot
    segs.push([hip, new Set(jointed ? [knee] : [])]); if (jointed) segs.push([knee, new Set()]);
    return { hip, knee: jointed ? knee : null };
  };
  const LL = leg(-1), LR = leg(1);
  ud.hipL = LL.hip; ud.kneeL = LL.knee; ud.hipR = LR.hip; ud.kneeR = LR.knee;

  // --- spine: abdomen, chest, armour, pack, head ---
  const spine = _joint(hips, 0, 0.1 * h, 0); ud.spine = spine;
  spine.add(_m(_vl([[0, 0.52 * w, 0.31 * w], [0.16 * h, 0.5 * w, 0.3 * w], [0.3 * h, 0.6 * w, 0.33 * w]]), um));
  spine.add(_m(_vl([[0.26 * h, 0.6 * w, 0.34 * w], [0.5 * h, 0.84 * w, 0.42 * w], [0.72 * h, 0.88 * w, 0.42 * w], [0.8 * h, 0.6 * w, 0.34 * w]]), om));
  if (kit.armor) {
    spine.add(_m(_vl([[0.36 * h, 0.5 * w, 0.1 * w, -0.17 * w], [0.56 * h, 0.7 * w, 0.12 * w, -0.2 * w], [0.76 * h, 0.66 * w, 0.1 * w, -0.19 * w]], 'slab'), am)); // breastplate
    if (fine) spine.add(_m(_vl([[0.4 * h, 0.5 * w, 0.08 * w, 0.2 * w], [0.74 * h, 0.66 * w, 0.08 * w, 0.2 * w]], 'slab'), am)); // back plate
    if (kit.armor > 1 && fine) for (const y of [0.2, 0.29]) spine.add(_box(0.38 * w, 0.07 * h, 0.05 * w, am, 0, y * h, -0.165 * w)); // abdominal plates
  } else spine.add(_box(0.05 * w, 0.5 * h, 0.03 * w, dm, 0, 0.5 * h, -0.215 * w)); // jacket seam
  spine.add(_box(0.09 * w, 0.26 * h, 0.03 * w, tm, -0.2 * w, 0.6 * h, kit.armor ? -0.262 * w : -0.215 * w)); // faction stripe
  spine.add(_box(0.05 * w, 0.05 * h, 0.03 * w, lm, 0.18 * w, 0.68 * h, kit.armor ? -0.262 * w : -0.215 * w)); // status light
  spine.add(_m(new THREE.CylinderGeometry(0.17 * w, 0.21 * w, 0.1 * h, 8), kit.armor ? am : om, 0, 0.83 * h, 0)); // collar
  const pz = 0.21 * w + (kit.armor ? 0.04 * w : 0);
  if (kit.pack === 'support') {
    spine.add(_box(0.5 * w, 0.44 * h, 0.2 * w, kit.white ? am : dm, 0, 0.52 * h, pz + 0.1 * w));
    for (const sx of [-1, 1]) spine.add(_box(0.06 * w, 0.3 * h, 0.03 * w, lm, sx * 0.12 * w, 0.52 * h, pz + 0.205 * w));
    spine.add(_box(0.3 * w, 0.06 * h, 0.22 * w, am, 0, 0.77 * h, pz + 0.1 * w));
  } else if (kit.pack === 'radio') {
    spine.add(_box(0.44 * w, 0.36 * h, 0.18 * w, dm, 0, 0.54 * h, pz + 0.09 * w));
    spine.add(_m(new THREE.CylinderGeometry(0.012, 0.012, 0.75 * h, 4), dm, 0.17 * w, 1.05 * h, pz + 0.12 * w)); spine.add(_box(0.04, 0.04, 0.04, lm, 0.17 * w, 1.43 * h, pz + 0.12 * w)); // antenna
    spine.add(_box(0.3 * w, 0.05 * h, 0.03 * w, lm, 0, 0.6 * h, pz + 0.185 * w)); spine.add(_box(0.14 * w, 0.14 * h, 0.12 * w, am, -0.12 * w, 0.42 * h, pz + 0.2 * w));
  } else if (kit.pack === 'jet') {
    spine.add(_box(0.4 * w, 0.2 * h, 0.14 * w, dm, 0, 0.6 * h, pz + 0.07 * w));
    for (const sx of [-1, 1]) {
      spine.add(_m(new THREE.CylinderGeometry(0.1 * w, 0.12 * w, 0.44 * h, 7), am, sx * 0.17 * w, 0.52 * h, pz + 0.15 * w));
      spine.add(_m(new THREE.CylinderGeometry(0.12 * w, 0.09 * w, 0.06 * h, 7), dm, sx * 0.17 * w, 0.28 * h, pz + 0.15 * w));
      spine.add(_m(new THREE.CylinderGeometry(0.075 * w, 0.075 * w, 0.02 * h, 7), lm, sx * 0.17 * w, 0.245 * h, pz + 0.15 * w)); // nozzle glow
      spine.add(_m(new THREE.SphereGeometry(0.1 * w, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), am, sx * 0.17 * w, 0.74 * h, pz + 0.15 * w));
    }
  } else if (kit.pack === 'ammo') {
    spine.add(_box(0.56 * w, 0.26 * h, 0.2 * w, dm, 0, 0.44 * h, pz + 0.1 * w));
    spine.add(_m(new THREE.CylinderGeometry(0.11 * w, 0.11 * w, 0.5 * w, 8).rotateZ(Math.PI / 2), am, 0, 0.64 * h, pz + 0.1 * w)); // ammo drum
    spine.add(_box(0.08 * w, 0.06 * h, 0.03 * w, lm, 0, 0.44 * h, pz + 0.205 * w));
  }
  if (kit.pauld) for (const s of kit.oneSide ? [-1] : [-1, 1]) { // pauldrons
    const k = kit.pauld * (opts.boss ? 1.25 : 1), x = s * 0.47 * w, y = 0.8 * h;
    if (variant === 1) spine.add(_m(new THREE.SphereGeometry(0.2 * w * k, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1.15), am, x, y - 0.04 * h, 0));
    else {
      spine.add(_m(new THREE.BoxGeometry(0.3 * w * k, 0.1 * h, 0.4 * w * k).rotateZ(-s * 0.22), am, x, y, 0));
      if (variant === 2) spine.add(_m(new THREE.BoxGeometry(0.22 * w * k, 0.08 * h, 0.32 * w * k).rotateZ(-s * 0.3), tm, x + s * 0.02 * w, y + 0.06 * h, 0));
    }
    if (opts.boss) spine.add(_m(new THREE.ConeGeometry(0.06 * w, 0.26 * h, 4).rotateZ(-s * 0.5), am, x + s * 0.12 * w, y + 0.14 * h, 0));
  }
  spine.add(_m(new THREE.CylinderGeometry(0.1 * w, 0.12 * w, 0.14 * h, 6), sm, 0, 0.9 * h, 0)); // neck
  const head = _joint(spine, 0, 1.03 * h, 0); ud.head = head; // baked into the spine segment
  let hm;
  if (sp.head === 'long') hm = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 3, 8), sm);
  else if (sp.head === 'flat') hm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.45), sm);
  else if (sp.head === 'crest') hm = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 7), sm);
  else if (sp.head === 'dome') { hm = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), sm); hm.scale.y = 1.25; }
  else hm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), sm);
  head.add(hm);
  // headgear: helmets only fit rounded heads; other species wear a brow band and ear pieces
  const [hx, hy, hz] = HEAD_BOX[sp.head] || HEAD_BOX.round;
  const roundish = sp.head === 'round' || sp.head === 'dome' || !HEAD_BOX[sp.head];
  let helm = kit.helm; if (helm !== 'none' && !roundish) helm = 'band';
  const visorDown = helm === 'full' || (helm === 'pilot' && r.chance(0.5));
  const shell = (sx, sy, sz, m, zo = 0.07, yo = 0.03) => head.add(_m(new THREE.SphereGeometry(1, fine ? 10 : 7, fine ? 7 : 5).scale(hx * sx, hy * sy, hz * sz), m, 0, yo, zo));
  if (helm === 'full') {
    shell(1.2, 1.16, 1.22, am, 0, 0.01);
    head.add(_box(hx * 1.5, hy * 0.3, 0.08, vm, 0, 0.04, -hz * 1.17)); head.add(_box(hx * 0.3, hy * 0.5, 0.08, vm, 0, -hy * 0.3, -hz * 1.13)); // T visor
    for (const s of [-1, 1]) head.add(_m(new THREE.CylinderGeometry(hx * 0.22, hx * 0.22, 0.06, 7).rotateZ(Math.PI / 2), um, s * hx * 1.18, -hy * 0.1, hz * 0.2));
    head.add(_m(new THREE.SphereGeometry(1, 8, 5).scale(hx * 0.95, hy * 0.6, hz * 0.6), dm, 0, -hy * 0.5, -hz * 0.74)); // faceplate
    for (const s of [-1, 1]) head.add(_m(new THREE.CylinderGeometry(hx * 0.16, hx * 0.16, 0.1, 6).rotateX(Math.PI / 2), um, s * hx * 0.42, -hy * 0.62, -hz * 1.12)); // filters
  } else if (helm === 'pilot') {
    shell(1.16, 1.14, 1.16, am);
    head.add(_box(hx * 1.7, hy * 0.36, 0.07, vm, 0, visorDown ? hy * 0.14 : hy * 0.66, visorDown ? -hz * 1.0 : -hz * 0.84));
    head.add(_box(0.05, hy * 1.2, hz * 1.9, tm, 0, hy * 0.62, 0.07)); // stripe over the crown
    for (const s of [-1, 1]) head.add(_m(new THREE.CylinderGeometry(hx * 0.2, hx * 0.2, 0.05, 7).rotateZ(Math.PI / 2), um, s * hx * 1.14, 0, 0.1));
  } else if (helm === 'cap') {
    head.add(_m(new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(hx * 1.14, hy * 0.8, hz * 1.14), kit.white ? am : tm, 0, hy * 0.36, 0));
    head.add(_box(hx * 1.7, 0.035, hz * 0.9, kit.white ? am : tm, 0, hy * 0.38, -hz * 1.1)); // brim
    head.add(_box(hx * 1.5, hy * 0.24, 0.05, dm, 0, hy * 0.62, -hz * 1.0)); for (const s of [-1, 1]) head.add(_box(hx * 0.5, hy * 0.2, 0.03, vm, s * hx * 0.38, hy * 0.62, -hz * 1.04)); // goggles
  } else if (helm === 'hood') {
    shell(1.2, 1.2, 1.3, um, 0.1, 0.04);
    head.add(_m(new THREE.TorusGeometry(hx * 0.95, hx * 0.36, 5, 8).rotateX(Math.PI / 2), tm, 0, -hy * 1.05, 0.02)); // scarf
  } else if (helm === 'band') {
    head.add(_box(hx * 2.1, 0.07, 0.06, am, 0, hy * 0.5, -hz * 0.98)); head.add(_box(hx * 1.6, hy * 0.9, 0.06, am, 0, 0, hz * 1.02));
    for (const s of [-1, 1]) head.add(_m(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 7).rotateZ(Math.PI / 2), dm, s * hx * 1.04, 0, 0));
    head.add(_box(0.05, 0.05, 0.05, lm, hx * 1.04, 0.12, 0));
  } else if (sp.id === 0 && variant !== 2) { // human hair
    const hair = mat(r.pick(HAIR), { metal: 0, rough: 0.9 });
    shell(1.08, 1.06, 1.1, hair, 0.06, 0.05);
    if (variant === 1) head.add(_m(new THREE.SphereGeometry(hx * 0.42, 6, 5), hair, 0, hy * 0.5, hz * 1.1)); // bun
  }
  if (opts.boss && (helm === 'full' || helm === 'pilot')) head.add(_m(wing({ span: hy * 0.75, cr: hz * 1.6, ct: hz * 0.5, sweep: hz * 0.5, t: 0.05 }).rotateZ(Math.PI / 2), lm, 0, hy * 0.95, -hz * 0.1)); // crest
  const front = { long: 0.21, flat: 0.22, crest: 0.15, dome: 0.34 }[sp.head] ?? 0.26; // eyes sit on the face, not inside it
  const em = mat(0x111111, { emissive: sp.id === 0 ? 0x000000 : new THREE.Color().setHSL(r.next(), 1, 0.5).getHex(), ei: 1.5 });
  if (!visorDown) for (let i = 0; i < sp.eyes; i++) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), em);
    e.position.set((i - (sp.eyes - 1) / 2) * 0.13, 0.05 + (sp.eyes > 2 && i % 2 ? 0.08 : 0), -front); head.add(e);
  }
  for (let i = 0; i < sp.horns; i++) {
    const hn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 5), mat(sp.color2)); hn.position.set(sp.horns === 1 ? 0 : (i ? 0.18 : -0.18), hy + 0.06, 0); hn.rotation.z = sp.horns === 1 ? 0 : (i ? -0.4 : 0.4); head.add(hn);
  }
  if (sp.tail) { const tg = _joint(hips, 0, 0, 0.2 * w); const tl = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.95, 5).translate(0, -0.47, 0), sm); tg.rotation.x = -1.0; tg.add(tl); ud.tail = tg; segs.push([tg, new Set()]); }

  // --- arms ---
  const arm = (side) => {
    const sh = _joint(spine, side * 0.5 * w, 0.72 * h, 0);
    sh.rotation.order = 'YXZ'; // raise the arm first (X), then turn it toward the gun (Y)
    const upL = 0.36 * h, foL = 0.32 * h;
    sh.add(_m(_vl([[-upL, 0.16 * w, 0.17 * w], [-upL * 0.4, 0.2 * w, 0.21 * w], [0.02 * h, 0.19 * w, 0.2 * w]]), kit.armor ? um : om));
    if (kit.armor > 1 && fine) sh.add(_m(_vl([[-upL * 0.75, 0.06 * w, 0.17 * w, 0], [-upL * 0.15, 0.07 * w, 0.2 * w, 0]], 'slab'), am, side * 0.09 * w)); // upper-arm plate
    const el = jointed ? _joint(sh, 0, -upL, 0) : sh;
    const ey = jointed ? 0 : -upL;
    if (kit.armor && fine) el.add(_box(0.2 * w, 0.08 * h, 0.2 * w, am, 0, ey + 0.005 * h, 0.01 * w)); // elbow guard
    el.add(_m(_vl([[-foL, 0.14 * w, 0.15 * w], [-foL * 0.35, 0.18 * w, 0.19 * w], [0, 0.16 * w, 0.17 * w]]), om, 0, ey, 0));
    el.add(_m(_vl([[-foL * 0.88, 0.165 * w, 0.175 * w], [-foL * 0.42, 0.2 * w, 0.21 * w]]), am, 0, ey, 0)); // bracer
    if (side < 0) el.add(_box(0.03 * w, 0.08 * h, 0.1 * w, lm, -0.1 * w, ey - foL * 0.62, 0)); // wrist display
    const hand = _joint(el, 0, ey - foL - 0.05 * h, 0);
    hand.add(_box(0.14 * w, 0.13 * h, 0.15 * w, dm));
    segs.push([sh, new Set(jointed ? [el] : [])]); // hand and gun bake into the forearm: one draw per segment
    if (jointed) segs.push([el, new Set()]);
    return { sh, el: jointed ? el : null, hand };
  };
  const AL = arm(-1), AR = arm(1);
  ud.shL = AL.sh; ud.elL = AL.el; ud.handL = AL.hand; ud.shR = AR.sh; ud.elR = AR.el; ud.handR = AR.hand;
  // Gun lies along the hand's -Y (down the forearm), so a raised arm points it forward.
  const gun = new THREE.Group(); AR.hand.add(gun); gun.position.set(0, 0, -0.07 * w);
  const gm = mat(0x2a2f36, { metal: 0.7, rough: 0.35 });
  gun.add(_box(0.1, 0.5, 0.15, gm, 0, -0.12, 0));                // receiver
  gun.add(_box(0.06, 0.12, 0.08, dm, 0, 0.17, 0.02));            // stock stub
  gun.add(_box(0.07, 0.14, 0.12, dm, 0, -0.08, 0.1));            // magazine
  gun.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.34, 6).translate(0, -0.53, -0.02), gm)); // barrel
  gun.add(_box(0.03, 0.16, 0.03, lm, 0, -0.18, -0.085));         // energy strip
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.72, -0.02); gun.add(muzzle);
  ud.gun = gun; ud.muzzle = muzzle;
  segs.push([spine, new Set([AL.sh, AR.sh])], [hips, new Set([spine, LL.hip, LR.hip, ...(ud.tail ? [ud.tail] : [])])]);

  for (const [grp, skip] of segs) bake(grp, skip);
  ud.pose = { aim: 0, kick: 0, breath: r.next() * 6 };
  g.userData = ud;
  return g;
}

const _damp = THREE.MathUtils.damp;
// Procedural pose: walk cycle (legs, knees, counter-swinging arms, hip bob, torso twist), idle breathing,
// and a two-handed aim that blends in smoothly. Call once per frame for visible characters.
//   walkT: walk phase clock, speed: ground speed, aim: 0..1 target weight, pitch: aim pitch (+ = up), dt: frame time
export function animateCharacter(ch, dt, { walkT = 0, speed = 0, aim = 0, pitch = 0, kick = 0 } = {}) {
  const u = ch.userData; if (!u.hips) return;
  const P = u.pose; dt = Math.min(dt, 0.1);
  P.aim = _damp(P.aim, aim, 9, dt);
  P.kick = Math.max(P.kick + kick, 0) * Math.exp(-dt * 14);
  P.breath += dt;
  const amp = Math.min(1, speed / 6), ph = walkT * 9, s = Math.sin(ph), c = Math.cos(ph);
  const a = P.aim;
  // legs: swing from the hip; knee folds on the forward swing, straightens under load
  u.hipL.rotation.set(0.55 * amp * s, 0, -0.04); u.hipR.rotation.set(-0.55 * amp * s, 0, 0.04);
  if (u.kneeL) { u.kneeL.rotation.x = -amp * (0.08 + 0.85 * Math.max(0, c)); u.kneeR.rotation.x = -amp * (0.08 + 0.85 * Math.max(0, -c)); }
  u.hips.position.y = 0.95 * (u.height / 2.3) + Math.abs(s) * 0.05 * amp - 0.03 * amp;
  // spine: twist against the stride, lean into a run, breathe at rest
  u.spine.rotation.set(0.12 * amp + a * 0.06 - a * pitch * 0.25, 0.1 * amp * s * (1 - a) - a * 0.18, 0);
  const br = Math.sin(P.breath * 1.8) * 0.012 * (1 - amp);
  u.spine.scale.set(1, 1 + br, 1 + br);
  if (u.tail) u.tail.rotation.set(-1.0 + Math.sin(P.breath * 2.2 + ph) * 0.12, Math.sin(ph * 0.5) * 0.25 * amp, 0);
  // arms: relaxed swing vs. two-handed aim (right hand on the grip, left on the foregrip)
  const lerp = (x, y) => x + (y - x) * a;
  const relaxLx = -0.45 * amp * s, relaxRx = 0.45 * amp * s + 0.15;
  u.shR.rotation.set(lerp(relaxRx, Math.PI / 2 + pitch * 0.85 - 0.05) - P.kick * 0.25, lerp(0, 0.22), lerp(0.1, 0));
  u.shL.rotation.set(lerp(relaxLx, Math.PI / 2 * 0.86 + pitch * 0.8), lerp(0, -0.7), lerp(-0.1, -0.2));
  if (u.elR) { u.elR.rotation.x = lerp(0.25 + 0.2 * amp * Math.max(0, s), 0.12 + P.kick * 0.3); u.elL.rotation.x = lerp(0.25 + 0.2 * amp * Math.max(0, -s), 0.75); }
}
// Kept for callers that only walk: no aim, fixed 60 fps step.
export function animateWalk(ch, t, speed) { animateCharacter(ch, 1 / 60, { walkT: t, speed }); }
const _mz = new THREE.Vector3();
export function muzzleWorld(ch, out = _mz) { const m = ch.userData.muzzle; if (!m) return null; ch.updateMatrixWorld(true); return m.getWorldPosition(out); }

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
