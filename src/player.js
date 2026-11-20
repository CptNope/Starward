import { SKILLS, HULL_CLASSES, NPC_ROLES } from './data.js';
import { genItem, genMedkit } from './gen/items.js';
import { RNG } from './rng.js';

export const SHIP_SLOTS = ['weapon1', 'weapon2', 'weapon3', 'weapon4', 'missile', 'shield', 'engine', 'reactor', 'plating'];
export const PERSONAL_SLOTS = ['pweapon1', 'pweapon2', 'suit', 'shieldgen', 'implant'];
export const slotAccepts = (slot) => slot.startsWith('weapon') ? 'sweapon' : slot.startsWith('pweapon') ? 'pweapon' : slot;

export function newPlayer(U, name = 'Captain') {
  const r = new RNG(Date.now());
  const startFac = U.factions.find(f => f.ideology === 'mercantile');
  const p = {
    name, level: 1, xp: 0, skillPoints: 2, skills: {}, credits: 2500, rep: {}, inventory: [], equip: {}, pequip: {},
    ship: { cls: 'fighter', name: 'Wayfarer', hull: 1, shield: 1, energy: 1, missiles: null },
    ownedShips: [], crew: [], cargo: {}, missions: [], systemId: U.startSystem, discovered: [U.startSystem],
    kills: 0, boarded: 0, landed: 0, hp: 1, pshield: 1, medkits: 2, time: 0, version: 1,
  };
  for (const f of U.factions) p.rep[f.id] = f.baseRep;
  p.rep[startFac.id] = Math.max(20, p.rep[startFac.id]);
  const mk = startFac.makers[0];
  p.equip.weapon1 = genItem(r, { kind: 'sweapon', level: 1, tier: 1, maker: mk });
  p.equip.weapon2 = genItem(r, { kind: 'sweapon', level: 1, tier: 1, maker: mk });
  p.equip.shield = genItem(r, { kind: 'shield', level: 1, tier: 1, maker: mk });
  p.equip.engine = genItem(r, { kind: 'engine', level: 1, tier: 1, maker: mk });
  p.equip.reactor = genItem(r, { kind: 'reactor', level: 1, tier: 1, maker: mk });
  p.equip.missile = genItem(r, { kind: 'missile', level: 1, tier: 1, maker: mk });
  p.pequip.pweapon1 = genItem(r, { kind: 'pweapon', level: 1, tier: 1, maker: mk });
  p.pequip.suit = genItem(r, { kind: 'suit', level: 1, tier: 1, maker: mk });
  p.pequip.shieldgen = genItem(r, { kind: 'shieldgen', level: 1, tier: 1, maker: mk });
  p.inventory.push(genItem(r, { kind: 'pweapon', level: 1, tier: 2 }));
  p.inventory.push(genMedkit(1));
  return p;
}

export function xpForLevel(l) { return Math.round(120 * Math.pow(l, 1.55)); }

export function skillMods(p) {
  const m = {};
  for (const s of SKILLS) {
    const rank = p.skills[s.id] || 0;
    if (!rank) continue;
    for (const [k, v] of Object.entries(s.fx)) m[k] = (m[k] || 0) + v * rank;
  }
  const crewMult = 1 + (m.crewPct || 0);
  for (const c of p.crew) {
    const role = NPC_ROLES.find(r => r.id === c.role);
    if (!role) continue;
    m[role.crew.stat] = (m[role.crew.stat] || 0) + role.crew.v * (1 + c.level * 0.04) * crewMult;
  }
  return m;
}

export function crewCap(p) {
  const hc = HULL_CLASSES.find(h => h.id === p.ship.cls);
  return hc.crew + Math.floor((p.skills.leadership || 0) * 0.5);
}

export function shipStats(p) {
  const hc = HULL_CLASSES.find(h => h.id === p.ship.cls);
  const m = skillMods(p);
  const s = { hullMax: hc.hull, shieldMax: hc.shield, shieldRegen: 12, energyMax: 100, energyRegen: 24, speed: hc.speed, turn: hc.turn, boost: 1.9, jumpRange: 9, armor: 0, crit: 0, luck: 0, cargo: hc.cargo, slots: hc.slots, size: hc.size };
  for (const slot of SHIP_SLOTS) {
    const it = p.equip[slot];
    if (!it || it.weapon) continue;
    for (const [k, v] of Object.entries(it.stats)) {
      if (k === 'turn') s.turn += v; else s[k] = (s[k] || 0) + v;
    }
  }
  for (const slot of ['implant']) { const it = p.pequip[slot]; if (it) s.luck += it.stats.luck || 0; }
  s.hullMax *= 1 + (m.hullPct || 0);
  s.shieldMax *= 1 + (m.shieldPct || 0);
  s.shieldRegen *= 1 + (m.shieldRegenPct || 0);
  s.energyMax *= 1 + (m.energyPct || 0);
  s.energyRegen *= 1 + (m.energyPct || 0);
  s.speed *= 1 + (m.speedPct || 0);
  s.turn *= 1 + (m.turnPct || 0);
  s.boost *= 1 + (m.boostPct || 0);
  s.boostDrain = 26 * (1 + (m.boostDrain || 0));
  s.cruise = 14 * (1 + (m.cruisePct || 0));
  s.jumpRange += m.jumpRange || 0;
  s.hullRegen = m.hullRegen || 0;
  s.regenDelay = Math.max(0.8, 3 + (m.regenDelay || 0));
  s.luck += m.luck || 0;
  s.dropPct = m.dropPct || 0;
  s.radar = 6000 * (1 + (m.radarPct || 0));
  s.disable = 0.15 + (m.disable || 0);
  s.missileCap = (p.equip.missile ? p.equip.missile.weapon.ammo : 0) + (m.missileCap || 0);
  s.weaponMods = { dmg: 1 + (m.sDmgPct || 0), rate: 1 + (m.sRatePct || 0), crit: m.sCrit || 0, vel: 1 + (m.velPct || 0), ion: 1 + (m.ionPct || 0), missile: 1 + (m.missilePct || 0) };
  s.weapons = [];
  for (let i = 1; i <= Math.min(4, hc.slots); i++) if (p.equip['weapon' + i]) s.weapons.push(p.equip['weapon' + i]);
  s.missile = p.equip.missile || null;
  s.mods = m;
  return s;
}

export function personalStats(p) {
  const m = skillMods(p);
  const s = { hpMax: 100, armor: 0, pShieldMax: 25, pShieldRegen: 4, moveSpeed: 0, crit: 0, luck: 0 };
  for (const slot of PERSONAL_SLOTS) {
    const it = p.pequip[slot];
    if (!it || it.weapon) continue;
    for (const [k, v] of Object.entries(it.stats)) s[k] = (s[k] || 0) + v;
  }
  s.hpMax *= 1 + (m.hpPct || 0);
  s.pShieldMax *= 1 + (m.pShieldPct || 0);
  s.move = 9 * (1 + s.moveSpeed + (m.movePct || 0));
  s.jump = 9 + (p.skills.sprint || 0) * 0.6;
  s.weaponMods = { dmg: 1 + (m.pDmgPct || 0), rate: 1 + (m.pRatePct || 0), crit: (m.pCrit || 0) + s.crit, reload: 1 + (m.reloadPct || 0), ion: 1 + (m.ionPct || 0), vel: 1 };
  s.healPct = 1 + (m.healPct || 0);
  s.hazard = Math.max(0.1, 1 + (m.hazard || 0));
  s.mining = 1 + (m.mining || 0);
  s.hack = p.skills.hacking || 0;
  s.luck += m.luck || 0;
  s.weapons = [p.pequip.pweapon1, p.pequip.pweapon2].filter(Boolean);
  return s;
}

export function canLearn(p, sk) {
  const rank = p.skills[sk.id] || 0;
  if (rank >= sk.max) return false;
  if (sk.req && (p.skills[sk.req[0]] || 0) < sk.req[1]) return false;
  return true;
}

export function changeRep(U, p, fid, delta) {
  if (fid === null || fid === undefined) return;
  const m = skillMods(p);
  const scale = delta > 0 ? 1 + (m.repGain || 0) : 1 + (m.repLoss || 0);
  p.rep[fid] = clampRep(p.rep[fid] + delta * scale);
  // ripple to allies/enemies
  for (const f of U.factions) {
    if (f.id === fid) continue;
    const rel = U.factions[fid].relations[f.id] || 0;
    if (Math.abs(rel) > 30) p.rep[f.id] = clampRep(p.rep[f.id] + delta * scale * rel / 250);
  }
}
const clampRep = (v) => Math.max(-100, Math.min(100, Math.round(v * 10) / 10));

export function repLabel(v) {
  if (v <= -60) return ['Nemesis', '#ff3d3d'];
  if (v <= -30) return ['Hostile', '#ff7a5a'];
  if (v < 10) return ['Neutral', '#c8c8c8'];
  if (v < 40) return ['Friendly', '#7ee08a'];
  if (v < 75) return ['Trusted', '#4dd6ff'];
  return ['Allied', '#ffd34d'];
}

export function cargoUsed(p) { let n = 0; for (const v of Object.values(p.cargo)) n += v; return n; }
