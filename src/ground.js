import * as THREE from 'three';
import { RNG, Noise, clamp, hashInts } from './rng.js';
import { BIOMES } from './data.js';
import { genNPC, hostileToPlayer } from './gen/universe.js';
import { mat, glowSprite, starfield, litMat } from './models.js';
import { buildShip } from './ships.js';
import { Q } from './quality.js';
import { HULL_CLASSES } from './data.js';
import { hashStr } from './rng.js';

const SIZE = 900;

export function makeGroundEnv(game, sys, planet) {
  const U = game.U, P = game.player;
  const N = Q.terrainSeg, CELL = SIZE / N;
  const biome = BIOMES.find(b => b.id === planet.biome);
  const r = new RNG(hashInts(planet.seed, 991));
  const noise = new Noise(planet.seed);
  const amp = { desert: 14, ice: 20, jungle: 16, volcanic: 26, toxic: 12, barren: 22, ocean: 10, crystal: 24 }[biome.id] || 16;
  const level = sys.level;

  // ---- outpost sites (flattened) ----
  const sites = [];
  for (let i = 0; i < planet.outposts; i++) {
    let x, z, tries = 0;
    do { const a = r.range(0, 6.28), d = r.range(90, 360); x = Math.cos(a) * d; z = Math.sin(a) * d; tries++; }
    while (tries < 30 && sites.some(s => Math.hypot(s.x - x, s.z - z) < 110));
    const pirate = U.factions.find(f => f.ideology === 'pirate');
    const kind = r.weighted([['faction', planet.owner !== null ? 5 : 1], ['pirate', 2 + sys.danger * 0.4], ['ruins', 2]]);
    sites.push({ x, z, kind, faction: kind === 'faction' ? (planet.owner ?? r.int(0, U.factions.length - 1)) : kind === 'pirate' ? pirate.id : null, r: 38 });
  }
  const flats = [{ x: 0, z: 0, r: 22 }, ...sites];

  // ---- heightfield ----
  const H = new Float32Array((N + 1) * (N + 1));
  const rawH = (x, z) => {
    let h = noise.fbm2(x * 0.004, z * 0.004, 5) * amp * 2.2;
    h += Math.abs(noise.fbm2(x * 0.012 + 50, z * 0.012, 3)) * amp * (biome.id === 'volcanic' || biome.id === 'crystal' ? 1.2 : 0.5);
    for (const f of flats) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r * 1.8) { const t = clamp((d - f.r) / (f.r * 0.8), 0, 1); h *= t * t * (3 - 2 * t); } }
    return h;
  };
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = rawH(i * CELL - SIZE / 2, j * CELL - SIZE / 2);
  const height = (x, z) => {
    const fx = clamp((x + SIZE / 2) / CELL, 0, N - 0.001), fz = clamp((z + SIZE / 2) / CELL, 0, N - 0.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = H[j * (N + 1) + i], b = H[j * (N + 1) + i + 1], c = H[(j + 1) * (N + 1) + i], d = H[(j + 1) * (N + 1) + i + 1];
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };

  // ---- colliders ----
  const boxes = []; // {minX,maxX,minZ,maxZ,top}
  const circles = []; const grid = new Map();
  const addCircle = (x, z, rad) => { const c = { x, z, r: rad }; circles.push(c); const k = `${Math.floor(x / 20)},${Math.floor(z / 20)}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c); };
  const collide = (pos, rad) => {
    for (const b of boxes) {
      if (pos.y > b.top) continue;
      const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < rad * rad) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = cx + dx / d * rad; pos.z = cz + dz / d * rad; }
        else { // inside: push out shortest axis
          const opts = [[b.minX - rad - pos.x, 0], [b.maxX + rad - pos.x, 0], [0, b.minZ - rad - pos.z], [0, b.maxZ + rad - pos.z]].sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
          pos.x += opts[0][0]; pos.z += opts[0][1];
        }
      }
    }
    const gx = Math.floor(pos.x / 20), gz = Math.floor(pos.z / 20);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = grid.get(`${gx + a},${gz + b}`); if (!list) continue;
      for (const c of list) { const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + rad; if (d < m && d > 1e-4) { pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m; } }
    }
  };
  const blocksShot = (pos) => {
    if (pos.y < height(pos.x, pos.z)) return true;
    for (const b of boxes) if (pos.y < b.top && pos.x > b.minX && pos.x < b.maxX && pos.z > b.minZ && pos.z < b.maxZ) return true;
    return Math.abs(pos.x) > SIZE / 2 || Math.abs(pos.z) > SIZE / 2;
  };

  const env = {
    type: 'ground', level, gravity: planet.gravity, hazard: biome.hazard, bound: SIZE / 2 - 30, height, collide, blocksShot,
    title: `${planet.name} — ${biome.name} world · Threat ${planet.hostility}`, actors: [], crates: [], deposits: [], planet, biome,
    onExit: (mode) => game.leaveSurface(mode),
  };

  env.build = (scene) => {
    scene.background = new THREE.Color(biome.sky);
    scene.fog = new THREE.Fog(biome.fog, Math.min(80, Q.drawDist * 0.35), Q.drawDist + 60);
    if (biome.id === 'barren' || biome.id === 'crystal') scene.add(starfield(Math.round(Q.stars / 2), Q.drawDist + 40));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.0); sun.position.set(200, 300, 120); scene.add(sun);
    scene.add(new THREE.HemisphereLight(biome.sky, biome.ground[1], 0.9));
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    // terrain mesh
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3);
    const c0 = new THREE.Color(biome.ground[0]), c1 = new THREE.Color(biome.ground[1]), c2 = new THREE.Color(biome.ground[2]), tmp = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k);
      const h = height(x, z); pos.setY(k, h);
      const t = clamp((h / amp + 1) * 0.5, 0, 1); const nn = noise.n2(x * 0.05, z * 0.05) * 0.5 + 0.5;
      tmp.copy(c1).lerp(c0, clamp(t * 1.6, 0, 1)); if (t > 0.7) tmp.lerp(c2, (t - 0.7) * 2.5);
      tmp.multiplyScalar(0.85 + nn * 0.3);
      cols.set([tmp.r, tmp.g, tmp.b], k * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, litMat({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 })));
    if (biome.water) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 1.2, SIZE * 1.2), litMat({ color: biome.id === 'toxic' ? 0x7a9a20 : 0x2a78c8, transparent: true, opacity: 0.7, roughness: 0.15, metalness: 0.3 }));
      w.rotation.x = -Math.PI / 2; w.position.y = -amp * 0.55; scene.add(w);
    }
    if (biome.id === 'volcanic') {
      for (let i = 0; i < 18; i++) { const x = r.range(-400, 400), z = r.range(-400, 400); if (Math.hypot(x, z) < 40) continue; const l = new THREE.Mesh(new THREE.CircleGeometry(r.range(4, 12), 10), new THREE.MeshBasicMaterial({ color: 0xff5a1f })); l.rotation.x = -Math.PI / 2; l.position.set(x, height(x, z) + 0.15, z); scene.add(l); }
    }
    // props
    scatterProps(scene, r, biome, height, addCircle, flats);
    // landing pad + ship
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(14, 15, 0.6, 16), mat(0x8a9098, { metal: 0.15, rough: 0.7 })); pad.position.y = 0.3; scene.add(pad);
    const hc = HULL_CLASSES.find(h => h.id === P.ship.cls);
    const ship = buildShip(hashStr(P.ship.name + P.ship.cls), hc.size * 1.4, 0x4dd6ff, hc.id); ship.position.set(0, 3.2, 0); ship.rotation.y = 0.6; scene.add(ship);
    for (const e of ship.userData.engines) e.material.opacity = 0.12; // parked: engines idling
    boxes.push({ minX: -5, maxX: 5, minZ: -5, maxZ: 5, top: 4 });
    // outposts
    for (const s of sites) buildSite(scene, s, env, r, U, P, sys, height, boxes, game);
    // wildlife
    const packs = Math.round(2 + planet.hostility * 0.8);
    for (let i = 0; i < packs; i++) {
      const a = r.range(0, 6.28), d = r.range(70, 400); const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
      const seed = r.int(1, 1e9), n = r.int(1, 4), lvl = Math.max(1, level + r.int(-1, 2));
      const aggressive = r.chance(0.35 + planet.hostility * 0.06);
      for (let k = 0; k < n; k++) env.actors.push({ kind: 'creature', seed, level: lvl, team: 'h', aggro: aggressive ? 26 : 7, name: 'Wildlife', pos: new THREE.Vector3(cx + r.range(-8, 8), 0, cz + r.range(-8, 8)) });
    }
    // deposits & caches
    for (let i = 0; i < r.int(10, 18); i++) {
      const a = r.range(0, 6.28), d = r.range(30, 410);
      const com = r.weighted([['ore', 6], ['crystal', biome.id === 'crystal' || biome.id === 'ice' ? 5 : 2], ['relic', 0.4]]);
      env.deposits.push({ pos: new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), commodity: com, amount: com === 'relic' ? 1 : r.int(2, 5), label: { ore: 'Raw Ore', crystal: 'Void Crystals', relic: 'Xeno Relic' }[com] });
    }
    for (let i = 0; i < r.int(3, 7); i++) {
      const a = r.range(0, 6.28), d = r.range(40, 400);
      env.crates.push({ pos: new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), locked: r.chance(0.3) ? Math.min(5, r.int(1, 2 + Math.floor(sys.danger / 3))) : 0, level });
    }
    // missions targeting this planet
    for (const m of P.missions) if (!m.done && m.type === 'raid' && m.sysId === sys.id && m.planetId === planet.id) {
      const a = r.range(0, 6.28); const cx = Math.cos(a) * 200, cz = Math.sin(a) * 200;
      const pir = U.factions.find(f => f.id === m.faction) || U.factions.find(f => f.ideology === 'pirate');
      for (let k = 0; k < 4; k++) { const npc = genNPC(U, r, { faction: pir.id, role: 'soldier', level: m.level }); env.actors.push({ kind: 'npc', npc, level: npc.level, team: 'h', aggro: 40, pos: new THREE.Vector3(cx + r.range(-10, 10), 0, cz + r.range(-10, 10)) }); }
      const boss = genNPC(U, r, { faction: pir.id, role: 'soldier', level: m.level + 2 }); boss.name = m.targetName; boss.hp *= 3;
      env.actors.push({ kind: 'npc', npc: boss, level: boss.level, team: 'h', aggro: 45, boss: true, missionId: m.id, pos: new THREE.Vector3(cx, 0, cz) });
    }
    return { pos: new THREE.Vector3(10, 0, 10), yaw: 0.8, exit: { pos: new THREE.Vector3(0, 0, 0), r: 9, label: 'Board your ship (launch)' } };
  };
  return env;
}

function scatterProps(scene, r, biome, height, addCircle, flats) {
  const kinds = {
    desert: [['rock', 60], ['cactus', 50]], ice: [['spike', 70], ['rock', 40]], jungle: [['tree', 220], ['rock', 30], ['bush', 80]],
    volcanic: [['rock', 120], ['spike', 30]], toxic: [['shroom', 110], ['rock', 30]], barren: [['rock', 140]], ocean: [['tree', 120], ['bush', 60], ['rock', 30]], crystal: [['crystal', 120], ['rock', 40]],
  }[biome.id];
  const M = new THREE.Matrix4(), QQ = new THREE.Quaternion(), S = new THREE.Vector3(), Pv = new THREE.Vector3();
  const nearFlat = (x, z) => flats.some(f => Math.hypot(x - f.x, z - f.z) < f.r + 6);
  for (const [kind, count0] of kinds) {
    const count = Math.max(4, Math.round(count0 * Q.props));
    let parts;
    const g2 = new THREE.Color(biome.ground[2]).getHex(), g1 = new THREE.Color(biome.ground[1]).getHex();
    if (kind === 'rock') parts = [[new THREE.DodecahedronGeometry(1, 0), mat(new THREE.Color(biome.ground[1]).multiplyScalar(0.8).getHex(), { metal: 0.1, rough: 0.95 }), 0]];
    if (kind === 'tree') parts = [[new THREE.CylinderGeometry(0.25, 0.4, 4, 5).translate(0, 2, 0), mat(0x5a3a22, { metal: 0 }), 0], [new THREE.ConeGeometry(2, 5, 6).translate(0, 5.5, 0), mat(biome.id === 'ocean' ? 0x3f9a4a : 0x2f7a2f, { metal: 0, rough: 0.9 }), 0]];
    if (kind === 'bush') parts = [[new THREE.IcosahedronGeometry(1, 0).translate(0, 0.6, 0), mat(0x4a8a3a, { metal: 0 }), 0]];
    if (kind === 'cactus') parts = [[new THREE.CylinderGeometry(0.4, 0.45, 3.5, 6).translate(0, 1.75, 0), mat(0x5d8a4a, { metal: 0 }), 0]];
    if (kind === 'spike') parts = [[new THREE.ConeGeometry(1, 6, 5).translate(0, 3, 0), mat(biome.id === 'ice' ? 0xcfe8ff : 0x2a2020, { metal: 0.5, rough: 0.3 }), 0]];
    if (kind === 'shroom') parts = [[new THREE.CylinderGeometry(0.25, 0.35, 2.5, 6).translate(0, 1.25, 0), mat(0xd8d0b0, { metal: 0 }), 0], [new THREE.SphereGeometry(1.5, 8, 5, 0, 6.29, 0, 1.6).translate(0, 2.5, 0), mat(g2, { emissive: g2, ei: 0.35, metal: 0 }), 0]];
    if (kind === 'crystal') parts = [[new THREE.OctahedronGeometry(1, 0).scale(0.6, 2.5, 0.6).translate(0, 2, 0), mat(g2, { emissive: g2, ei: 0.7, metal: 0.8, rough: 0.15 }), 0]];
    const meshes = parts.map(([geo, m]) => new THREE.InstancedMesh(geo, m, count));
    for (let i = 0; i < count; i++) {
      let x, z; do { x = r.range(-440, 440); z = r.range(-440, 440); } while (nearFlat(x, z));
      const s = kind === 'rock' ? r.range(0.6, 4) : r.range(0.7, 1.6);
      Pv.set(x, height(x, z) - (kind === 'rock' ? s * 0.3 : 0), z); QQ.setFromEuler(new THREE.Euler(kind === 'rock' ? r.next() * 3 : r.range(-0.1, 0.1), r.next() * 6.28, 0)); S.set(s, s * (kind === 'rock' ? r.range(0.5, 1) : 1), s);
      M.compose(Pv, QQ, S); for (const mm of meshes) mm.setMatrixAt(i, M);
      const cr = kind === 'rock' ? s * 0.8 : kind === 'tree' || kind === 'cactus' || kind === 'shroom' ? 0.5 * s : kind === 'spike' || kind === 'crystal' ? 0.7 * s : 0;
      if (cr > 0.6) addCircle(x, z, cr);
    }
    for (const mm of meshes) scene.add(mm);
  }
}

function buildSite(scene, s, env, r, U, P, sys, height, boxes, game) {
  const fac = s.faction !== null ? U.factions[s.faction] : null;
  const hostile = s.kind === 'pirate' || (fac && hostileToPlayer(U, P, fac.id));
  const col = fac ? fac.color : 0x8a7a5a;
  const wallM = s.kind === 'ruins' ? mat(0x8a8070, { metal: 0, rough: 1 }) : mat(0xb8bec8, { metal: 0.5, rough: 0.4 });
  const trimM = mat(col, { emissive: col, ei: 0.8 });
  const nB = s.kind === 'ruins' ? 0 : r.int(2, 5);
  for (let i = 0; i < nB; i++) {
    const a = (i / nB) * Math.PI * 2 + r.range(-0.2, 0.2), d = r.range(18, 28);
    const w = r.range(8, 14), dpt = r.range(8, 14), h = r.range(5, 9);
    const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), wallM); b.position.set(x, h / 2 - 0.2, z); scene.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, dpt + 0.6), trimM); roof.position.set(x, h, z); scene.add(roof);
    const lamp = glowSprite(col, 6, 0.8); lamp.position.set(x, h + 1, z); scene.add(lamp);
    boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dpt / 2, maxZ: z + dpt / 2, top: h });
  }
  if (s.kind !== 'ruins') {
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 12, 8), trimM); beacon.position.set(s.x, 6, s.z); scene.add(beacon);
    const bl = glowSprite(col, 14); bl.position.set(s.x, 12.5, s.z); scene.add(bl);
    boxes.push({ minX: s.x - 0.6, maxX: s.x + 0.6, minZ: s.z - 0.6, maxZ: s.z + 0.6, top: 12 });
    // people
    const n = r.int(3, 7);
    for (let i = 0; i < n; i++) {
      const role = i === 0 && !hostile ? 'merchant' : i === 1 && !hostile && r.chance(0.6) ? r.pick(['engineer', 'scientist', 'medic']) : 'soldier';
      const npc = genNPC(U, r, { faction: s.faction, role, level: env.level });
      env.actors.push({ kind: 'npc', npc, level: npc.level, team: hostile ? 'h' : 'p', aggro: hostile ? 38 : 0, stationary: role === 'merchant', pos: new THREE.Vector3(s.x + r.range(-12, 12), 0, s.z + r.range(-12, 12)) });
    }
    env.crates.push({ pos: new THREE.Vector3(s.x + r.range(-6, 6), 0, s.z + r.range(-6, 6)), locked: hostile ? 0 : r.int(1, 3), level: env.level + 1 });
  } else {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, x = s.x + Math.cos(a) * 16, z = s.z + Math.sin(a) * 16, h = r.range(2, 9);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, h, 6), wallM); p.position.set(x, h / 2, z); p.rotation.z = r.range(-0.15, 0.15); scene.add(p);
      boxes.push({ minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1, top: h });
    }
    const glyph = glowSprite(0xb766ff, 10); glyph.position.set(s.x, 2, s.z); scene.add(glyph);
    env.crates.push({ pos: new THREE.Vector3(s.x, 0, s.z), relic: true, locked: r.chance(0.5) ? r.int(1, 3) : 0, level: env.level + 2 });
    const seed = r.int(1, 1e9);
    for (let k = 0; k < r.int(3, 6); k++) env.actors.push({ kind: 'creature', seed, level: env.level + 1, team: 'h', aggro: 30, name: 'Ruin Guardian', pos: new THREE.Vector3(s.x + r.range(-20, 20), 0, s.z + r.range(-20, 20)) });
  }
}
