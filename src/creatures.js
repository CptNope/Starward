// Wildlife and ruin guardians. Each seed picks a body plan (four-legged beast, two-legged raptor,
// six-legged crawler, spider, drifting floater, winged flyer; guardians are stone golems) and then
// varies proportions, colours, horns, spines and tails inside it. Creatures face -Z.
// Rigging matches the characters: joints are Groups that pivot at the hip/knee/wing root, and each
// rigid piece bakes to one draw call.
import * as THREE from 'three';
import { RNG } from './rng.js';
import { mat, bake } from './models.js';
import { PROFILES, loft, wing, mirrorX } from './geo.js';
import { Q } from './quality.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _up = V(0, 1, 0);
// tapered limb from a (radius r0) to b (radius r1)
function bone(a, b, r0, r1, seg = 5) {
  const d = V().subVectors(b, a), len = d.length();
  return new THREE.CylinderGeometry(r1, r0, len, seg).translate(0, len / 2, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, d.normalize())).translate(a.x, a.y, a.z);
}
const PLANS = ['beast', 'beast', 'raptor', 'crawler', 'spider', 'floater', 'flyer'];

export function buildCreature(seed, level = 1, kind = null) {
  const r = new RNG(seed);
  const plan = kind === 'guardian' ? 'golem' : r.pick(PLANS);
  const jointed = Q.tier > 0; // Low preset keeps knees rigid: one draw per leg
  const g = new THREE.Group(), B = new THREE.Group(); g.add(B); // B carries the whole body so it can bob and lunge
  const s = r.range(0.7, 1.8) * (1 + level * 0.02);
  // --- palette ---
  const hue = r.next(), sat = r.range(0.35, 0.75), lum = r.range(0.3, 0.5);
  const col = (dh, ds, dl) => new THREE.Color().setHSL((hue + dh + 1) % 1, Math.min(1, Math.max(0, sat + ds)), Math.min(0.9, Math.max(0.06, lum + dl))).getHex();
  const accent = new THREE.Color().setHSL((hue + r.range(0.3, 0.7)) % 1, 0.9, 0.55).getHex();
  const stone = plan === 'golem';
  const M = {
    skin: stone ? mat(col(0, -sat + 0.06, 0.02), { metal: 0.2, rough: 0.9 }) : mat(col(0, 0, 0), { metal: 0.05, rough: 0.85 }),
    dark: stone ? mat(col(0, -sat + 0.05, -0.16), { metal: 0.3, rough: 0.8 }) : mat(col(0.02, -0.1, -0.15), { metal: 0.05, rough: 0.9 }),
    belly: stone ? mat(col(0, -sat + 0.08, 0.14), { metal: 0.2, rough: 0.85 }) : mat(col(-0.03, -0.2, 0.2), { metal: 0.05, rough: 0.85 }),
    bone: mat(0xd9d0b8, { metal: 0.1, rough: 0.6 }),
    acc: mat(accent, { metal: 0.1, rough: 0.6 }),
    glow: mat(0x111111, { emissive: accent, ei: 1.5 }),
    eye: mat(0x111111, { emissive: new THREE.Color().setHSL(r.next(), 1, 0.6).getHex(), ei: 1.6 }),
  };
  const ud = { plan, legs: [], limbs: [], t: r.next() * 10, lunge: 0, s };
  const segs = [], skipB = new Set();
  const mesh = (geo, m, x = 0, y = 0, z = 0) => { if (x || y || z) geo.translate(x, y, z); return new THREE.Mesh(geo, m); };
  const put = (geo, m, x, y, z) => { const o = mesh(geo, m, x, y, z); B.add(o); return o; };
  const both = (geo, m, x, y, z) => { geo.translate(x, y, z); B.add(new THREE.Mesh(geo, m)); B.add(new THREE.Mesh(mirrorX(geo), m)); };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const part = (grp, skip = []) => { segs.push([grp, new Set(skip)]); };
  const eyes = (n, x, y, z, rad) => { for (let i = 0; i < n; i++) both(new THREE.SphereGeometry(rad * (i ? 0.7 : 1), 6, 4), M.eye, x - i * rad * 0.4, y + i * rad * 1.3, z + i * rad * 1.6); };
  const spines = (n, z0, z1, y, h, m = M.acc) => { for (let i = 0; i < n; i++) { const f = n === 1 ? 0.5 : i / (n - 1); put(new THREE.ConeGeometry(h * 0.22, h * (0.6 + Math.sin(f * Math.PI) * 0.6), 4).rotateX(0.35), m, 0, y + h * 0.3, z0 + (z1 - z0) * f); } };
  // walking leg with a hip and a knee. rest = [hip, knee] angles; positive swings forward.
  const leg = (x, y, z, up, lo, th, rest, ph, m = M.dark) => {
    const hip = joint(B, x, y, z); hip.rotation.x = rest[0]; skipB.add(hip);
    hip.add(mesh(bone(V(0, th * 0.3, 0), V(0, -up, 0), th * 1.3, th * 0.74, 6), m));
    const knee = joint(hip, 0, -up, 0); knee.rotation.x = rest[1];
    knee.add(mesh(bone(V(0, th * 0.2, 0), V(0, -lo, 0), th * 0.74, th * 0.44, 6), m));
    const ft = mesh(loft([[-th * 1.5, th * 0.7, th * 0.3, -th * 0.1], [-th * 0.5, th * 1.15, th * 0.5], [th * 0.5, th * 0.9, th * 0.55]], PROFILES.hull), m); ft.position.y = -lo; ft.rotation.x = -(rest[0] + rest[1]); knee.add(ft);
    if (jointed) { part(hip, [knee]); part(knee); } else part(hip);
    ud.legs.push({ hip, knee: jointed ? knee : null, rest, ph });
    return hip;
  };
  // splayed arthropod leg: up and out from the body, then down to the ground. One rigid piece.
  const legSets = jointed || (plan !== 'crawler' && plan !== 'spider') ? null : [0, 1].map((i) => { const s2 = new THREE.Group(); B.add(s2); skipB.add(s2); ud.limbs.push({ set: s2, ph: i * Math.PI }); return s2; });
  const spiderLeg = (side, x, y, z, out, rise, th, ph, yaw) => {
    const hip = joint(legSets ? legSets[Math.round(ph / Math.PI) % 2] : B, side * x, y, z); if (!legSets) skipB.add(hip);
    const k = V(side * out * 0.5, rise, 0), f = V(side * out, -y, 0);
    hip.add(mesh(bone(V(0, 0, 0), k, th, th * 0.7, 4), M.dark)); hip.add(mesh(bone(k, f, th * 0.7, th * 0.2, 4), M.dark));
    hip.add(mesh(new THREE.SphereGeometry(th * 0.95, 5, 4), M.skin, k.x, k.y, k.z));
    hip.rotation.y = yaw; if (legSets) return;
    part(hip); ud.limbs.push({ g: hip, side, ph, yaw });
  };

  if (plan === 'beast' || plan === 'raptor') {
    const biped = plan === 'raptor';
    const L = r.range(2.0, 3.0) * s, W = r.range(0.7, 1.05) * s, H = r.range(0.7, 0.95) * s, legLen = r.range(0.9, 1.45) * s * (biped ? 1.15 : 1);
    const th = W * r.range(0.2, 0.27);
    const hind = [0.45, -0.95], fore = [-0.2, 0.42];
    const y0 = legLen + H * 0.25; // spine height
    const lean = biped ? 0.12 : 0; // raptors carry the chest a little high
    // torso: deep chest, tucked waist
    put(loft([[-L * 0.5, W * 0.66, H * 0.74, H * 0.06 + lean * L], [-L * 0.24, W, H, lean * L * 0.5], [L * 0.14, W * 0.88, H * 0.86], [L * 0.5, W * 0.5, H * 0.56, H * 0.04]], PROFILES.hull), M.skin, 0, y0, 0);
    put(loft([[-L * 0.42, W * 0.5, H * 0.3, -H * 0.36 + lean * L * 0.8], [L * 0.1, W * 0.6, H * 0.3, -H * 0.34], [L * 0.44, W * 0.34, H * 0.2, -H * 0.2]], PROFILES.round6), M.belly, 0, y0, 0);
    // neck and head
    const nz = -L * 0.5, ny = y0 + H * 0.1 + lean * L, nl = r.range(0.4, 0.9) * s * (biped ? 1.2 : 1), nUp = r.range(0.25, 0.7) * (biped ? 1.3 : 1);
    const hz = nz - nl * Math.cos(nUp), hy = ny + nl * Math.sin(nUp);
    put(bone(V(0, ny - H * 0.1, nz + 0.15 * s), V(0, hy, hz), W * 0.36, W * 0.26, 6), M.skin);
    const hw = W * r.range(0.5, 0.72), hl = r.range(0.7, 1.15) * s, hh = hw * r.range(0.7, 0.95);
    put(loft([[hz + hl * 0.3, hw * 0.8, hh * 0.9, hy + hh * 0.05], [hz - hl * 0.05, hw, hh, hy + hh * 0.05], [hz - hl * 0.45, hw * 0.62, hh * 0.6, hy - hh * 0.05], [hz - hl * 0.72, hw * 0.4, hh * 0.36, hy - hh * 0.12]], PROFILES.hull), M.skin);
    put(loft([[hz + hl * 0.1, hw * 0.7, hh * 0.24, hy - hh * 0.5], [hz - hl * 0.66, hw * 0.34, hh * 0.16, hy - hh * 0.42]], PROFILES.round6), M.dark); // jaw
    for (let i = 0; i < 3; i++) both(new THREE.ConeGeometry(hw * 0.05, hh * 0.24, 4).rotateX(Math.PI), M.bone, hw * (0.2 - i * 0.03), hy - hh * 0.36, hz - hl * (0.3 + i * 0.13)); // teeth
    eyes(r.pick([1, 1, 2]), hw * 0.44, hy + hh * 0.22, hz - hl * 0.12, hw * 0.11);
    const horn = r.int(0, 3);
    if (horn === 1) both(new THREE.ConeGeometry(hw * 0.12, hh * 1.1, 5).rotateX(-0.7).rotateZ(-0.35), M.bone, hw * 0.3, hy + hh * 0.75, hz + hl * 0.25);
    else if (horn === 2) put(new THREE.ConeGeometry(hw * 0.13, hh * 0.9, 5).rotateX(0.5), M.bone, 0, hy + hh * 0.5, hz - hl * 0.5);
    else if (horn === 3) both(wing({ span: hw * 0.9, cr: hl * 0.45, ct: hl * 0.1, sweep: hl * 0.3, t: 0.03 * s }).rotateZ(0.7), M.acc, hw * 0.3, hy + hh * 0.3, hz + hl * 0.2); // frills
    if (r.chance(0.6)) spines(r.int(3, 6), -L * 0.4, L * 0.38, y0 + H * 0.42, H * r.range(0.3, 0.6), r.chance(0.5) ? M.acc : M.bone);
    else if (r.chance(0.5)) put(loft([[-L * 0.4, W * 0.5, H * 0.16, H * 0.5], [0, W * 0.74, H * 0.2, H * 0.47], [L * 0.38, W * 0.4, H * 0.12, H * 0.34]], PROFILES.slab), M.acc, 0, y0, 0); // back plate
    // tail
    const tail = joint(B, 0, y0 + H * 0.05, L * 0.46); skipB.add(tail);
    const tl = r.range(0.9, 1.7) * s * (biped ? 1.3 : 1);
    tail.add(mesh(bone(V(0, 0, 0), V(0, -tl * 0.12, tl), W * 0.26, W * 0.05, 6), M.skin));
    if (r.chance(0.4)) tail.add(mesh(new THREE.IcosahedronGeometry(W * 0.2, 0), M.bone, 0, -tl * 0.12, tl));
    else if (r.chance(0.4)) tail.add(mesh(wing({ span: tl * 0.35, cr: tl * 0.4, ct: tl * 0.1, sweep: tl * 0.2, t: 0.03 * s }).rotateZ(Math.PI / 2), M.acc, 0, -tl * 0.1, tl * 0.7));
    part(tail); ud.tail = tail;
    // legs
    const hy0 = y0 - H * 0.2;
    const fit = (rest) => { const up = 0.5, lo = 0.56; const k = (hy0 - th * 0.25) / (up * Math.cos(rest[0]) + lo * Math.cos(rest[0] + rest[1])); return [up * k, lo * k]; };
    if (biped) {
      const [u1, l1] = fit(hind);
      leg(-W * 0.4, hy0, L * 0.06, u1, l1, th * 1.35, hind, 0); leg(W * 0.4, hy0, L * 0.06, u1, l1, th * 1.35, hind, Math.PI);
      both(bone(V(0, 0, 0), V(0, -H * 0.5, -H * 0.3), th * 0.5, th * 0.3, 4), M.dark, W * 0.42, y0 - H * 0.1 + lean * L * 0.6, -L * 0.34); // small arms
    } else {
      const [u1, l1] = fit(hind), [u2, l2] = fit(fore);
      leg(-W * 0.4, hy0, L * 0.3, u1, l1, th * 1.15, hind, 0); leg(W * 0.4, hy0, L * 0.3, u1, l1, th * 1.15, hind, Math.PI);
      leg(-W * 0.42, hy0, -L * 0.3, u2, l2, th, fore, Math.PI); leg(W * 0.42, hy0, -L * 0.3, u2, l2, th, fore, 0);
    }
    ud.height = Math.max(y0 + H * 0.5, hy + hh * 0.4); ud.radius = Math.max(W * 0.7, L * 0.5);
  } else if (plan === 'crawler' || plan === 'spider') {
    const n = plan === 'spider' ? 4 : 3; // leg pairs
    const W = r.range(0.7, 1.0) * s, L = r.range(1.9, 2.8) * s * (n === 4 ? 0.8 : 1), y0 = (n === 4 ? r.range(0.55, 0.85) : r.range(0.36, 0.5)) * s, H = W * r.range(0.55, 0.75);
    const scorpion = plan === 'crawler' && r.chance(0.5);
    if (n === 4) { // spider: small head-chest, big abdomen
      put(loft([[-L * 0.5, W * 0.3, H * 0.4], [-L * 0.3, W * 0.7, H * 0.8], [-L * 0.02, W * 0.66, H * 0.7], [L * 0.06, W * 0.3, H * 0.4]], PROFILES.hull), M.dark, 0, y0, 0);
      put(new THREE.IcosahedronGeometry(1, 1).scale(W * 0.62, H * 0.78, L * 0.36), M.skin, 0, y0 + H * 0.28, L * 0.36);
      for (let i = 0; i < 3; i++) put(new THREE.TorusGeometry(W * (0.52 - i * 0.1), 0.03 * s, 3, 8).rotateY(Math.PI / 2).scale(1, H * 1.3 / W, 1), M.glow, 0, y0 + H * 0.3, L * (0.3 + i * 0.12)); // markings
    } else { // crawler: armoured segments
      const segN = 4;
      for (let i = 0; i < segN; i++) { const f = i / (segN - 1), w = W * (0.7 + Math.sin(f * Math.PI) * 0.34), z = -L * 0.38 + f * L * 0.8; put(loft([[z - L * 0.14, w * 0.8, H * 0.7], [z, w, H], [z + L * 0.14, w * 0.86, H * 0.8]], PROFILES.hull), i % 2 ? M.skin : M.dark, 0, y0, 0); }
      for (let i = 0; i < segN; i++) { const f = i / (segN - 1); put(new THREE.ConeGeometry(W * 0.1, H * 0.5, 4), M.acc, 0, y0 + H * 0.55, -L * 0.38 + f * L * 0.8); }
    }
    // head: mandibles and a cluster of eyes
    const hz = -L * 0.5;
    both(wing({ span: W * 0.55, cr: W * 0.22, ct: W * 0.04, sweep: -W * 0.5, t: 0.06 * s }).rotateY(-0.5), M.bone, W * 0.12, y0 - H * 0.1, hz);
    eyes(n === 4 ? 3 : 2, W * 0.16, y0 + H * 0.2, hz + W * 0.1, W * 0.07);
    if (scorpion) { // curled stinger tail, and claws
      const tail = joint(B, 0, y0 + H * 0.2, L * 0.42); skipB.add(tail);
      const pts = [V(0, 0, 0), V(0, H * 1.1, L * 0.3), V(0, H * 2.3, L * 0.2), V(0, H * 2.8, -L * 0.12)];
      for (let i = 0; i < 3; i++) { tail.add(mesh(bone(pts[i], pts[i + 1], W * (0.2 - i * 0.04), W * (0.16 - i * 0.04), 5), i % 2 ? M.skin : M.dark)); tail.add(mesh(new THREE.SphereGeometry(W * (0.2 - i * 0.04), 5, 4), M.dark, pts[i].x, pts[i].y, pts[i].z)); }
      tail.add(mesh(new THREE.ConeGeometry(W * 0.1, W * 0.5, 5).rotateX(-2.0), jointed ? M.glow : M.acc, 0, H * 2.75, -L * 0.24));
      part(tail); ud.tail = tail; ud.tailCurl = true;
      both(bone(V(0, 0, 0), V(W * 0.5, 0, -W * 0.8), W * 0.1, W * 0.16, 5), M.dark, W * 0.3, y0, hz + W * 0.1);
      both(new THREE.ConeGeometry(W * 0.16, W * 0.5, 4).rotateX(-Math.PI / 2), M.bone, W * 0.8, y0, hz - W * 0.9);
    }
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0.5 : i / (n - 1), z = (n === 4 ? -L * 0.3 + f * L * 0.26 : -L * 0.34 + f * L * 0.62), yaw = (f - 0.5) * (n === 4 ? 1.5 : 0.9);
      const out = W * (n === 4 ? r.range(1.6, 2.0) : r.range(1.0, 1.25)), rise = n === 4 ? y0 * r.range(0.8, 1.3) : y0 * r.range(0.5, 0.8);
      spiderLeg(1, W * 0.28, y0, z, out, rise, 0.1 * s, i * Math.PI, -yaw); spiderLeg(-1, W * 0.28, y0, z, out, rise, 0.1 * s, i * Math.PI + Math.PI, yaw);
    }
    ud.height = y0 + H * (scorpion ? 2.2 : 1.1); ud.radius = Math.max(W * 0.9, L * 0.5);
  } else if (plan === 'floater') {
    // drifting bell with a glowing core and trailing tentacles
    const Rb = r.range(0.6, 0.95) * s, y0 = r.range(1.3, 1.8) * s;
    const dome = new THREE.LatheGeometry([[0.02, 1], [0.5, 0.88], [0.85, 0.55], [1, 0.1], [0.92, -0.12], [0.6, -0.05], [0.02, 0.05]].map(([x, y]) => new THREE.Vector2(x * Rb, y * Rb * r.range(0.95, 1.05))), 9);
    put(dome, M.skin, 0, y0, 0);
    put(new THREE.IcosahedronGeometry(Rb * 0.36, 0), M.glow, 0, y0 + Rb * 0.25, 0);
    put(new THREE.TorusGeometry(Rb * 0.97, Rb * 0.07, 4, 9).rotateX(Math.PI / 2), M.acc, 0, y0 + Rb * 0.05, 0);
    for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + (i - 1.5) * 0.5; put(new THREE.SphereGeometry(Rb * 0.09, 6, 4), M.eye, Math.cos(a) * Rb * 0.9, y0 + Rb * 0.36, Math.sin(a) * Rb * 0.9); }
    const nt = jointed ? 5 : 3;
    for (let i = 0; i < nt; i++) {
      const a = i / nt * Math.PI * 2 + 0.3, len = y0 * r.range(0.5, 0.8), t = joint(B, Math.cos(a) * Rb * 0.6, y0 - Rb * 0.05, Math.sin(a) * Rb * 0.6); skipB.add(t);
      const p = [V(0, 0, 0), V(0.08 * s, -len * 0.4, 0.05 * s), V(-0.06 * s, -len * 0.75, 0), V(0.03 * s, -len, 0.04 * s)];
      for (let k = 0; k < 3; k++) t.add(mesh(bone(p[k], p[k + 1], 0.07 * s * (1 - k * 0.28), 0.07 * s * (0.72 - k * 0.28), 4), k === 2 ? M.acc : M.dark));
      t.add(mesh(new THREE.SphereGeometry(0.06 * s, 4, 3), M.bone, p[3].x, p[3].y, p[3].z));
      part(t); ud.limbs.push({ g: t, ph: i * 1.3, a });
    }
    ud.height = (y0 + Rb * 0.2) / 0.55; ud.radius = Rb * 1.05;
  } else if (plan === 'flyer') {
    // hovering glider: beaked head, two flapping wings, fan tail
    const L = r.range(1.5, 2.2) * s, W = r.range(0.45, 0.65) * s, y0 = r.range(1.1, 1.6) * s, span = r.range(1.5, 2.3) * s;
    put(loft([[-L * 0.5, W * 0.4, W * 0.4, W * 0.1], [-L * 0.2, W, W * 0.9], [L * 0.2, W * 0.8, W * 0.7], [L * 0.5, W * 0.3, W * 0.3, W * 0.05]], PROFILES.hull), M.skin, 0, y0, 0);
    put(loft([[-L * 0.4, W * 0.5, W * 0.3, -W * 0.3], [L * 0.4, W * 0.3, W * 0.2, -W * 0.2]], PROFILES.round6), M.belly, 0, y0, 0);
    const hz = -L * 0.62;
    put(new THREE.IcosahedronGeometry(W * 0.46, 0).scale(1, 0.9, 1.2), M.skin, 0, y0 + W * 0.22, hz);
    put(new THREE.ConeGeometry(W * 0.2, W * 1.1, 4).rotateX(-Math.PI / 2 - 0.15), M.bone, 0, y0 + W * 0.12, hz - W * 0.8);
    eyes(1, W * 0.3, y0 + W * 0.34, hz - W * 0.2, W * 0.1);
    if (r.chance(0.6)) put(wing({ span: W * 0.9, cr: W * 0.9, ct: W * 0.2, sweep: W * 0.6, t: 0.03 * s }).rotateZ(Math.PI / 2), M.acc, 0, y0 + W * 0.5, hz + W * 0.2); // crest
    for (const side of [1, -1]) {
      const wj = joint(B, side * W * 0.4, y0 + W * 0.2, -L * 0.08); skipB.add(wj);
      let wg = wing({ span, cr: L * 0.7, ct: L * 0.16, sweep: L * 0.3, t: 0.05 * s, tt: 0.02 * s }); if (side < 0) wg = mirrorX(wg);
      wj.add(mesh(wg, M.dark));
      let st = wing({ span: span * 0.92, cr: L * 0.2, ct: L * 0.06, sweep: L * 0.5, t: 0.07 * s }).translate(0, 0, L * 0.12); if (side < 0) st = mirrorX(st);
      wj.add(mesh(st, M.acc));
      part(wj); ud.limbs.push({ g: wj, side });
    }
    const tail = joint(B, 0, y0, L * 0.46); skipB.add(tail);
    tail.add(mesh(loft([[0, W * 0.3, W * 0.2], [L * 0.5, W * 1.2, W * 0.04]], PROFILES.diamond), M.acc)); part(tail); ud.tail = tail;
    both(bone(V(0, 0, 0), V(0, -W * 0.5, W * 0.5), 0.05 * s, 0.03 * s, 4), M.bone, W * 0.25, y0 - W * 0.3, L * 0.1); // tucked feet
    ud.height = (y0 + W * 0.2) / 0.55; ud.radius = Math.max(W, L * 0.5);
  } else {
    // golem: a ruin guardian of stone slabs around a burning core
    const H = r.range(2.6, 3.2) * s, W = H * r.range(0.38, 0.52), th = W * r.range(0.18, 0.23);
    const style = r.int(0, 2);
    const legL = H * 0.4, y0 = legL;
    put(loft([[-W * 0.3, W * 0.8, H * 0.2, 0], [0, W * 0.9, H * 0.22, 0], [W * 0.3, W * 0.8, H * 0.2, 0]], PROFILES.slab), M.dark, 0, y0 + H * 0.05, 0); // pelvis
    const chest = loft([[-W * 0.36, W * 0.9, H * 0.3], [0, W * 1.3, H * 0.4], [W * 0.34, W * 1.05, H * 0.34]], PROFILES.oct); put(chest, M.skin, 0, y0 + H * 0.34, 0);
    put(style === 1 ? new THREE.IcosahedronGeometry(W * 0.2, 0) : new THREE.OctahedronGeometry(W * 0.24, 0).scale(1, style === 2 ? 1.5 : 1, 1), M.glow, 0, y0 + H * 0.34, -W * 0.34); // core
    put(new THREE.TorusGeometry(W * 0.3, 0.035 * H, 4, 6), M.dark, 0, y0 + H * 0.34, -W * 0.36);
    if (style === 0) { put(loft([[-W * 0.26, W * 0.44, H * 0.14], [W * 0.2, W * 0.5, H * 0.16]], PROFILES.slab), M.belly, 0, y0 + H * 0.6, -W * 0.04); put(new THREE.BoxGeometry(W * 0.34, H * 0.03, 0.04 * H), M.eye, 0, y0 + H * 0.61, -W * 0.3); } // slab head, visor
    else if (style === 1) { put(new THREE.ConeGeometry(W * 0.3, H * 0.24, 4).rotateY(Math.PI / 4), M.belly, 0, y0 + H * 0.66, 0); both(new THREE.SphereGeometry(W * 0.06, 5, 4), M.eye, W * 0.1, y0 + H * 0.62, -W * 0.17); } // pyramid head, two eyes
    else { put(new THREE.OctahedronGeometry(W * 0.2, 0).scale(1, 1.4, 1), M.eye, 0, y0 + H * 0.72, 0); put(new THREE.TorusGeometry(W * 0.3, 0.03 * H, 4, 6).rotateX(Math.PI / 2), M.belly, 0, y0 + H * 0.6, 0); } // no head: a floating crystal
    both(new THREE.BoxGeometry(0.03 * H, H * 0.2, 0.03 * H), M.glow, W * 0.5, y0 + H * 0.3, -W * 0.3); // runes
    both(new THREE.BoxGeometry(W * 0.2, H * 0.02, 0.03 * H), M.glow, W * 0.32, y0 + H * 0.5, -W * 0.3);
    const shards = r.int(2, 5); for (let i = 0; i < shards; i++) put(new THREE.ConeGeometry(W * 0.1, H * r.range(0.12, 0.28), 4).rotateX(0.3), M.belly, (i - (shards - 1) / 2) * W * 0.26, y0 + H * 0.58, W * 0.26); // back shards
    for (const side of [1, -1]) {
      const sh = joint(B, side * W * 0.78, y0 + H * 0.46, 0); skipB.add(sh);
      sh.add(mesh(style === 1 ? new THREE.ConeGeometry(W * 0.28, W * 0.6, 5).translate(0, W * 0.1, 0) : style === 2 ? new THREE.BoxGeometry(W * 0.5, W * 0.4, W * 0.56) : new THREE.IcosahedronGeometry(W * 0.3, 0), M.belly)); // shoulder stone
      sh.add(mesh(loft([[-th * 0.9, th * 1.5, H * 0.24, -H * 0.2], [th * 0.9, th * 1.7, H * 0.26, -H * 0.2]], PROFILES.slab), M.skin));
      sh.add(mesh(loft([[-th * 1.1, th * 2.0, H * 0.24, -H * 0.48], [th * 1.1, th * 2.2, H * 0.26, -H * 0.48]], PROFILES.oct), M.dark)); // fist
      part(sh); ud.limbs.push({ g: sh, side });
      const hip = joint(B, side * W * 0.36, y0, 0); skipB.add(hip);
      hip.add(mesh(loft([[-th, th * 1.6, legL * 0.5, -legL * 0.25], [th, th * 1.8, legL * 0.5, -legL * 0.25]], PROFILES.slab), M.skin));
      hip.add(mesh(loft([[-th * 1.3, th * 2.0, legL * 0.44, -legL * 0.76], [th * 1.1, th * 2.2, legL * 0.46, -legL * 0.77]], PROFILES.oct), M.dark));
      part(hip); ud.legs.push({ hip, knee: null, rest: [0, 0], ph: side > 0 ? 0 : Math.PI });
    }
    ud.height = y0 + H * 0.7; ud.radius = W * 0.8;
  }
  if (legSets) for (const s2 of legSets) bake(s2);
  for (const [grp, skip] of segs) bake(grp, skip);
  bake(B, skipB);
  ud.body = B;
  g.userData = ud;
  return g;
}

// Procedural motion for every body plan. Call once per frame for visible creatures.
//   walkT: walk phase clock, speed: ground speed, lunge: set to 1 on the frame it bites
export function animateCreature(c, dt, { walkT = 0, speed = 0, lunge = 0 } = {}) {
  const u = c.userData; if (!u.body) return;
  dt = Math.min(dt, 0.1); u.t += dt;
  u.lunge = Math.max(u.lunge * Math.exp(-dt * 7), lunge);
  const amp = Math.min(1, speed / 5), ph = walkT * 9, B = u.body, t = u.t, s = u.s, k = u.lunge;
  const breathe = Math.sin(t * 1.7) * 0.012;
  B.scale.set(1 + breathe, 1 + breathe, 1);
  if (u.plan === 'beast' || u.plan === 'raptor' || u.plan === 'golem') {
    const stride = u.plan === 'golem' ? 0.4 : 0.6;
    for (const l of u.legs) {
      const sw = Math.sin(ph + l.ph), lift = Math.max(0, Math.cos(ph + l.ph));
      l.hip.rotation.x = l.rest[0] + sw * stride * amp;
      if (l.knee) l.knee.rotation.x = l.rest[1] + Math.sign(l.rest[1] || -1) * lift * 0.55 * amp;
    }
    B.position.y = Math.abs(Math.sin(ph)) * 0.05 * s * amp - 0.04 * s * amp;
    B.rotation.set(-k * 0.3 + (u.plan === 'raptor' ? 0.06 * amp : 0), 0, Math.sin(ph) * 0.03 * amp);
    B.position.z = -k * 0.45 * s;
    if (u.tail) u.tail.rotation.set(Math.sin(t * 1.3) * 0.08 + k * 0.3, Math.sin(ph * 0.5 + t * 0.9) * (0.18 + 0.2 * amp), 0);
    if (u.plan === 'golem') for (const l of u.limbs) l.g.rotation.set(-Math.sin(ph + (l.side > 0 ? Math.PI : 0)) * 0.35 * amp - k * 1.1, 0, l.side * (0.06 + Math.sin(t * 1.2 + l.side) * 0.03)); // arms swing, then slam
  } else if (u.plan === 'crawler' || u.plan === 'spider') {
    for (const l of u.limbs) {
      const sw = Math.sin(ph * 1.3 + l.ph), lift = Math.max(0, Math.cos(ph * 1.3 + l.ph));
      if (l.set) { l.set.position.set(0, lift * 0.1 * s * amp, -sw * 0.16 * s * amp); continue; }
      l.g.rotation.set(0, l.yaw + l.side * sw * 0.32 * amp, l.side * lift * 0.22 * amp + l.side * Math.sin(t * 2 + l.ph) * 0.015);
    }
    B.position.set(0, Math.sin(ph * 2.6) * 0.02 * s * amp, -k * 0.5 * s);
    B.rotation.x = -k * 0.18;
    if (u.tail) u.tail.rotation.x = Math.sin(t * 2.1) * 0.08 - k * 0.7; // stinger strikes forward
  } else if (u.plan === 'floater') {
    B.position.set(0, Math.sin(t * 1.4) * 0.14 * s, -k * 0.4 * s);
    B.rotation.set(-0.1 * amp - k * 0.4, t * 0.25, 0);
    B.scale.set(1 + Math.sin(t * 2.8) * 0.04, 1 - Math.sin(t * 2.8) * 0.05, 1 + Math.sin(t * 2.8) * 0.04); // pulse
    for (const l of u.limbs) l.g.rotation.set(Math.sin(t * 1.9 + l.ph) * 0.22 + Math.sin(l.a) * 0.3 * amp, 0, Math.cos(t * 1.6 + l.ph) * 0.22 - Math.cos(l.a) * 0.3 * amp);
  } else if (u.plan === 'flyer') {
    const flap = Math.sin(t * (7 + 5 * amp));
    for (const l of u.limbs) l.g.rotation.z = l.side * (0.12 + flap * (0.42 + 0.2 * amp));
    B.position.set(0, -flap * 0.07 * s + Math.sin(t * 0.9) * 0.1 * s, -k * 0.5 * s);
    B.rotation.set(-0.12 * amp - k * 0.5, 0, Math.sin(t * 0.7) * 0.06);
    if (u.tail) u.tail.rotation.x = -flap * 0.12;
  }
}
