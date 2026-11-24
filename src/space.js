import * as THREE from 'three';
import { RNG, hashInts, hashStr, clamp } from './rng.js';
import { HULL_CLASSES, DAMAGE_TYPES, BIOMES, TIERS } from './data.js';
import { getSystem, genShipDef, hostileToPlayer, factionsAtWar } from './gen/universe.js';
import { genLoot, genItem } from './gen/items.js';
import { shipStats, changeRep } from './player.js';
import { glowSprite, planetTexture, nebulaTexture, starfield, disposeTree, mat, litMat } from './models.js';
import { buildShip } from './ships.js';
import { buildStation, stationKind } from './stations.js';
import { Q } from './quality.js';
import { buildRocks, updateRocks, spawnWingmen, wingTarget, flyFormation, wingmanDown, spawnSignal, updateSignals } from './spacefeatures.js';
import { Projectiles, fireWeapon } from './projectiles.js';

const FWD = new THREE.Vector3(0, 0, -1), UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const NPC_DMG = 0.55;
// Enemy pilots fly at this fraction of their hull's top speed.
const NPC_SPEED = 0.8;
// Seconds for an empty missile rack to reload itself.
const MISSILE_RELOAD = 90;
// How close to a planet's surface you have to fly before you can land, and how long the descent takes.
const LAND_RANGE = 420, DESCENT_TIME = 2.2;
// Dogfight tuning. GIMBAL: how far (radians) guns can swivel off the nose toward your aim.
// SNAP: how close the aim must be to a target's lead marker for the guns to lock onto it.
const GIMBAL = 0.2, SNAP_MOUSE = 0.15, SNAP_PAD = 0.26;
// Mouse aim: radians of aim movement per pixel, and the furthest the aim may lead the nose.
const AIM_SENS = 0.0021, AIM_MAX = 0.55;

const U_ideo = (mode, f) => mode.U.factions[f].ideology;

class Ship {
  constructor(mode, def, opts = {}) {
    this.mode = mode; this.def = def; this.isPlayer = !!opts.player;
    this.faction = def.faction; this.level = def.level;
    const color = opts.ally ? 0x5be37d : def.faction !== null && def.faction !== undefined ? mode.U.factions[def.faction].color : (this.isPlayer ? 0x4dd6ff : 0xaaaaaa);
    const hc = HULL_CLASSES.find(h => h.id === def.cls);
    this.hc = hc; this.turrets = hc.turrets || 0;
    this.mesh = buildShip(def.seed, hc.size * 2.2, this.isPlayer ? 0x4dd6ff : color, hc.id);
    this.pos = this.mesh.position; this.quat = this.mesh.quaternion;
    this.vel = new THREE.Vector3(); this.throttle = opts.throttle ?? 0.6;
    this.radius = this.mesh.userData.radius * 0.9;
    this.alive = true; this.disabled = false; this.cool = []; this.missileCool = 0; this.lastHit = -99;
    this.aggro = new Set(); this.state = 'patrol'; this.waypoint = null; this.target = null; this.think = Math.random();
    this.evade = 0; this.name = def.name; this.missionId = opts.missionId || null; this.bounty = opts.bounty || false;
    if (this.isPlayer) this.refreshPlayerStats(true);
    else {
      const lm = 1 + 0.12 * (def.level - 1);
      const lo = def.loadout;
      this.st = {
        hullMax: hc.hull * lm * 0.75 + (lo.plating?.stats.hullMax || 0), shieldMax: hc.shield * lm * 0.6 + (lo.shield?.stats.shieldMax || 0),
        shieldRegen: 6 + (lo.shield?.stats.shieldRegen || 0) * 0.6, armor: lo.plating?.stats.armor || 0, speed: hc.speed * NPC_SPEED, turn: hc.turn * 0.75,
        weapons: lo.weapons, missile: lo.missile || null, regenDelay: 4, weaponMods: { dmg: NPC_DMG, vel: 1 }, boost: 1.6,
      };
      this.hull = this.st.hullMax; this.shield = this.st.shieldMax; this.energy = 100;
      this.missiles = lo.missile ? lo.missile.weapon.ammo : 0;
    }
  }
  refreshPlayerStats(init) {
    const p = this.mode.game.player;
    this.st = shipStats(p);
    if (init) { this.hull = p.ship.hull * this.st.hullMax; this.shield = p.ship.shield * this.st.shieldMax; this.energy = p.ship.energy * this.st.energyMax; this.missiles = Math.min(p.ship.missiles ?? this.st.missileCap, this.st.missileCap); }
    this.hull = Math.min(this.hull, this.st.hullMax); this.shield = Math.min(this.shield, this.st.shieldMax);
  }
  shieldFrac() { return this.shield / Math.max(1, this.st.shieldMax); }
  forward(out = new THREE.Vector3()) { return out.copy(FWD).applyQuaternion(this.quat); }
  steer(yaw, pitch, roll, dt) {
    _e.set(pitch * dt, yaw * dt, roll * dt, 'YXZ'); _q.setFromEuler(_e); this.quat.multiply(_q).normalize();
  }
  steerToward(dir, dt, mult = 1) {
    _v.copy(dir).applyQuaternion(_q.copy(this.quat).invert()).normalize();
    const yawErr = Math.atan2(-_v.x, -_v.z), pitchErr = Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
    const t = this.st.turn * mult;
    const angle = Math.acos(clamp(-_v.z, -1, 1));
    // keep wings roughly level relative to galactic "up" for readable dogfights
    const rightY = _v2.set(1, 0, 0).applyQuaternion(this.quat).y;
    this.steer(clamp(yawErr * 4, -1, 1) * t, clamp(pitchErr * 4, -1, 1) * t, clamp(-rightY * 2, -1, 1) * t * 0.5, dt);
    return angle;
  }
  hit(dmg, dtype, src) {
    if (!this.alive) return;
    const dt = DAMAGE_TYPES[dtype] || DAMAGE_TYPES.energy;
    this.lastHit = this.mode.time;
    let ionHit = dtype === 'ion';
    if (this.shield > 0) {
      const sd = dmg * dt.shield;
      if (sd <= this.shield) { this.shield -= sd; this.onDamaged(src); return; }
      dmg = (sd - this.shield) / dt.shield; this.shield = 0;
    }
    let hd = dmg * dt.hull * (100 / (100 + (this.st.armor || 0) * 4));
    this.hull -= hd;
    this.onDamaged(src);
    if (this.hull <= 0) this.mode.shipDown(this, src, ionHit);
  }
  onDamaged(src) {
    const owner = src && src.owner;
    if (owner && owner !== this) {
      if (!this.isPlayer) { this.aggro.add(owner); if (!this.target || !this.target.alive || Math.random() < 0.3) { this.target = owner; this.state = 'attack'; } }
      if (owner.isPlayer && !this.isPlayer) this.mode.playerAttacked(this);
    }
    if (this.isPlayer) this.mode.game.ui.damageFlash();
  }
}

export class SpaceMode {
  constructor(game, sysId, arrival = { type: 'warp' }) {
    this.game = game; this.U = game.U; this.sysId = sysId; this.arrival = arrival; this.kind = 'space';
    this.time = 0; this.ships = []; this.crates = []; this.targetIdx = 0; this.rocks = []; this.signals = []; this.scan = null;
    this.cruise = 0; this.cruiseOn = false; this.spawnTimer = 20; this.viewMode = game.settings.spaceView ?? 0; this.aimDir = null;
    this.sys = getSystem(this.U, sysId);
    this.rng = new RNG(hashInts(Date.now() & 0xffffff, sysId));
  }
  init() {
    const g = this.game, sys = this.sys;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 1, 210000);
    // sky
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(160000, 24, 12), new THREE.MeshBasicMaterial({ map: nebulaTexture(sys.id * 7 + 3, (sys.id * 0.137) % 1), side: THREE.BackSide, depthWrite: false }));
    this.sky.renderOrder = -2;
    this.scene.add(this.sky);
    this.stars = starfield(Q.stars, 120000); this.stars.renderOrder = -1; this.scene.add(this.stars);
    // star
    const sr = 1200 * sys.star.size;
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(sr, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(sys.star.color).multiplyScalar(1.6), toneMapped: false }));
    this.scene.add(this.sun);
    this.sun.add(glowSprite(sys.star.color, sr * 7, 0.9));
    this.sunRadius = sr;
    const light = new THREE.PointLight(sys.star.color, 2.2, 0, 0); this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x8090b0, 0.35));
    this.scene.add(new THREE.HemisphereLight(0x6070a0, 0x101018, 0.4));
    // planets
    this.planets = sys.planets.map(p => {
      const biome = BIOMES.find(b => b.id === p.biome);
      const m = new THREE.Mesh(new THREE.SphereGeometry(p.radius, Q.tier ? 48 : 32, Q.tier ? 32 : 20), litMat({ map: planetTexture(p), roughness: 0.9, metalness: 0 }));
      m.position.fromArray(p.pos); m.rotation.z = p.incl * 4;
      const atmo = glowSprite(biome.sky, p.radius * 2.7, 0.45); m.add(atmo);
      if (p.rings) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(p.radius * 1.4, p.radius * 2.2, Q.tier ? 64 : 32), new THREE.MeshBasicMaterial({ color: biome.ground[2], side: THREE.DoubleSide, transparent: true, opacity: 0.35 }));
        ring.rotation.x = Math.PI / 2 + 0.3; m.add(ring);
      }
      this.scene.add(m);
      return { data: p, mesh: m, pos: m.position, radius: p.radius };
    });
    // stations
    this.stations = sys.stations.map(s => {
      const m = buildStation(s.seed, this.U.factions[s.faction].color, stationKind(s.name));
      m.position.fromArray(s.pos); this.scene.add(m);
      return { data: s, mesh: m, pos: m.position, radius: m.userData.radius, spin: { wheel: 0.05, spire: 0.03, hub: 0.02 }[m.userData.kind] || 0 };
    });
    // asteroid belts
    for (const b of sys.belts) {
      const r = new RNG(b.seed);
      const cnt = Math.round(b.count * Q.belt);
      const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat(0x6b6158, { metal: 0.2, rough: 0.9 }), cnt);
      const M = new THREE.Matrix4(), QQ = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
      for (let i = 0; i < cnt; i++) {
        const a = r.range(0, Math.PI * 2), rad = b.radius + r.gauss() * b.width;
        P.set(Math.cos(a) * rad, r.gauss() * 300, Math.sin(a) * rad);
        QQ.setFromEuler(new THREE.Euler(r.next() * 6, r.next() * 6, r.next() * 6));
        const s = r.range(8, 70); S.set(s * r.range(0.6, 1.4), s, s * r.range(0.6, 1.4));
        inst.setMatrixAt(i, M.compose(P, QQ, S));
      }
      this.scene.add(inst);
    }
    // projectiles
    this._pendingBelts = sys.belts;
    this.proj = new Projectiles(this.scene, {
      scale: 6, max: 500,
      canHit: (o, t) => this.canHit(o, t),
      // your own gunfire gets a slightly generous hit box against ships, so near misses on a small fighter count
      grace: (p, t) => p.owner && p.owner.isPlayer && !p.missile && t.hc ? clamp(t.radius * 0.5, 4, 8) : 0,
      onHit: (t, dmg, dtype, p, crit) => { t.hit(dmg, dtype, p); if (p.leech && p.owner && p.owner.alive) p.owner.hull = Math.min(p.owner.st.hullMax, p.owner.hull + dmg * p.leech); if (p.owner && p.owner.isPlayer) this.game.ui.hitMarker(crit); },
    });
    // player
    const pdata = g.player;
    this.player = new Ship(this, { name: pdata.ship.name, cls: pdata.ship.cls, faction: null, level: pdata.level, seed: hashStr(pdata.ship.name + pdata.ship.cls), loadout: {} }, { player: true });
    this.placePlayer();
    this.scene.add(this.player.mesh);
    this.ships.push(this.player);
    // NPCs
    for (const b of this._pendingBelts) buildRocks(this, b);
    this.populate();
    this.spawnMissionTargets();
    spawnWingmen(this, Ship);
    for (let i = this.rng.int(1, 3); i > 0; i--) spawnSignal(this, false);
    this.signalTimer = this.rng.range(60, 110);
    g.ui.toast(`Entered ${sys.name} — ${sys.owner !== null ? this.U.factions[sys.owner].name : 'Unclaimed space'} · Threat ${sys.danger}`, '#9fd8ff');
    this.camPos = this.player.pos.clone().add(new THREE.Vector3(0, 20, 60).applyQuaternion(this.player.quat));
    this.camera.position.copy(this.camPos);
  }
  placePlayer() {
    const a = this.arrival, p = this.player;
    if (a.type === 'undock' && this.stations[a.stationId]) {
      const st = this.stations[a.stationId];
      p.pos.copy(st.pos).add(new THREE.Vector3(st.radius + 120, 30, 0));
      p.mesh.lookAt(p.pos.clone().multiplyScalar(2).sub(st.pos)); p.quat.multiply(_q.setFromAxisAngle(UP, Math.PI));
    } else if (a.type === 'launch' && this.planets[a.planetId]) {
      const pl = this.planets[a.planetId];
      const out = pl.pos.clone().normalize();
      p.pos.copy(pl.pos).addScaledVector(out, pl.radius + 500);
      p.mesh.lookAt(pl.pos); p.quat.multiply(_q.setFromAxisAngle(UP, Math.PI));
    } else if (a.type === 'resume' && a.pos) {
      p.pos.fromArray(a.pos); if (a.quat) p.quat.fromArray(a.quat);
    } else {
      const ref = this.planets[0] ? this.planets[0].pos : new THREE.Vector3(5000, 0, 0);
      p.pos.copy(ref).normalize().multiplyScalar(ref.length() + 3500).add(new THREE.Vector3(0, 400, 1500));
      const look = this.stations[0] ? this.stations[0].pos : ref;
      p.mesh.lookAt(look); p.quat.multiply(_q.setFromAxisAngle(UP, Math.PI));
      p.vel.copy(p.forward()).multiplyScalar(400);
    }
  }
  populate() {
    const sys = this.sys, r = this.rng;
    const pirates = this.U.factions.filter(f => f.ideology === 'pirate');
    const groups = [];
    if (sys.owner !== null) for (let i = 0; i < r.int(1, 3); i++) groups.push({ faction: sys.owner, n: r.int(1, 3), role: 'patrol' });
    if (sys.owner !== null && r.chance(0.6)) groups.push({ faction: sys.owner, n: 1, role: 'trader', cls: 'freighter' });
    const pirN = Math.max(0, Math.round((sys.danger - 1) * 0.5 + r.range(-0.5, 1)));
    for (let i = 0; i < pirN; i++) groups.push({ faction: r.pick(pirates).id, n: r.int(1, 3), role: 'raid' });
    // a random foreign faction visitor
    if (r.chance(0.5)) groups.push({ faction: r.int(0, this.U.factions.length - 1), n: r.int(1, 2), role: 'patrol' });
    // capital ships prowl dangerous space
    if (sys.danger >= 4 && r.chance(0.2 + sys.danger * 0.04)) {
      const capFac = sys.owner !== null && U_ideo(this, sys.owner) === 'militarist' && r.chance(0.5) ? sys.owner : r.pick(pirates).id;
      groups.push({ faction: capFac, n: 1, role: capFac === sys.owner ? 'patrol' : 'raid', cls: 'dreadnought', level: sys.level + 2, escort: 3 });
    }
    for (const gdef of groups) {
      const out = this.spawnGroup(gdef, true);
      if (gdef.escort) this.spawnGroup({ faction: gdef.faction, n: gdef.escort, role: gdef.role, at: out[0].pos }, true);
    }
  }
  randomPointNear(r) {
    const anchors = [...this.planets.map(p => p.pos), ...this.stations.map(s => s.pos)];
    const a = anchors.length ? r.pick(anchors) : new THREE.Vector3(8000, 0, 0);
    return a.clone().add(new THREE.Vector3(r.range(-1, 1), r.range(-0.3, 0.3), r.range(-1, 1)).normalize().multiplyScalar(r.range(1500, 4000)));
  }
  spawnGroup({ faction, n, role, cls, missionId, name, level, bounty, disabled, at }, initial = false) {
    const r = this.rng;
    let center;
    if (at) center = at.clone();
    else if (initial) center = this.randomPointNear(r);
    else center = this.player.pos.clone().add(new THREE.Vector3(r.range(-1, 1), r.range(-0.3, 0.3), r.range(-1, 1)).normalize().multiplyScalar(r.range(3500, 6000)));
    const out = [];
    for (let i = 0; i < n; i++) {
      const def = genShipDef(this.U, r.fork(i + this.time), { faction, level: level || this.sys.level, cls });
      if (name) def.name = name;
      const s = new Ship(this, def, { missionId, bounty });
      const spread = 200 * Math.max(1, s.hc.size / 2);
      s.pos.copy(center).add(new THREE.Vector3(r.range(-spread, spread), r.range(-80, 80), r.range(-spread, spread)));
      s.quat.setFromEuler(new THREE.Euler(0, r.range(0, 6.28), 0));
      s.role = role; s.waypoint = this.randomPointNear(r);
      if (role === 'raid' || bounty) s.hunter = true;
      if (disabled) { s.disabled = true; s.hull = s.st.hullMax * 0.1; s.shield = 0; s.state = 'disabled'; s.throttle = 0; }
      this.scene.add(s.mesh); this.ships.push(s); out.push(s);
      if (!initial) this.proj.flash(s.pos, 0x9fd8ff, 120, 0.8, 1, true);
    }
    return out;
  }
  spawnMissionTargets() {
    for (const m of this.game.player.missions) {
      if (m.sysId !== this.sysId || m.done) continue;
      if (m.type === 'bounty') {
        const [s] = this.spawnGroup({ faction: m.faction, n: 1, role: 'raid', name: m.targetName, missionId: m.id, bounty: true, level: m.level + 1, cls: m.cls }, true);
        const escorts = this.spawnGroup({ faction: m.faction, n: m.escorts, role: 'raid', level: m.level }, true);
        escorts.forEach(e => e.pos.copy(s.pos).add(new THREE.Vector3(this.rng.range(-150, 150), 0, this.rng.range(-150, 150))));
      }
      if (m.type === 'derelict') this.spawnGroup({ faction: m.faction, n: 1, role: 'derelict', name: m.targetName, missionId: m.id, disabled: true, level: m.level }, true);
    }
  }
  canHit(owner, t) {
    if (!owner || owner === t) return false;
    if (t.rock) return !!(owner.isPlayer || owner.ally);
    if (owner.isPlayer) return !t.ally;
    if (owner.ally) return !t.isPlayer && !t.ally;
    if (t.isPlayer || t.ally) return this.isHostileToPlayer(owner) || owner.aggro.has(t);
    return factionsAtWar(this.U, owner.faction, t.faction) || owner.aggro.has(t) || t.aggro.has(owner);
  }
  isHostileToPlayer(s) {
    if (s.disabled || s.ally) return false;
    if (s.aggro.has(this.player)) return true;
    return hostileToPlayer(this.U, this.game.player, s.faction) || (s.faction !== null && this.U.factions[s.faction].ideology === 'pirate');
  }
  playerAttacked(s) {
    if (!s._repHit && !this.isHostileToPlayer(s)) {
      s._repHit = true;
      changeRep(this.U, this.game.player, s.faction, -6);
      this.game.ui.toast(`You attacked ${this.U.factions[s.faction].name} — reputation lost`, '#ff7a5a');
      // nearby allies join
      for (const o of this.ships) if (!o.isPlayer && o.faction === s.faction && o.pos.distanceTo(s.pos) < 2500) o.aggro.add(this.player);
    }
    s.aggro.add(this.player);
  }

  shipDown(s, src, ion) {
    if (!s.alive) return;
    const killer = src && src.owner;
    if (s.isPlayer) { s.alive = false; this.proj.explosion(s.pos.clone(), 80); this.player.mesh.visible = false; this.game.onPlayerDeath('space'); return; }
    if (s.ally) { s.alive = false; this.proj.explosion(s.pos.clone(), 40 * s.hc.size); this.scene.remove(s.mesh); disposeTree(s.mesh); wingmanDown(this, s); return; }
    const byPlayer = killer && (killer.isPlayer || killer.ally);
    const disableChance = byPlayer ? (ion ? 0.45 : 0) + this.player.st.disable : 0.05;
    if (!s.disabled && Math.random() < disableChance * (s.turrets ? 0.5 : 1)) {
      s.disabled = true; s.hull = 1; s.shield = 0; s.state = 'disabled'; s.throttle = 0; s.target = null;
      this.game.ui.toast(`${s.name} disabled — fly close and press E to board`, '#ffd34d');
      if (byPlayer) this.rewardKill(s, true);
      return;
    }
    s.alive = false;
    this.proj.explosion(s.pos.clone(), 40 * s.hc.size);
    if (s.turrets) for (let i = 0; i < 6; i++) this.proj.explosion(s.pos.clone().add(_v.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(s.radius * 1.5)), 60 * s.hc.size);
    this.scene.remove(s.mesh); disposeTree(s.mesh);
    if (byPlayer && !s.rewarded) this.rewardKill(s, false);
    if (byPlayer || (killer && Math.random() < 0.3)) this.dropLoot(s);
  }
  rewardKill(s, disabledOnly) {
    if (s.rewarded) return; s.rewarded = true;
    const g = this.game;
    g.player.kills++;
    const xp = Math.round((18 + s.level * 9) * s.hc.size * (s.bounty ? 2 : 1));
    g.addXP(xp, `${s.name} ${disabledOnly ? 'disabled' : 'destroyed'}`);
    if (s.faction !== null) {
      const hostile = this.isHostileToPlayer(s) && !s._repHit;
      changeRep(this.U, g.player, s.faction, hostile ? -2 : -10);
      for (const f of this.U.factions) if (factionsAtWar(this.U, f.id, s.faction) && f.id !== s.faction) changeRep(this.U, g.player, f.id, 1.5);
      if (this.U.factions[s.faction].ideology === 'pirate' || s.bounty) { const b = Math.round(60 + s.level * 40 * s.hc.size); g.addCredits(b, 'bounty'); }
    }
    if (s.missionId) g.missionProgress(s.missionId, 'kill');
  }
  dropLoot(s) {
    const r = this.rng, st = this.player.st;
    const n = 1 + (r.chance(0.35 + st.dropPct) ? 1 : 0) + (s.hc.size > 1.5 ? 1 : 0) + (s.bounty ? 1 : 0) + (s.turrets ? 3 : 0);
    for (let i = 0; i < n; i++) {
      const maker = s.faction !== null ? r.pick(this.U.factions[s.faction].makers) : null;
      let item = r.chance(0.45) && s.def.loadout.weapons.length ? JSON.parse(JSON.stringify(r.pick(s.def.loadout.weapons))) : genLoot(r, s.level, st.luck + (s.bounty ? 0.3 : 0) + (s.turrets ? 0.4 : 0), maker);
      if (item.weapon && !item.id.startsWith('i')) item.id = 'i' + Math.random().toString(36).slice(2);
      item.id = 'i' + Math.random().toString(36).slice(2);
      this.spawnCrate(s.pos.clone().add(new THREE.Vector3(r.range(-30, 30), r.range(-30, 30), r.range(-30, 30))), { item, credits: r.int(10, 40) * s.level });
    }
  }
  spawnCrate(pos, contents) {
    const tier = contents.item ? contents.item.tier : 1;
    const color = new THREE.Color(contents.color ?? TIERS[tier].color);
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), mat(color.getHex(), { emissive: color.getHex(), ei: 0.6 }));
    m.add(glowSprite(color, 40, 0.8));
    m.position.copy(pos); this.scene.add(m);
    this.crates.push({ mesh: m, pos: m.position, contents, life: 120 });
  }

  // ------------- Update -------------
  update(dt) {
    this.time += dt;
    const g = this.game, inp = g.input, p = this.player, ui = g.ui;
    if (this.descent) this.updateDescent(dt); else if (p.alive) this.controlPlayer(dt, inp);
    if (this.jumpSpool) { const j = this.jumpSpool; j.t -= dt; if (!p.alive) this.jumpSpool = null; else if (j.t <= 0) { this.jumpSpool = null; g.doJump(j.sysId); } }
    for (const s of this.ships) if (!s.isPlayer && s.alive) this.updateAI(s, dt);
    // physics + regen
    for (const s of this.ships) {
      if (!s.alive) continue;
      if (!s.isPlayer && !s.disabled) {
        const target = s.forward(_v2).multiplyScalar(s.st.speed * s.throttle * (s.boosting ? s.st.boost : 1));
        s.vel.lerp(target, 1 - Math.exp(-1.4 * dt));
      } else if (s.disabled) { s.vel.multiplyScalar(1 - dt * 0.3); s.steer(0.1, 0.05, 0.2, dt); if (Math.random() < dt * 4) this.proj.flash(s.pos.clone().add(_v.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(s.radius)), 0xffaa55, 12, 0.3); }
      s.pos.addScaledVector(s.vel, dt);
      if (!s.disabled && this.time - s.lastHit > s.st.regenDelay) s.shield = Math.min(s.st.shieldMax, s.shield + s.st.shieldRegen * dt);
      if (s.isPlayer && s.st.hullRegen) s.hull = Math.min(s.st.hullMax, s.hull + s.st.hullRegen * dt);
      for (let i = 0; i < s.cool.length; i++) s.cool[i] -= dt;
      s.missileCool -= dt;
      // Your missile rack reloads itself: a full rack takes about 90 seconds whatever its size.
      if (s.isPlayer && s.st.missile && s.missiles < s.st.missileCap) {
        s.misLoad = (s.misLoad || 0) + dt; const per = MISSILE_RELOAD / Math.max(1, s.st.missileCap);
        if (s.misLoad >= per) { s.misLoad = 0; s.missiles++; }
      } else if (s.isPlayer) s.misLoad = 0;
      // engine glow
      const eg = s.mesh.userData.engines; const k = s.disabled ? 0.05 : 0.5 + s.throttle * (s.boosting ? 1.8 : 1);
      for (const e of eg) e.material.opacity = Math.min(1, k);
      this.collideBodies(s, dt);
    }
    for (const st of this.stations) if (st.spin) st.mesh.rotation.y += st.spin * dt; // habitat rings turn slowly
    this.proj.update(dt, this.rocks.length ? this.ships.concat(this.rocks) : this.ships);
    this.ships = this.ships.filter(s => s.alive || s.isPlayer);
    if (this.rocks.length && this.rocks.some(r => !r.alive)) this.rocks = this.rocks.filter(r => r.alive);
    updateRocks(this, dt);
    updateSignals(this, dt);
    this.signalTimer -= dt;
    if (this.signalTimer <= 0) { this.signalTimer = this.rng.range(70, 130); if (this.signals.filter(s => !s.resolved).length < 3) spawnSignal(this, true); }
    this.updateCrates(dt);
    // ambient spawns
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.rng.range(25, 45);
      const npcs = this.ships.filter(s => !s.isPlayer).length;
      if (npcs < Q.npcCap) {
        const r = this.rng;
        if (r.chance(0.25 + this.sys.danger * 0.05)) this.spawnGroup({ faction: r.pick(this.U.factions.filter(f => f.ideology === 'pirate')).id, n: r.int(1, 3), role: 'raid' });
        else this.spawnGroup({ faction: this.sys.owner ?? r.int(0, this.U.factions.length - 1), n: r.int(1, 2), role: r.chance(0.3) ? 'trader' : 'patrol', cls: r.chance(0.3) ? 'freighter' : null });
      }
    }
    this.updateCamera(dt);
    this.updateHud();
  }

  controlPlayer(dt, inp) {
    const p = this.player, st = p.st, g = this.game, gp = inp.gp;
    // steering
    let yaw = 0, pitch = 0, roll = 0;
    const dz = (v) => Math.abs(v) < 0.06 ? 0 : (v - Math.sign(v) * 0.06) / 0.94;
    // Mouse aim (captured mouse): the mouse moves an aim point and the ship turns to follow it.
    // Otherwise the cursor offset from the centre sets the turn rate, like a joystick.
    this.mouseAim = inp.locked && !inp.padActive && g.settings.flight !== 'classic' && !g.ui.freeCursor;
    if (this.mouseAim) {
      if (!this.aimDir) this.aimDir = p.forward().clone();
      const cq = this.camera.quaternion;
      _q.setFromAxisAngle(_v.set(0, 1, 0).applyQuaternion(cq), -inp.dx * AIM_SENS); this.aimDir.applyQuaternion(_q);
      _q.setFromAxisAngle(_v.set(1, 0, 0).applyQuaternion(cq), -inp.dy * AIM_SENS); this.aimDir.applyQuaternion(_q);
      // keep the aim point within reach of the nose so it never drifts off screen
      const f = p.forward(_v2), a = this.aimDir.angleTo(f);
      if (a > AIM_MAX) { const ax = _v.crossVectors(f, this.aimDir).normalize(); this.aimDir.copy(f).applyAxisAngle(ax, AIM_MAX); }
      const e = this.localErr(this.aimDir);
      yaw = clamp(e.yaw * 5, -1, 1); pitch = clamp(e.pitch * 5, -1, 1);
    } else {
      this.aimDir = null;
      if (!g.ui.freeCursor) { yaw = -dz(inp.vc.x); pitch = -dz(inp.vc.y); }
    }
    if (inp.down('KeyA')) yaw += 0.8; if (inp.down('KeyD')) yaw -= 0.8;
    if (inp.down('KeyQ')) roll += 1; if (inp.down('KeyE') && !this.interactTarget) roll -= 1;
    if (inp.down('ArrowUp')) pitch -= 0.8; if (inp.down('ArrowDown')) pitch += 0.8;
    if (gp) { yaw -= gp.lx; pitch -= gp.ly; roll -= gp.rx; }
    // Aim assist for joystick-style steering: a gentle pull toward a hostile target's lead
    // marker once it's near the nose. Your own input always wins.
    if (!this.mouseAim && this.target && this.target.alive && this.cruise < 0.1 && this.isHostileToPlayer(this.target) && st.weapons[0]) {
      const lead = this.leadPoint(p, this.target, st.weapons[0].weapon.speed * st.weaponMods.vel).sub(p.pos);
      const e = this.localErr(lead);
      if (e.angle < 0.35 && p.pos.distanceTo(this.target.pos) < st.weapons[0].weapon.range * 1.3) {
        const k = 0.75 * (1 - e.angle / 0.35);
        yaw += clamp(e.yaw * 4, -1, 1) * k * (1 - Math.min(1, Math.abs(yaw)));
        pitch += clamp(e.pitch * 4, -1, 1) * k * (1 - Math.min(1, Math.abs(pitch)));
      }
    }
    const turn = st.turn * (this.cruiseOn ? 0.35 : 1);
    p.steer(yaw * turn, pitch * turn, roll * turn * 1.4, dt);
    // throttle
    if (inp.down('KeyW') || (gp && gp.ry < -0.3)) p.throttle = Math.min(1, p.throttle + dt * 0.8);
    if (inp.down('KeyS') || (gp && gp.ry > 0.3)) p.throttle = Math.max(0, p.throttle - dt * 0.8);
    if (inp.pressed('KeyX')) p.throttle = 0;
    if (inp.wheel) p.throttle = clamp(p.throttle - inp.wheel * 0.1, 0, 1); // scroll up for more throttle
    p.boosting = (inp.down('ShiftLeft') || inp.down('ShiftRight') || inp.gpDown(5)) && p.energy > 5 && !this.cruiseOn;
    if (p.boosting) p.energy -= st.boostDrain * dt;
    // cruise
    if (inp.pressed('KeyC') || inp.gpPressed(10)) {
      if (this.cruiseOn) this.cruiseOn = false;
      else if (this.enemiesNear(2200)) g.ui.toast('Cruise blocked — hostiles nearby', '#ff7a5a');
      else { this.cruiseOn = true; g.ui.toast('Cruise drive engaged', '#9fd8ff'); }
    }
    if (this.cruiseOn && this.time - p.lastHit < 0.5) { this.cruiseOn = false; g.ui.toast('Cruise interrupted!', '#ff7a5a'); }
    this.cruise = THREE.MathUtils.lerp(this.cruise, this.cruiseOn ? 1 : 0, 1 - Math.exp(-(this.cruiseOn ? 0.8 : 3) * dt));
    let speed = st.speed * p.throttle * (p.boosting ? st.boost : 1);
    speed = THREE.MathUtils.lerp(speed, st.speed * st.cruise, this.cruise);
    p.vel.lerp(p.forward(_v2).multiplyScalar(speed), 1 - Math.exp(-(this.cruiseOn ? 2.5 : 1.8) * dt));
    p.energy = Math.min(st.energyMax, p.energy + st.energyRegen * dt * (p.boosting ? 0 : 1));
    // targeting
    if (inp.pressed('KeyT') || inp.gpPressed(3)) this.cycleTarget();
    if (inp.pressed('KeyR') || inp.gpPressed(1)) this.targetAhead();
    if (this.target && (!this.target.alive)) this.target = null;
    // With nothing locked, lock the nearest hostile so the lead marker and gun tracking are always there in a fight.
    this.autoT = (this.autoT || 0) - dt;
    if (!this.target && this.autoT <= 0) { this.autoT = 0.5; this.target = this.nearestHostile(Math.min(p.st.radar, 2400)); }
    // weapons
    const firing = (inp.mouse(0) && !g.ui.freeCursor) || inp.down('Space') || (gp && gp.rt > 0.4);
    if (firing && this.cruise < 0.1) this.firePlayerGuns();
    if ((inp.click(2) || inp.pressed('KeyF') || (gp && gp.lt > 0.5 && !this._lt)) && this.cruise < 0.1) this.firePlayerMissile();
    this._lt = gp && gp.lt > 0.5;
    // interact
    this.interactTarget = this.findInteract();
    if (this.interactTarget && (inp.pressed('KeyE') || inp.gpPressed(0))) this.doInteract(this.interactTarget);
    if (inp.pressed('KeyL')) { const pl = this.nearPlanet(); if (pl) this.beginLanding(pl); else g.ui.toast('No planet in landing range — fly closer', '#ff7a5a'); }
    if (inp.pressed('KeyV') || inp.gpPressed(11)) this.cycleView();
  }
  cycleView() {
    this.viewMode = (this.viewMode + 1) % 3;
    this.game.settings.spaceView = this.viewMode; this.game.persistSettings();
    this.game.ui.toast(['Chase camera', 'Cockpit view', 'Wide chase camera'][this.viewMode], '#9fd8ff');
  }
  // Yaw/pitch error (radians) from the ship's nose to a world direction.
  localErr(dir) {
    _v.copy(dir).applyQuaternion(_q.copy(this.player.quat).invert()).normalize();
    return { yaw: Math.atan2(-_v.x, -_v.z), pitch: Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), angle: Math.acos(clamp(-_v.z, -1, 1)) };
  }
  // Where the guns will fire: the nose, swivelled toward the mouse aim, snapped onto the
  // target's lead point when the aim is on it.
  gunAim(out = new THREE.Vector3()) {
    const p = this.player, st = p.st, f = p.forward(out);
    let want = this.mouseAim && this.aimDir ? this.aimDir : null;
    if (this.target && this.target.alive && st.weapons[0]) {
      const lead = this.leadPoint(p, this.target, st.weapons[0].weapon.speed * st.weaponMods.vel).sub(p.pos).normalize();
      const ref = want || f;
      if (lead.angleTo(ref) < (want ? SNAP_MOUSE : SNAP_PAD)) want = lead;
    }
    if (want) {
      const a = want.angleTo(f);
      if (a <= GIMBAL) out.copy(want);
      else { const ax = _v.crossVectors(f, want).normalize(); out.applyAxisAngle(ax, GIMBAL); }
    }
    return out.normalize();
  }
  firePlayerGuns() {
    const p = this.player, st = p.st, ws = st.weapons;
    const muz = p.mesh.userData.muzzles;
    const aim = this.gunAim();
    ws.forEach((w, i) => {
      if ((p.cool[i] || 0) > 0) return;
      const cost = w.weapon.energy;
      if (p.energy < cost) return;
      p.energy -= cost;
      p.cool[i] = 1 / (w.weapon.rate * st.weaponMods.rate);
      const o = muz[i % muz.length].clone().applyQuaternion(p.quat).add(p.pos);
      fireWeapon(this.proj, w, o, aim, p, st.weaponMods, p.vel);
      this.game.audio?.shot(w.weapon.dtype);
    });
  }
  firePlayerMissile() {
    const p = this.player, m = p.st.missile;
    if (!m) return this.game.ui.toast('No missile launcher equipped', '#ff7a5a');
    if (p.missiles <= 0) return this.game.ui.toast('Out of missiles — the rack is reloading', '#ff7a5a');
    if (p.missileCool > 0) return;
    p.missiles--; p.missileCool = 1 / m.weapon.rate;
    fireWeapon(this.proj, m, p.pos.clone().addScaledVector(p.forward(), 12), p.forward(), p, p.st.weaponMods, p.vel, this.target);
  }
  leadPoint(from, t, speed) {
    const out = t.pos.clone();
    for (let i = 0; i < 2; i++) { const tt = out.distanceTo(from.pos) / speed; out.copy(t.pos).addScaledVector(_v.copy(t.vel).sub(from.vel), tt); }
    return out;
  }
  nearestHostile(d) {
    let best = null, bd = d;
    for (const s of this.ships) { if (s.isPlayer || s.ally || !s.alive || s.disabled || !this.isHostileToPlayer(s)) continue; const x = s.pos.distanceTo(this.player.pos); if (x < bd) { bd = x; best = s; } }
    return best;
  }
  enemiesNear(d) { return this.ships.some(s => !s.isPlayer && s.alive && this.isHostileToPlayer(s) && s.pos.distanceTo(this.player.pos) < d); }
  cycleTarget() {
    const list = this.ships.filter(s => !s.isPlayer && !s.ally && s.alive && s.pos.distanceTo(this.player.pos) < this.player.st.radar)
      .sort((a, b) => (this.isHostileToPlayer(b) - this.isHostileToPlayer(a)) || a.pos.distanceTo(this.player.pos) - b.pos.distanceTo(this.player.pos));
    if (!list.length) { this.target = null; return; }
    this.targetIdx = (list.indexOf(this.target) + 1) % list.length;
    this.target = list[this.targetIdx];
  }
  targetAhead() {
    const f = this.player.forward(); let best = null, ba = 0.35;
    for (const s of this.ships) { if (s.isPlayer || s.ally || !s.alive) continue; const a = _v.copy(s.pos).sub(this.player.pos).normalize().angleTo(f); if (a < ba) { ba = a; best = s; } }
    if (best) this.target = best;
  }
  nearPlanet() { return this.planets.find(pl => pl.pos.distanceTo(this.player.pos) < pl.radius + LAND_RANGE); }
  // Landing: pick a site on the survey map, then the ship dives into the atmosphere on its own.
  beginLanding(pl) { this.jumpSpool = null; this.game.ui.landing(this, pl); }
  startDescent(pl, site) {
    this.descent = { pl, site, t: 0 }; this.cruiseOn = false; this.cruise = 0;
    this.game.ui.toast(`Beginning descent to ${pl.data.name}`, '#9fd8ff');
  }
  updateDescent(dt) {
    const d = this.descent, p = this.player, g = this.game;
    if (!p.alive) { this.descent = null; g.ui.entryFx(false); return; }
    d.t += dt;
    const down = _v.copy(d.pl.pos).sub(p.pos).normalize();
    p.steerToward(down, dt, 1.6); p.throttle = 1; p.boosting = false;
    p.vel.lerp(_v2.copy(down).multiplyScalar(Math.max(140, p.st.speed)), 1 - Math.exp(-2.5 * dt));
    if (d.t > DESCENT_TIME - 0.9 && !d.fx) { d.fx = true; g.ui.entryFx(true); g.audio.warp && g.audio.warp(); }
    if (d.t >= DESCENT_TIME) { this.descent = null; p.vel.set(0, 0, 0); g.land(this, d.pl.data, d.site); }
  }
  findInteract() {
    const p = this.player;
    for (const st of this.stations) if (st.pos.distanceTo(p.pos) < st.radius + 260) return { type: 'dock', st };
    for (const sig of this.signals) if (sig.mesh && sig.pos.distanceTo(p.pos) < 320) return { type: 'scan', sig };
    for (const s of this.ships) {
      if (s.isPlayer || s.ally || !s.alive) continue;
      const d = s.pos.distanceTo(p.pos);
      if (d < s.radius + 140) {
        if (s.disabled) return { type: 'board', ship: s };
        if (!this.isHostileToPlayer(s)) return { type: 'hail', ship: s };
      }
    }
    const pl = this.nearPlanet(); if (pl) return { type: 'land', pl };
    const far = this.planets.find(q => q.pos.distanceTo(p.pos) < q.radius + 2600); if (far) return { type: 'approach', pl: far };
    return null;
  }
  doInteract(it) {
    const g = this.game;
    if (it.type === 'approach') return;
    if (it.type === 'dock' || it.type === 'board') this.jumpSpool = null;
    if (it.type === 'dock') g.dock(this, it.st.data);
    else if (it.type === 'land') this.beginLanding(it.pl);
    else if (it.type === 'board') {
      if (this.player.vel.length() > 120) return g.ui.toast('Match speed to board (slow down)', '#ff7a5a');
      g.board(this, it.ship, false);
    } else if (it.type === 'hail') g.ui.hail(this, it.ship);
    else if (it.type === 'scan' && !this.scan) { this.scan = { sig: it.sig, t: 0 }; g.ui.toast('Scanning anomaly… hold position', '#b766ff'); }
  }
  spawnWingmenNow() { spawnWingmen(this, Ship); }
  removeShip(s) { s.alive = false; this.scene.remove(s.mesh); disposeTree(s.mesh); }

  updateAI(s, dt) {
    if (s.disabled) return;
    s.think -= dt;
    if (s.think <= 0) {
      s.think = 0.4 + Math.random() * 0.3;
      if (s.ally) {
        s.target = wingTarget(this, s);
        s.state = s.target ? 'attack' : 'formation';
      } else
      // find target
      if (!s.target || !s.target.alive || s.target.disabled || s.target.pos.distanceTo(s.pos) > 4000) {
        s.target = null;
        let best = null, bd = s.hunter ? 3000 : 1800;
        for (const o of this.ships) {
          if (o === s || !o.alive || o.disabled) continue;
          const d = o.pos.distanceTo(s.pos);
          if (d < bd && this.canHit(s, o) && (!o.isPlayer || this.isHostileToPlayer(s))) { bd = d; best = o; }
        }
        s.target = best; s.state = best ? 'attack' : (s.role === 'trader' ? 'trade' : 'patrol');
      }
      if (s.hull < s.st.hullMax * 0.18 && !s.ally && !s.turrets && s.role !== 'raid' && s.state === 'attack') s.state = 'flee';
      if (s.ally && s.target && s.target.pos.distanceTo(this.player.pos) > 3200) { s.target = null; s.state = 'formation'; }
    }
    if (s.state === 'formation') { flyFormation(this, s, dt); return; }
    if (s.state === 'attack' && s.target && s.turrets) { this.capitalAttack(s, dt); return; }
    if (s.state === 'attack' && s.target) {
      const t = s.target;
      const w = s.st.weapons[0];
      const lead = this.leadPoint(s, t, w ? w.weapon.speed : 1200);
      const toT = lead.sub(s.pos); const dist = toT.length(); toT.normalize();
      // Fighters ease off the throttle once they're in gun range and break away without boost,
      // so a dogfight is a turning fight you can follow instead of a string of high-speed passes.
      if (s.evade > 0) { s.evade -= dt; s.steerToward(s.evadeDir, dt); s.throttle = 0.8; s.boosting = false; }
      else {
        const ang = s.steerToward(toT, dt);
        s.boosting = dist > 2200; s.throttle = dist < 300 ? 0.4 : dist < 1000 ? 0.65 : 1;
        if (dist < 180 && Math.random() < dt * 1.2) { s.evade = 0.9 + Math.random() * 0.7; s.evadeDir = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); }
        if (ang < 0.12 && dist < (w ? w.weapon.range * 1.1 : 1200)) {
          s.st.weapons.forEach((wi, i) => {
            if ((s.cool[i] || 0) > 0) return;
            s.cool[i] = 1 / wi.weapon.rate * (1.2 + Math.random() * 0.6);
            const o = s.mesh.userData.muzzles[i % 2].clone().applyQuaternion(s.quat).add(s.pos);
            fireWeapon(this.proj, wi, o, s.forward(), s, s.st.weaponMods, s.vel);
          });
        }
        if (s.st.missile && s.missiles > 0 && s.missileCool <= 0 && ang < 0.4 && dist < 2000 && Math.random() < dt * 0.5) {
          s.missiles--; s.missileCool = 4;
          fireWeapon(this.proj, s.st.missile, s.pos.clone().addScaledVector(s.forward(), 10), s.forward(), s, s.st.weaponMods, s.vel, t);
        }
      }
    } else if (s.state === 'flee') {
      const away = _v.copy(s.pos).sub(s.target ? s.target.pos : this.player.pos).normalize();
      s.steerToward(away, dt); s.throttle = 1; s.boosting = true;
      if (s.target && s.pos.distanceTo(s.target.pos) > 3500) { this.removeShip(s); }
    } else {
      // patrol / trade
      if (s.role === 'distress') { s.throttle = 0; s.boosting = false; return; }
      if (!s.waypoint || s.pos.distanceTo(s.waypoint) < 300) {
        if (s.role === 'trader' && this.stations.length && Math.random() < 0.5) {
          const st = this.rng.pick(this.stations); s.waypoint = st.pos.clone(); s.docking = st;
        } else { s.waypoint = this.randomPointNear(this.rng); s.docking = null; }
      }
      if (s.docking && s.pos.distanceTo(s.docking.pos) < s.docking.radius + 150) { this.removeShip(s); return; }
      s.steerToward(_v.copy(s.waypoint).sub(s.pos).normalize(), dt, 0.6);
      s.throttle = 0.55; s.boosting = false;
    }
  }
  // Capital ships turn slowly but their turrets track and fire independently.
  capitalAttack(s, dt) {
    const t = s.target, dist = t.pos.distanceTo(s.pos);
    const want = _v.copy(t.pos).sub(s.pos).normalize();
    if (dist < 700) want.negate();
    s.steerToward(want, dt); s.throttle = dist > 1400 ? 0.8 : 0.35; s.boosting = false;
    const R = s.radius;
    s.st.weapons.forEach((wi, i) => {
      for (let k = 0; k < s.turrets; k += s.st.weapons.length) {
        const idx = i * 8 + k;
        if ((s.cool[idx] || 0) > 0) continue;
        s.cool[idx] = 1 / wi.weapon.rate * (1.4 + Math.random() * 0.8);
        const tgt = (k % 2 && this.ships.length > 2) ? this.nearestEnemyOf(s) || t : t;
        if (tgt.pos.distanceTo(s.pos) > wi.weapon.range * 1.15) continue;
        // fire from the hull's own turrets when the model has them
        const tp = s.mesh.userData.turrets, mount = tp && tp.length ? tp[(k + i) % tp.length] : null;
        const o = (mount ? _v2.copy(mount) : _v2.set((Math.random() - 0.5) * R * 0.8, R * 0.25, (Math.random() - 0.5) * R * 1.4)).applyQuaternion(s.quat).add(s.pos).clone();
        const aim = this.leadPoint({ pos: o, vel: s.vel }, tgt, wi.weapon.speed).sub(o).normalize();
        fireWeapon(this.proj, wi, o, aim, s, s.st.weaponMods, s.vel);
      }
    });
    if (s.st.missile && s.missiles > 0 && s.missileCool <= 0 && dist < 2400) {
      s.missiles--; s.missileCool = 3;
      fireWeapon(this.proj, s.st.missile, s.pos.clone().add(_v2.set(0, R * 0.4, 0)), _v.copy(t.pos).sub(s.pos).normalize(), s, s.st.weaponMods, s.vel, t);
    }
  }
  nearestEnemyOf(s) {
    let best = null, bd = 2500;
    for (const o of this.ships) { if (o === s || !o.alive || o.disabled || !this.canHit(s, o)) continue; if (!o.isPlayer && !o.ally && !factionsAtWar(this.U, s.faction, o.faction) && !s.aggro.has(o)) continue; const d = o.pos.distanceTo(s.pos); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  collideBodies(s, dt) {
    const sr = this.sunRadius;
    const dsun = s.pos.length();
    if (dsun < sr + s.radius) { s.pos.setLength(sr + s.radius); if (s.isPlayer) s.hit(200 * dt * 10, 'plasma', null); }
    for (const pl of this.planets) {
      const d = s.pos.distanceTo(pl.pos);
      if (d < pl.radius + s.radius + 20) {
        _v.copy(s.pos).sub(pl.pos).setLength(pl.radius + s.radius + 20); s.pos.copy(pl.pos).add(_v);
        const into = s.vel.dot(_v.normalize()); if (into < 0) s.vel.addScaledVector(_v, -into * 1.3);
      }
    }
    for (const st of this.stations) {
      const d = s.pos.distanceTo(st.pos);
      if (d < st.radius * 0.8 + s.radius) { _v.copy(s.pos).sub(st.pos).setLength(st.radius * 0.8 + s.radius); s.pos.copy(st.pos).add(_v); s.vel.multiplyScalar(0.5); }
    }
  }
  updateCrates(dt) {
    const p = this.player;
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.life -= dt; c.mesh.rotation.x += dt; c.mesh.rotation.y += dt * 1.3;
      const d = c.pos.distanceTo(p.pos);
      if (d < 350 && p.alive) c.pos.lerp(p.pos, Math.min(1, dt * 3 * (1 - d / 400)));
      if (d < 30 + p.radius && p.alive) {
        if (c.contents.item && !this.game.giveItem(c.contents.item)) { c.life = Math.min(c.life, 20); continue; }
        if (c.contents.cargo) {
          const got = this.game.addCargo(c.contents.cargo, c.contents.qty);
          if (got) this.game.ui.toast(`+${got} ${c.contents.label}`, '#ffd34d');
          c.contents.qty -= got; if (c.contents.qty > 0) { c.life = Math.min(c.life, 20); continue; }
        }
        if (c.contents.parts) { this.game.player.parts = (this.game.player.parts || 0) + c.contents.parts; this.game.ui.toast(`+${c.contents.parts} parts`, '#9fd8ff'); c.contents.parts = 0; }
        if (c.contents.credits) this.game.addCredits(c.contents.credits);
        c.life = -1;
      }
      if (c.life <= 0) { this.scene.remove(c.mesh); disposeTree(c.mesh); this.crates.splice(i, 1); }
    }
  }
  updateCamera(dt) {
    const p = this.player, cam = this.camera;
    const size = p.hc.size * 2.2;
    const off = [new THREE.Vector3(0, 7 * size, 26 * size), (p.mesh.userData.cockpit || new THREE.Vector3(0, 2.2 * size, 4 * size)).clone(), new THREE.Vector3(0, 13 * size, 52 * size)][this.viewMode] || new THREE.Vector3(0, 7 * size, 26 * size);
    const want = off.applyQuaternion(p.quat).add(p.pos);
    const k = 1 - Math.exp(-(this.viewMode === 1 ? 30 : 8) * dt);
    if (!p.alive) { cam.lookAt(p.pos); return; }
    this.camPos.lerp(want, k);
    // keep up to speed (avoid lag at cruise)
    this.camPos.addScaledVector(p.vel, dt * (1 - k));
    cam.position.copy(this.camPos);
    const look = p.forward(_v).multiplyScalar(this.viewMode === 1 ? 200 : 600).add(p.pos);
    cam.up.copy(UP).applyQuaternion(p.quat);
    cam.lookAt(look);
    const targetFov = 70 + (p.boosting ? 8 : 0) + this.cruise * 18;
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
    this.sky.position.copy(cam.position); this.stars.position.copy(cam.position);
  }
  updateHud() {
    const ui = this.game.ui, p = this.player;
    const it = this.interactTarget;
    const prompts = { dock: (x) => `E · Dock at ${x.st.data.name}`, board: (x) => `E · ${x.ship.derelict ? 'Explore' : 'Board'} ${x.ship.name}`, hail: (x) => `E · Hail ${x.ship.name}`, land: (x) => `L · Land on ${x.pl.data.name}`, approach: (x) => `Fly closer to land on ${x.pl.data.name} · ${Math.max(0, Math.round((x.pl.pos.distanceTo(p.pos) - x.pl.radius - LAND_RANGE) / 10) * 10)} m`, scan: () => 'E · Scan anomaly' };
    ui.prompt(this.descent ? `Descending to ${this.descent.pl.data.name}…` : this.jumpSpool ? `Jump drive spooling… ${Math.ceil(this.jumpSpool.t)}` : this.scan ? `Scanning anomaly… ${Math.min(99, Math.round(this.scan.t / 5 * 100))}%` : it ? prompts[it.type](it) : null);
    ui.spaceHud({
      hull: p.hull / p.st.hullMax, shield: p.shield / p.st.shieldMax, energy: p.energy / p.st.energyMax,
      hullTxt: `${Math.ceil(p.hull)}/${Math.round(p.st.hullMax)}`, shieldTxt: `${Math.ceil(p.shield)}/${Math.round(p.st.shieldMax)}`,
      speed: Math.round(p.vel.length()), throttle: p.throttle, cruise: this.cruise > 0.5, missiles: p.missiles, missileCap: p.st.missile ? p.st.missileCap : 0, missileIn: p.st.missile && p.missiles < p.st.missileCap ? Math.ceil(MISSILE_RELOAD / Math.max(1, p.st.missileCap) - (p.misLoad || 0)) : 0, boost: p.boosting,
      // gun reticle at the range you're fighting at, so it shows where shots actually go
      reticle: this.project(_v3.copy(this.gunAim(_v4)).multiplyScalar(this.target && this.target.alive ? clamp(this.target.pos.distanceTo(p.pos), 300, 2500) : 900).add(p.pos)),
      aimCursor: this.mouseAim && this.aimDir ? this.project(_v3.copy(this.aimDir).multiplyScalar(900).add(p.pos)) : null,
    });
    // target
    if (this.target && this.target.alive) {
      const t = this.target;
      const fac = t.faction !== null ? this.U.factions[t.faction] : null;
      const sp = this.project(t.pos);
      const lead = this.player.st.weapons[0] ? this.project(this.leadPoint(p, t, this.player.st.weapons[0].weapon.speed * p.st.weaponMods.vel)) : null;
      ui.target({
        name: t.name, cls: `${t.hc.name} · Lv ${t.level}`, faction: fac ? fac.name : 'Independent', color: fac ? '#' + new THREE.Color(fac.color).getHexString() : '#ccc',
        hostile: this.isHostileToPlayer(t), hull: t.hull / t.st.hullMax, shield: t.shield / t.st.shieldMax, dist: Math.round(t.pos.distanceTo(p.pos)), screen: sp, lead, disabled: t.disabled,
      });
    } else ui.target(null);
    // radar + markers
    const inv = _q.copy(p.quat).invert();
    const blips = [];
    const R = p.st.radar;
    for (const s of this.ships) {
      if (s.isPlayer || !s.alive) continue;
      const rel = _v.copy(s.pos).sub(p.pos); const d = rel.length(); if (d > R) continue;
      rel.applyQuaternion(inv);
      blips.push({ x: rel.x / R, z: rel.z / R, y: rel.y / R, c: s.ally ? '#4dd6ff' : s.disabled ? '#ffd34d' : this.isHostileToPlayer(s) ? '#ff4d4d' : s.faction !== null ? '#7ee08a' : '#ccc', t: s === this.target });
    }
    for (const c of this.crates) { const rel = _v.copy(c.pos).sub(p.pos).applyQuaternion(inv); if (rel.length() < R) blips.push({ x: rel.x / R, z: rel.z / R, y: 0, c: '#ffffff', s: 1 }); }
    for (const rk of this.rocks) { const rel = _v.copy(rk.pos).sub(p.pos); if (rel.length() < R * 0.6) { rel.applyQuaternion(inv); blips.push({ x: rel.x / R, z: rel.z / R, y: 0, c: '#a08060' }); } }
    for (const sg of this.signals) { if (sg.resolved && !sg.mesh) continue; const rel = _v.copy(sg.pos).sub(p.pos); if (rel.length() < R) { rel.applyQuaternion(inv); blips.push({ x: rel.x / R, z: rel.z / R, y: 0, c: '#b766ff', t: false }); } }
    ui.radar(blips);
    // nav markers (planets, stations)
    const marks = [];
    for (const sg of this.signals) if (!sg.resolved || sg.mesh) marks.push({ name: sg.resolved ? '✦ Anomaly' : '? Unknown signal', d: sg.pos.distanceTo(p.pos), s: this.project(sg.pos), c: '#c792ff' });
    let nearRock = null, nrd = 30000; for (const rk of this.rocks) { const d = rk.pos.distanceTo(p.pos); if (d < nrd) { nrd = d; nearRock = rk; } }
    if (nearRock && nrd > 600) marks.push({ name: 'Asteroid field', d: nrd, s: this.project(nearRock.pos), c: '#c8a07a' });
    for (const s of this.ships) if (s.turrets && s.alive && !s.ally) marks.push({ name: '⚠ ' + s.name, d: s.pos.distanceTo(p.pos), s: this.project(s.pos), c: this.isHostileToPlayer(s) ? '#ff6b6b' : '#ffb05a' });
    for (const pl of this.planets) marks.push({ name: pl.data.name, d: pl.pos.distanceTo(p.pos) - pl.radius, s: this.project(pl.pos), c: '#9fd8ff' });
    for (const st of this.stations) marks.push({ name: st.data.name, d: st.pos.distanceTo(p.pos), s: this.project(st.pos), c: '#' + new THREE.Color(this.U.factions[st.data.faction].color).getHexString(), station: true });
    for (const s of this.ships) if (s.missionId && s.alive) marks.push({ name: '◆ ' + s.name, d: s.pos.distanceTo(p.pos), s: this.project(s.pos), c: '#ffd34d' });
    ui.navMarkers(marks);
  }
  project(pos) {
    const v = _v2.copy(pos).project(this.camera);
    const behind = v.z > 1;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind };
  }
  savePlayerShip() {
    const p = this.player, ps = this.game.player.ship;
    ps.hull = Math.max(0.05, p.hull / p.st.hullMax); ps.shield = p.shield / p.st.shieldMax; ps.energy = p.energy / p.st.energyMax; ps.missiles = p.missiles;
  }
  snapshot() { return { type: 'resume', pos: this.player.pos.toArray(), quat: this.player.quat.toArray() }; }
  resume() { this.player.refreshPlayerStats(false); this.player.vel.set(0, 0, 0); this.game.ui.setMode('space'); }
  dispose() { this.proj.clear(); disposeTree(this.scene); }
}
