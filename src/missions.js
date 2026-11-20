import { RNG, hashInts } from './rng.js';
import { getSystem, dist, genNPC } from './gen/universe.js';
import { personName, shipName } from './gen/names.js';

let mid = 1;
export function genMissions(U, sysId, station, dayKey) {
  const r = new RNG(hashInts(station.seed, dayKey));
  const here = U.systems[sysId];
  const giver = U.factions[station.faction];
  const near = U.systems.filter(s => s.id !== sysId && dist(s, here) < 16).sort((a, b) => dist(a, here) - dist(b, here));
  const pick = () => near.length ? r.pick(near.slice(0, 12)) : here;
  const enemies = U.factions.filter(f => f.id !== giver.id && ((giver.relations[f.id] ?? 0) < -40 || f.ideology === 'pirate'));
  const out = [];
  const n = r.int(4, 6);
  for (let i = 0; i < n; i++) {
    const type = r.weighted([['bounty', 4], ['derelict', 2], ['delivery', 3], ['survey', 2], ['raid', 2]]);
    const target = r.chance(0.35) ? here : pick();
    const det = getSystem(U, target.id);
    const lvl = target.level;
    const enemy = enemies.length ? r.pick(enemies) : U.factions.find(f => f.ideology === 'pirate');
    const base = 300 + lvl * 160 + dist(here, target) * 25;
    const m = { id: `m${Date.now().toString(36)}${mid++}${i}`, type, sysId: target.id, sysName: target.name, level: lvl, giver: giver.id, giverName: giver.name, done: false, faction: enemy.id };
    if (type === 'bounty') {
      m.targetName = `${personName(enemy.culture, r)}'s ${shipName(r, enemy.culture)}`; m.cls = r.pick(['gunship', 'corvette', 'interceptor', 'fighter']); m.escorts = r.int(1, 3);
      m.title = `Bounty: ${m.targetName}`; m.desc = `Hunt down a ${enemy.name} ${m.cls} and its escorts in ${target.name}.`; m.reward = { credits: Math.round(base * 1.6), xp: 60 + lvl * 25, rep: 6 };
    } else if (type === 'derelict') {
      m.targetName = `${shipName(r, enemy.culture)} (derelict)`;
      m.title = `Recover black box`; m.desc = `A ship went dark in ${target.name}. Board the ${m.targetName} and recover its flight recorder from the bridge.`; m.reward = { credits: Math.round(base * 1.2), xp: 50 + lvl * 20, rep: 4 };
    } else if (type === 'delivery') {
      const sts = det.stations.filter(s => !(target.id === sysId && s.id === station.id));
      if (!sts.length) { i--; continue; }
      const st = r.pick(sts); m.stationId = st.id; m.stationName = st.name;
      m.title = `Courier run to ${st.name}`; m.desc = `Deliver a sealed package to ${st.name} in ${target.name}. Dock there to complete.`; m.reward = { credits: Math.round(base * 0.9), xp: 30 + lvl * 12, rep: 3 };
    } else if (type === 'survey') {
      if (!det.planets.length) { i--; continue; }
      const pl = r.pick(det.planets); m.planetId = pl.id; m.planetName = pl.name;
      m.title = `Survey ${pl.name}`; m.desc = `Land on ${pl.name} in ${target.name} and log its biosphere.`; m.reward = { credits: Math.round(base * 0.8), xp: 40 + lvl * 15, rep: 3 };
    } else if (type === 'raid') {
      if (!det.planets.length) { i--; continue; }
      const pl = r.pick(det.planets); m.planetId = pl.id; m.planetName = pl.name;
      m.targetName = personName(enemy.culture, r);
      m.title = `Raid: ${m.targetName}'s camp`; m.desc = `${enemy.name} warlord ${m.targetName} is dug in on ${pl.name} (${target.name}). Land and take them out.`; m.reward = { credits: Math.round(base * 1.8), xp: 80 + lvl * 25, rep: 7 };
    }
    m.reward.item = r.chance(0.5);
    out.push(m);
  }
  return out;
}
