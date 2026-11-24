import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { genUniverse, getSystem, dist } from './gen/universe.js';
import { genItem } from './gen/items.js';
import { newPlayer, xpForLevel, shipStats, changeRep, cargoUsed, SHIP_SLOTS, PERSONAL_SLOTS, slotAccepts } from './player.js';
import { HULL_CLASSES, TIERS } from './data.js';
import { COMMODITIES } from './gen/items.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Music } from './music.js';
import { SpaceMode } from './space.js';
import { OnFootMode } from './onfoot.js';
import { makeGroundEnv } from './ground.js';
import { makeInteriorEnv } from './interior.js';
import { planetTexture, nebulaTexture, starfield, glowSprite, litMat, texJobs } from './models.js';
import { Q, PRESETS, detectTier, FrameGovernor, applyPreset } from './quality.js';
import { Touch } from './touch.js';
import { RNG } from './rng.js';

const SAVE_KEY = 'starward-save-v1';
// Seconds the jump drive takes to spool up when hostiles are close.
const JUMP_SPOOL = 4;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.settings = { bloom: true, quality: 'auto', autoQuality: true, showFps: false };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('starward-settings') || '{}')); } catch (e) {}
    const coarse = matchMedia('(pointer: coarse)').matches;
    const aa = !coarse && devicePixelRatio < 1.5 && this.settings.quality !== 0;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: aa, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    let tier = this.settings.quality === 'auto' ? detectTier(this.renderer) : +this.settings.quality;
    if (this.settings.quality === 'auto' && this.settings.autoTier !== undefined) tier = Math.min(tier, this.settings.autoTier);
    this.tier = tier; applyPreset(tier);
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.5, 0.82);
    const bloomSize = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (w, h) => bloomSize(Math.max(64, Math.round(w * Q.bloomRes * 2)), Math.max(64, Math.round(h * Q.bloomRes * 2)));
    this.composer.addPass(this.renderPass); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.governor = new FrameGovernor(this);
    this.applyResolution();
    this.input = new Input(this.canvas);
    this.touch = new Touch(this); this.input.touchSource = this.touch;
    // Esc (or alt-tab) frees the mouse without a key event reaching the page: pause instead of
    // letting the cursor take over steering.
    this.input.onLockLost = () => { if (this.mode && !this.ui.modal && !this.jumping && !this.touch.active) { this.lockLostAt = performance.now(); this.ui.pause(); } };
    this.input.onKey = () => { if (this.touch.active) { this.touch.active = false; this.input.touchActive = false; document.body.classList.remove('is-touch'); this.touch.refreshVisible(); } };
    this.audio = new Audio();
    this.music = new Music(this);
    if (this.settings.sfxVol !== undefined) this.audio.vol = 0.35 * this.settings.sfxVol;
    this.ui = new UI(this);
    this.modes = [];
    this.clock = new THREE.Clock();
    addEventListener('resize', () => this.resize());
    // Browsers only allow sound after a user gesture: any click, key or tap unlocks music and effects.
    for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, () => { this.audio.ensure(); this.music.unlock(); }, { passive: true });
    this.canvas.addEventListener('click', () => { this.audio.ensure(); if (!this.ui.modal && this.mode && !this.touch.active) this.input.requestLock(); });
    addEventListener('keydown', () => this.audio.ensure(), { once: true });
    addEventListener('touchend', () => this.audio.ensure(), { once: true });
    this.fpsEl = document.getElementById('fps');
    this.texJobs = texJobs; this.getSystem = (id) => getSystem(this.U, id);
    this.buildTitleScene();
    this.ui.title();
    this.saveTimer = 60;
    this.loop();
  }
  get mode() { return this.modes[this.modes.length - 1]; }
  applyResolution() {
    const dpr = Math.max(0.5, Math.min(devicePixelRatio || 1, Q.maxDpr) * this.governor.scale);
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setPixelRatio(dpr); this.composer.setSize(innerWidth, innerHeight);
  }
  setTier(t, auto) {
    if (t === this.tier) return;
    this.tier = t; applyPreset(t);
    if (auto) { this.settings.autoTier = t; this.ui.toast(`Graphics set to ${PRESETS[t].name} to keep things smooth`, '#9fd8ff'); }
    this.persistSettings();
    this.applyResolution();
  }
  persistSettings() { try { localStorage.setItem('starward-settings', JSON.stringify(this.settings)); } catch (e) {} }
  renderFrame(scene, camera) {
    if (this.mode && this.mode.proj) this.mode.proj.setCamera(camera, this.renderer), this.mode.proj.fxBudget = Q.fx;
    const useBloom = this.settings.bloom && Q.bloom;
    if (useBloom) { this.renderPass.scene = scene; this.renderPass.camera = camera; this.composer.render(); }
    else this.renderer.render(scene, camera);
  }
  resize() {
    this.applyResolution();
    for (const m of this.modes) { m.camera.aspect = innerWidth / innerHeight; m.camera.updateProjectionMatrix(); }
    if (this.title) { this.title.camera.aspect = innerWidth / innerHeight; this.title.camera.updateProjectionMatrix(); }
    if (this.ui.modal === 'menu' && this.ui.tab === 'galaxy') this.ui.drawMap();
  }
  buildTitleScene() {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 1, 300000);
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(200000, 24, 12), new THREE.MeshBasicMaterial({ map: nebulaTexture(11, 0.62), side: THREE.BackSide })));
    scene.add(starfield());
    const pl = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), litMat({ map: planetTexture({ biome: 'ocean', seed: 1234 }, Math.max(256, Q.planetRes)), roughness: 0.9 }));
    pl.position.set(700, -300, -3000); scene.add(pl); pl.add(glowSprite(0x8fc8ff, 2500, 0.5));
    const sun = new THREE.DirectionalLight(0xffeedd, 2.5); sun.position.set(-1, 0.4, 0.6); scene.add(sun); scene.add(new THREE.AmbientLight(0x404060, 0.4));
    this.title = { scene, camera, pl };
  }
  previewUniverse(seed) { if (!this._prev || this._prev.seed !== seed) this._prev = genUniverse(seed); return this._prev; }

  // ---------------- Lifecycle ----------------
  newGame(seed, name, species) {
    this.U = this.previewUniverse(seed);
    this.player = newPlayer(this.U, name);
    this.player.species = species; this.player.seed = Math.floor(Math.random() * 1e9);
    this.player.lastDock = { sysId: this.U.startSystem, stationId: 0 };
    this.stockCache = {}; this.boardCache = {}; this.barCache = {};
    this.startSpace(this.U.startSystem, { type: 'undock', stationId: 0 });
    setTimeout(() => { const t = this.touch.active; this.ui.toast(t ? 'Welcome, captain. Left thumb steers, right thumb drags for throttle and roll.' : 'Welcome, captain. Click the view to capture the mouse. Press I for inventory, M for the galaxy map.', '#ffd34d'); this.ui.toast(t ? 'Fly close to the station and tap USE to dock for contracts, gear and crew.' : 'Dock at the station (fly close, press E) to find contracts, gear and crew.', '#9fd8ff'); }, 600);
    this.save(false);
  }
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  save(announce) {
    if (!this.player) return;
    const m = this.mode;
    if (m && m.kind === 'space') m.savePlayerShip();
    if (m && m.savePlayer) m.savePlayer();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ seed: this.U.seed, player: this.player }));
      this.persistSettings();
      if (announce) this.ui.toast('Game saved', '#7ee08a');
    } catch (e) { if (announce) this.ui.toast('Could not save in this browser', '#ff7a5a'); }
  }
  loadGame() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      this.U = genUniverse(d.seed); this.player = d.player;
      this.ui.modal = null; this.ui.overlay.style.display = 'none';
      this.stockCache = {}; this.boardCache = {}; this.barCache = {};
      const ld = this.player.lastDock || { sysId: this.player.systemId, stationId: 0 };
      const sys = getSystem(this.U, this.player.systemId);
      this.startSpace(this.player.systemId, sys.stations.length && ld.sysId === this.player.systemId ? { type: 'undock', stationId: ld.stationId } : { type: 'warp' });
      this.ui.toast('Flight record restored', '#7ee08a');
    } catch (e) { console.error(e); this.ui.toast('Save could not be loaded', '#ff7a5a'); }
  }
  clearModes() { while (this.modes.length) { const m = this.modes.pop(); m.dispose(); } }
  startSpace(sysId, arrival) {
    this.clearModes();
    this.player.systemId = sysId;
    if (!this.player.discovered.includes(sysId)) this.player.discovered.push(sysId);
    this.U.systems[sysId].visited = true;
    texJobs.clear();
    const s = new SpaceMode(this, sysId, arrival);
    this.modes.push(s); s.init(); this.ui.setMode('space');
  }

  // ---------------- Transitions ----------------
  jump(sysId) {
    const m = this.mode;
    if (!m || m.kind !== 'space') return this.ui.toast('Return to your ship to jump', '#ff7a5a');
    const here = this.U.systems[this.player.systemId], there = this.U.systems[sysId];
    if (dist(here, there) > shipStats(this.player).jumpRange) return this.ui.toast('Out of jump range — upgrade your engine or learn Astrogation', '#ff7a5a');
    // With hostiles close the drive needs a few seconds to spool up: you can run, but you have to survive the countdown.
    if (m.enemiesNear(1500)) {
      if (m.jumpSpool) return;
      if (this.ui.modal) this.ui.close();
      m.jumpSpool = { sysId, t: JUMP_SPOOL };
      return this.ui.toast(`Hostiles close — emergency jump in ${JUMP_SPOOL} seconds. Hold on!`, '#ffd34d');
    }
    this.doJump(sysId);
  }
  doJump(sysId) {
    const m = this.mode;
    if (!m || m.kind !== 'space') return;
    if (this.ui.modal) this.ui.close();
    m.savePlayerShip();
    this.ui.warpFx(true); this.audio.warp();
    this.jumping = true;
    setTimeout(() => {
      this.startSpace(sysId, { type: 'warp' });
      this.player.time += 60;
      this.ui.warpFx(false); this.jumping = false;
      this.save(false);
    }, 1300);
  }
  dock(space, station) {
    space.savePlayerShip();
    this.player.lastDock = { sysId: this.player.systemId, stationId: station.id };
    for (const m of this.player.missions) if (!m.done && m.type === 'delivery' && m.sysId === this.player.systemId && m.stationId === station.id) this.completeMission(m);
    space.player.vel.set(0, 0, 0); space.player.throttle = 0;
    let healed = 0; for (const c of this.player.crew) if (c.injured) { c.injured = false; healed++; }
    if (healed) this.ui.toast(`${healed} wingm${healed > 1 ? 'en' : 'an'} patched up and ready`, '#7ee08a');
    this.ui.sel = null;
    this.ui.openStation(station, space, 'market');
    this.save(false);
  }
  land(space, planet, site = null) {
    space.savePlayerShip();
    this.player.landed++;
    const sys = getSystem(this.U, this.player.systemId);
    for (const m of this.player.missions) if (!m.done && m.type === 'survey' && m.sysId === sys.id && m.planetId === planet.id) this.completeMission(m);
    this.landedPlanet = planet;
    const env = makeGroundEnv(this, sys, planet, site);
    this.pushFoot(env);
    setTimeout(() => this.ui.entryFx(false), 250);
    this.addXP(this.player.landed <= 50 ? 10 : 2, null);
  }
  board(space, ship, peaceful) {
    space.savePlayerShip();
    this.boardingShip = ship;
    const env = makeInteriorEnv(this, space, ship, peaceful);
    this.pushFoot(env);
  }
  pushFoot(env) {
    const f = new OnFootMode(this, env);
    this.modes.push(f); f.init();
    this.input.requestLock();
  }
  popFoot(f) {
    f.savePlayer();
    this.modes.pop(); f.dispose();
    const s = this.mode; s.resume();
    return s;
  }
  leaveSurface(f) {
    const s = this.popFoot(f);
    const pl = s.planets[this.landedPlanet.id];
    const out = pl.pos.clone().normalize();
    s.player.pos.copy(pl.pos).addScaledVector(out, pl.radius + 450);
    s.player.mesh.lookAt(pl.pos.clone().addScaledVector(out, pl.radius * 4)); s.player.quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    s.player.mesh.lookAt(s.player.pos.clone().addScaledVector(out, 10)); s.player.mesh.rotateY(Math.PI);
    s.camPos.copy(s.player.pos).addScaledVector(out, -40);
    this.ui.toast(`Launched from ${this.landedPlanet.name}`, '#9fd8ff');
  }
  leaveInterior(f) {
    const ship = this.boardingShip, env = f.env;
    const hostiles = f.actors.filter(a => a.alive && a.team === 'h').length;
    const btns = [];
    if (!env.peaceful && hostiles === 0) {
      btns.push({ label: `Claim the ${ship.def.clsName} as your ship`, fn: () => { this.ui.close(); this.finishBoarding(f, 'claim'); } });
      btns.push({ label: 'Strip it for salvage and scuttle', fn: () => { this.ui.close(); this.finishBoarding(f, 'scuttle'); } });
    }
    btns.push({ label: 'Leave', fn: () => { this.ui.close(); this.finishBoarding(f, 'leave'); } });
    btns.push({ label: 'Stay aboard', fn: () => this.ui.close() });
    const text = env.peaceful ? 'Return to your ship?' : hostiles ? `${hostiles} hostile crew still aboard. Leave anyway?` : 'The ship is yours. What now?';
    this.ui.interiorExit({ text, buttons: btns });
  }
  finishBoarding(f, how) {
    const ship = this.boardingShip, env = f.env;
    if (!env.peaceful) this.player.boarded++;
    const s = this.popFoot(f);
    if (how === 'claim') {
      const P = this.player, old = P.ship.cls;
      P.ship = { cls: ship.def.cls, name: ship.def.name, hull: 0.35, shield: 0, energy: 1, missiles: 0 };
      this.fitGearToHull();
      if (ship.def.loadout.weapons) for (const w of ship.def.loadout.weapons) if (P.inventory.length < 40) P.inventory.push(w);
      s.removeShip(ship);
      // rebuild player ship model
      const pos = s.player.pos.clone(), q = s.player.quat.clone();
      s.scene.remove(s.player.mesh);
      s.ships = s.ships.filter(x => x !== s.player);
      s.player = new (s.player.constructor)(s, { name: P.ship.name, cls: P.ship.cls, faction: null, level: P.level, seed: hashName(P.ship.name + P.ship.cls), loadout: {} }, { player: true });
      s.player.pos.copy(pos); s.player.quat.copy(q); s.scene.add(s.player.mesh); s.ships.push(s.player);
      this.addXP(60 + ship.level * 20, `Captured the ${ship.def.name}`);
      this.ui.toast(`Your old ${HULL_CLASSES.find(h => h.id === old).name} was left adrift. Repair your new ship at a station.`, '#ffd34d');
      if (ship.faction !== null) changeRep(this.U, P, ship.faction, -5);
    } else if (how === 'scuttle') {
      const r = new RNG(Date.now());
      for (let i = 0; i < 2; i++) this.giveItem(genItem(r, { level: ship.level, luck: 0.2 }));
      this.addCredits(80 + ship.level * 50, 'salvage'); this.addXP(30 + ship.level * 8, 'Ship scuttled');
      const parts = 6 + ship.level * 2 + Math.round(ship.hc.size * 4); this.player.parts = (this.player.parts || 0) + parts; this.ui.toast(`+${parts} parts salvaged`, '#9fd8ff');
      s.proj.explosion(ship.pos.clone(), 60); s.removeShip(ship);
    }
    this.save(false);
  }
  fitGearToHull() {
    const P = this.player, hc = HULL_CLASSES.find(h => h.id === P.ship.cls);
    for (let i = hc.slots + 1; i <= 4; i++) { const k = 'weapon' + i; if (P.equip[k]) { P.inventory.push(P.equip[k]); delete P.equip[k]; } }
    while (P.crew.length > hc.crew + Math.floor((P.skills.leadership || 0) / 2)) { const c = P.crew.pop(); this.ui.toast(`${c.name} left — not enough bunks`, '#ff7a5a'); }
  }
  buyShip(id) {
    const P = this.player, cur = HULL_CLASSES.find(h => h.id === P.ship.cls), h = HULL_CLASSES.find(x => x.id === id);
    const cost = Math.max(0, h.price - Math.round(cur.price * 0.45));
    if (P.credits < cost) return;
    this.addCredits(-cost);
    P.ship.cls = id; P.ship.hull = 1; P.ship.shield = 1;
    this.fitGearToHull();
    const s = this.modes[0];
    if (s && s.kind === 'space') {
      const pos = s.player.pos.clone(), q = s.player.quat.clone();
      s.scene.remove(s.player.mesh); s.ships = s.ships.filter(x => x !== s.player);
      s.player = new (s.player.constructor)(s, { name: P.ship.name, cls: P.ship.cls, faction: null, level: P.level, seed: hashName(P.ship.name + P.ship.cls), loadout: {} }, { player: true });
      s.player.pos.copy(pos); s.player.quat.copy(q); s.scene.add(s.player.mesh); s.ships.push(s.player);
    }
    this.ui.toast(`Purchased a ${h.name}!`, '#ffd34d');
  }
  onPlayerDeath(where) {
    this.input.releaseLock();
    setTimeout(() => this.ui.showDeath(where === 'space' ? 'Ship destroyed' : 'You were killed', () => this.respawn()), 1200);
  }
  respawn() {
    const P = this.player;
    P.credits = Math.round(P.credits * 0.85); P.cargo = {};
    P.hp = 1; P.pshield = 1; P.ship.hull = 1; P.ship.shield = 1; P.ship.energy = 1;
    const ld = P.lastDock || { sysId: this.U.startSystem, stationId: 0 };
    this.startSpace(ld.sysId, { type: 'undock', stationId: ld.stationId });
    this.save(false);
  }
  // Re-sync wingman ships with the crew roster without waiting for a jump.
  wingmenChanged() {
    const s = this.modes[0]; if (!s || s.kind !== 'space') return;
    for (const w of s.ships.filter(x => x.ally)) s.removeShip(w);
    s.ships = s.ships.filter(x => x.alive);
    s.spawnWingmenNow();
  }
  afterMenu() { if (this.mode && !this.ui.modal && !this.touch.active && this.input.lastDevice === 'kbm' && (this.mode.kind !== 'space' || this.settings.flight !== 'classic')) this.input.requestLock(); }

  // ---------------- Progression ----------------
  addXP(n, why) {
    const P = this.player; P.xp += n;
    if (why) this.ui.toast(`${why} · +${n} XP`, '#b8e0ff');
    while (P.xp >= xpForLevel(P.level)) {
      P.xp -= xpForLevel(P.level); P.level++;
      const pts = 1 + (P.level % 5 === 0 ? 1 : 0); P.skillPoints += pts;
      this.ui.toast(`LEVEL ${P.level}! +${pts} skill point${pts > 1 ? 's' : ''} (press K)`, '#ffd34d'); this.audio.level();
    }
  }
  addCredits(n, why) { this.player.credits = Math.max(0, this.player.credits + n); if (why && n > 0) this.ui.toast(`+${Math.round(n)} cr (${why})`, '#ffd34d'); }
  giveItem(item, quiet) {
    const P = this.player;
    if (P.inventory.length >= 40) { this.ui.toast('Inventory full! Sell or discard items (I)', '#ff7a5a'); return false; }
    P.inventory.push(item);
    if (!quiet) { this.ui.toast(`Looted: ${item.name}`, TIERS[item.tier].color); this.audio.loot(item.tier); }
    return true;
  }
  addCargo(id, n) {
    const P = this.player, cap = shipStats(P).cargo;
    const room = Math.max(0, cap - cargoUsed(P)); const k = Math.min(room, n);
    if (k <= 0) { this.ui.toast('Cargo hold full', '#ff7a5a'); return 0; }
    P.cargo[id] = (P.cargo[id] || 0) + k; return k;
  }
  tradeCommodity(id, n) {
    const P = this.player, det = getSystem(this.U, P.systemId), price = det.market[id], tr = (P.skills.commerce || 0) * 0.02;
    if (n > 0) { const buy = Math.round(price * (1.05 - tr)); const afford = Math.min(n, Math.floor(P.credits / buy)); const got = afford > 0 ? this.addCargo(id, afford) : 0; this.addCredits(-got * buy); }
    else if (n < 0) { const k = Math.min(-n, P.cargo[id] || 0); P.cargo[id] -= k; this.addCredits(k * Math.round(price * (0.92 + tr))); }
  }
  equip(item, slot) {
    const P = this.player;
    const isShip = SHIP_SLOTS.includes(slot);
    const bag = isShip ? P.equip : P.pequip;
    if (slotAccepts(slot) !== item.kind) return this.ui.toast('Wrong slot', '#ff7a5a');
    if (slot.startsWith('weapon') && +slot.slice(6) > shipStats(P).slots) return this.ui.toast('Your hull lacks that gun slot', '#ff7a5a');
    P.inventory = P.inventory.filter(i => i !== item);
    if (bag[slot]) P.inventory.push(bag[slot]);
    bag[slot] = item;
    this.statsChanged();
  }
  unequip(slot) {
    const P = this.player; const bag = SHIP_SLOTS.includes(slot) ? P.equip : P.pequip;
    if (!bag[slot]) return;
    if (P.inventory.length >= 40) return this.ui.toast('Inventory full', '#ff7a5a');
    P.inventory.push(bag[slot]); delete bag[slot];
    this.statsChanged();
  }
  statsChanged(fromPlayerData) {
    const s = this.modes[0];
    if (s && s.kind === 'space') {
      if (fromPlayerData) { const P = this.player; s.player.refreshPlayerStats(true); }
      else s.player.refreshPlayerStats(false);
    }
    const f = this.mode; if (f && f.refreshStats) f.refreshStats();
  }
  missionProgress(id, ev) {
    const m = this.player.missions.find(x => x.id === id); if (!m || m.done) return;
    if ((m.type === 'bounty' || m.type === 'raid') && ev === 'kill') this.completeMission(m);
    if (m.type === 'derelict' && ev === 'loot') this.completeMission(m);
  }
  completeMission(m) {
    const P = this.player;
    m.done = true;
    const mult = 1 + (P.skills.bounty || 0) * 0.1;
    this.addCredits(Math.round(m.reward.credits * mult), 'contract');
    this.addXP(m.reward.xp, `Contract complete: ${m.title}`);
    changeRep(this.U, P, m.giver, m.reward.rep);
    if (m.reward.item) { const r = new RNG(Date.now()); this.giveItem(genItem(r, { level: m.level + 1, luck: 0.35 })); }
    P.missions = P.missions.filter(x => !x.done);
    this.audio.level();
  }

  // ---------------- Loop ----------------
  loop() {
    requestAnimationFrame(() => this.loop());
    const raw = this.clock.getDelta(), dt = Math.min(0.05, raw);
    const inp = this.input, ui = this.ui;
    this.governor.sample(raw);
    texJobs.run(Q.tier === 0 ? 3 : 5);
    this.touch.refreshVisible();
    if (this.settings.showFps) { this.fpsT = (this.fpsT || 0) - raw; if (this.fpsT <= 0) { this.fpsT = 0.5; this.fpsEl.style.display = ''; this.fpsEl.textContent = `${this.governor.fps} fps · ${PRESETS[this.tier].name} · ${Math.round(this.renderer.getPixelRatio() * 100) / 100}x`; } } else if (this.fpsEl.style.display !== 'none') this.fpsEl.style.display = 'none';
    inp.pollGamepad();
    if (ui.modal) ui.gamepadNav(inp, raw);
    ui.refreshHint();
    if (this.mode && !this.jumping) {
      // global hotkeys
      if (!ui.modal || ['menu'].includes(ui.modal)) {
        const map = { KeyI: 'inventory', Tab: 'inventory', KeyK: 'skills', KeyM: 'galaxy', KeyJ: 'missions', KeyG: 'guide' };
        for (const [k, tab] of Object.entries(map)) if (inp.pressed(k)) { if (ui.modal === 'menu' && ui.tab === tab) ui.close(); else { ui.sel = null; ui.openMenu(tab); } }
        if (inp.gpPressed(8)) ui.modal === 'menu' ? ui.close() : ui.openMenu('inventory');
      }
      // Esc that just freed the mouse already paused the game; don't let it unpause straight away
      const escFresh = performance.now() - (this.lockLostAt || 0) < 400;
      if ((inp.pressed('Escape') && !escFresh) || inp.pressed('KeyP') || inp.gpPressed(9)) ui.back();
      // on the landing map, the same keys that opened it confirm the marked spot
      else if (ui.modal === 'landing' && (inp.pressed('Enter') || inp.pressed('KeyL') || inp.pressed('KeyE'))) ui.handlers.landgo.call(ui, 'sel');
      if (!ui.modal) {
        this.mode.update(dt);
        this.player.time += dt;
        this.saveTimer -= dt; if (this.saveTimer <= 0) { this.saveTimer = 90; this.save(false); }
      }
      this.renderFrame(this.mode.scene, this.mode.camera);
    } else if (this.title && !this.mode) {
      const t = performance.now() * 0.00003; this.title.pl.rotation.y += dt * 0.03;
      this.title.camera.position.set(Math.sin(t) * 300, 100, 1200); this.title.camera.lookAt(this.title.pl.position);
      this.renderFrame(this.title.scene, this.title.camera);
    } else if (this.mode) this.renderFrame(this.mode.scene, this.mode.camera);
    this.music.update(raw > 0.25 ? 0.05 : raw);
    inp.endFrame();
  }
}
function hashName(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
