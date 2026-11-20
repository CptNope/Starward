import { RNG } from '../rng.js';

const ONSETS = ['b', 'br', 'c', 'ch', 'd', 'dr', 'f', 'g', 'gr', 'h', 'j', 'k', 'kr', 'l', 'm', 'n', 'p', 'qu', 'r', 's', 'sh', 'st', 't', 'th', 'tr', 'v', 'vr', 'x', 'z', 'zh', 'y', 'w', 'sk', 'kh', 'ph'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ae', 'ai', 'au', 'ei', 'ia', 'io', 'oa', 'ou', 'y', 'ee', 'aa', 'ui'];
const CODAS = ['', '', '', 'n', 'r', 's', 'th', 'x', 'l', 'k', 'm', 'nd', 'rk', 'sh', 'z', 'v', 'st', 'ng'];

// A "culture" is a phonetic palette; each faction/species gets one so its names sound related.
export function makeCulture(seed) {
  const r = new RNG(seed);
  const pickSome = (arr, n) => r.shuffle(arr.slice()).slice(0, n);
  return {
    onsets: pickSome(ONSETS, r.int(7, 13)),
    vowels: pickSome(VOWELS, r.int(4, 8)),
    codas: pickSome(CODAS, r.int(4, 8)),
    minSyl: r.int(1, 2), maxSyl: r.int(2, 3),
    apostrophe: r.chance(0.2),
    hyphen: r.chance(0.12),
  };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function cultureWord(c, r, sylls) {
  const n = sylls ?? r.int(c.minSyl, c.maxSyl);
  let w = '';
  for (let i = 0; i < n; i++) {
    if (i > 0 && c.apostrophe && r.chance(0.15)) w += "'";
    w += r.pick(c.onsets) + r.pick(c.vowels);
    if (i === n - 1 || r.chance(0.3)) w += r.pick(c.codas);
  }
  return cap(w);
}

export function personName(c, r) {
  const first = cultureWord(c, r, r.int(1, 2));
  const last = cultureWord(c, r);
  return c.hyphen && r.chance(0.5) ? `${first}-${last}` : `${first} ${last}`;
}

const STAR_SUFFIX = ['Prime', 'Major', 'Minor', 'Reach', 'Expanse', 'Drift', 'Gate', 'Rift', 'Deep', 'Hollow', 'Crossing', 'Verge'];
const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Sigma', 'Tau', 'Omega'];

export function starName(r, c) {
  const base = cultureWord(c, r);
  const t = r.next();
  if (t < 0.3) return `${base} ${r.pick(STAR_SUFFIX)}`;
  if (t < 0.5) return `${r.pick(GREEK)} ${base}`;
  if (t < 0.62) return `${base}-${r.int(2, 999)}`;
  return base;
}
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const ADJ = ['Crimson', 'Iron', 'Silent', 'Golden', 'Shattered', 'Eternal', 'Azure', 'Obsidian', 'Radiant', 'Free', 'Black', 'Verdant', 'Ashen', 'Hollow', 'Sovereign', 'Ivory', 'Scarlet', 'Void', 'Solar', 'Frozen'];
const NOUN = ['Concord', 'Dominion', 'Compact', 'Syndicate', 'Covenant', 'Hegemony', 'Collective', 'Union', 'Cartel', 'Order', 'Republic', 'Clans', 'Directorate', 'Accord', 'League', 'Brotherhood', 'Assembly', 'Throne', 'Combine', 'Remnant'];
const BY_IDEOLOGY = {
  pirate: ['Cartel', 'Clans', 'Brotherhood', 'Raiders', 'Corsairs', 'Reavers'],
  mercantile: ['Combine', 'Trade League', 'Compact', 'Consortium', 'Exchange'],
  militarist: ['Dominion', 'Hegemony', 'Directorate', 'Legion', 'Empire'],
  scientific: ['Collective', 'Institute', 'Accord', 'Conclave', 'Archive'],
  zealot: ['Covenant', 'Order', 'Throne', 'Faithful', 'Ascendancy'],
  isolationist: ['Remnant', 'Union', 'Enclave', 'Sanctum', 'Holdfast'],
};

export function factionName(r, c, ideology) {
  const noun = r.chance(0.75) ? r.pick(BY_IDEOLOGY[ideology] || NOUN) : r.pick(NOUN);
  return r.chance(0.5) ? `${r.pick(ADJ)} ${noun}` : `${cultureWord(c, r, 2)} ${noun}`;
}

export function shipName(r, c) {
  const forms = [
    () => `${r.pick(ADJ)} ${r.pick(['Wake', 'Fang', 'Promise', 'Horizon', 'Spear', 'Lantern', 'Vow', 'Gambit', 'Tide', 'Comet', 'Requiem', 'Dawn'])}`,
    () => cultureWord(c, r),
    () => `${cultureWord(c, r)}'s ${r.pick(['Fortune', 'Revenge', 'Folly', 'Pride', 'Lament', 'Grace'])}`,
  ];
  return r.pick(forms)();
}

export function manufacturer(r, c) {
  return `${cultureWord(c, r, 2)} ${r.pick(['Armories', 'Dynamics', 'Arms', 'Works', 'Forge', 'Systems', 'Industries', 'Kinetics'])}`;
}
