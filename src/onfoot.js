import * as THREE from 'three';
import { RNG, clamp } from './rng.js';
import { DAMAGE_TYPES } from './data.js';
import { personalStats, changeRep } from './player.js';
import { buildCharacter, animateCharacter, muzzleWorld, glowSprite, mat, disposeTree } from './models.js';
import { buildCreature, animateCreature } from './creatures.js';

// Aim-in tell: an armed NPC who gets a shot on a new target raises the rifle and charges a glow
// at the muzzle for WINDUP seconds before its first shot, so you get a fair warning.
const WINDUP = 0.8, WINDUP_JITTER = 0.25;
import { Projectiles, fireWeapon, segSphere } from './projectiles.js';
import { genLoot, genItem } from './gen/items.js';
import { Q } from './quality.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// A simple rifle shown in first person, parented to the camera.
function buildViewGun() {
  const g = new THREE.Group();
  const dark = mat(0x3b424b, { metal: 0.35, rough: 0.5 }), mid = mat(0x5d6875, { metal: 0.3, rough: 0.5 }), glow = mat(0x4dd6ff, { emissive: 0x4dd6ff, ei: 1.2 });
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  box(0.07, 0.09, 0.42, mid, 0, 0, 0);            // receiver
  box(0.035, 0.035, 0.34, dark, 0, 0.015, -0.36); // barrel
  box(0.05, 0.12, 0.06, dark, 0, -0.09, 0.06);    // grip
  box(0.06, 0.08, 0.16, dark, 0, -0.01, 0.26);    // stock
  box(0.04, 0.03, 0.12, dark, 0, 0.065, -0.02);   // sight rail
  box(0.012, 0.012, 0.2, glow, 0.037, 0.01, -0.08); // power strip
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.015, -0.55); g.add(muzzle);
  g.userData.muzzle = muzzle;
  g.scale.setScalar(0.62);
  g.traverse((o) => { if (o.isMesh) { o.renderOrder = 10; o.frustumCulled = false; } });
  return g;
}

class Actor {
  constructor(mode, spec) {
    Object.assign(this, spec);
    this.mode = mode; this.alive = true; this.cool = Math.random(); this.reaction = 0.4 + Math.random() * 0.5;
    this.pos = this.mesh.position; this.vel = new THREE.Vector3(); this.velY = 0;
    this.radius = this.mesh.userData.radius || 0.6; this.height = this.mesh.userData.height || 2;
    this.home = this.pos.clone(); this.wanderT = 0; this.wanderTo = this.pos.clone(); this.walkT = Math.random() * 10;
    this.hpMax = this.hp; this.shield = this.shieldMax || 0;
  }
  get center() { return _v2.copy(this.pos).setY(this.pos.y + this.height * 0.55); }
  hit(dmg, dtype, src) {
    if (!this.alive) return;
    const d = DAMAGE_TYPES[dtype] || DAMAGE_TYPES.energy;
    if (this.shield > 0) { const sd = dmg * d.shield; if (sd <= this.shield) { this.shield -= sd; this.aggroOn(src); return; } dmg = (sd - this.shield) / d.shield; this.shield = 0; }
    this.hp -= dmg * d.hull * (100 / (100 + (this.armor || 0) * 4));
    this.aggroOn(src);
    if (this.hp <= 0) this.mode.actorDown(this, src);
  }
  aggroOn(src) {
    const o = src && src.owner;
    if (!o) return;
    if (o.isPlayer && this.team === 'p') this.mode.betray(this);
    this.target = o;
  }
}

// Hit-test proxy so projectiles hit the body center, not the feet
function hitProxy(a) {
  return { get alive() { return a.alive; }, get pos() { return a.center; }, get radius() { return a.radius + 0.25; }, actor: a, hit: (d, t, s) => a.hit(d, t, s), team: a.team };
}

export class OnFootMode {
  constructor(game, env) {
    this.game = game; this.U = game.U; this.env = env; this.kind = env.type; this.time = 0;
    this.actors = []; this.crates = []; this.deposits = []; this.yaw = 0; this.pitch = -0.1; this.wIdx = 0;
    this.rng = new RNG(Date.now() & 0xffffff);
  }
  init() {
    const g = this.game, env = this.env;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, env.type === 'interior' ? 140 : Q.drawDist + 80);
    const spawn = env.build(this.scene, this);
    // player
    const sp = this.U.species[g.player.species || 0];
    this.pmesh = buildCharacter(sp, g.player.seed || 7, 0x2f6f8f, { role: 'captain' });
    this.scene.add(this.pmesh);
    // first-person view: hide your body and show a rifle held in front of the camera
    this.fp = g.settings.footView === 1;
    this.scene.add(this.camera);
    this.viewGun = buildViewGun(); this.camera.add(this.viewGun);
    this.ps = personalStats(g.player);
    const P = g.player;
    this.me = {
      isPlayer: true, alive: true, team: 'p', mesh: this.pmesh, pos: this.pmesh.position, velY: 0, onGround: true, radius: 0.55,
      hp: P.hp * this.ps.hpMax, shield: P.pshield * this.ps.pShieldMax, lastHit: -9,
      hit: (dmg, dtype) => this.playerHit(dmg, dtype),
    };
    this.me.pos.copy(spawn.pos); this.yaw = spawn.yaw || 0;
    this.meProxy = { get alive() { return true && thisRef.me.alive; }, get pos() { return _v.copy(thisRef.me.pos).setY(thisRef.me.pos.y + 1.3); }, radius: 0.75, isPlayer: true, team: 'p', hit: (d, t) => this.playerHit(d, t) };
    const thisRef = this;
    this.exit = spawn.exit;
    this.proj = new Projectiles(this.scene, {
      scale: 1, max: 300,
      canHit: (o, t) => {
        if (!o) return false;
        const ot = o.isPlayer ? 'p' : o.team, tt = t.isPlayer ? 'p' : t.team;
        if (o.isPlayer) return !t.isPlayer;
        return ot !== tt || (t.actor && t.actor === o.target) || (t.isPlayer && o.target && o.target.isPlayer);
      },
      onHit: (t, dmg, dtype, p, crit) => { t.hit(dmg, dtype, p); if (p.owner && p.owner.isPlayer) { this.game.ui.hitMarker(crit); if (p.leech) this.me.hp = Math.min(this.ps.hpMax, this.me.hp + dmg * p.leech); } },
      collideWorld: (pos) => this.env.blocksShot(pos),
    });
    for (const a of env.actors) this.addActor(a);
    for (const c of env.crates) this.addCrate(c);
    for (const d of env.deposits || []) this.addDeposit(d);
    this.camPos = this.me.pos.clone().add(new THREE.Vector3(0, 3, 6));
    g.ui.setMode('foot');
    g.ui.toast(env.title, '#9fd8ff');
  }
  addActor(spec) {
    let mesh;
    if (spec.kind === 'creature') mesh = buildCreature(spec.seed, spec.level, spec.name === 'Ruin Guardian' ? 'guardian' : null);
    else { const sp = this.U.species[spec.npc.species]; const fc = spec.npc.faction !== null ? this.U.factions[spec.npc.faction].color : 0x666666; mesh = buildCharacter(sp, spec.npc.seed, new THREE.Color(fc).multiplyScalar(0.6).getHex(), { role: spec.captain ? 'captain' : spec.npc.role, boss: !!spec.boss }); }
    mesh.position.copy(spec.pos); mesh.position.y = this.env.height(spec.pos.x, spec.pos.z);
    mesh.rotation.y = this.rng.range(0, 6.28);
    this.scene.add(mesh);
    const a = new Actor(this, { ...spec, mesh, hp: spec.hp || (spec.npc ? spec.npc.hp : 40 + spec.level * 12), armor: spec.level * 1.5 });
    a.proxy = hitProxy(a);
    this.actors.push(a);
    return a;
  }
  addCrate(c) {
    const color = c.locked ? 0xff5a5a : c.relic ? 0xb766ff : 0xffc94d;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), mat(0x3a3f48, { metal: 0.6 }));
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.12, 0.85), mat(color, { emissive: color, ei: 1 }));
    m.add(strip); m.add(glowSprite(color, 2.5, 0.6));
    m.position.copy(c.pos); m.position.y = this.env.height(c.pos.x, c.pos.z) + 0.4; m.rotation.y = this.rng.range(0, 6);
    this.scene.add(m);
    this.crates.push({ ...c, mesh: m, pos: m.position, opened: false });
  }
  addDeposit(d) {
    const col = d.commodity === 'crystal' ? 0x8f6fff : d.commodity === 'relic' ? 0xffd34d : 0xb08060;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), mat(col, { emissive: col, ei: 0.5, metal: 0.8, rough: 0.2 }));
    m.scale.set(1, 1.6, 1); m.position.copy(d.pos); m.position.y = this.env.height(d.pos.x, d.pos.z) + 1;
    m.add(glowSprite(col, 4, 0.5));
    this.scene.add(m); this.deposits.push({ ...d, mesh: m, pos: m.position });
  }

  playerHit(dmg, dtype) {
    if (!this.me.alive) return;
    const d = DAMAGE_TYPES[dtype] || DAMAGE_TYPES.energy;
    this.me.lastHit = this.time; this.game.ui.damageFlash();
    if (this.me.shield > 0) { const sd = dmg * d.shield; if (sd <= this.me.shield) { this.me.shield -= sd; return; } dmg = (sd - this.me.shield) / d.shield; this.me.shield = 0; }
    this.me.hp -= dmg * d.hull * (100 / (100 + this.ps.armor * 4));
    if (this.me.hp <= 0) { this.me.alive = false; this.game.onPlayerDeath('foot'); }
  }
  betray(a) {
    const fac = a.npc && a.npc.faction;
    for (const o of this.actors) if (o.team === 'p' && o.alive && (o.npc?.faction === fac) && o.pos.distanceTo(a.pos) < 45) { o.team = 'h'; o.proxy.team = 'h'; o.target = this.me; }
    a.team = 'h'; a.proxy.team = 'h';
    if (fac !== null && fac !== undefined && !this._betrayed) { this._betrayed = true; changeRep(this.U, this.game.player, fac, -8); this.game.ui.toast(`You attacked the ${this.U.factions[fac].name}!`, '#ff7a5a'); }
  }
  actorDown(a, src) {
    a.alive = false;
    this.proj.explosion(a.center.clone(), 1.5);
    this.scene.remove(a.mesh); disposeTree(a.mesh);
    const byPlayer = src && src.owner && src.owner.isPlayer;
    if (!byPlayer) return;
    const g = this.game;
    g.addXP(Math.round(10 + a.level * 6 * (a.boss ? 4 : 1)), a.name || 'Enemy down');
    if (a.npc && a.npc.faction !== null && a.team === 'h') { for (const f of this.U.factions) if ((f.relations[a.npc.faction] || 0) < -45) changeRep(this.U, g.player, f.id, 0.8); }
    if (a.missionId) g.missionProgress(a.missionId, 'kill');
    // drop
    const r = this.rng;
    const items = [];
    if (a.npc && r.chance(0.45)) { const it = JSON.parse(JSON.stringify(a.npc.weapon)); it.id = 'i' + Math.random().toString(36).slice(2); items.push(it); }
    if (r.chance(0.35 + this.ps.luck) || a.boss) items.push(genLoot(r, a.level, this.ps.luck + (a.boss ? 0.4 : 0)));
    if (items.length || r.chance(0.5)) this.addCrate({ pos: a.pos.clone(), items, credits: r.int(5, 25) * a.level, drop: true });
  }

  update(dt) {
    this.time += dt;
    const g = this.game, inp = g.input, gp = inp.gp, me = this.me, ps = this.ps, env = this.env;
    if (me.alive) {
      // look
      const sens = 0.0024;
      this.yaw -= inp.dx * sens; this.pitch -= inp.dy * sens;
      if (inp.down('ArrowLeft')) this.yaw += dt * 2.2; if (inp.down('ArrowRight')) this.yaw -= dt * 2.2;
      if (inp.down('ArrowUp')) this.pitch += dt * 1.6; if (inp.down('ArrowDown')) this.pitch -= dt * 1.6;
      if (gp && !gp.touch) { this.yaw -= gp.rx * dt * 3; this.pitch -= gp.ry * dt * 2.2; }
      this.pitch = clamp(this.pitch, -1.2, 1.0);
      // move
      let mx = 0, mz = 0;
      if (inp.down('KeyW')) mz -= 1; if (inp.down('KeyS')) mz += 1; if (inp.down('KeyA')) mx -= 1; if (inp.down('KeyD')) mx += 1;
      if (gp) { mx += gp.lx; mz += gp.ly; }
      const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
      const sprint = (inp.down('ShiftLeft') || inp.gpDown(10)) ? 1.6 : 1;
      const spd = ps.move * sprint;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const vx = (mx * cos + mz * sin) * spd, vz = (-mx * sin + mz * cos) * spd;
      me.pos.x += vx * dt; me.pos.z += vz * dt;
      env.collide(me.pos, me.radius);
      const gy = env.height(me.pos.x, me.pos.z);
      if ((inp.pressed('Space') || inp.gpPressed(0)) && me.onGround) { me.velY = ps.jump * Math.sqrt(1 / env.gravity); me.onGround = false; }
      me.velY -= 25 * env.gravity * dt; me.pos.y += me.velY * dt;
      if (me.pos.y <= gy) { me.pos.y = gy; me.velY = 0; me.onGround = true; }
      if (env.ceiling && me.pos.y > env.ceiling - 2.4) { me.pos.y = env.ceiling - 2.4; me.velY = Math.min(0, me.velY); }
      const moving = ml > 0.05;
      const firing = inp.mouse(0) || (gp && gp.rt > 0.4);
      this.pmesh.rotation.y = this.yaw;
      if (moving) this.walkT = (this.walkT || 0) + dt * sprint;
      // Rifle up whenever you're fighting or standing; carried at low ready while sprinting.
      const sinceFire = this.time - (this.lastFire ?? -9);
      const aimW = !ps.weapons.length ? 0 : (sprint > 1 && moving && sinceFire > 1.2) ? 0.3 : 1;
      animateCharacter(this.pmesh, dt, { walkT: this.walkT || 0, speed: moving ? spd : 0, aim: aimW, pitch: this.pitch, kick: this.kick || 0 });
      this.kick = 0;
      // weapons
      if (inp.pressed('Digit1')) this.wIdx = 0; if (inp.pressed('Digit2') || inp.gpPressed(3)) this.wIdx = ps.weapons.length > 1 ? 1 - this.wIdx : 0;
      if (this.wIdx >= ps.weapons.length) this.wIdx = 0;
      const w = ps.weapons[this.wIdx];
      if (w) {
        if (w._mag === undefined) w._mag = w.weapon.mag;
        if (this.reloading > 0) { this.reloading -= dt; if (this.reloading <= 0) w._mag = w.weapon.mag; }
        if ((inp.pressed('KeyR') || inp.gpPressed(2)) && w._mag < w.weapon.mag && !(this.reloading > 0)) this.reloading = w.weapon.reload * ps.weaponMods.reload;
        this.fireCool = (this.fireCool || 0) - dt;
        if (firing && this.fireCool <= 0 && !(this.reloading > 0)) {
          if (w._mag <= 0) this.reloading = w.weapon.reload * ps.weaponMods.reload;
          else {
            w._mag--; this.fireCool = 1 / (w.weapon.rate * ps.weaponMods.rate);
            const origin = (this.fp ? this.viewGun.userData.muzzle.getWorldPosition(new THREE.Vector3()) : muzzleWorld(this.pmesh) || new THREE.Vector3(0.55, 1.55, -0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).add(me.pos)).clone();
            this.lastFire = this.time; this.kick = 1;
            const aim = this.aimPoint();
            fireWeapon(this.proj, w, origin, aim.sub(origin).normalize(), this.meProxy, ps.weaponMods, null, this.aimActor);
            this.recoil = 0.03;
          }
        }
      }
      // medkit
      if (inp.pressed('KeyH') || inp.gpPressed(13)) this.useMedkit();
      if (inp.pressed('KeyV') || inp.gpPressed(11)) this.cycleView();
      // regen + hazard
      if (this.time - me.lastHit > 3) me.shield = Math.min(ps.pShieldMax, me.shield + ps.pShieldRegen * dt);
      if (env.hazard) { const hz = env.hazard * 0.5 * ps.hazard * dt; if (me.shield > 0) me.shield = Math.max(0, me.shield - hz); else { me.hp -= hz * 0.5; if (me.hp <= 0) { me.alive = false; g.onPlayerDeath('foot'); } } }
      // interact
      this.interact = this.findInteract();
      if (this.interact && (inp.pressed('KeyE') || inp.gpPressed(1))) this.doInteract(this.interact);
      // bounds
      if (env.bound) { me.pos.x = clamp(me.pos.x, -env.bound, env.bound); me.pos.z = clamp(me.pos.z, -env.bound, env.bound); }
    }
    for (const a of this.actors) if (a.alive) this.updateActor(a, dt);
    this.actors = this.actors.filter(a => a.alive);
    const targets = [this.meProxy, ...this.actors.map(a => a.proxy)];
    this.proj.update(dt, targets);
    for (const c of this.crates) c.mesh.rotation.y += dt * 0.3;
    for (const d of this.deposits) d.mesh.rotation.y += dt * 0.8;
    env.update && env.update(dt, this);
    this.updateCamera(dt);
    this.updateHud();
  }
  aimPoint() {
    const cam = this.camera; const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let best = null, bt = 250;
    for (const a of this.actors) {
      const c = a.center; const toC = _v.copy(c).sub(cam.position); const t = toC.dot(dir);
      if (t < 0 || t > bt) continue;
      const perp = toC.addScaledVector(dir, -t).length();
      // generous snap for touch/gamepad aiming
      const tol = this.game.input.lastDevice === 'kbm' ? 0.4 : 1.2 + t * 0.06;
      if (perp < a.radius + tol && (a.team === 'h' || tol < 1)) { bt = t; best = a; }
    }
    this.aimActor = best ? best.proxy : null;
    if (best) return best.center.clone();
    // march to world
    const p = cam.position.clone();
    for (let t = 2; t < 200; t += 1.5) { p.copy(cam.position).addScaledVector(dir, t); if (this.env.blocksShot(p)) break; }
    return p;
  }
  useMedkit() {
    const g = this.game; const idx = g.player.inventory.findIndex(i => i.kind === 'medkit');
    if (idx < 0) return g.ui.toast('No medkits', '#ff7a5a');
    const mk = g.player.inventory.splice(idx, 1)[0];
    this.me.hp = Math.min(this.ps.hpMax, this.me.hp + mk.heal * this.ps.healPct);
    g.ui.toast(`+${Math.round(mk.heal * this.ps.healPct)} health`, '#7ee08a');
  }
  updateActor(a, dt) {
    const env = this.env, me = this.me;
    // pick target
    a.reaction -= dt;
    if (a.reaction <= 0) {
      a.reaction = 0.5;
      if (a.team === 'h') { if (me.alive && me.pos.distanceTo(a.pos) < a.aggro) a.target = this.me; else if (a.target === this.me && me.pos.distanceTo(a.pos) > a.aggro * 1.8) a.target = null; }
      if (!a.target || (a.target.alive === false)) {
        a.target = null;
        for (const o of this.actors) if (o !== a && o.alive && o.team !== a.team && o.pos.distanceTo(a.pos) < 30) { a.target = o; break; }
        if (a.team === 'h' && me.alive && me.pos.distanceTo(a.pos) < a.aggro) a.target = this.me;
      }
    }
    let moveTo = null, speed = a.kind === 'creature' ? 6 + a.level * 0.1 : 4.5;
    const t = a.target && (a.target.isPlayer ? (me.alive ? me : null) : (a.target.alive ? a.target : null));
    if (t) {
      const d = t.pos.distanceTo(a.pos);
      a.mesh.rotation.y = Math.atan2(-(t.pos.x - a.pos.x), -(t.pos.z - a.pos.z));
      if (a.kind === 'creature') {
        if (d > a.radius + 1.6) moveTo = t.pos; else if ((a.cool -= dt) <= 0) { a.cool = 1.1; a.lunge = 1; const dm = 6 + a.level * 3.2; t.isPlayer ? this.playerHit(dm, 'kinetic') : t.hit(dm, 'kinetic', { owner: a }); }
        speed *= 1.25;
      } else {
        const w = a.npc.weapon.weapon;
        const pref = Math.min(18, w.range * 0.5);
        if (d > pref) moveTo = t.pos; else if (d < pref * 0.5) moveTo = _v.copy(a.pos).sub(t.pos).add(a.pos);
        a.cool -= dt;
        // Aim in again whenever the target changes or steps out of range.
        if (t !== a.aimTgt || d >= w.range) { a.aimTgt = t; a.windMax = WINDUP + Math.random() * WINDUP_JITTER; a.windup = a.windMax; a.aimCue = false; }
        else if (a.windup > 0) {
          a.windup -= dt;
          if (!a.aimCue && t.isPlayer) { a.aimCue = true; this.game.audio.aimIn(d); }
        }
        if (a.cool <= 0 && d < w.range && a.windup <= 0) {
          a.cool = 1 / w.rate * (1.4 + Math.random());
          const mz = muzzleWorld(a.mesh); const origin = mz ? mz.clone() : a.center.clone().setY(a.center.y + 0.2);
          a.kick = 1;
          const tgt = t.isPlayer ? this.meProxy.pos.clone() : t.center.clone();
          tgt.x += (Math.random() - 0.5) * 1.6; tgt.y += (Math.random() - 0.5) * 1.2;
          fireWeapon(this.proj, a.npc.weapon, origin, tgt.sub(origin).normalize(), a, { dmg: 0.5, rate: 1, vel: 1 }, null);
        }
      }
    } else {
      a.wanderT -= dt;
      if (a.wanderT <= 0) { a.wanderT = 3 + Math.random() * 5; a.wanderTo.copy(a.home).add(new THREE.Vector3((Math.random() - .5) * 16, 0, (Math.random() - .5) * 16)); }
      if (!a.stationary && a.wanderTo.distanceTo(a.pos) > 1.5) { moveTo = a.wanderTo; speed *= 0.35; }
      if (a.team === 'p' && me.alive && me.pos.distanceTo(a.pos) < 6) { a.mesh.rotation.y = Math.atan2(-(me.pos.x - a.pos.x), -(me.pos.z - a.pos.z)); moveTo = null; }
    }
    if (moveTo) {
      const dir = _v.copy(moveTo).sub(a.pos).setY(0); const l = dir.length();
      if (l > 0.1) {
        dir.multiplyScalar(speed * dt / l); a.pos.add(dir);
        if (!t) a.mesh.rotation.y = Math.atan2(-dir.x, -dir.z);
        env.collide(a.pos, a.radius);
        a.walkT += dt;
        a.moving = speed;
      }
    }
    if (a.kind === 'creature') { animateCreature(a.mesh, dt, { walkT: a.walkT, speed: a.moving || 0, lunge: a.lunge || 0 }); a.moving = 0; a.lunge = 0; }
    else {
      let pitch = 0;
      if (t) { const tp = t.isPlayer ? this.meProxy.pos : t.center; pitch = Math.atan2(tp.y - (a.pos.y + a.height * 0.62), Math.hypot(tp.x - a.pos.x, tp.z - a.pos.z)); }
      animateCharacter(a.mesh, dt, { walkT: a.walkT, speed: a.moving || 0, aim: t ? 1 : 0, pitch: clamp(pitch, -0.9, 0.9), kick: a.kick || 0 });
      this.aimTell(a, t, dt);
      a.moving = 0; a.kick = 0;
    }
    a.pos.y = env.height(a.pos.x, a.pos.z);
    if (env.bound) { a.pos.x = clamp(a.pos.x, -env.bound, env.bound); a.pos.z = clamp(a.pos.z, -env.bound, env.bound); }
  }
  // Muzzle glow that builds up while an NPC aims in, flares as it fires, then fades.
  aimTell(a, t, dt) {
    const mz = a.mesh.userData.muzzle; if (!mz) return;
    if (!a.tell) { a.tell = glowSprite(a.team === 'h' ? 0xff5030 : 0x6fdcff, 1, 0); a.tell.visible = false; mz.add(a.tell); }
    const s = a.tell, m = s.material;
    let op, sc;
    if (t && a.windup > 0 && a.windMax) {
      const k = 1 - a.windup / a.windMax;
      op = 0.25 + 0.7 * k * (0.85 + 0.15 * Math.sin(this.time * 40));
      sc = 0.35 + 0.95 * k;
    } else if (a.kick) { op = 1; sc = 1.5; }
    else { op = Math.max(0, m.opacity - dt * 5); sc = s.scale.x; }
    // keep the tell readable at range: past 15 m it stops shrinking with distance
    if (op > 0.01) sc *= Math.max(1, this.camera.position.distanceTo(a.pos) / 15);
    m.opacity = op; s.scale.setScalar(sc); s.visible = op > 0.01;
  }
  findInteract() {
    const p = this.me.pos;
    if (this.exit && p.distanceTo(this.exit.pos) < this.exit.r) return { type: 'exit', label: this.exit.label };
    let best = null, bd = 3.2;
    for (const a of this.actors) if (a.team === 'p' && a.npc) { const d = a.pos.distanceTo(p); if (d < bd) { bd = d; best = { type: 'talk', a, label: `Talk to ${a.npc.name} (${a.npc.roleName})` }; } }
    for (const c of this.crates) { const d = c.pos.distanceTo(p); if (d < bd) { bd = d; best = { type: 'crate', c, label: c.locked ? `Hack locked cache (Hacking ${c.locked})` : c.drop ? 'Loot' : c.relic ? 'Open relic vault' : 'Open cache' }; } }
    for (const dp of this.deposits) { const d = dp.pos.distanceTo(p); if (d < bd + 0.8) { bd = d; best = { type: 'mine', d: dp, label: `Extract ${dp.label}` }; } }
    return best;
  }
  doInteract(it) {
    const g = this.game;
    if (it.type === 'exit') this.env.onExit(this);
    else if (it.type === 'talk') g.ui.talk(it.a.npc, this, it.a);
    else if (it.type === 'crate') {
      const c = it.c;
      if (c.locked && this.ps.hack < c.locked) return g.ui.toast(`Needs Hacking rank ${c.locked}`, '#ff7a5a');
      const r = this.rng;
      const items = c.items || [];
      if (!c.items) { const n = c.relic ? 2 : 1 + (r.chance(0.4) ? 1 : 0); for (let i = 0; i < n; i++) items.push(genLoot(r, c.level || this.env.level, this.ps.luck + (c.locked ? 0.25 * c.locked : 0) + (c.relic ? 0.5 : 0))); }
      for (const itm of items) g.giveItem(itm);
      if (c.credits) g.addCredits(c.credits);
      if (c.relic) { g.addCargo('relic', 1); g.addXP(40 + this.env.level * 10, 'Relic recovered'); }
      if (c.locked) g.addXP(15 * c.locked, 'Cache hacked');
      if (c.missionId) g.missionProgress(c.missionId, 'loot');
      this.scene.remove(c.mesh); disposeTree(c.mesh); this.crates.splice(this.crates.indexOf(c), 1);
    } else if (it.type === 'mine') {
      const d = it.d;
      const n = Math.max(1, Math.round(d.amount * this.ps.mining));
      const got = g.addCargo(d.commodity, n);
      if (got > 0) { g.ui.toast(`+${got} ${d.label}`, '#ffd34d'); g.addXP(4 + got, null); this.scene.remove(d.mesh); disposeTree(d.mesh); this.deposits.splice(this.deposits.indexOf(d), 1); }
    }
  }
  cycleView() {
    this.fp = !this.fp;
    this.game.settings.footView = this.fp ? 1 : 0; this.game.persistSettings();
    this.game.ui.toast(this.fp ? 'First-person view' : 'Third-person view', '#9fd8ff');
  }
  updateCamera(dt) {
    const me = this.me, cam = this.camera;
    this.pmesh.visible = !this.fp; this.viewGun.visible = this.fp && this.ps.weapons.length > 0;
    if (this.fp) {
      // eyes sit just below the top of the head; the view rifle bobs while walking and kicks when firing
      const h = this.pmesh.userData.height || 2.3;
      cam.position.set(me.pos.x, me.pos.y + h * 0.86, me.pos.z);
      cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.recoil = Math.max(0, (this.recoil || 0) - dt * 0.2);
      cam.rotation.x += this.recoil;
      const vg = this.viewGun, bob = this.walkT || 0;
      this.gunKick = Math.max(0, (this.gunKick || 0) - dt * 6);
      if (this.time - (this.lastFire ?? -9) < 0.02) this.gunKick = 1;
      vg.position.set(0.2 + Math.sin(bob * 5) * 0.008, -0.2 + Math.abs(Math.cos(bob * 5)) * 0.008, -0.58 + this.gunKick * 0.04);
      vg.rotation.set(this.gunKick * 0.08, 0.05, 0);
      return;
    }
    const head = _v.copy(me.pos); head.y += 1.9;
    const dist = this.env.type === 'interior' ? 3.9 : 4.8;
    const off = new THREE.Vector3(1.1, 0.45, dist);
    off.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    const want = head.clone().add(off);
    // keep camera out of walls
    const step = want.clone().sub(head); const L = step.length(); step.divideScalar(L);
    const probe = head.clone(); let ok = L;
    for (let t = 0.3; t <= L; t += 0.25) { probe.copy(head).addScaledVector(step, t); if (this.env.blocksShot(probe)) { ok = t - 0.35; break; } }
    want.copy(head).addScaledVector(step, Math.max(0.4, ok));
    cam.position.copy(want);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.recoil = Math.max(0, (this.recoil || 0) - dt * 0.2);
    cam.rotation.x += this.recoil;
  }
  updateHud() {
    const ui = this.game.ui, me = this.me, ps = this.ps;
    const w = ps.weapons[this.wIdx];
    ui.footHud({
      hp: me.hp / ps.hpMax, shield: me.shield / ps.pShieldMax, hpTxt: `${Math.ceil(Math.max(0, me.hp))}/${Math.round(ps.hpMax)}`, shieldTxt: `${Math.ceil(me.shield)}/${Math.round(ps.pShieldMax)}`,
      weapon: w ? w.name : 'Unarmed', tier: w ? w.tier : 0, ammo: w ? (this.reloading > 0 ? 'Reloading…' : `${w._mag ?? w.weapon.mag} / ${w.weapon.mag}`) : '',
      medkits: this.game.player.inventory.filter(i => i.kind === 'medkit').length, hazard: this.env.hazard,
    });
    ui.prompt(this.interact ? `E · ${this.interact.label}` : null);
    const bars = [];
    for (const a of this.actors) {
      const d = a.pos.distanceTo(me.pos); if (d > 45) continue;
      const top = a.pos.clone(); top.y += a.height + 0.5;
      const v = top.project(this.camera); if (v.z > 1) continue;
      bars.push({ x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, f: a.hp / a.hpMax, hostile: a.team === 'h', name: d < 18 ? (a.npc ? a.npc.name : a.name) + ` · ${a.level}` : '' });
    }
    ui.worldBars(bars);
    if (this.exit) { const v = this.exit.pos.clone(); v.y += 3; v.project(this.camera); ui.navMarkers(v.z < 1 ? [{ name: this.exit.label.replace(/^.*?· /, ''), d: Math.round(this.exit.pos.distanceTo(me.pos)), s: { x: (v.x * .5 + .5) * innerWidth, y: (-v.y * .5 + .5) * innerHeight }, c: '#9fd8ff' }] : []); }
    ui.radar(this.actors.filter(a => a.pos.distanceTo(me.pos) < 80).map(a => { const rel = a.pos.clone().sub(me.pos).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw); return { x: rel.x / 80, z: rel.z / 80, y: 0, c: a.team === 'h' ? '#ff4d4d' : '#7ee08a' }; }));
  }
  savePlayer() { const P = this.game.player; P.hp = Math.max(0.1, this.me.hp / this.ps.hpMax); P.pshield = this.me.shield / this.ps.pShieldMax; }
  refreshStats() { this.ps = personalStats(this.game.player); }
  resume() { this.refreshStats(); this.game.ui.setMode('foot'); }
  dispose() { this.proj.clear(); disposeTree(this.scene); }
}
