import { RNG, hashInts, hashStr } from '../rng.js';
import { IDEOLOGIES, BIOMES, HULL_CLASSES, NPC_ROLES } from '../data.js';
import { makeCulture, cultureWord, personName, starName, factionName, shipName, manufacturer, ROMAN } from './names.js';
import { genItem, rollTier, COMMODITIES } from './items.js';

const FACTION_COLORS = [0xff4d4d, 0x4da3ff, 0x5be37d, 0xffb43d, 0xc36bff, 0x3de0d0, 0xff7ad9, 0xe8e86a];

export function genUniverse(seed) {
  const r = new RNG(hashStr('universe:' + seed));
  const U = { seed, species: [], factions: [], systems: [], systemCache: {} };

  // ---- Species ----
  const nSpecies = r.int(5, 8);
  U.species.push({ id: 0, name: 'Human', culture: makeCulture(r.int(1, 1e9)), skin: [0.08, 0.35, 0.65], height: 1.0, width: 1.0, head: 'round', eyes: 2, horns: 0, tail: false, color2: 0x334455 });
  for (let i = 1; i < nSpecies; i++) {
    const c = makeCulture(r.int(1, 1e9));
    U.species.push({
      id: i, name: cultureWord(c, r, r.int(2, 3)), culture: c,
      skin: [r.next(), r.range(0.3, 0.8), r.range(0.35, 0.65)],
      height: r.range(0.75, 1.35), width: r.range(0.8, 1.35),
      head: r.pick(['round', 'long', 'flat', 'crest', 'dome']), eyes: r.pick([1, 2, 2, 3, 4]),
      horns: r.pick([0, 0, 1, 2]), tail: r.chance(0.35), color2: Math.floor(r.next() * 0xffffff),
    });
  }

  // ---- Galaxy layout (spiral-ish disc) ----
  const nSys = 140;
  for (let i = 0; i < nSys; i++) {
    let x, y, ok = false, tries = 0;
    while (!ok && tries++ < 40) {
      const arm = r.int(0, 2), t = Math.pow(r.next(), 0.7);
      const ang = arm * (Math.PI * 2 / 3) + t * 4.2 + r.gauss() * 0.45;
      const rad = 6 + t * 48 + r.gauss() * 3;
      x = 50 + Math.cos(ang) * rad; y = 50 + Math.sin(ang) * rad;
      ok = U.systems.every(s => (s.x - x) ** 2 + (s.y - y) ** 2 > 9);
    }
    const sc = U.species[r.int(0, U.species.length - 1)].culture;
    const starType = r.weighted([[{ k: 'Red dwarf', color: 0xff7a5a, size: 0.7 }, 30], [{ k: 'Yellow star', color: 0xffe08a, size: 1 }, 30], [{ k: 'White star', color: 0xf4f6ff, size: 1.15 }, 15], [{ k: 'Blue giant', color: 0x8fb6ff, size: 1.6 }, 8], [{ k: 'Orange giant', color: 0xffa64d, size: 1.4 }, 12], [{ k: 'Neutron star', color: 0xc8f0ff, size: 0.45 }, 5]]);
    U.systems.push({ id: i, name: starName(r, sc), x, y, star: starType, owner: null, level: 1, danger: 1, visited: false });
  }

  // ---- Factions ----
  const nFac = 7;
  const ideos = ['mercantile', 'pirate', 'militarist', 'scientific', 'zealot', 'isolationist', r.pick(['militarist', 'mercantile', 'zealot', 'pirate'])];
  r.shuffle(ideos.slice(2));
  const used = new Set();
  for (let i = 0; i < nFac; i++) {
    const ideology = ideos[i];
    const sp = U.species[i % U.species.length];
    const c = sp.culture;
    // pick home system far from other homes
    let home, best = -1;
    for (let k = 0; k < 30; k++) {
      const s = U.systems[r.int(0, nSys - 1)];
      if (used.has(s.id)) continue;
      const d = Math.min(999, ...U.factions.map(f => dist(U.systems[f.home], s)));
      const centerBias = i === 0 ? -Math.hypot(s.x - 50, s.y - 50) * 2 : 0; // first faction near core
      if (d + centerBias > best) { best = d + centerBias; home = s; }
    }
    used.add(home.id);
    const ideo = IDEOLOGIES.find(x => x.id === ideology);
    U.factions.push({
      id: i, name: factionName(r, c, ideology), ideology, ideoName: ideo.name, species: sp.id, culture: c,
      color: FACTION_COLORS[i % FACTION_COLORS.length], home: home.id, makers: [manufacturer(r, c), manufacturer(r, c)],
      baseRep: ideo.baseRep + r.int(-10, 10), relations: {}, strength: r.range(0.7, 1.3),
      motto: r.pick(['Through order, stars.', 'Profit is a compass.', 'Take what drifts.', 'Know the void.', 'The light demands.', 'Leave us be.', 'Steel endures.']),
    });
  }
  // Relations
  for (const a of U.factions) for (const b of U.factions) {
    if (a.id >= b.id) continue;
    let v = r.int(-40, 50);
    if (a.ideology === 'pirate' || b.ideology === 'pirate') v = r.int(-95, -60);
    if (a.ideology === b.ideology) v += 25;
    if ((a.ideology === 'zealot' && b.ideology === 'scientific') || (b.ideology === 'zealot' && a.ideology === 'scientific')) v -= 40;
    v = Math.max(-100, Math.min(100, v));
    a.relations[b.id] = v; b.relations[a.id] = v;
  }

  // Territory: nearest home within reach, weighted by strength
  for (const s of U.systems) {
    let bestF = null, bestD = 1e9;
    for (const f of U.factions) {
      const d = dist(U.systems[f.home], s) / f.strength;
      if (d < bestD) { bestD = d; bestF = f; }
    }
    s.owner = bestD < 26 ? bestF.id : null;
  }
  // Start: mercantile home
  const startF = U.factions.find(f => f.ideology === 'mercantile');
  U.startSystem = startF.home;
  const start = U.systems[U.startSystem];
  for (const s of U.systems) {
    const d = dist(start, s);
    s.level = Math.max(1, Math.round(1 + d / 4.5 + (s.owner === null ? 2 : 0)));
    const pir = s.owner !== null && U.factions[s.owner].ideology === 'pirate';
    s.danger = Math.min(10, Math.round(1 + d / 9 + (s.owner === null ? 3 : 0) + (pir ? 3 : 0)));
  }
  start.danger = 1; start.level = 1;
  return U;
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---- Detailed system (deterministic, lazily built) ----
export function getSystem(U, id) {
  if (U.systemCache[id]) return U.systemCache[id];
  const s = U.systems[id];
  const r = new RNG(hashInts(hashStr(String(U.seed)), id, 77));
  const owner = s.owner !== null ? U.factions[s.owner] : null;
  const det = { ...s, planets: [], stations: [], belts: [], market: {} };
  const nPl = r.int(2, 7);
  let orbit = 4000 + r.range(0, 1500);
  for (let i = 0; i < nPl; i++) {
    const biome = r.pick(BIOMES);
    const radius = r.range(260, 900);
    orbit += radius * 2 + r.range(2500, 6000);
    const ang = r.range(0, Math.PI * 2);
    det.planets.push({
      id: i, name: `${s.name} ${ROMAN[i]}`, biome: biome.id, radius, orbit, angle: ang, incl: r.range(-0.08, 0.08),
      seed: r.int(1, 1e9), rings: r.chance(0.25), outposts: r.int(1, 4), hostility: Math.min(10, s.danger + r.int(-1, 3)),
      pos: [Math.cos(ang) * orbit, Math.sin(ang * 3) * orbit * 0.04, Math.sin(ang) * orbit], gravity: r.range(0.6, 1.4),
      owner: owner && r.chance(0.6) ? owner.id : (r.chance(0.3) ? r.int(0, U.factions.length - 1) : null),
    });
  }
  // Stations near some planets
  const nSt = owner ? r.int(1, 3) : r.int(0, 1);
  for (let i = 0; i < nSt && det.planets.length; i++) {
    const p = det.planets[i % det.planets.length];
    const off = p.radius + r.range(700, 1200);
    const a = r.range(0, Math.PI * 2);
    const fac = owner ? (r.chance(0.8) ? owner.id : r.int(0, U.factions.length - 1)) : U.factions.find(f => f.ideology === 'pirate').id;
    det.stations.push({
      id: i, name: `${cultureWord(U.factions[fac].culture, r, 2)} ${r.pick(['Station', 'Outpost', 'Citadel', 'Dock', 'Haven', 'Spire', 'Exchange'])}`,
      faction: fac, pos: [p.pos[0] + Math.cos(a) * off, p.pos[1] + r.range(-200, 200), p.pos[2] + Math.sin(a) * off],
      seed: r.int(1, 1e9), shipyard: r.chance(0.55), services: ['market', 'repair', 'missions', 'bar'],
    });
  }
  if (r.chance(0.55)) det.belts.push({ radius: r.range(9000, 22000), width: r.range(800, 1800), count: r.int(160, 320), seed: r.int(1, 1e9) });
  // Market price modifiers
  for (const c of COMMODITIES) det.market[c.id] = Math.round(c.base * r.range(0.55, 1.6));
  U.systemCache[id] = det;
  return det;
}

// ---- NPC people ----
export function genNPC(U, r, { faction = null, role = null, level = 1, speciesId = null } = {}) {
  const fac = faction !== null ? U.factions[faction] : null;
  const sp = U.species[speciesId ?? (fac && r.chance(0.7) ? fac.species : r.int(0, U.species.length - 1))];
  const rl = role ? NPC_ROLES.find(x => x.id === role) : r.pick(NPC_ROLES);
  const traits = r.shuffle(['gruff', 'cheerful', 'paranoid', 'curious', 'greedy', 'loyal', 'weary', 'boastful', 'pious', 'sarcastic', 'nervous', 'stoic']).slice(0, 2);
  const lvl = Math.max(1, level + r.int(-1, 2));
  const npc = {
    id: `n${r.int(1, 1e9)}`, name: personName(sp.culture, r), species: sp.id, speciesName: sp.name, role: rl.id, roleName: rl.name,
    faction: fac ? fac.id : null, level: lvl, traits, seed: r.int(1, 1e9),
    weapon: genItem(r, { kind: 'pweapon', level: lvl, tier: rollTier(r, 0) , maker: fac ? r.pick(fac.makers) : null }),
    hp: 50 + lvl * 14, hireCost: Math.round(800 + lvl * 350 * (1 + r.next())),
  };
  return npc;
}

const GREET = {
  gruff: ['What do you want?', 'Make it quick.', 'Hm.'],
  cheerful: ['Well hello there, spacer!', 'Good stars to you!', 'Oh, a new face!'],
  paranoid: ['Who sent you?', "Keep your hands where I can see 'em.", 'Did anyone follow you?'],
  curious: ['Where did you fly in from?', 'Your ship — what class is it?', 'Ooh, tell me something new.'],
  greedy: ['Got credits? Then we can talk.', 'Everything has a price.', 'Buying or selling?'],
  loyal: ['For the {f}.', 'The {f} watches over this place.', 'Stand with us and you stand with family.'],
  weary: ['Long shift. Long life.', 'Another day in the void...', "Don't mind me."],
  boastful: ['You may have heard of me.', 'Best shot in {s}, they say.', 'I once outran a frigate in a scout.'],
  pious: ['The light keeps you.', 'Walk carefully among the stars.', 'Have you made your offering?'],
  sarcastic: ['Oh great, another hero.', 'Let me guess: you need something.', 'Riveting.'],
  nervous: ['Oh! You startled me.', 'Is it safe out there?', 'I-I can help, maybe.'],
  stoic: ['Speak.', 'Greetings.', 'I am listening.'],
};
const RUMORS = [
  'Ships have gone dark near {sys}. Pirates, or worse.', 'They say {sys} has relic ruins on its planets.', 'The {f} is massing ships near {sys}.',
  'Good prices for {c} out at {sys}.', 'A legendary weapon was looted from a derelict near {sys}.', "Don't land on volcanic worlds without a good suit.",
  'Disable a ship with ion fire and you can board it — and maybe keep it.', 'Datachips can teach you skills faster than any trainer.',
];
export function npcLine(U, npc, r, sysName) {
  const t = npc.traits[0];
  const fac = npc.faction !== null ? U.factions[npc.faction].name : 'nobody';
  const other = U.systems[r.int(0, U.systems.length - 1)].name;
  const greet = r.pick(GREET[t]).replace('{f}', fac).replace('{s}', sysName);
  const rumor = r.pick(RUMORS).replace('{sys}', other).replace('{f}', U.factions[r.int(0, U.factions.length - 1)].name).replace('{c}', r.pick(['crystals', 'relics', 'electronics', 'munitions']));
  return { greet, rumor };
}

// ---- Ships ----
export function genShipDef(U, r, { faction = null, level = 1, cls = null } = {}) {
  const fac = faction !== null ? U.factions[faction] : null;
  const pool = fac && fac.ideology === 'pirate' ? ['scout', 'fighter', 'interceptor', 'gunship'] : fac && fac.ideology === 'mercantile' ? ['freighter', 'fighter', 'scout', 'corvette'] : ['fighter', 'interceptor', 'gunship', 'corvette', 'scout', 'frigate'];
  const clsId = cls || r.weighted(pool.map((p, i) => [p, p === 'frigate' ? 1 : 6 - i * 0.6]));
  const hc = HULL_CLASSES.find(h => h.id === clsId) || HULL_CLASSES[1];
  const culture = fac ? fac.culture : U.species[0].culture;
  const lvl = Math.max(1, level + r.int(-1, 1));
  const maker = fac ? r.pick(fac.makers) : null;
  const loadout = { weapons: [] };
  const tierBias = Math.min(0.5, lvl * 0.02);
  for (let i = 0; i < Math.min(hc.slots, 3); i++) loadout.weapons.push(genItem(r, { kind: 'sweapon', level: lvl, luck: tierBias, maker }));
  if (r.chance(0.35 + lvl * 0.02)) loadout.missile = genItem(r, { kind: 'missile', level: lvl, luck: tierBias, maker });
  loadout.shield = genItem(r, { kind: 'shield', level: lvl, luck: tierBias, maker });
  if (r.chance(0.5)) loadout.plating = genItem(r, { kind: 'plating', level: lvl, luck: tierBias, maker });
  return {
    name: shipName(r, culture), cls: hc.id, clsName: hc.name, faction: fac ? fac.id : null, level: lvl, loadout,
    seed: r.int(1, 1e9), captain: genNPC(U, r, { faction, role: 'pilot', level: lvl }),
  };
}

export function hostileToPlayer(U, player, factionId) {
  if (factionId === null || factionId === undefined) return true;
  return (player.rep[factionId] ?? 0) <= -30;
}
export function factionsAtWar(U, a, b) {
  if (a === b) return false;
  if (a === null || b === null) return true;
  return (U.factions[a].relations[b] ?? 0) <= -45;
}
