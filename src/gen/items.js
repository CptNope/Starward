import { RNG } from '../rng.js';
import { TIERS, AFFIXES, SPECIALS, SHIP_WEAPONS, SHIP_MISSILES, SHIP_GEAR, PERSONAL_WEAPONS, PERSONAL_GEAR, SKILLS } from '../data.js';
import { ROMAN } from './names.js';

let uid = 1;
export const newId = () => `i${Date.now().toString(36)}${(uid++).toString(36)}`;

export function rollTier(r, luck = 0, minTier = 0) {
  // luck shifts weight toward higher tiers
  const entries = TIERS.map((t, i) => [i, t.w * Math.pow(1 + luck * 3, i)]).filter(e => e[0] >= minTier);
  return r.weighted(entries);
}

const levelMult = (lvl) => 1 + 0.13 * (lvl - 1);

export const GEAR_KINDS = ['sweapon', 'missile', 'shield', 'engine', 'reactor', 'plating', 'pweapon', 'suit', 'shieldgen', 'implant'];

// Generate any equippable item. opts: { kind, level, tier, luck, maker, seed }
export function genItem(r, opts = {}) {
  const level = Math.max(1, opts.level || 1);
  const kind = opts.kind || r.weighted([['sweapon', 16], ['missile', 6], ['shield', 8], ['engine', 7], ['reactor', 7], ['plating', 8], ['pweapon', 16], ['suit', 8], ['shieldgen', 6], ['implant', 6]]);
  const tier = opts.tier ?? rollTier(r, opts.luck || 0);
  const T = TIERS[tier];
  const m = T.mult * levelMult(level);
  const item = { id: newId(), kind, tier, level, stats: {}, affixes: [], specials: [], maker: opts.maker || null };

  if (kind === 'sweapon' || kind === 'pweapon' || kind === 'missile') {
    const base = r.pick(kind === 'sweapon' ? SHIP_WEAPONS : kind === 'pweapon' ? PERSONAL_WEAPONS : SHIP_MISSILES);
    const jitter = () => r.range(0.9, 1.1);
    item.base = base.base;
    item.weapon = {
      dtype: base.dtype, dmg: base.dmg * m * jitter(), rate: base.rate * jitter(), speed: base.speed * jitter(), spread: base.spread,
      range: base.range, count: base.count || 1, energy: base.energy || 0, homing: base.homing || 0, ammo: base.ammo || 0,
      mag: base.mag || 0, reload: base.reload || 0, aoe: base.aoe || 0, gravity: base.gravity || 0,
      crit: 0.05, critDmg: 1.5, leech: 0, pierce: 0, chain: 0, overload: 0,
    };
    // occasional damage type mutation for variety
    if (r.chance(0.12 + tier * 0.03)) item.weapon.dtype = r.pick(['kinetic', 'energy', 'ion', 'plasma', 'explosive']);
  } else {
    const table = SHIP_GEAR[kind] || PERSONAL_GEAR[kind];
    item.base = r.pick(table.base);
    for (const [k, v] of Object.entries(table.stats)) {
      const scale = k === 'jumpRange' ? 1 + tier * 0.35 : k === 'turn' ? T.mult : m;
      item.stats[k] = round(v * scale * r.range(0.9, 1.1), k);
    }
    if (kind === 'implant' && Object.keys(item.stats).length === 0) item.stats.crit = round(0.02 * T.mult, 'crit');
  }

  item.core = { weapon: item.weapon ? { ...item.weapon } : null, stats: { ...item.stats } };
  // Affixes
  const pool = AFFIXES.filter(a => a.cats.includes(kind));
  const nAff = Math.min(pool.length, T.affixes + (r.chance(0.25) ? 1 : 0) - (tier === 1 && r.chance(0.5) ? 1 : 0));
  const chosen = r.shuffle(pool.slice()).slice(0, Math.max(0, nAff));
  for (const a of chosen) item.affixes.push(rollAffix(a, tier, level, r));
  // Specials for legendary+ weapons
  if (item.weapon && tier >= 5) item.specials = r.shuffle(SPECIALS.slice()).slice(0, tier === 6 ? 2 : 1).map(s => s.id);
  rebuild(item);
  item.name = nameItem(r, item, chosen);
  return item;
}

function rollAffix(a, tier, level, r) {
  const T = TIERS[tier];
  const scale = a.pct ? T.mult * (1 + (level - 1) * 0.02) : T.mult * levelMult(level);
  let val = round(a.v * scale * r.range(0.75, 1.25), a.stat, a.pct);
  if (a.round) val = Math.max(1, Math.round(val));
  return { id: a.id, stat: a.stat, value: val, label: a.label, pct: !!a.pct };
}

// Recompute an item's final numbers from its core + affixes + specials.
export function rebuild(item) {
  const c = item.core;
  if (c) { if (c.weapon) item.weapon = { ...c.weapon }; item.stats = { ...c.stats }; }
  for (const af of item.affixes) applyAffix(item, af.stat, af.value);
  const w = item.weapon;
  if (w) for (const id of item.specials) {
    if (id === 'twin') w.count += 1;
    if (id === 'homing') w.homing = Math.max(w.homing, 1.6);
    if (id === 'aoe') w.aoe = Math.max(w.aoe, item.kind === 'pweapon' ? 4 : 60);
    if (id === 'pierce') w.pierce = 2;
    if (id === 'chain') w.chain = 1;
    if (id === 'overload') w.overload = 0.5;
  }
  item.value = Math.round((60 + item.level * 22) * Math.pow(TIERS[item.tier].mult, 2.2) * (item.weapon ? 1.3 : 1));
  return item;
}

// Items saved before v0.3 have no core: rebuild one by undoing their affixes.
export function ensureCore(item) {
  if (item.core || !GEAR_KINDS.includes(item.kind)) return !!item.core;
  const core = { weapon: item.weapon ? { ...item.weapon } : null, stats: { ...item.stats } };
  const w = core.weapon;
  for (const af of item.affixes) {
    const v = af.value;
    if (w) {
      if (af.stat === 'dmgPct') w.dmg /= 1 + v; else if (af.stat === 'ratePct') w.rate /= 1 + v; else if (af.stat === 'crit') w.crit -= v;
      else if (af.stat === 'critDmg') w.critDmg -= v; else if (af.stat === 'velPct') w.speed /= 1 + v; else if (af.stat === 'effPct') w.energy /= 1 + v;
      else if (af.stat === 'magPct') w.mag = Math.max(1, Math.round(w.mag / (1 + v))); else if (af.stat === 'reloadPct') w.reload /= 1 + v; else if (af.stat === 'leech') w.leech -= v;
    } else core.stats[af.stat] = (core.stats[af.stat] || 0) - v;
  }
  if (w && item.specials.includes('twin')) w.count = Math.max(1, w.count - 1);
  item.core = core;
  return true;
}

const affixDefs = (item) => item.affixes.map(a => AFFIXES.find(x => x.id === a.id)).filter(Boolean);
export const salvageParts = (it) => Math.max(1, Math.round(Math.pow(it.tier + 1, 1.7) * (1 + it.level * 0.08)));
export const upgradeCost = (it) => ({ parts: Math.round(8 * Math.pow(it.tier + 1, 1.8) * (1 + it.level * 0.05)), credits: Math.round(it.value * 0.6) });
export const reforgeCost = (it) => ({ parts: Math.round(3 * (it.tier + 1) * (1 + it.level * 0.05)), credits: Math.round(it.value * 0.25) });
export const canCraft = (it) => GEAR_KINDS.includes(it.kind);

// Raise an item one tier: stronger core, scaled bonuses, one new bonus, and specials at Legendary+.
export function upgradeItem(item, r) {
  if (!canCraft(item) || item.tier >= TIERS.length - 1 || !ensureCore(item)) return false;
  const t0 = item.tier, ratio = TIERS[t0 + 1].mult / TIERS[t0].mult;
  const c = item.core;
  if (c.weapon) c.weapon.dmg *= ratio;
  for (const k of Object.keys(c.stats)) c.stats[k] = round(c.stats[k] * (k === 'jumpRange' ? (1 + (t0 + 1) * 0.35) / (1 + t0 * 0.35) : ratio), k);
  for (const af of item.affixes) { af.value = round(af.value * ratio, af.stat, af.pct); if (af.stat === 'jumpRange') af.value = Math.max(1, Math.round(af.value)); }
  item.tier = t0 + 1;
  const pool = AFFIXES.filter(a => a.cats.includes(item.kind) && !item.affixes.some(x => x.id === a.id));
  if (pool.length) item.affixes.push(rollAffix(r.pick(pool), item.tier, item.level, r));
  if (item.weapon && item.tier >= 5) {
    const want = item.tier === 6 ? 2 : 1;
    while (item.specials.length < want) { const sp = r.pick(SPECIALS.filter(s => !item.specials.includes(s.id))); item.specials.push(sp.id); }
  }
  rebuild(item);
  item.name = nameItem(r, item, affixDefs(item));
  return true;
}

// Re-roll which bonuses an item has and how strong they are (same count, same tier).
export function reforgeItem(item, r) {
  if (!canCraft(item) || !ensureCore(item)) return false;
  const n = Math.max(1, item.affixes.length);
  const pool = r.shuffle(AFFIXES.filter(a => a.cats.includes(item.kind))).slice(0, n);
  item.affixes = pool.map(a => rollAffix(a, item.tier, item.level, r));
  rebuild(item);
  item.name = nameItem(r, item, affixDefs(item));
  return true;
}

function round(v, stat, pct) {
  if (pct || ['crit', 'turn'].includes(stat)) return Math.round(v * 1000) / 1000;
  if (Math.abs(v) < 10) return Math.round(v * 10) / 10;
  return Math.round(v);
}

function applyAffix(item, stat, val) {
  const w = item.weapon;
  if (w) {
    if (stat === 'dmgPct') w.dmg *= 1 + val;
    else if (stat === 'ratePct') w.rate *= 1 + val;
    else if (stat === 'crit') w.crit += val;
    else if (stat === 'critDmg') w.critDmg += val;
    else if (stat === 'velPct') w.speed *= 1 + val;
    else if (stat === 'effPct') w.energy *= 1 + val;
    else if (stat === 'magPct') w.mag = Math.round(w.mag * (1 + val));
    else if (stat === 'reloadPct') w.reload *= 1 + val;
    else if (stat === 'leech') w.leech += val;
    return;
  }
  item.stats[stat] = (item.stats[stat] || 0) + val;
}

function nameItem(r, item, affixes) {
  const mk = item.maker ? item.maker.split(' ')[0] + ' ' : '';
  const mark = item.tier >= 2 ? ` Mk-${ROMAN[Math.min(9, Math.floor(item.level / 3))]}` : '';
  let n = item.base;
  if (item.specials.length) {
    const sp = SPECIALS.find(s => s.id === item.specials[0]);
    n = `${sp.name} ${n}`;
  } else if (affixes[0] && r.chance(0.7)) n = `${affixes[0].pre} ${n}`;
  if (affixes[1] && item.tier >= 3) n = `${n} ${affixes[1].suf}`;
  if (item.tier === 0) n = `Worn ${item.base}`;
  return (r.chance(0.6) ? mk : '') + n + mark;
}

export function genSkillChip(r, level = 1) {
  const sk = r.pick(SKILLS);
  return { id: newId(), kind: 'skillchip', skill: sk.id, tier: 3, level, name: `Datachip: ${sk.name}`, value: 400 + level * 60, stats: {}, affixes: [], specials: [] };
}
export function genMedkit(level = 1) {
  return { id: newId(), kind: 'medkit', tier: 1, level, name: 'Medkit', heal: 40 + level * 8, value: 40 + level * 5, stats: {}, affixes: [], specials: [] };
}

export const COMMODITIES = [
  { id: 'ore', name: 'Raw Ore', base: 30 }, { id: 'crystal', name: 'Void Crystals', base: 140 }, { id: 'food', name: 'Rations', base: 22 },
  { id: 'med', name: 'Medical Supplies', base: 90 }, { id: 'tech', name: 'Electronics', base: 120 }, { id: 'arms', name: 'Munitions', base: 110 },
  { id: 'lux', name: 'Luxury Goods', base: 260 }, { id: 'fuel', name: 'Fuel Cells', base: 45 }, { id: 'relic', name: 'Xeno Relics', base: 520 },
];

// Random drop with chance of consumables/chips
export function genLoot(r, level, luck = 0, maker = null) {
  const t = r.next();
  if (t < 0.08) return genSkillChip(r, level);
  if (t < 0.2) return genMedkit(level);
  return genItem(r, { level, luck, maker });
}

export function itemPower(item) {
  // rough score for comparisons in UI
  if (item.weapon) { const w = item.weapon; return Math.round(w.dmg * w.rate * w.count * (1 + w.crit * (w.critDmg - 1)) * 10) / 10; }
  let s = 0; for (const v of Object.values(item.stats)) s += Math.abs(v);
  return Math.round(s);
}

export const seedRng = (s) => new RNG(s);
