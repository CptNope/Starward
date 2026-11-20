// v0.3 space systems: asteroid mining, wingmen, and signals (random events).
import * as THREE from 'three';
import { RNG, clamp } from './rng.js';
import { genShipDef, factionsAtWar } from './gen/universe.js';
import { genItem, genSkillChip } from './gen/items.js';
import { shipName } from './gen/names.js';
import { skillMods, changeRep } from './player.js';
import { mat, glowSprite, disposeTree } from './models.js';
import { Q } from './quality.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const ROCK_KINDS = { ore: { color: 0x7a6656, label: 'Raw Ore' }, crystal: { color: 0x8f6fff, label: 'Void Crystals' }, relic: { color: 0xffc94d, label: 'Xeno Relic' } };

// ---------------- Asteroid mining ----------------
export function buildRocks(mode, belt) {
  const r = new RNG(belt.seed + 17);
  const n = Math.round(30 * Math.max(0.5, Q.belt));
  for (let i = 0; i < n; i++) {
    const a = r.range(0, Math.PI * 2), rad = belt.radius + r.gauss() * belt.width * 0.6;
    const kind = r.weighted([['ore', 7], ['crystal', 2.5], ['relic', 0.35]]);
    const size = r.range(18, 55);
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { _v.fromBufferAttribute(p, k).multiplyScalar(r.range(0.75, 1.2)); p.setXYZ(k, _v.x, _v.y, _v.z); }
    const k = ROCK_KINDS[kind];
    const m = new THREE.Mesh(geo, kind === 'ore' ? mat(k.color, { metal: 0.2, rough: 0.9 }) : mat(k.color, { emissive: k.color, ei: 0.55, metal: 0.6, rough: 0.3 }));
    m.scale.set(size * r.range(0.8, 1.2), size, size * r.range(0.8, 1.2));
    m.position.set(Math.cos(a) * rad, r.gauss() * 220, Math.sin(a) * rad);
    m.rotation.set(r.next() * 6, r.next() * 6, r.next() * 6);
    mode.scene.add(m);
    const rock = {
      rock: true, kind, mesh: m, pos: m.position, radius: size * 0.95, alive: true, hp: size * 9, spin: r.range(-0.2, 0.2),
      hit(dmg, dtype) {
        if (!this.alive) return;
        this.hp -= dmg * (dtype === 'kinetic' || dtype === 'explosive' ? 1.3 : 0.8);
        if (this.hp <= 0) breakRock(mode, this);
      },
    };
    mode.rocks.push(rock);
  }
}
function breakRock(mode, rock) {
  rock.alive = false;
  mode.proj.explosion(rock.pos.clone(), rock.radius * 1.4);
  mode.scene.remove(rock.mesh); rock.mesh.geometry.dispose();
  const mult = 1 + (skillMods(mode.game.player).mining || 0);
  const qty = Math.max(1, Math.round((rock.kind === 'relic' ? 1 : 2 + rock.radius / 15) * mult));
  const k = ROCK_KINDS[rock.kind];
  mode.spawnCrate(rock.pos.clone(), { cargo: rock.kind, qty, label: k.label, color: k.color, parts: Math.random() < 0.3 ? 2 + Math.floor(rock.radius / 20) : 0 });
  mode.game.addXP(3 + Math.round(rock.radius / 10), null);
}
export function updateRocks(mode, dt) {
  const p = mode.player;
  for (const r of mode.rocks) {
    if (!r.alive) continue;
    r.mesh.rotation.y += r.spin * dt;
    const d = r.pos.distanceTo(p.pos), m = r.radius + p.radius;
    if (d < m) { _v.copy(p.pos).sub(r.pos).setLength(m); p.pos.copy(r.pos).add(_v); p.vel.multiplyScalar(0.4); }
  }
}

// ---------------- Wingmen ----------------
const FORMATION = [new THREE.Vector3(-55, 10, 45), new THREE.Vector3(55, 10, 45)];
export function spawnWingmen(mode, Ship) {
  const P = mode.game.player;
  const wings = P.crew.filter(c => c.wing && !c.injured).slice(0, 2);
  wings.forEach((c, i) => {
    const def = genShipDef(mode.U, new RNG(c.seed), { faction: null, level: Math.max(P.level, c.level), cls: c.role === 'gunner' || c.role === 'soldier' ? 'gunship' : c.role === 'pilot' ? 'interceptor' : 'fighter' });
    def.name = c.name; def.captain = c;
    const s = new Ship(mode, def, { ally: true });
    s.ally = true; s.crew = c; s.slot = i; s.role = 'wing';
    s.st.weaponMods = { dmg: 0.8 + c.level * 0.02, vel: 1 };
    s.pos.copy(FORMATION[i]).applyQuaternion(mode.player.quat).add(mode.player.pos);
    s.quat.copy(mode.player.quat);
    mode.scene.add(s.mesh); mode.ships.push(s);
  });
}
export function wingTarget(mode, s) {
  const p = mode.player;
  const t = mode.target;
  if (t && t.alive && !t.ally && !t.disabled && (mode.isHostileToPlayer(t) || t.aggro.has(p))) return t;
  let best = null, bd = 2600;
  for (const o of mode.ships) {
    if (o === s || o.isPlayer || o.ally || !o.alive || o.disabled) continue;
    if (!mode.isHostileToPlayer(o) && !o.aggro.has(p) && !o.aggro.has(s)) continue;
    const d = o.pos.distanceTo(p.pos); if (d < bd) { bd = d; best = o; }
  }
  return best;
}
export function flyFormation(mode, s, dt) {
  const p = mode.player;
  const want = _w.copy(FORMATION[s.slot % 2]).applyQuaternion(p.quat).add(p.pos);
  const d = want.distanceTo(s.pos);
  if (mode.cruise > 0.3 || d > 3500) { s.pos.copy(want); s.quat.copy(p.quat); s.vel.copy(p.vel); return; }
  const lead = _v.copy(want).addScaledVector(p.vel, 0.6).sub(s.pos);
  if (lead.lengthSq() > 25) s.steerToward(lead.normalize(), dt, 1.2); else s.steerToward(p.forward(_v), dt, 0.8);
  s.throttle = clamp(d / 160, 0.25, 1) * Math.max(0.4, p.vel.length() / Math.max(1, s.st.speed) + 0.2);
  s.boosting = d > 450;
}
export function wingmanDown(mode, s) {
  s.crew.injured = true;
  mode.game.ui.toast(`${s.crew.name} ejected safely — they'll fly again after you dock`, '#ffb05a');
}

// ---------------- Signals ----------------
const SIGNAL_TYPES = [['distress', 3], ['ambush', 1.3], ['derelict', 2.2], ['anomaly', 2], ['battle', 1.6]];
export function spawnSignal(mode, nearPlayer) {
  const r = mode.rng;
  const base = nearPlayer ? mode.player.pos : mode.randomPointNear(r);
  const pos = base.clone().add(new THREE.Vector3(r.range(-1, 1), r.range(-0.25, 0.25), r.range(-1, 1)).normalize().multiplyScalar(r.range(nearPlayer ? 5000 : 1500, nearPlayer ? 9000 : 5000)));
  let type = r.weighted(SIGNAL_TYPES);
  const war = warPair(mode);
  if (type === 'battle' && !war) type = 'derelict';
  const sig = { type, pos, resolved: false, name: 'Unknown signal', war };
  if (type === 'anomaly') makeAnomaly(mode, sig);
  mode.signals.push(sig);
  return sig;
}
function warPair(mode) {
  const F = mode.U.factions, r = mode.rng;
  const pairs = [];
  for (const a of F) for (const b of F) if (a.id < b.id && factionsAtWar(mode.U, a.id, b.id)) pairs.push([a.id, b.id]);
  const local = pairs.filter(([a, b]) => a === mode.sys.owner || b === mode.sys.owner);
  return local.length ? r.pick(local) : pairs.length ? r.pick(pairs) : null;
}
function makeAnomaly(mode, sig) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(30, 1), new THREE.MeshBasicMaterial({ color: 0xb766ff, wireframe: true }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(70, 3, 6, 40), new THREE.MeshBasicMaterial({ color: 0x7ef0ff }));
  g.add(core, ring, glowSprite(0xb766ff, 260, 0.8));
  g.position.copy(sig.pos); mode.scene.add(g);
  sig.mesh = g; sig.core = core; sig.ring = ring;
}
export function updateSignals(mode, dt) {
  const p = mode.player, g = mode.game, U = mode.U;
  for (const sig of mode.signals) {
    if (sig.mesh) { sig.core.rotation.y += dt * 0.6; sig.core.rotation.x += dt * 0.25; sig.ring.rotation.x += dt * 0.4; }
    if (!sig.resolved && p.pos.distanceTo(sig.pos) < 2600) resolveSignal(mode, sig);
    if (sig.watch && !sig.done) {
      const { victim, attackers } = sig.watch;
      if (!victim.alive) { sig.done = true; g.ui.toast('The freighter was lost', '#ff7a5a'); }
      else if (attackers.every(a => !a.alive || a.disabled)) {
        sig.done = true;
        const lvl = mode.sys.level, cr = 150 + lvl * 70;
        g.addCredits(cr, 'rescue reward'); g.addXP(40 + lvl * 15, `Rescued the ${victim.name}`);
        if (victim.faction !== null) changeRep(U, g.player, victim.faction, 6);
        victim.role = 'trader'; victim.state = 'trade'; victim.waypoint = null;
        if (Math.random() < 0.4) g.giveItem(genItem(mode.rng, { level: lvl, luck: 0.25 }));
      }
    }
  }
  // anomaly scanning
  if (mode.scan) {
    const sig = mode.scan.sig;
    if (!sig.mesh || p.pos.distanceTo(sig.pos) > 400) { mode.scan = null; g.ui.toast('Scan interrupted — stay close to the anomaly', '#ff7a5a'); }
    else {
      mode.scan.t += dt;
      if (mode.scan.t >= 5) { finishScan(mode, sig); mode.scan = null; }
    }
  }
  mode.signals = mode.signals.filter(s => !(s.resolved && !s.mesh && (s.done || !s.watch)));
}
function resolveSignal(mode, sig) {
  sig.resolved = true;
  const g = mode.game, U = mode.U, r = mode.rng, lvl = mode.sys.level;
  const pirates = U.factions.filter(f => f.ideology === 'pirate');
  const pir = r.pick(pirates).id;
  if (sig.type === 'distress') {
    const facs = U.factions.filter(f => f.ideology !== 'pirate');
    const vf = mode.sys.owner !== null && U.factions[mode.sys.owner].ideology !== 'pirate' ? mode.sys.owner : r.pick(facs).id;
    const [victim] = mode.spawnGroup({ faction: vf, n: 1, role: 'distress', cls: 'freighter', at: sig.pos });
    victim.throttle = 0; victim.state = 'idle';
    const attackers = mode.spawnGroup({ faction: pir, n: r.int(2, 3), role: 'raid', at: sig.pos.clone().add(new THREE.Vector3(300, 50, -200)) });
    for (const a of attackers) { a.aggro.add(victim); victim.aggro.add(a); a.target = victim; a.state = 'attack'; }
    sig.watch = { victim, attackers };
    g.ui.toast(`Distress call: the ${victim.name} is under pirate attack!`, '#ffd34d');
  } else if (sig.type === 'ambush') {
    const n = r.int(3, 4) + Math.floor(lvl / 6);
    const a = mode.spawnGroup({ faction: pir, n, role: 'raid', at: mode.player.pos.clone().add(mode.player.forward(_v).multiplyScalar(900)) });
    for (const s of a) { s.target = mode.player; s.state = 'attack'; s.aggro.add(mode.player); }
    g.ui.toast('It was a trap — pirate ambush!', '#ff5a5a');
  } else if (sig.type === 'derelict') {
    const [d] = mode.spawnGroup({ faction: null, n: 1, role: 'derelict', cls: r.pick(['freighter', 'corvette', 'gunship', 'frigate']), at: sig.pos, disabled: true });
    d.derelict = true; d.name = `Derelict ${shipName(r, U.species[0].culture)}`; d.def.name = d.name;
    g.ui.toast(`Signal resolved: a drifting derelict. Fly close and press E to explore it.`, '#9fd8ff');
  } else if (sig.type === 'anomaly') {
    sig.name = 'Anomaly';
    g.ui.toast('Signal resolved: a spatial anomaly. Fly close and press E to scan it.', '#b766ff');
  } else if (sig.type === 'battle') {
    const [a, b] = sig.war;
    const A = mode.spawnGroup({ faction: a, n: r.int(2, 4), role: 'patrol', at: sig.pos });
    const B = mode.spawnGroup({ faction: b, n: r.int(2, 4), role: 'patrol', at: sig.pos.clone().add(new THREE.Vector3(500, 0, 300)) });
    A.forEach((s, i) => { s.target = B[i % B.length]; s.state = 'attack'; });
    B.forEach((s, i) => { s.target = A[i % A.length]; s.state = 'attack'; });
    g.ui.toast(`Battle detected: ${U.factions[a].name} vs ${U.factions[b].name}`, '#ffb05a');
  }
}
function finishScan(mode, sig) {
  const g = mode.game, r = mode.rng, lvl = mode.sys.level;
  g.addXP(30 + lvl * 15, 'Anomaly scanned');
  const roll = r.next();
  if (roll < 0.3) { const n = g.addCargo('relic', 1); g.ui.toast(n ? 'Recovered a Xeno Relic from the anomaly' : 'A relic slipped away — cargo hold full', '#ffd34d'); }
  else if (roll < 0.5) g.giveItem(genSkillChip(r, lvl));
  else if (roll < 0.8) g.giveItem(genItem(r, { level: lvl + 1, luck: 0.6 }));
  else { const n = 10 + lvl * 3; g.player.parts = (g.player.parts || 0) + n; g.ui.toast(`+${n} parts from exotic matter`, '#9fd8ff'); }
  mode.proj.explosion(sig.pos.clone(), 160);
  mode.scene.remove(sig.mesh); disposeTree(sig.mesh); sig.mesh = null;
}
