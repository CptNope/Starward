// Ship hulls. Every hull class has its own recipe, so a Dreadnought reads as a warship from any
// distance and a freighter as a hauler. Ships face -Z, +Y is up, and one unit is the `size` passed in.
// Each ship bakes to two draw calls (lit + glow) plus one Points draw for its engine flares.
import * as THREE from 'three';
import { RNG } from './rng.js';
import { mat, bake, glowPoints } from './models.js';
import { PROFILES, loft, wing, mirrorX, prim } from './geo.js';

const CONTAINER_COLS = [0x8a4b3a, 0x3f6f78, 0x7d7f86, 0xa08a3c, 0x4d6a4a, 0x6a5078];

export function buildShip(seed, size = 1, color = 0x88aaff, cls = 'fighter') {
  const r = new RNG(seed);
  const g = new THREE.Group(), k = new THREE.Group(); k.scale.setScalar(size); g.add(k);
  // --- palette: a muted hull tone, a darker panel tone, dark machinery, and the faction colour ---
  const hue = r.next(), sat = r.range(0.05, 0.22), lum = r.range(0.44, 0.62);
  const hcol = (dl = 0, ds = 0) => new THREE.Color().setHSL(hue, Math.max(0, sat + ds), Math.max(0.05, lum + dl)).getHex();
  const M = {
    hull: mat(hcol(), { metal: 0.6, rough: 0.4 }),
    hull2: mat(hcol(-0.1), { metal: 0.6, rough: 0.45 }),
    lite: mat(hcol(0.14, -0.03), { metal: 0.5, rough: 0.4 }),
    dark: mat(0x2e3540, { metal: 0.7, rough: 0.6 }),
    trim: mat(color, { metal: 0.3, rough: 0.5, emissive: color, ei: 0.25 }),
    glow: mat(0x111111, { emissive: color, ei: 1.5 }),
    glass: mat(0x7fd8ff, { metal: 0.9, rough: 0.1, emissive: 0x1a5a7a, ei: 0.8 }),
    win: mat(0x111111, { emissive: 0xffe2a8, ei: 1.3 }),
    noz: mat(0x111111, { emissive: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.3).getHex(), ei: 1.0 }),
  };
  const flares = [], muzzles = [], turrets = [];
  const add = (geo, m, x = 0, y = 0, z = 0) => { if (x || y || z) geo.translate(x, y, z); k.add(new THREE.Mesh(geo, m)); return geo; };
  const pair = (geo, m, x, y, z) => { geo.translate(x, y, z); k.add(new THREE.Mesh(geo, m)); k.add(new THREE.Mesh(mirrorX(geo), m)); };
  const box = (w, h, d, m, x, y, z) => add(prim.box(w, h, d), m, x, y, z);
  const boxes = (w, h, d, m, x, y, z) => { box(w, h, d, m, x, y, z); if (x) box(w, h, d, m, -x, y, z); };
  const fus = (sections, profile, m = M.hull) => add(loft(sections, PROFILES[profile]), m);
  // tapered wing pair rooted at (x, y, z); `cant` rolls each wing up around its root
  const wings = (o, m = M.hull) => { const w = wing(o); if (o.cant) w.rotateZ(o.cant); pair(w, m, o.x || 0, o.y || 0, o.z || 0); };
  // vertical fin(s): a wing stood on its root, leaning out by `cant`
  const fin = (o, m = M.hull) => {
    const mk = (side) => { const f = wing({ span: o.h, cr: o.cr, ct: o.ct, sweep: o.sweep, t: o.t || 0.1 }).rotateZ(Math.PI / 2 - side * (o.cant || 0)); if (o.down) f.rotateZ(Math.PI); return f; };
    if (o.x) { add(mk(1), m, o.x, o.y, o.z); add(mk(-1), m, -o.x, o.y, o.z); } else add(mk(0), m, 0, o.y, o.z);
  };
  // engine: nacelle + bright nozzle disc + a flare sprite. `len` runs forward from the nozzle at z.
  const engine = (x, y, z, rad, len = rad * 3, m = M.dark) => {
    const one = (ex) => {
      add(prim.cyl(rad, rad * 0.78, len, 8), m, ex, y, z - len / 2);
      add(prim.cyl(rad * 1.12, rad * 1.12, len * 0.14, 8), M.hull2, ex, y, z - len * 0.12);
      add(prim.cyl(rad * 0.78, rad * 0.78, 0.04, 8), M.noz, ex, y, z + 0.01);
      flares.push({ p: new THREE.Vector3(ex, y, z + rad * 0.9), s: rad });
    };
    one(x); if (x) one(-x);
  };
  const canopy = (y, z, w, h, l, m = M.glass) => add(new THREE.SphereGeometry(1, 8, 6).scale(w / 2, h, l / 2), m, 0, y, z);
  // fixed forward gun(s); the two outermost become the ship's muzzles
  const gun = (x, y, z, len, rad = 0.05) => {
    const one = (gx) => { add(prim.cyl(rad, rad, len, 6), M.dark, gx, y, z - len / 2); add(prim.cyl(rad * 1.5, rad * 1.5, len * 0.18, 6), M.hull2, gx, y, z - len * 0.2); muzzles.push(new THREE.Vector3(gx, y, z - len)); };
    one(x); if (x) one(-x);
  };
  // turret: armoured base, dome and twin barrels pointing forward (up = -1 hangs it under the hull)
  const turret = (x, y, z, s, up = 1) => {
    const one = (tx) => {
      add(prim.cyl(s * 0.5, s * 0.6, s * 0.3, 8).rotateX(Math.PI / 2), M.hull2, tx, y + up * s * 0.15, z);
      add(loft([[-s * 0.5, s * 0.5, s * 0.3, 0], [-s * 0.1, s * 0.8, s * 0.42, 0], [s * 0.45, s * 0.7, s * 0.36, 0]], PROFILES.slab), M.lite, tx, y + up * s * 0.5, z);
      for (const bx of [-0.17, 0.17]) add(prim.cyl(s * 0.07, s * 0.07, s * 0.95, 5), M.dark, tx + bx * s, y + up * s * 0.5, z - s * 0.85);
      turrets.push(new THREE.Vector3(tx, y + up * s * 0.5, z - s * 1.3));
    };
    one(x); if (x) one(-x);
  };
  // rows of lit windows along z, mirrored port and starboard, facing outward from x
  const windows = (x, y, z0, z1, n, sz = 0.07, m = M.win) => {
    for (let i = 0; i < n; i++) { if (r.chance(0.18)) continue; const z = z0 + (z1 - z0) * (n === 1 ? 0.5 : i / (n - 1)); boxes(0.05, sz, sz * 1.6, m, x, y, z); }
  };
  const antenna = (x, y, z, h) => { add(prim.cyl(0.018, 0.018, h, 4).rotateX(Math.PI / 2), M.dark, x, y + h / 2, z); box(0.05, 0.05, 0.05, M.glow, x, y + h, z); };
  const v = r.int(0, 2); // variant within the class
  let eye; // where the cockpit / bridge camera sits
  const j = (a, b) => r.range(a, b);

  if (cls === 'scout') {
    // darting needle: one engine, big bubble canopy, sensor boom
    fus([[-3.7, 0.04, 0.04], [-2.7, 0.42, 0.34], [-1.1, 0.86, 0.7, 0.04], [0.7, 0.98, 0.8, 0.05], [2.1, 0.8, 0.68, 0.05], [2.7, 0.56, 0.5, 0.05]], 'hex');
    canopy(0.34, -1.25, 0.56, 0.3, 1.5);
    add(prim.cyl(0.02, 0.02, 1.1, 4), M.dark, 0, 0, -4.1); // nose probe
    wings({ x: 0.36, y: -0.05, z: 0.9, span: j(1.7, 2.3), cr: 1.7, ct: 0.45, sweep: j(0.8, 1.3), dih: v === 1 ? 0.25 : -0.12, t: 0.12 }, M.hull2);
    wings({ x: 0.5, y: -0.03, z: 1.15, span: 1.3, cr: 0.5, ct: 0.25, sweep: 0.75, t: 0.14 }, M.trim);
    if (v === 2) fin({ x: 0.3, y: 0.3, z: 1.9, h: 0.95, cr: 0.9, ct: 0.4, sweep: 0.45, cant: 0.5 }); else fin({ y: 0.36, z: 1.9, h: 1.05, cr: 1.0, ct: 0.4, sweep: 0.5 }, M.trim);
    add(prim.cyl(0.3, 0.3, 0.08, 10).rotateX(Math.PI / 2), M.hull2, 0, -0.5, -0.3); antenna(0, -0.5, -0.3, -0.25); // sensor dish
    engine(0, 0.05, 3.25, 0.4, 1.3);
    gun(0.42, -0.12, -1.4, 1.0, 0.04); eye = [0, 0.7, -2.0];
  } else if (cls === 'interceptor') {
    // long dart with big outboard engines and forward canards
    fus([[-5.4, 0.03, 0.03], [-4.0, 0.36, 0.28], [-1.6, 0.78, 0.56, 0.03], [1.4, 0.95, 0.66, 0.04], [3.0, 0.8, 0.58, 0.04], [3.5, 0.5, 0.4, 0.04]], 'hull');
    canopy(0.27, -2.0, 0.44, 0.22, 1.8);
    wings({ x: 0.3, y: -0.02, z: -2.9, span: 0.95, cr: 0.7, ct: 0.25, sweep: 0.35, t: 0.07 }, M.trim); // canards
    const sw = v === 0 ? -j(0.7, 1.1) : j(1.2, 1.7); // forward-swept or delta
    wings({ x: 0.4, y: -0.04, z: v === 0 ? 2.1 : 1.3, span: j(2.2, 2.7), cr: v === 0 ? 1.7 : 3.0, ct: 0.6, sweep: sw, t: 0.12 }, M.hull2);
    const ex = j(1.15, 1.45);
    pair(loft([[-0.6, 0.5, 0.5], [0.2, 0.74, 0.74], [2.0, 0.7, 0.7]], PROFILES.round6), M.hull, ex, -0.04, 1.2);
    engine(ex, -0.04, 3.5, 0.4, 0.5);
    boxes(0.76, 0.05, 0.5, M.trim, ex, 0.3, 1.6);
    fin({ y: 0.3, z: 2.5, h: 0.9, cr: 1.2, ct: 0.4, sweep: 0.7 }); fin({ y: -0.28, z: 2.6, h: 0.5, cr: 0.9, ct: 0.3, sweep: 0.5, down: true }, M.hull2);
    gun(0.3, -0.14, -2.6, 1.3, 0.04); eye = [0, 0.55, -2.9];
  } else if (cls === 'gunship') {
    // flying tank: slab armour, weapon pods on stub wings, chin and dorsal turrets
    fus([[-3.5, 0.5, 0.4, -0.25], [-2.7, 1.5, 1.0, -0.12], [-0.6, 2.2, 1.5], [1.7, 2.3, 1.55], [3.0, 1.8, 1.2]], 'oct');
    add(loft([[-2.75, 1.0, 0.36, 0.42], [-2.0, 1.25, 0.46, 0.64]], PROFILES.slab), M.glass); // faceted cockpit glass
    add(loft([[-2.0, 1.25, 0.46, 0.64], [-1.0, 1.3, 0.3, 0.8]], PROFILES.slab), M.lite);
    add(loft([[-0.8, 2.36, 0.9, 0.05], [1.9, 2.46, 0.9, 0.05]], PROFILES.slab), M.hull2); // armour belt
    boxes(0.1, 0.5, 2.2, M.trim, 1.25, 0.05, 0.5);
    wings({ x: 1.0, y: -0.1, z: 0.6, span: j(1.5, 1.9), cr: 1.9, ct: 1.3, sweep: 0.2, dih: -0.15, t: 0.26 }, M.hull);
    const px = 1.0 + 1.75;
    pair(loft([[-1.4, 0.4, 0.4], [-1.0, 0.62, 0.62], [0.9, 0.62, 0.62], [1.3, 0.4, 0.4]], PROFILES.oct), M.hull2, px, -0.3, 0.7); // weapon pods
    for (const [dx, dy] of [[-0.14, 0.12], [0.14, 0.12], [0, -0.14]]) gun(px + dx, -0.3 + dy, -0.6, 0.7, 0.045);
    muzzles.length = 0; muzzles.push(new THREE.Vector3(-px, -0.3, -1.3), new THREE.Vector3(px, -0.3, -1.3));
    turret(0, -0.62, -2.0, 0.7, -1);
    if (v !== 1) turret(0, 0.78, 0.9, 0.75);
    fin({ x: 0.75, y: 0.6, z: 2.2, h: 0.9, cr: 1.1, ct: 0.6, sweep: 0.4, cant: 0.25 }, M.hull2);
    antenna(-0.5, 0.75, -0.4, 0.7);
    engine(0.7, 0.05, 3.5, 0.45, 1.0); if (v !== 2) engine(0, -0.2, 3.4, 0.36, 0.9);
    eye = [0, 1.0, -2.7];
  } else if (cls === 'corvette') {
    // small warship: raised bridge aft, side sponsons, one dorsal turret
    fus([[-5.4, 0.08, 0.08, -0.1], [-4.2, 0.85, 0.55, -0.05], [-1.6, 1.55, 0.95], [1.4, 1.9, 1.15], [3.9, 1.7, 1.05], [4.8, 1.2, 0.8]], 'hull');
    add(loft([[0.8, 0.9, 0.5, 0.7], [1.5, 1.2, 0.75, 0.85], [3.3, 1.1, 0.7, 0.85], [3.9, 0.7, 0.4, 0.72]], PROFILES.slab), M.lite); // bridge deck
    box(1.0, 0.1, 0.05, M.glass, 0, 0.98, 0.98); windows(0.56, 0.95, 1.7, 3.1, 5);
    pair(loft([[-1.4, 0.3, 0.3], [-0.6, 0.62, 0.6], [3.0, 0.7, 0.66], [3.5, 0.55, 0.5]], PROFILES.oct), M.hull2, 1.25, -0.12, 1.0); // sponsons
    boxes(0.06, 0.12, 2.6, M.trim, 1.62, -0.1, 1.9);
    wings({ x: 1.5, y: -0.15, z: 2.4, span: j(1.0, 1.5), cr: 1.6, ct: 0.6, sweep: 0.7, dih: v === 1 ? 0.3 : -0.2, t: 0.12 }, M.hull);
    turret(0, 0.5, -1.7, 0.8); if (v === 2) turret(0, -0.52, 0.2, 0.7, -1);
    fin({ y: 1.15, z: 3.2, h: 0.8, cr: 0.9, ct: 0.35, sweep: 0.5 }, M.trim);
    antenna(0.3, 1.2, 1.6, 0.8);
    windows(0.72, 0.1, -2.8, 0.4, 7, 0.06);
    engine(1.25, -0.12, 4.75, 0.42, 1.2); engine(0, 0.02, 5.1, 0.5, 1.0);
    gun(0.5, -0.1, -3.4, 1.2, 0.05); eye = [0, 1.4, 1.1];
  } else if (cls === 'freighter') {
    // hauler: cab up front, cargo containers hung on a spine, engine block aft
    fus([[-6.0, 0.7, 0.5, 0.25], [-5.3, 1.5, 1.2, 0.2], [-3.9, 1.8, 1.5, 0.2], [-3.4, 1.1, 0.9, 0.2]], 'oct', M.lite);
    box(1.3, 0.22, 0.05, M.glass, 0, 0.62, -5.52); boxes(0.05, 0.2, 0.7, M.glass, 0.86, 0.55, -4.9);
    box(0.5, 0.5, 7.2, M.dark, 0, 0.45, 0.1); // spine
    const rows = 3 + (v > 0 ? 1 : 0), cl = 6.6 / rows;
    for (let i = 0; i < rows; i++) for (const sx of [-1, 1]) for (const sy of [0, 1]) {
      if (sy && r.chance(0.3)) continue; // some top slots fly empty
      const z = -3.1 + cl * (i + 0.5), c = r.pick(CONTAINER_COLS), m = mat(c, { metal: 0.3, rough: 0.7 });
      box(1.15, 1.0, cl - 0.18, m, sx * 0.86, sy ? 0.72 : -0.4, z);
      box(1.19, 0.08, cl - 0.5, M.hull2, sx * 0.86, (sy ? 0.72 : -0.4) + 0.2, z); // strap
    }
    for (let i = 0; i <= rows; i++) box(2.6, 0.12, 0.12, M.dark, 0, 0.16, -3.1 + cl * i); // clamps
    fus([[3.5, 2.0, 1.6, 0.15], [4.0, 2.5, 2.0, 0.15], [5.4, 2.5, 2.0, 0.15], [5.9, 1.9, 1.5, 0.15]], 'oct', M.hull);
    boxes(0.05, 1.3, 1.2, M.hull2, 1.5, 0.15, 4.7); box(1.8, 0.06, 1.0, M.trim, 0, 1.17, 4.7);
    for (const sx of [-1, 1]) add(prim.box(1.6, 0.04, 1.3).rotateZ(sx * 0.5), M.hull2, sx * 1.8, 1.2, 4.6); // radiators
    antenna(0.5, 0.95, -4.6, 0.9);
    engine(0.72, 0.15, 6.3, 0.55, 0.9); if (v === 2) engine(0, 0.95, 6.2, 0.36, 0.7); else engine(0, -0.7, 6.2, 0.36, 0.7);
    gun(0.95, 0.0, -4.6, 0.9, 0.05); eye = [0, 1.1, -5.6];
  } else if (cls === 'frigate') {
    // line warship: stepped decks, bridge tower, outrigger engines, three turrets
    fus([[-6.2, 0.1, 0.14, -0.1], [-5.0, 0.9, 0.66], [-2.0, 1.8, 1.15], [1.5, 2.4, 1.45], [4.5, 2.4, 1.45], [5.7, 1.7, 1.05]], 'wedge');
    add(loft([[-2.7, 0.7, 0.4, 0.66], [-0.5, 1.2, 0.5, 0.86], [3.9, 1.3, 0.5, 0.92], [4.7, 0.9, 0.4, 0.85]], PROFILES.hull), M.hull2); // upper deck
    add(loft([[2.1, 0.7, 0.7, 1.4], [2.5, 0.8, 0.9, 1.5], [3.5, 0.8, 0.9, 1.5], [3.9, 0.6, 0.6, 1.35]], PROFILES.slab), M.lite); // bridge tower
    box(1.2, 0.26, 0.9, M.lite, 0, 2.0, 2.9); box(1.1, 0.1, 0.05, M.glass, 0, 2.0, 2.43); boxes(0.05, 0.1, 0.7, M.glass, 0.61, 2.0, 2.9);
    antenna(0, 2.13, 3.2, 0.9); antenna(0.4, 2.13, 3.0, 0.5);
    wings({ x: 1.0, y: -0.1, z: 4.0, span: j(1.5, 1.9), cr: 1.8, ct: 1.1, sweep: 0.5, dih: v === 1 ? 0.3 : 0, t: 0.22 }, M.hull2);
    const ex = 1.0 + 1.75, ey = v === 1 ? 0.2 : -0.1;
    pair(loft([[-1.3, 0.5, 0.5], [-0.6, 0.86, 0.86], [1.2, 0.86, 0.86]], PROFILES.round6), M.hull, ex, ey, 4.4);
    engine(ex, ey, 5.9, 0.48, 0.5); engine(0.55, 0, 6.1, 0.46, 1.0);
    turret(0, 0.62, -3.3, 0.9); turret(0, 0.98, -0.6, 1.0); turret(0, -0.72, 0.6, 0.85, -1);
    boxes(0.06, 0.16, 5.0, M.trim, 1.06, 0.32, 1.6);
    windows(1.14, 0.06, -1.0, 4.2, 12, 0.07); windows(0.62, 0.9, -0.2, 1.8, 5, 0.06);
    boxes(0.05, 0.3, 1.1, M.glow, 1.2, -0.3, 2.4); // hangar slit
    gun(0.45, -0.1, -4.3, 1.3, 0.06); eye = [0, 2.35, 2.5];
  } else if (cls === 'dreadnought') {
    // capital ship: dagger hull in three tiers, command tower, ventral hangar, six turrets, engine bank
    fus([[-7.0, 0.1, 0.2], [-5.5, 1.2, 0.8], [-2.0, 2.8, 1.35], [2.0, 4.2, 1.75], [5.0, 4.4, 1.85], [6.4, 3.4, 1.45]], 'wedge');
    add(loft([[-3.6, 1.0, 0.44, 0.78], [0, 2.2, 0.6, 1.02], [4.5, 2.7, 0.66, 1.08], [5.5, 2.0, 0.55, 1.0]], PROFILES.hull), M.hull2); // second tier
    add(loft([[0.4, 1.0, 0.5, 1.5], [1.2, 1.5, 0.66, 1.62], [3.6, 1.6, 0.7, 1.66], [4.6, 1.1, 0.5, 1.55]], PROFILES.slab), M.lite); // citadel
    add(loft([[2.5, 0.6, 1.0, 2.4], [2.8, 0.7, 1.2, 2.5], [3.6, 0.7, 1.2, 2.5], [3.9, 0.5, 0.8, 2.3]], PROFILES.slab), M.hull); // tower stem
    box(1.9, 0.34, 1.0, M.lite, 0, 3.2, 3.2); box(1.8, 0.12, 0.05, M.glass, 0, 3.22, 2.68); boxes(0.05, 0.12, 0.8, M.glass, 0.96, 3.22, 3.2);
    antenna(0, 3.37, 3.5, 1.1); antenna(-0.6, 3.37, 3.3, 0.6); antenna(0.7, 1.95, 1.4, 0.9);
    add(loft([[-2.5, 0.6, 0.5, -0.8], [0.5, 1.3, 1.0, -1.05], [3.6, 1.5, 1.1, -1.1], [5.2, 1.0, 0.7, -0.95]], PROFILES.hull).rotateZ(Math.PI), M.hull2); // keel
    boxes(0.05, 0.42, 2.2, M.glow, 0.72, -1.05, 1.6); // hangar bays
    pair(loft([[1.6, 0.5, 0.5], [2.6, 1.0, 0.9], [5.6, 1.1, 1.0], [6.2, 0.8, 0.7]], PROFILES.oct), M.hull2, 2.35, -0.05, 0); // engine sponsons
    wings({ x: 2.7, y: -0.05, z: 4.2, span: 1.3, cr: 2.2, ct: 1.0, sweep: 0.8, dih: v === 1 ? 0.35 : -0.25, t: 0.2 }, M.hull);
    turret(1.0, 0.72, -2.7, 0.95); turret(1.55, 1.36, 0.2, 1.05); turret(0, 0.52, -4.4, 0.8); turret(0, -0.78, -1.6, 0.9, -1);
    boxes(0.07, 0.2, 6.0, M.trim, 1.95, 0.42, 2.6); box(0.5, 0.05, 4.4, M.trim, 0, 1.36, -1.5);
    windows(2.12, 0.1, 0.4, 5.0, 16, 0.08); windows(1.5, -0.28, -2.4, 0.2, 9, 0.07); windows(1.38, 1.05, 0.6, 4.4, 10, 0.07); windows(0.8, 1.66, 1.3, 3.5, 6, 0.06);
    for (let i = 0; i < 5; i++) boxes(0.5, 0.05, 0.3, M.dark, 1.4 + r.range(-0.3, 0.9), 0.9, -1.2 + i * 1.1); // deck greebles
    engine(2.35, -0.05, 6.5, 0.5, 0.8); engine(0.6, 0.35, 6.75, 0.5, 0.9); engine(0.6, -0.5, 6.7, 0.42, 0.9); engine(1.5, 0.0, 6.6, 0.36, 0.7);
    gun(0.5, -0.1, -5.0, 1.2, 0.07); eye = [0, 3.6, 2.8];
  } else {
    // fighter: the workhorse. Twin engines, mid wings with tip guns, twin tails or a delta.
    fus([[-4.0, 0.04, 0.04, -0.05], [-3.0, 0.5, 0.38], [-1.5, 1.05, 0.76, 0.04], [0.5, 1.4, 0.92, 0.05], [2.2, 1.5, 0.88], [3.1, 1.2, 0.7]], 'hull');
    canopy(0.4, -1.3, 0.6, 0.3, 1.9);
    pair(loft([[-0.9, 0.3, 0.4], [-0.5, 0.42, 0.6], [1.6, 0.42, 0.6]], PROFILES.slab), M.hull2, 0.72, -0.08, 0); // intakes
    boxes(0.34, 0.5, 0.04, M.dark, 0.72, -0.08, -0.72);
    if (v === 0) wings({ x: 0.6, y: -0.02, z: 1.2, span: j(2.6, 3.1), cr: 3.2, ct: 0.5, sweep: 1.5, t: 0.14 }, M.hull2); // delta
    else { wings({ x: 0.6, y: -0.02, z: 0.5, span: j(2.5, 3.0), cr: 2.2, ct: 0.9, sweep: j(0.9, 1.4), dih: v === 2 ? -0.2 : 0.1, t: 0.14 }, M.hull2); wings({ x: 0.5, y: 0, z: 2.9, span: 1.3, cr: 1.0, ct: 0.5, sweep: 0.5, t: 0.09 }, M.hull); }
    wings({ x: 0.8, y: 0.0, z: v === 0 ? 1.9 : 1.0, span: 1.9, cr: 0.32, ct: 0.2, sweep: v === 0 ? 0.9 : 0.75, t: 0.16 }, M.trim); // colour stripe
    fin({ x: 0.5, y: 0.34, z: 2.3, h: 1.1, cr: 1.2, ct: 0.5, sweep: 0.6, cant: 0.3 });
    engine(0.42, 0.02, 3.6, 0.36, 1.2);
    gun(0.75, -0.2, -1.6, 1.1, 0.045); eye = [0, 0.76, -2.2];
  }

  // measure before baking: the hull's own size sets collision radius and camera fit
  const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3());
  bake(g); g.remove(k);
  const fl = glowPoints(flares.map(f => f.p.clone().multiplyScalar(size)), color, 1.05 * size * (flares.reduce((s, f) => s + f.s, 0) / flares.length / 0.4), 0.75); g.add(fl);
  g.userData.engines = [fl];
  g.userData.radius = Math.max(sz.z * 0.42, sz.x * 0.48);
  g.userData.muzzles = muzzles.slice(-2).map(m => m.multiplyScalar(size));
  g.userData.turrets = turrets.map(t => t.multiplyScalar(size));
  g.userData.cockpit = new THREE.Vector3(...eye).multiplyScalar(size);
  g.userData.cls = cls;
  return g;
}
