// Static tables: tiers, damage types, skills, bases. Generators combine these with seeds.

export const TIERS = [
  { name: 'Scrap', color: '#8d8d8d', mult: 0.7, affixes: 0, w: 22 },
  { name: 'Common', color: '#e6e6e6', mult: 1.0, affixes: 1, w: 34 },
  { name: 'Uncommon', color: '#52d273', mult: 1.22, affixes: 1, w: 22 },
  { name: 'Rare', color: '#3d9bff', mult: 1.48, affixes: 2, w: 12 },
  { name: 'Epic', color: '#b766ff', mult: 1.8, affixes: 3, w: 6 },
  { name: 'Legendary', color: '#ffa31a', mult: 2.2, affixes: 4, w: 3 },
  { name: 'Mythic', color: '#ff3d6e', mult: 2.75, affixes: 5, w: 1 },
];

// shield / hull multipliers
export const DAMAGE_TYPES = {
  kinetic: { color: 0xffd27a, shield: 0.6, hull: 1.3 },
  energy: { color: 0x58d6ff, shield: 1.2, hull: 0.9 },
  ion: { color: 0x7d8cff, shield: 1.9, hull: 0.3 },
  plasma: { color: 0x7dff6a, shield: 1.0, hull: 1.15 },
  explosive: { color: 0xff7a3a, shield: 0.75, hull: 1.5 },
};

// Ship weapon bases
export const SHIP_WEAPONS = [
  { base: 'Pulse Laser', dtype: 'energy', dmg: 9, rate: 7, speed: 1400, spread: 0.004, energy: 2.2, range: 1600 },
  { base: 'Autocannon', dtype: 'kinetic', dmg: 7, rate: 10, speed: 1200, spread: 0.012, energy: 1.2, range: 1400 },
  { base: 'Railgun', dtype: 'kinetic', dmg: 48, rate: 1.1, speed: 3200, spread: 0.0, energy: 10, range: 2600 },
  { base: 'Ion Cannon', dtype: 'ion', dmg: 14, rate: 3.5, speed: 1100, spread: 0.006, energy: 4, range: 1500 },
  { base: 'Plasma Lance', dtype: 'plasma', dmg: 22, rate: 2.4, speed: 900, spread: 0.004, energy: 6, range: 1300 },
  { base: 'Flak Projector', dtype: 'explosive', dmg: 6, rate: 2.2, speed: 1000, spread: 0.06, energy: 5, range: 900, count: 6 },
];
export const SHIP_MISSILES = [
  { base: 'Seeker Pod', dtype: 'explosive', dmg: 60, rate: 0.7, speed: 520, homing: 2.4, ammo: 12, range: 2400 },
  { base: 'Swarm Rack', dtype: 'explosive', dmg: 18, rate: 0.45, speed: 600, homing: 3.2, ammo: 10, range: 2000, count: 4 },
  { base: 'Torpedo Tube', dtype: 'explosive', dmg: 220, rate: 0.25, speed: 300, homing: 0.9, ammo: 4, range: 3000, aoe: 90 },
];
export const SHIP_GEAR = {
  shield: { base: ['Deflector', 'Barrier Array', 'Aegis Field', 'Phase Screen'], stats: { shieldMax: 120, shieldRegen: 10 } },
  engine: { base: ['Thruster Block', 'Ion Drive', 'Fusion Engine', 'Vector Drive'], stats: { speed: 30, turn: 0.12, jumpRange: 1 } },
  reactor: { base: ['Power Core', 'Fusion Reactor', 'Capacitor Bank', 'Singularity Cell'], stats: { energyMax: 60, energyRegen: 12 } },
  plating: { base: ['Hull Plating', 'Ablative Armor', 'Composite Shell', 'Nanoweave Hull'], stats: { hullMax: 140, armor: 4 } },
};

// Personal gear
export const PERSONAL_WEAPONS = [
  { base: 'Sidearm', dtype: 'kinetic', dmg: 14, rate: 4, speed: 140, spread: 0.01, mag: 12, reload: 1.1, range: 60 },
  { base: 'Assault Rifle', dtype: 'kinetic', dmg: 10, rate: 9, speed: 160, spread: 0.02, mag: 30, reload: 1.8, range: 90 },
  { base: 'SMG', dtype: 'kinetic', dmg: 6, rate: 15, speed: 130, spread: 0.045, mag: 40, reload: 1.5, range: 50 },
  { base: 'Scattergun', dtype: 'kinetic', dmg: 8, rate: 1.4, speed: 120, spread: 0.12, mag: 6, reload: 2.2, range: 30, count: 8 },
  { base: 'Longrifle', dtype: 'kinetic', dmg: 70, rate: 0.9, speed: 320, spread: 0, mag: 5, reload: 2.4, range: 180 },
  { base: 'Plasma Caster', dtype: 'plasma', dmg: 24, rate: 2.5, speed: 70, spread: 0.01, mag: 10, reload: 1.9, range: 60, aoe: 3 },
  { base: 'Ion Blaster', dtype: 'ion', dmg: 12, rate: 5, speed: 120, spread: 0.015, mag: 20, reload: 1.6, range: 70 },
  { base: 'Beam Carbine', dtype: 'energy', dmg: 9, rate: 8, speed: 220, spread: 0.008, mag: 28, reload: 1.7, range: 100 },
  { base: 'Grenade Launcher', dtype: 'explosive', dmg: 55, rate: 0.9, speed: 50, spread: 0.01, mag: 4, reload: 2.6, range: 70, aoe: 6, gravity: 1 },
];
export const PERSONAL_GEAR = {
  suit: { base: ['Flight Suit', 'Combat Armor', 'Exo-Rig', 'Vanguard Plate'], stats: { hpMax: 60, armor: 5 } },
  shieldgen: { base: ['Shield Belt', 'Barrier Harness', 'Kinetic Ward'], stats: { pShieldMax: 40, pShieldRegen: 6 } },
  implant: { base: ['Reflex Implant', 'Neural Link', 'Myomer Graft', 'Ocular Mod'], stats: {} },
};

export const SLOT_LABELS = {
  weapon1: 'Ship Gun 1', weapon2: 'Ship Gun 2', missile: 'Missiles', shield: 'Shield', engine: 'Engine', reactor: 'Reactor', plating: 'Plating',
  pweapon1: 'Primary', pweapon2: 'Secondary', suit: 'Suit', shieldgen: 'Personal Shield', implant: 'Implant',
};

// Affix pool. cat: which item categories accept it. v: value at tier mult 1 (scaled by tier & level)
export const AFFIXES = [
  { id: 'dmg', stat: 'dmgPct', v: 0.08, cats: ['sweapon', 'pweapon', 'missile'], pre: 'Brutal', suf: 'of Ruin', pct: true, label: 'Damage' },
  { id: 'rate', stat: 'ratePct', v: 0.07, cats: ['sweapon', 'pweapon', 'missile'], pre: 'Rapid', suf: 'of Haste', pct: true, label: 'Fire rate' },
  { id: 'crit', stat: 'crit', v: 0.03, cats: ['sweapon', 'pweapon', 'implant'], pre: 'Keen', suf: 'of Precision', pct: true, label: 'Crit chance' },
  { id: 'critd', stat: 'critDmg', v: 0.15, cats: ['sweapon', 'pweapon', 'implant'], pre: 'Vicious', suf: 'of Execution', pct: true, label: 'Crit damage' },
  { id: 'vel', stat: 'velPct', v: 0.1, cats: ['sweapon', 'pweapon'], pre: 'Hyper', suf: 'of the Comet', pct: true, label: 'Projectile speed' },
  { id: 'eff', stat: 'effPct', v: -0.08, cats: ['sweapon'], pre: 'Efficient', suf: 'of Thrift', pct: true, label: 'Energy cost' },
  { id: 'mag', stat: 'magPct', v: 0.15, cats: ['pweapon'], pre: 'Extended', suf: 'of Plenty', pct: true, label: 'Magazine' },
  { id: 'rel', stat: 'reloadPct', v: -0.1, cats: ['pweapon'], pre: 'Slick', suf: 'of Swiftness', pct: true, label: 'Reload time' },
  { id: 'hull', stat: 'hullMax', v: 40, cats: ['plating', 'shield', 'reactor'], pre: 'Reinforced', suf: 'of the Bastion', label: 'Hull' },
  { id: 'shd', stat: 'shieldMax', v: 35, cats: ['shield', 'reactor', 'plating'], pre: 'Charged', suf: 'of Warding', label: 'Shield' },
  { id: 'shr', stat: 'shieldRegen', v: 3, cats: ['shield', 'reactor'], pre: 'Pulsing', suf: 'of Renewal', label: 'Shield regen /s' },
  { id: 'en', stat: 'energyMax', v: 20, cats: ['reactor', 'engine'], pre: 'Overcharged', suf: 'of Power', label: 'Energy' },
  { id: 'enr', stat: 'energyRegen', v: 4, cats: ['reactor', 'engine'], pre: 'Humming', suf: 'of the Dynamo', label: 'Energy regen /s' },
  { id: 'spd', stat: 'speed', v: 10, cats: ['engine'], pre: 'Swift', suf: 'of the Wind', label: 'Speed' },
  { id: 'trn', stat: 'turn', v: 0.06, cats: ['engine'], pre: 'Agile', suf: 'of the Hawk', label: 'Turn rate' },
  { id: 'jmp', stat: 'jumpRange', v: 0.5, cats: ['engine'], pre: 'Farstriding', suf: 'of the Void', label: 'Jump range', round: true },
  { id: 'arm', stat: 'armor', v: 2, cats: ['plating', 'suit'], pre: 'Hardened', suf: 'of Iron', label: 'Armor' },
  { id: 'hp', stat: 'hpMax', v: 18, cats: ['suit', 'implant', 'shieldgen'], pre: 'Vital', suf: 'of Vigor', label: 'Health' },
  { id: 'psh', stat: 'pShieldMax', v: 14, cats: ['shieldgen', 'suit'], pre: 'Warded', suf: 'of the Aegis', label: 'Personal shield' },
  { id: 'psr', stat: 'pShieldRegen', v: 2, cats: ['shieldgen', 'implant'], pre: 'Restoring', suf: 'of Mending', label: 'P. shield regen /s' },
  { id: 'mv', stat: 'moveSpeed', v: 0.05, cats: ['suit', 'implant'], pre: 'Fleet', suf: 'of the Fox', pct: true, label: 'Move speed' },
  { id: 'luck', stat: 'luck', v: 0.04, cats: ['implant', 'reactor', 'suit'], pre: 'Lucky', suf: 'of Fortune', pct: true, label: 'Loot quality' },
  { id: 'leech', stat: 'leech', v: 0.02, cats: ['sweapon', 'pweapon'], pre: 'Siphoning', suf: 'of the Leech', pct: true, label: 'Repair on hit' },
];

// Special (legendary+) effects on weapons
export const SPECIALS = [
  { id: 'twin', label: '+1 projectile per shot', name: 'Twinned' },
  { id: 'homing', label: 'Projectiles seek targets', name: 'Seeking' },
  { id: 'aoe', label: 'Shots explode on impact', name: 'Detonating' },
  { id: 'pierce', label: 'Shots pierce through targets', name: 'Piercing' },
  { id: 'chain', label: 'Hits arc to a nearby enemy', name: 'Arcing' },
  { id: 'overload', label: '+50% damage below 30% shields', name: 'Desperate' },
];

// ---------- Skills ----------
export const SKILL_TREES = ['Piloting', 'Gunnery', 'Engineering', 'Combat', 'Tech', 'Social', 'Survival'];
export const SKILLS = [
  // Piloting
  { id: 'flight', tree: 'Piloting', name: 'Flight Training', max: 5, desc: '+5% ship speed', fx: { speedPct: 0.05 } },
  { id: 'evasive', tree: 'Piloting', name: 'Evasive Maneuvers', max: 5, desc: '+7% turn rate', fx: { turnPct: 0.07 }, req: ['flight', 1] },
  { id: 'burner', tree: 'Piloting', name: 'Afterburner Mastery', max: 5, desc: '+10% boost power, -6% boost drain', fx: { boostPct: 0.1, boostDrain: -0.06 }, req: ['flight', 2] },
  { id: 'nav', tree: 'Piloting', name: 'Astrogation', max: 5, desc: '+0.6 jump range', fx: { jumpRange: 0.6 } },
  { id: 'cruise', tree: 'Piloting', name: 'Cruise Efficiency', max: 3, desc: '+15% cruise speed', fx: { cruisePct: 0.15 }, req: ['nav', 1] },
  // Gunnery
  { id: 'gunnery', tree: 'Gunnery', name: 'Ship Weapons', max: 5, desc: '+6% ship weapon damage', fx: { sDmgPct: 0.06 } },
  { id: 'cycling', tree: 'Gunnery', name: 'Rapid Cycling', max: 5, desc: '+5% ship fire rate', fx: { sRatePct: 0.05 }, req: ['gunnery', 1] },
  { id: 'targeting', tree: 'Gunnery', name: 'Targeting Computers', max: 5, desc: '+2.5% ship crit chance', fx: { sCrit: 0.025 }, req: ['gunnery', 2] },
  { id: 'ordnance', tree: 'Gunnery', name: 'Ordnance', max: 5, desc: '+12% missile damage, +1 missile capacity', fx: { missilePct: 0.12, missileCap: 1 } },
  { id: 'ionspec', tree: 'Gunnery', name: 'Ion Specialist', max: 3, desc: '+15% ion & energy damage', fx: { ionPct: 0.15 }, req: ['gunnery', 3] },
  { id: 'lead', tree: 'Gunnery', name: 'Ballistics', max: 3, desc: '+8% projectile speed', fx: { velPct: 0.08 } },
  // Engineering
  { id: 'hullrein', tree: 'Engineering', name: 'Hull Reinforcement', max: 5, desc: '+8% hull', fx: { hullPct: 0.08 } },
  { id: 'shieldharm', tree: 'Engineering', name: 'Shield Harmonics', max: 5, desc: '+8% shield capacity', fx: { shieldPct: 0.08 } },
  { id: 'recharge', tree: 'Engineering', name: 'Fast Recharge', max: 5, desc: '+10% shield regen, -0.2s regen delay', fx: { shieldRegenPct: 0.1, regenDelay: -0.2 }, req: ['shieldharm', 1] },
  { id: 'capacitor', tree: 'Engineering', name: 'Capacitors', max: 5, desc: '+10% energy & energy regen', fx: { energyPct: 0.1 } },
  { id: 'fieldrep', tree: 'Engineering', name: 'Damage Control', max: 5, desc: 'Repair 0.6 hull/s', fx: { hullRegen: 0.6 }, req: ['hullrein', 2] },
  // Combat
  { id: 'firearms', tree: 'Combat', name: 'Firearms', max: 5, desc: '+6% personal weapon damage', fx: { pDmgPct: 0.06 } },
  { id: 'trigger', tree: 'Combat', name: 'Trigger Discipline', max: 5, desc: '+5% personal fire rate', fx: { pRatePct: 0.05 }, req: ['firearms', 1] },
  { id: 'deadeye', tree: 'Combat', name: 'Deadeye', max: 5, desc: '+3% personal crit chance', fx: { pCrit: 0.03 }, req: ['firearms', 2] },
  { id: 'tough', tree: 'Combat', name: 'Toughness', max: 5, desc: '+10% health', fx: { hpPct: 0.1 } },
  { id: 'pshield', tree: 'Combat', name: 'Shield Discipline', max: 5, desc: '+10% personal shields', fx: { pShieldPct: 0.1 } },
  { id: 'sprint', tree: 'Combat', name: 'Athletics', max: 5, desc: '+5% move speed, higher jumps', fx: { movePct: 0.05 } },
  { id: 'reload', tree: 'Combat', name: 'Quick Hands', max: 3, desc: '-10% reload time', fx: { reloadPct: -0.1 }, req: ['trigger', 1] },
  // Tech
  { id: 'hacking', tree: 'Tech', name: 'Hacking', max: 5, desc: 'Open locked caches, +10% boarding loot', fx: { hack: 1 } },
  { id: 'salvage', tree: 'Tech', name: 'Salvaging', max: 5, desc: '+6% loot quality, +10% drop chance', fx: { luck: 0.06, dropPct: 0.1 } },
  { id: 'scanning', tree: 'Tech', name: 'Scanning', max: 5, desc: '+15% radar range', fx: { radarPct: 0.15 } },
  { id: 'ionlock', tree: 'Tech', name: 'Disabling Strikes', max: 3, desc: '+20% chance ships are disabled (boardable) instead of destroyed', fx: { disable: 0.2 }, req: ['hacking', 1] },
  // Social
  { id: 'commerce', tree: 'Social', name: 'Commerce', max: 5, desc: 'Buy 4% cheaper, sell 4% higher', fx: { trade: 0.04 } },
  { id: 'diplomacy', tree: 'Social', name: 'Diplomacy', max: 5, desc: '+15% reputation gains, -10% losses', fx: { repGain: 0.15, repLoss: -0.1 } },
  { id: 'leadership', tree: 'Social', name: 'Leadership', max: 5, desc: '+12% crew bonuses, +1 crew slot per 2 ranks', fx: { crewPct: 0.12, crewCap: 0.5 } },
  { id: 'bounty', tree: 'Social', name: 'Bounty Hunter', max: 5, desc: '+10% mission rewards', fx: { missionPct: 0.1 } },
  { id: 'intimidate', tree: 'Social', name: 'Intimidation', max: 3, desc: 'Better odds when demanding cargo', fx: { intimidate: 1 } },
  // Survival
  { id: 'medic', tree: 'Survival', name: 'Field Medic', max: 5, desc: '+20% healing from medkits', fx: { healPct: 0.2 } },
  { id: 'envsuit', tree: 'Survival', name: 'Environmental Training', max: 5, desc: '-15% hazard damage', fx: { hazard: -0.15 } },
  { id: 'scavenger', tree: 'Survival', name: 'Scavenger', max: 5, desc: '+20% minerals from deposits', fx: { mining: 0.2 } },
];

export const BIOMES = [
  { id: 'desert', name: 'Desert', ground: [0xd9a05b, 0xb5733a, 0xf0d098], sky: 0xf2b77a, fog: 0xe0a46c, hazard: 0, water: false },
  { id: 'ice', name: 'Frozen', ground: [0xdfeefc, 0x9bbbd8, 0xffffff], sky: 0xbfd8f0, fog: 0xd0e4f5, hazard: 2, water: false },
  { id: 'jungle', name: 'Jungle', ground: [0x3f8d3a, 0x2a5e2a, 0x7ab84a], sky: 0x9fd6b6, fog: 0x7cae8f, hazard: 0, water: true },
  { id: 'volcanic', name: 'Volcanic', ground: [0x3a2a2a, 0x1e1616, 0xff5a1f], sky: 0x8a3a24, fog: 0x5a2a20, hazard: 5, water: false },
  { id: 'toxic', name: 'Toxic', ground: [0x8fa23a, 0x5d6e26, 0xc9e04f], sky: 0xb6c46a, fog: 0x9aa84f, hazard: 4, water: true },
  { id: 'barren', name: 'Barren', ground: [0x8a8a8f, 0x5e5e63, 0xb2b2b8], sky: 0x1a1a24, fog: 0x2a2a34, hazard: 1, water: false },
  { id: 'ocean', name: 'Oceanic', ground: [0x6fbf73, 0xd8c78f, 0x4f9a52], sky: 0x8fc8ff, fog: 0x9fd0ff, hazard: 0, water: true },
  { id: 'crystal', name: 'Crystalline', ground: [0x9a6fd8, 0x5a3f8f, 0xe0b8ff], sky: 0x6a4f9f, fog: 0x7a5faf, hazard: 2, water: false },
];

export const IDEOLOGIES = [
  { id: 'militarist', name: 'Militarist', baseRep: 0, war: 0.4 },
  { id: 'mercantile', name: 'Mercantile', baseRep: 15, war: 0.1 },
  { id: 'pirate', name: 'Pirate', baseRep: -60, war: 0.8 },
  { id: 'scientific', name: 'Scientific', baseRep: 10, war: 0.1 },
  { id: 'zealot', name: 'Zealot', baseRep: -10, war: 0.5 },
  { id: 'isolationist', name: 'Isolationist', baseRep: -5, war: 0.25 },
];

export const NPC_ROLES = [
  { id: 'merchant', name: 'Merchant', crew: { stat: 'trade', v: 0.03, label: 'better prices' } },
  { id: 'soldier', name: 'Soldier', crew: { stat: 'pDmgPct', v: 0.05, label: 'personal damage' } },
  { id: 'pilot', name: 'Pilot', crew: { stat: 'turnPct', v: 0.05, label: 'turn rate' } },
  { id: 'engineer', name: 'Engineer', crew: { stat: 'shieldRegenPct', v: 0.08, label: 'shield regen' } },
  { id: 'gunner', name: 'Gunner', crew: { stat: 'sDmgPct', v: 0.05, label: 'ship damage' } },
  { id: 'scientist', name: 'Scientist', crew: { stat: 'luck', v: 0.04, label: 'loot quality' } },
  { id: 'medic', name: 'Medic', crew: { stat: 'hpPct', v: 0.06, label: 'health' } },
  { id: 'smuggler', name: 'Smuggler', crew: { stat: 'speedPct', v: 0.04, label: 'ship speed' } },
];

export const HULL_CLASSES = [
  { id: 'scout', name: 'Scout', hull: 180, shield: 80, speed: 260, turn: 1.9, slots: 1, crew: 1, cargo: 10, size: 1.0, price: 9000 },
  { id: 'fighter', name: 'Fighter', hull: 260, shield: 120, speed: 230, turn: 1.7, slots: 2, crew: 1, cargo: 12, size: 1.1, price: 18000 },
  { id: 'interceptor', name: 'Interceptor', hull: 220, shield: 140, speed: 300, turn: 2.1, slots: 2, crew: 1, cargo: 8, size: 1.0, price: 26000 },
  { id: 'gunship', name: 'Gunship', hull: 480, shield: 220, speed: 180, turn: 1.2, slots: 3, crew: 3, cargo: 20, size: 1.6, price: 48000 },
  { id: 'corvette', name: 'Corvette', hull: 620, shield: 300, speed: 170, turn: 1.0, slots: 3, crew: 4, cargo: 30, size: 2.0, price: 75000 },
  { id: 'freighter', name: 'Freighter', hull: 700, shield: 180, speed: 140, turn: 0.7, slots: 1, crew: 3, cargo: 80, size: 2.4, price: 52000 },
  { id: 'frigate', name: 'Frigate', hull: 1100, shield: 480, speed: 140, turn: 0.75, slots: 4, crew: 6, cargo: 45, size: 3.0, price: 140000 },
];
