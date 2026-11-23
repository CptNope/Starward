// Space stations. The kind follows the station's name (a "Spire" is a spire, a "Dock" a shipyard,
// a pirate "Haven" is dug into an asteroid), so you can tell where you are before you read the label.
// Each station bakes to two draw calls plus a few beacon sprites. +Y is the station's axis.
import * as THREE from 'three';
import { RNG } from './rng.js';
import { mat, bake, glowSprite } from './models.js';
import { PROFILES, loft, prim } from './geo.js';

const KIND_BY_WORD = { Station: 'wheel', Spire: 'spire', Citadel: 'citadel', Dock: 'yard', Exchange: 'hub', Outpost: 'outpost', Haven: 'rock' };
export function stationKind(name = '') { return KIND_BY_WORD[name.trim().split(' ').pop()] || 'wheel'; }
const CARGO = [0x8a4b3a, 0x3f6f78, 0x7d7f86, 0xa08a3c, 0x4d6a4a];

export function buildStation(seed, color, kind = 'wheel') {
  const r = new RNG(seed);
  const g = new THREE.Group();
  const R = r.range(70, 120);
  const tint = r.range(-0.04, 0.05);
  const grey = (l) => new THREE.Color().setHSL(0.6, 0.08, l + tint).getHex();
  const M = {
    hull: mat(grey(0.56), { metal: 0.7, rough: 0.35 }), hull2: mat(grey(0.4), { metal: 0.7, rough: 0.45 }), lite: mat(grey(0.72), { metal: 0.5, rough: 0.4 }),
    dark: mat(0x20252d, { metal: 0.7, rough: 0.6 }), trim: mat(color, { emissive: color, ei: 0.6 }), glow: mat(0x111111, { emissive: color, ei: 1.5 }),
    win: mat(0x111111, { emissive: 0xffe2a8, ei: 1.3 }), solar: mat(0x1a2c66, { metal: 0.9, rough: 0.25 }), rock: mat(0x6b5f55, { metal: 0.05, rough: 0.95 }),
    bay: mat(0x111111, { emissive: 0x9fe8ff, ei: 1.4 }),
  };
  const add = (geo, m, x = 0, y = 0, z = 0) => { if (x || y || z) geo.translate(x, y, z); g.add(new THREE.Mesh(geo, m)); return geo; };
  const box = (w, h, d, m, x = 0, y = 0, z = 0, ry = 0) => { const b = prim.box(w, h, d); if (ry) b.rotateY(ry); return add(b, m, x, y, z); };
  const cylY = (r1, r2, h, seg, m, x = 0, y = 0, z = 0) => add(new THREE.CylinderGeometry(r1, r2, h, seg), m, x, y, z);
  const ring = (rad, tube, m, y = 0, rs = 8, ts = 36) => add(new THREE.TorusGeometry(rad, tube, rs, ts).rotateX(Math.PI / 2), m, 0, y, 0);
  const lathe = (pts, seg, m, y = 0) => add(new THREE.LatheGeometry(pts.map(([x, py]) => new THREE.Vector2(x, py)), seg), m, 0, y, 0);
  // n things spaced around the Y axis: fn(angle, i) adds whatever it likes
  const around = (n, fn, a0 = 0) => { for (let i = 0; i < n; i++) fn(a0 + i / n * Math.PI * 2, i); };
  // ring of lit windows facing outward at radius rad
  const windows = (rad, y, n, sz = 1.6, m = M.win) => around(n, (a) => { if (r.chance(0.2)) return; box(sz * 0.6, sz, sz * 1.7, m, Math.cos(a) * rad, y, Math.sin(a) * rad, -a); });
  // radial arm from r0 to r1 at angle a
  const arm = (a, r0, r1, w, h, m, y = 0) => box(r1 - r0, h, w, m, Math.cos(a) * (r0 + r1) / 2, y, Math.sin(a) * (r0 + r1) / 2, -a);
  const at = (a, rad) => [Math.cos(a) * rad, Math.sin(a) * rad];
  // solar wing: a framed panel whose long side runs outward along angle a
  const solar = (a, r0, len, wid, y) => { const [x, z] = at(a, r0 + len / 2); box(len, 0.6, wid, M.solar, x, y, z, -a); box(len + 2, 1, 1.2, M.hull2, x, y, z, -a); for (let i = 1; i < 4; i++) { const [sx, sz2] = at(a, r0 + len * i / 4); box(0.8, 0.9, wid, M.hull2, sx, y, sz2, -a); } };
  const beacon = (x, y, z, s = 40, c = color) => { const b = glowSprite(c, s); b.position.set(x, y, z); beacons.push(b); };
  const beacons = [];
  const mast = (x, y, z, h) => { cylY(0.5, 0.8, h, 4, M.dark, x, y + h / 2, z); box(1.6, 1.6, 1.6, M.glow, x, y + h, z); };
  const turret = (x, y, z, s) => {
    cylY(s * 0.9, s, s * 0.6, 8, M.hull2, x, y + s * 0.3, z); add(new THREE.SphereGeometry(s * 0.75, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M.lite, x, y + s * 0.6, z);
    const a = Math.atan2(z, x) || 0; // barrels point away from the station's axis
    for (const o of [-0.28, 0.28]) box(s * 1.7, s * 0.2, s * 0.2, M.dark, x + Math.cos(a) * s - Math.sin(a) * o * s, y + s * 0.95, z + Math.sin(a) * s + Math.cos(a) * o * s, -a);
  };

  if (kind === 'spire') {
    // tall needle with stacked habitat discs and a docking collar
    const H = R * 2.2;
    lathe([[0, -H * 0.5], [R * 0.1, -H * 0.46], [R * 0.16, -H * 0.2], [R * 0.2, 0], [R * 0.14, H * 0.3], [R * 0.05, H * 0.47], [0, H * 0.5]], 10, M.hull);
    const discs = [[-0.26, 0.62], [-0.02, 0.86], [0.2, 0.5], [0.36, 0.3]];
    for (const [fy, fr] of discs) {
      const y = H * fy, rad = R * fr;
      lathe([[R * 0.12, -5], [rad * 0.9, -5], [rad, -1.5], [rad, 2.5], [rad * 0.82, 6], [R * 0.12, 7]], 16, M.hull2, y);
      ring(rad * 0.92, 1.4, M.trim, y + 6.2, 4, 32);
      windows(rad + 0.3, y + 0.5, Math.round(rad / 2.6));
    }
    around(4, (a) => { arm(a, R * 0.8, R * 1.0, 5, 4, M.hull, -H * 0.02); const [x, z] = at(a, R); box(14, 2, 14, M.dark, x, -H * 0.02 + 3, z, -a); box(10, 0.6, 2, M.bay, x, -H * 0.02 + 4.2, z, -a); }, r.next() * 6);
    add(new THREE.SphereGeometry(R * 0.2, 10, 8), M.hull2, 0, -H * 0.42, 0); ring(R * 0.24, 1.6, M.glow, -H * 0.42, 4, 24);
    mast(0, H * 0.5, 0, R * 0.3);
    beacon(0, H * 0.5 + R * 0.3, 0, 50); beacon(0, -H * 0.5, 0, 60);
    g.userData.radius = R + 20;
  } else if (kind === 'citadel') {
    // fortress: armoured octagon, four gun bastions, hangar slits
    const A = R * 0.55, Hh = R * 0.42;
    cylY(A, A, Hh * 2, 8, M.hull);
    lathe([[A, 0], [A * 0.7, Hh * 0.5], [A * 0.32, Hh * 0.75], [A * 0.28, Hh * 1.3], [0, Hh * 1.4]], 8, M.hull2, Hh);
    lathe([[0, -Hh * 1.2], [A * 0.3, -Hh * 0.9], [A * 0.75, -Hh * 0.35], [A, 0]], 8, M.hull2, -Hh);
    ring(A * 1.12, R * 0.07, M.hull2, Hh * 0.55, 4, 8); ring(A * 1.12, R * 0.07, M.hull2, -Hh * 0.55, 4, 8); // armour belts
    ring(A * 1.04, 1.6, M.trim, 0, 4, 8);
    around(4, (a) => {
      arm(a, A * 0.9, R * 0.86, R * 0.12, R * 0.14, M.hull2);
      const [x, z] = at(a, R * 0.86);
      cylY(R * 0.15, R * 0.17, R * 0.5, 8, M.hull, x, 0, z); cylY(R * 0.17, R * 0.15, R * 0.06, 8, M.lite, x, R * 0.28, z);
      turret(x, R * 0.31, z, R * 0.09); box(R * 0.2, 2, 2, M.glow, x, -R * 0.26, z, -a);
      beacon(x, -R * 0.3, z, 30);
    }, Math.PI / 8);
    around(4, (a) => { const [x, z] = at(a, A * 0.93); box(3, Hh * 0.5, A * 0.42, M.bay, x, 0, z, -a); }, Math.PI / 8 + Math.PI / 4);
    windows(A * 0.72, Hh * 1.52, 10, 1.5); windows(A * 0.31, Hh * 2.05, 6, 1.4);
    turret(0, Hh * 2.38, 0, R * 0.07); mast(0, Hh * 2.4, 0, R * 0.35);
    beacon(0, Hh * 2.4 + R * 0.35, 0, 50);
    g.userData.radius = R + 20;
  } else if (kind === 'yard') {
    // shipyard: a spine with gantry hoops around a half-built hull, a habitat drum at one end
    const L = R * 1.9;
    box(L, 6, 8, M.hull2, 0, R * 0.36, 0); box(L, 6, 8, M.hull2, 0, -R * 0.36, 0);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const x = -L * 0.32 + i * L * 0.2, S = R * 0.42;
      box(4, S * 2, 4, M.hull, x, 0, S); box(4, S * 2, 4, M.hull, x, 0, -S); box(4, 4, S * 2, M.hull, x, S, 0); box(4, 4, S * 2, M.hull, x, -S, 0);
      for (const [cy, cz] of [[S, S], [S, -S], [-S, S], [-S, -S]]) box(5, 5, 5, M.glow, x, cy, cz);
      box(3, 3, S * 0.5, M.dark, x, S * 0.3 * (i % 2 ? 1 : -1), S * 0.75); // crane arm
    }
    // the ship on the slip: bare frames forward, plated aft
    const hl = L * 0.66, hx = -L * 0.02;
    const hullGeo = loft([[-hl * 0.5, 2, 2], [-hl * 0.3, R * 0.2, R * 0.14], [0, R * 0.34, R * 0.22], [hl * 0.34, R * 0.36, R * 0.24], [hl * 0.5, R * 0.26, R * 0.18]], PROFILES.wedge).rotateY(-Math.PI / 2);
    add(hullGeo, M.dark, hx, 0, 0);
    add(loft([[0, R * 0.36, R * 0.235], [hl * 0.34, R * 0.385, R * 0.255], [hl * 0.5, R * 0.28, R * 0.19]], PROFILES.wedge).rotateY(-Math.PI / 2), M.lite, hx, 0, 0);
    for (let i = 0; i < 5; i++) { const fx = hx - hl * 0.06 - i * hl * 0.085, s = 1 - i * 0.17; box(1.6, R * 0.25 * s, R * 0.37 * s, M.hull, fx, 0, 0); }
    // habitat drum and docking pads
    const dx = L * 0.5 + R * 0.02;
    add(new THREE.CylinderGeometry(R * 0.3, R * 0.3, R * 0.5, 12).rotateZ(Math.PI / 2), M.hull, dx - R * 0.2, 0, 0);
    add(new THREE.CylinderGeometry(R * 0.33, R * 0.33, R * 0.06, 12).rotateZ(Math.PI / 2), M.trim, dx - R * 0.2, 0, 0);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (r.chance(0.2)) continue; box(4, 1.6, 1.6, M.win, dx - R * 0.08, Math.cos(a) * R * 0.305, Math.sin(a) * R * 0.305); box(4, 1.6, 1.6, M.win, dx - R * 0.33, Math.cos(a + 0.3) * R * 0.305, Math.sin(a + 0.3) * R * 0.305); }
    box(2, R * 0.3, R * 0.3, M.bay, dx + R * 0.05, 0, 0);
    box(R * 0.5, 0.6, R * 0.34, M.solar, -L * 0.5 - R * 0.05, R * 0.36 + 3.5, 0); box(R * 0.5, 0.6, R * 0.34, M.solar, -L * 0.5 - R * 0.05, -R * 0.36 - 3.5, 0);
    mast(dx - R * 0.2, R * 0.3, 0, R * 0.3);
    beacon(dx + R * 0.06, 0, 0, 50, 0x9fe8ff); beacon(-L * 0.5, R * 0.36, 0, 30); beacon(-L * 0.5, -R * 0.36, 0, 30);
    g.userData.radius = R + 20;
  } else if (kind === 'hub') {
    // trade exchange: core sphere, promenade ring, docking arms stacked with cargo, big solar wings
    add(new THREE.IcosahedronGeometry(R * 0.36, 1), M.hull); ring(R * 0.38, 2, M.trim, 0, 4, 24);
    ring(R * 0.62, R * 0.07, M.hull2, 0, 6, 30); windows(R * 0.692, 0, 26, 1.7);
    const a0 = r.next() * 6;
    around(6, (a, i) => {
      arm(a, R * 0.3, R * 0.98, 5, 5, M.hull, 0);
      const [x, z] = at(a, R); box(16, 3, 16, M.dark, x, 0, z, -a); box(12, 0.8, 2, M.bay, x, 2, z, -a); box(12, 0.8, 2, M.bay, x, -2, z, -a);
      if (i % 2 === 0) for (let c = 0; c < 4; c++) { if (r.chance(0.25)) continue; const [cx, cz] = at(a, R * (0.74 + (c >> 1) * 0.11)); box(R * 0.1, R * 0.09, R * 0.1, mat(r.pick(CARGO), { metal: 0.3, rough: 0.7 }), cx, (c % 2 ? 1 : -1) * (2.5 + R * 0.045), cz, -a); }
      else beacon(x, 0, z, 26);
    }, a0);
    for (const s of [-1, 1]) {
      cylY(2.5, 3.5, R * 0.55, 6, M.hull2, 0, s * R * 0.6, 0);
      solar(a0 + 0.5, R * 0.04, R * 0.7, R * 0.3, s * R * 0.82); solar(a0 + 0.5 + Math.PI, R * 0.04, R * 0.7, R * 0.3, s * R * 0.82);
    }
    mast(0, R * 0.88, 0, R * 0.2); beacon(0, R * 0.88 + R * 0.2, 0, 45); beacon(0, -R * 0.88, 0, 45);
    g.userData.radius = R + 20;
  } else if (kind === 'outpost') {
    // frontier outpost: pressurised cans on a truss with solar wings and a comms dish
    const L = R * 1.8;
    box(L, 4, 4, M.dark, 0, 0, 0);
    for (let i = 0; i < 7; i++) box(1.2, 6, 6, M.hull2, -L * 0.45 + i * L * 0.15, 0, 0);
    const cans = 3 + r.int(0, 2);
    for (let i = 0; i < cans; i++) {
      const x = (i - (cans - 1) / 2) * R * 0.3, rr = R * r.range(0.11, 0.15), len = R * r.range(0.45, 0.8), y = (i % 2 ? 1 : -1) * (rr * 0.5);
      add(new THREE.CylinderGeometry(rr, rr, len, 10).rotateX(Math.PI / 2), i % 2 ? M.hull : M.lite, x, y, 0);
      add(new THREE.CylinderGeometry(rr * 1.08, rr * 1.08, 3, 10).rotateX(Math.PI / 2), M.trim, x, y, 0);
      for (const e of [-1, 1]) add(new THREE.CylinderGeometry(rr * 0.6, rr, rr * 0.5, 10).rotateX(e * Math.PI / 2), M.hull2, x, y, e * (len / 2 + rr * 0.25));
      for (let w = 0; w < 5; w++) { if (r.chance(0.25)) continue; box(1.8, 0.8, 1.8, M.win, x, y + (i % 2 ? 1 : -1) * (rr + 0.2), (w - 2) * len * 0.17); }
    }
    for (const s of [-1, 1]) for (const t of [-1, 1]) { box(R * 0.26, 0.6, R * 0.62, M.solar, s * L * 0.38, 0, t * (R * 0.34 + 4)); box(R * 0.27, 1, 1.2, M.hull2, s * L * 0.38, 0, t * (R * 0.34 + 4)); box(1.2, 1, R * 0.62, M.hull2, s * L * 0.38, 0, t * (R * 0.34 + 4)); }
    for (const s of [-1, 1]) { box(R * 0.16, R * 0.34, 0.6, M.lite, s * L * 0.18, R * 0.2, 0); } // radiators
    add(new THREE.ConeGeometry(R * 0.14, R * 0.08, 10, 1, true).rotateX(Math.PI), M.lite, 0, R * 0.42, 0); cylY(0.6, 0.6, R * 0.3, 4, M.dark, 0, R * 0.26, 0);
    box(3, R * 0.14, R * 0.14, M.bay, -L * 0.5, 0, 0);
    beacon(L * 0.5, 0, 0, 34); beacon(-L * 0.5, 0, 0, 40, 0x9fe8ff); beacon(0, R * 0.46, 0, 24);
    g.userData.radius = R + 20;
  } else if (kind === 'rock') {
    // haven: a base dug into an asteroid, with domes, a landing shelf and a lit docking cave
    const rg = new THREE.IcosahedronGeometry(R * 0.72, 2); const p = rg.attributes.position; const v = new THREE.Vector3();
    const bump = {}; // same displacement for vertices that share a position, so the rock stays closed
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const key = v.x.toFixed(2) + v.y.toFixed(2) + v.z.toFixed(2); const s = bump[key] ??= r.range(0.78, 1.16); v.multiplyScalar(s); p.setXYZ(i, v.x * 1.15, v.y * 0.85, v.z); }
    add(rg, M.rock);
    const domeAt = (a, el, s) => { const d = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); const pos = d.clone().multiplyScalar(R * 0.62);
      add(new THREE.SphereGeometry(s, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).applyQuaternion(q), M.lite, pos.x, pos.y, pos.z); add(new THREE.CylinderGeometry(s * 1.08, s * 1.15, s * 0.3, 10).applyQuaternion(q), M.hull2, pos.x, pos.y, pos.z);
      add(new THREE.TorusGeometry(s * 0.7, 0.7, 4, 12).rotateX(Math.PI / 2).translate(0, s * 0.72, 0).applyQuaternion(q), M.win, pos.x, pos.y, pos.z); return { d, q, pos }; };
    for (let i = 0; i < 5; i++) domeAt(r.range(0, 6.28), r.range(0.2, 1.3), R * r.range(0.08, 0.16));
    const t = domeAt(r.range(0, 6.28), 1.45, R * 0.1); mast(t.pos.x, t.pos.y + R * 0.08, t.pos.z, R * 0.4); beacon(t.pos.x, t.pos.y + R * 0.48, t.pos.z, 40);
    // docking cave + landing shelf on +X
    box(R * 0.36, R * 0.3, R * 0.38, M.hull2, R * 0.76, -R * 0.08, 0); box(1.5, R * 0.2, R * 0.28, M.bay, R * 0.945, -R * 0.08, 0);
    box(R * 0.34, 3, R * 0.5, M.hull2, R * 0.92, -R * 0.27, 0); box(R * 0.3, 0.8, 2, M.glow, R * 0.92, -R * 0.25, R * 0.22); box(R * 0.3, 0.8, 2, M.glow, R * 0.92, -R * 0.25, -R * 0.22);
    add(new THREE.TorusGeometry(R * 0.95, 1.6, 4, 28).rotateX(Math.PI / 2).rotateZ(0.5), M.hull2); // scaffold ring
    for (let i = 0; i < 3; i++) { const a = r.range(0, 6.28); const [x, z] = at(a, R * 0.95); box(8, 8, 8, mat(r.pick(CARGO), { rough: 0.7 }), x * Math.cos(0.5), x * Math.sin(0.5), z); }
    beacon(R * 0.8, -R * 0.05, 0, 60, 0x9fe8ff);
    g.userData.radius = R + 20;
  } else {
    // wheel: the classic spinning ring on a spindle, with spokes, a second ring and solar wings
    const tube = r.range(9, 13);
    ring(R, tube, M.hull, 0, 8, 36); ring(R, 2.2, M.trim, tube * 0.95, 4, 48); ring(R + tube * 0.2, tube * 0.9, M.hull2, 0, 4, 36);
    windows(R + tube * 1.03, 2.5, 34, 1.8); windows(R + tube * 1.03, -2.5, 34, 1.8);
    lathe([[0, -R * 0.95], [8, -R * 0.9], [13, -R * 0.6], [18, -R * 0.2], [22, -8], [22, 8], [18, R * 0.2], [13, R * 0.6], [8, R * 0.9], [0, R * 0.95]], 12, M.hull);
    around(6, (a) => arm(a, 16, R - tube * 0.6, 5, 4, M.hull2), r.next());
    windows(22.3, 0, 10, 1.6); ring(22.5, 1.2, M.trim, 10, 4, 16); ring(22.5, 1.2, M.trim, -10, 4, 16);
    if (r.chance(0.6)) { ring(R * 0.55, 6, M.hull2, R * 0.5, 6, 28); windows(R * 0.55 + 6.2, R * 0.5, 16, 1.5); around(3, (a) => arm(a, 12, R * 0.55 - 4, 3, 3, M.hull2, R * 0.5), 0.5); }
    solar(0.4, 10, R * 0.5, R * 0.22, -R * 0.72); solar(0.4 + Math.PI, 10, R * 0.5, R * 0.22, -R * 0.72);
    for (const s of [-1, 1]) { add(new THREE.SphereGeometry(13, 10, 6), M.hull2, 0, s * R * 0.93, 0); box(3, 3, 10, M.bay, 0, s * R * 0.93, 13); beacon(0, s * (R * 0.95 + 16), 0, 55); }
    mast(0, R * 0.95 + 10, 0, R * 0.22);
    g.userData.radius = R + 20;
  }
  bake(g);
  for (const b of beacons) g.add(b);
  g.userData.kind = kind;
  return g;
}
