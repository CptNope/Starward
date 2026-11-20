import * as THREE from 'three';
import { RNG, clamp } from './rng.js';
import { genNPC } from './gen/universe.js';
import { mat, glowSprite } from './models.js';
import { Q } from './quality.js';

const CELL = 5, CEIL = 5.2;
const DIMS = { dreadnought: [37, 25], scout: [13, 9], fighter: [15, 11], interceptor: [15, 11], gunship: [21, 15], corvette: [25, 17], freighter: [27, 15], frigate: [31, 21] };

// Interior of a ship (boarding / visiting). Also used for derelicts.
export function makeInteriorEnv(game, spaceMode, ship, peaceful) {
  const U = game.U, def = ship.def;
  const r = new RNG(def.seed);
  const [W, H] = DIMS[def.cls] || [17, 13];
  const grid = new Uint8Array(W * H).fill(1);
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? 1 : grid[j * W + i];
  const rooms = [];
  const nRooms = Math.max(3, Math.round(W * H / 40));
  for (let t = 0; t < 200 && rooms.length < nRooms; t++) {
    const w = r.int(3, 6), h = r.int(3, 5), x = r.int(1, W - w - 1), y = r.int(1, H - h - 1);
    if (rooms.some(o => x < o.x + o.w + 1 && x + w + 1 > o.x && y < o.y + o.h + 1 && y + h + 1 > o.y)) continue;
    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
  }
  rooms.sort((a, b) => a.cx - b.cx);
  for (const rm of rooms) for (let j = rm.y; j < rm.y + rm.h; j++) for (let i = rm.x; i < rm.x + rm.w; i++) grid[j * W + i] = 0;
  for (let k = 1; k < rooms.length; k++) {
    const a = rooms[k - 1], b = rooms[k];
    let x = a.cx, y = a.cy;
    while (x !== b.cx) { grid[y * W + x] = 0; x += Math.sign(b.cx - x); }
    while (y !== b.cy) { grid[y * W + x] = 0; y += Math.sign(b.cy - y); }
    grid[y * W + x] = 0;
  }
  const toWorld = (i, j) => new THREE.Vector3((i - W / 2 + 0.5) * CELL, 0, (j - H / 2 + 0.5) * CELL);
  const cellOf = (x, z) => [Math.floor(x / CELL + W / 2), Math.floor(z / CELL + H / 2)];
  const roomPoint = (rm) => toWorld(r.int(rm.x, rm.x + rm.w - 1), r.int(rm.y, rm.y + rm.h - 1));

  const collide = (pos, rad) => {
    const [ci, cj] = cellOf(pos.x, pos.z);
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      if (!at(i, j)) continue;
      const minX = (i - W / 2) * CELL, maxX = minX + CELL, minZ = (j - H / 2) * CELL, maxZ = minZ + CELL;
      const cx = clamp(pos.x, minX, maxX), cz = clamp(pos.z, minZ, maxZ);
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < rad * rad) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = cx + dx / d * rad; pos.z = cz + dz / d * rad; }
        else { const c = toWorld(rooms[0].cx, rooms[0].cy); pos.x = c.x; pos.z = c.z; }
      }
    }
  };
  const blocksShot = (pos) => { if (pos.y < 0 || pos.y > CEIL) return true; const [i, j] = cellOf(pos.x, pos.z); return !!at(i, j); };

  const fac = def.faction !== null ? U.factions[def.faction] : null;
  const col = fac ? fac.color : 0x8899aa;
  const env = {
    type: 'interior', level: def.level, gravity: 1, hazard: 0, height: () => 0, collide, blocksShot, ceiling: CEIL,
    title: ship.derelict ? `Exploring the ${def.name}. Scavengers may be aboard.` : peaceful ? `Aboard the ${def.name} (${def.clsName})` : `Boarding the ${def.name}! Clear the crew.`, actors: [], crates: [], deposits: [],
    ship, peaceful, onExit: (mode) => game.leaveInterior(mode),
  };
  env.build = (scene) => {
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.Fog(0x05060a, 20, 70);
    scene.add(new THREE.AmbientLight(0x9aa8b8, 0.8));
    scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x303038, 0.7));
    const floors = [], walls = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!at(i, j)) floors.push([i, j]);
      else if (!at(i + 1, j) || !at(i - 1, j) || !at(i, j + 1) || !at(i, j - 1) || !at(i + 1, j + 1) || !at(i - 1, j - 1) || !at(i + 1, j - 1) || !at(i - 1, j + 1)) walls.push([i, j]);
    }
    const M = new THREE.Matrix4();
    const floorM = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.2, CELL), mat(0x3a4048, { metal: 0.7, rough: 0.5 }), floors.length);
    const ceilM = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.2, CELL), mat(0x22262c, { metal: 0.5 }), floors.length);
    floors.forEach(([i, j], k) => { const p = toWorld(i, j); floorM.setMatrixAt(k, M.makeTranslation(p.x, -0.1, p.z)); ceilM.setMatrixAt(k, M.makeTranslation(p.x, CEIL + 0.1, p.z)); });
    const wallM = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, CEIL, CELL), mat(r.chance(0.5) ? 0x6a7480 : 0x7a6e66, { metal: 0.6, rough: 0.45 }), walls.length);
    walls.forEach(([i, j], k) => { const p = toWorld(i, j); wallM.setMatrixAt(k, M.makeTranslation(p.x, CEIL / 2, p.z)); });
    scene.add(floorM, ceilM, wallM);
    // trim lights
    const lights = floors.filter((_, k) => k % 3 === 0);
    const lm = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.6, 0.08, 0.4), mat(0xffffff, { emissive: col, ei: 2 }), lights.length);
    lights.forEach(([i, j], k) => { const p = toWorld(i, j); lm.setMatrixAt(k, M.makeTranslation(p.x, CEIL - 0.05, p.z)); });
    scene.add(lm);
    rooms.slice(0, Q.lights).forEach((rm) => { const p = toWorld(rm.cx, rm.cy); const L = new THREE.PointLight(new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.6), 9, 30, 1.2); L.position.set(p.x, CEIL - 0.8, p.z); scene.add(L); });
    // consoles in the bridge
    const bridge = rooms[rooms.length - 1];
    for (let k = 0; k < 3; k++) {
      const p = roomPoint(bridge);
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.8), mat(0x2a3038, { metal: 0.6 })); c.position.set(p.x, 0.55, p.z); scene.add(c);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ color: col })); scr.position.set(p.x, 1.4, p.z); scr.rotation.x = -0.4; scene.add(scr);
    }
    // airlock
    const air = toWorld(rooms[0].cx, rooms[0].cy);
    const door = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 24), new THREE.MeshBasicMaterial({ color: 0x4dd6ff })); door.rotation.x = -Math.PI / 2; door.position.set(air.x, 0.03, air.z); scene.add(door);
    // crew
    const nCrew = ship.derelict ? r.int(0, 3) : peaceful ? r.int(2, 5) : 2 + Math.round((def.cls === 'dreadnought' ? 12 : def.cls === 'frigate' ? 8 : def.cls === 'corvette' ? 6 : 3) * r.range(0.8, 1.3));
    for (let k = 0; k < nCrew; k++) {
      const rm = rooms[1 + (k % Math.max(1, rooms.length - 1))] || rooms[0];
      const npc = genNPC(U, r, { faction: ship.derelict ? U.factions.find(f => f.ideology === 'pirate').id : def.faction, role: peaceful ? null : r.chance(0.7) ? 'soldier' : null, level: def.level });
      env.actors.push({ kind: 'npc', npc, level: npc.level, team: peaceful ? 'p' : 'h', aggro: 22, pos: roomPoint(rm), crew: true });
    }
    const cap = { ...def.captain, hp: (def.captain.hp || 80) * (peaceful ? 1 : 2.5) };
    if (!ship.derelict) env.actors.push({ kind: 'npc', npc: cap, level: cap.level, team: peaceful ? 'p' : 'h', aggro: 22, pos: toWorld(bridge.cx, bridge.cy), boss: !peaceful, stationary: true, captain: true });
    // loot
    for (let k = 0; k < r.int(2, 4); k++) { const rm = r.pick(rooms); env.crates.push({ pos: roomPoint(rm), locked: r.chance(0.3) ? r.int(1, 3) : 0, level: def.level }); }
    if (!peaceful) env.crates.push({ pos: roomPoint(bridge), locked: Math.min(5, 1 + Math.floor(def.level / 5)), level: def.level + 2 });
    if (ship.derelict) for (let k = 0; k < 3; k++) env.crates.push({ pos: roomPoint(r.pick(rooms)), locked: r.chance(0.4) ? r.int(1, 3) : 0, level: def.level + 1 });
    if (ship.missionId) env.crates.push({ pos: roomPoint(bridge), missionId: ship.missionId, level: def.level + 1, relic: false });
    return { pos: air.clone(), yaw: Math.PI / 2, exit: { pos: air.clone(), r: 2.6, label: 'Return through the airlock' } };
  };
  return env;
}
