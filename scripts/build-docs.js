// Generates docs/PLAYER_GUIDE.md from the live game data so the docs never drift.
// Run with: npm run docs
import { writeFileSync } from 'fs';
import { TIERS, DAMAGE_TYPES, BIOMES, HULL_CLASSES, SKILLS, SKILL_TREES, SPECIALS, NPC_ROLES, IDEOLOGIES, SHIP_WEAPONS, SHIP_MISSILES, PERSONAL_WEAPONS } from '../src/data.js';
import { COMMODITIES } from '../src/gen/items.js';
import { VERSION, LINKS } from '../src/guide.js';

const t = (head, rows) => `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}\n`;
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const dmgNote = { kinetic: 'Cheap and reliable, rips hull', energy: 'All-rounder, good on shields', ion: 'Strips shields; raises the chance to disable ships for boarding', plasma: 'Heavy, slow bolts', explosive: 'Area damage: missiles, flak, grenades' };

const md = `# Starward Player Guide

*Version ${VERSION}. This guide is generated from the game's data (\`npm run docs\`). The same guide is in the game: press **G**.*

**[▶ Play Starward](${LINKS.play})** · Made by **[Jeremy Anderson Tech](${LINKS.site})**

## Contents

1. [Getting started](#getting-started)
2. [Flying and combat](#flying-and-combat)
3. [Damage types](#damage-types)
4. [Weapons](#weapons)
5. [Boarding and capturing ships](#boarding-and-capturing-ships)
6. [Signals and events](#signals-and-events)
7. [Asteroid mining](#asteroid-mining)
8. [Capital ships](#capital-ships)
9. [Wingmen](#wingmen)
10. [Workshop and crafting](#workshop-and-crafting)
11. [Stations](#stations)
12. [Planets and exploration](#planets-and-exploration)
13. [Loot and gear](#loot-and-gear)
14. [Skills](#skills)
15. [Factions and reputation](#factions-and-reputation)
16. [Trading and economy](#trading-and-economy)
17. [Contracts](#contracts)
18. [Ships and crew](#ships-and-crew)
19. [Controls](#controls)
20. [Graphics, saving and troubleshooting](#graphics-saving-and-troubleshooting)
21. [About](#about)

## Getting started

You captain a small fighter in a galaxy generated from a seed. There's no script: pick a direction, take contracts, trade, explore planets, board ships, and grow your captain, ship and crew.

1. **Dock** at the station you start next to: fly close and press **E** (or tap **USE**). Check the **Mission Board** and the **Gear Market**.
2. **Spend your skill points** (**K**). Ship Weapons, Shield Harmonics and Flight Training are strong first picks.
3. **Take a nearby contract.** Surveys and courier runs are safe; bounties pay more.
4. **Open the galaxy map** (**M**), pick a star inside the dashed circle (your jump range) and engage the jump drive.
5. **Land** on planets (**L**) to mine ore, open caches and find relics in alien ruins.

Danger and loot level rise the farther you travel from your starting system. Unclaimed space and pirate territory are the most dangerous and the most rewarding.

**Seeds:** the same seed always builds the same galaxy, so you can share yours with friends. The About screen shows your current seed.

## Flying and combat

- Steer with the mouse. Click the view to capture it, then move the **gold ring** where you want to go and the ship turns to follow. Prefer the old steering, where the cursor works like a joystick? Switch it under **Pause → Controls**.
- **W / S** set throttle, **X** stops, **A / D** yaw, **Q / E** roll.
- **Boost** (**Shift**) burns energy. **Cruise** (**C**) crosses a system fast but can't start near hostiles and drops out when you're hit.
- **T** cycles targets (hostiles first); **R** targets whatever is ahead.
- The **blue reticle** shows where your guns will hit. Guns swivel toward your aim, and when your aim is on the **gold lead diamond** they lock onto it, so put the ring on the diamond and fire. On a gamepad or touch, the ship also nudges itself toward a locked target's diamond.
- **V** cycles the camera: chase, cockpit and a wide chase view.
- Missiles (**right mouse** / **F**) home on your locked target. Restock them at stations.
- Shields regenerate after a few seconds without taking damage. Hull doesn't: repair it at a station or learn **Damage Control**.
- If your ship is destroyed you wake at the last station you docked at, minus 15% of your credits and your cargo.

## Damage types

${t(['Type', 'vs Shields', 'vs Hull', 'Notes'], Object.entries(DAMAGE_TYPES).map(([k, d]) => [`**${cap(k)}**`, `×${d.shield}`, `×${d.hull}`, dmgNote[k]]))}
A good loadout pairs an ion or energy gun (to drop shields) with a kinetic or explosive one (to finish the hull).

## Weapons

Every weapon is generated from one of these bases, then scaled by tier and level and given bonus stats. The numbers below are base values at level 1, Common tier.

**Ship guns**

${t(['Base', 'Type', 'Damage', 'Shots/s', 'Range'], SHIP_WEAPONS.map(w => [w.base, cap(w.dtype), w.dmg + (w.count ? ` × ${w.count}` : ''), w.rate, w.range]))}
**Missile launchers**

${t(['Base', 'Damage', 'Capacity', 'Range'], SHIP_MISSILES.map(w => [w.base, w.dmg + (w.count ? ` × ${w.count}` : ''), w.ammo, w.range]))}
**Personal weapons**

${t(['Base', 'Type', 'Damage', 'Shots/s', 'Magazine'], PERSONAL_WEAPONS.map(w => [w.base, cap(w.dtype), w.dmg + (w.count ? ` × ${w.count}` : ''), w.rate, w.mag]))}
Any weapon can also roll a different damage type, and higher tiers are more likely to.

## Boarding and capturing ships

When you knock out a ship, it sometimes ends up **disabled** (shown in gold) instead of destroyed. Ion damage and the **Disabling Strikes** skill make this much more likely.

1. Fly close, slow down, and press **E** to board.
2. Fight through the crew to the bridge, where the captain and a locked cache wait.
3. Return to the airlock and choose:
   - **Claim it.** It becomes your ship: your gear moves over and its guns go to your inventory.
   - **Scuttle it** for two pieces of gear, credits and XP.
   - **Leave** it adrift.

**Reading a gunfight.** An enemy who spots you raises its rifle, and the muzzle starts to glow red. When the glow peaks, about a second later, it fires, so that's your cue to strafe or duck behind cover. Allies show the same glow in blue.

You can also **hail** friendly or neutral ships (**E** when close) to hear rumors, trade, visit aboard peacefully, or demand their cargo. Demanding is piracy: it costs reputation, and they may fight back. Your odds improve with Intimidation and level.

## Signals and events

Every system has **unknown signals**, shown as purple **?** markers and radar dots, and new ones appear while you fly. Get within about 2.5 km to find out what they are:

${t(['Signal', 'What happens'], [['Distress call', 'A freighter under pirate attack. Save it for credits, XP, reputation with its faction and sometimes gear.'], ['Ambush', 'The distress call was bait. Pirates jump in around you.'], ['Derelict', 'An abandoned ship to explore (**E**) for extra caches. A few scavengers may be aboard. Scuttle it on the way out for parts.'], ['Anomaly', 'Fly within 300 m, press **E** and hold position for 5 seconds. Rewards: XP plus a relic, datachip, high-tier gear or parts.'], ['Battle', 'Two factions at war fighting it out. Watch, pick a side, or loot what is left.']])}
Signals aren't saved: every visit to a system rolls new ones.

## Asteroid mining

Systems with an asteroid belt have mineable rocks, marked **Asteroid field** on the HUD and shown as brown radar dots. Shoot them; kinetic and explosive weapons break rock fastest.

${t(['Rock', 'Drops'], [['Grey-brown', 'Raw Ore'], ['Glowing violet', 'Void Crystals'], ['Gold (rare)', 'Xeno Relics']])}
Fly through the cargo crate to collect it. Some rocks also give Workshop parts. **Scavenger** increases the yield.

## Capital ships

**Dreadnoughts** prowl dangerous systems (threat 4+), usually with escorts. They turn slowly, but six independent turrets track everything around them, and many carry missile racks. Stay mobile, strip shields with ion or energy weapons, and bring wingmen.

Each turret you see on the hull is a real gun: shots leave from the turrets, so the side facing you is the one shooting at you.

Their huge hull makes them hard to disable, but if you manage it you can board and claim one. Destroying one drops a pile of high-quality loot. A ⚠ marker shows where they are.

## Wingmen

Any two crew members can **fly as wingmen**. Open the **Character** tab (**I** → Character) and choose **Fly as wingman**.

- **Ships:** pilots fly interceptors, gunners and soldiers fly gunships, and everyone else flies fighters.
- **Behavior:** wingmen hold formation, attack whatever you're fighting, defend you, and keep up through cruise and jumps. Their kills count as yours.
- **Losses:** a wingman whose ship is destroyed ejects, and is ready again the next time you dock.

## Workshop and crafting

Every station has a **Workshop** that runs on **parts**. You get parts by salvaging gear you don't need (better and higher-level items give more), scuttling boarded ships and derelicts, mining, and scanning anomalies.

| Action | Effect |
|---|---|
| **Upgrade** | Raises an item one tier: stronger base stats, stronger bonuses, plus one new bonus. Weapons gain special effects at Legendary and Mythic. |
| **Reforge** | Re-rolls which bonuses an item has and how strong they are. |
| **Salvage** | Breaks an unequipped item down into parts. |

Equipped gear can be upgraded and reforged in place. Both cost parts plus some credits, and the cost rises with tier and level.

## Stations

A station's shape tells you what it is before you read its name: a **Station** is a spinning wheel, a **Spire** a tall needle of stacked decks, a **Citadel** an armoured fortress with gun bastions, a **Dock** a shipyard with a hull on the slip, an **Exchange** a trade hub with cargo on its docking arms, an **Outpost** a cluster of pressurised cans and solar wings, and a **Haven** a base dug into an asteroid.

## Planets and exploration

Fly within range of a planet and press **L** to land. Terrain, props, outposts, wildlife and loot are all generated from the planet's seed.

${t(['Biome', 'Hazard'], BIOMES.map(b => [b.name, b.hazard ? `${b.hazard} (drains shields, then health)` : 'None']))}
- **Faction outposts** have merchants, medics and engineers. Engineers and scientists can teach you a skill point.
- **Pirate camps** are hostile and guard caches.
- **Alien ruins** hold relic vaults guarded by creatures. Relics sell for a fortune.
- **Deposits** of ore, void crystals and relics can be extracted into your cargo hold.
- **Locked caches** (red) need the Hacking skill.

Wildlife comes in many body plans: four-legged beasts, two-legged raptors, low armoured crawlers (some with a scorpion's stinger), spiders, drifting floaters and winged flyers. All of them bite at close range, so keep your distance. **Ruin Guardians** are stone golems with a glowing core.

Walk back to your ship and press **E** to launch.

## Loot and gear

${t(['Tier', 'Power', 'Bonus stats'], TIERS.map(x => [`**${x.name}**`, `×${x.mult}`, x.affixes]))}
**Legendary and Mythic special effects:**

${SPECIALS.map(s => `- **${s.name}**: ${s.label.toLowerCase()}`).join('\n')}

**Ship slots:** up to 4 guns (depends on hull), missiles, shield, engine, reactor, plating.
**Personal slots:** primary, secondary, suit, personal shield, implant.

Item level follows the system you found it in. Hover any item for a comparison with what you have equipped. **Datachips** teach a skill rank instantly; **medkits** heal on foot (**H**). Inventory holds 40 items.

## Skills

You earn a skill point every level (two every fifth level). You can also get them from datachips, station training sims, and engineers or scientists on planets. There are ${SKILLS.length} skills across ${SKILL_TREES.length} trees; some need a rank in another skill first.

${SKILL_TREES.map(tree => `### ${tree}\n\n${t(['Skill', 'Ranks', 'Per rank', 'Requires'], SKILLS.filter(s => s.tree === tree).map(s => [`**${s.name}**`, s.max, s.desc, s.req ? `${SKILLS.find(x => x.id === s.req[0]).name} ${s.req[1]}` : '—']))}`).join('\n')}
## Factions and reputation

Seven factions share each galaxy. Each has an ideology, a home species, territory, and relations with the others. Factions at war fight on sight.

${t(['Ideology', 'Starting attitude'], IDEOLOGIES.map(i => [i.name, i.baseRep >= 10 ? 'Friendly' : i.baseRep <= -30 ? 'Hostile' : 'Neutral']))}
Reputation runs from −100 to +100:

${t(['Range', 'Standing'], [['−100 to −60', 'Nemesis'], ['−59 to −30', 'Hostile (attacks on sight)'], ['−29 to 9', 'Neutral'], ['10 to 39', 'Friendly'], ['40 to 74', 'Trusted'], ['75 to 100', 'Allied']])}
- Attacking or destroying a faction's ships costs reputation with them and their allies, and earns a little with their enemies.
- Completing contracts raises reputation with the faction that posted them.
- Diplomacy increases gains and reduces losses.

## Trading and economy

Each system sets its own prices. In the Commodity exchange, goods marked *cheap here* are worth buying and goods marked *in demand* are worth selling.

${t(['Commodity', 'Base price'], COMMODITIES.map(c => [c.name, `${c.base} cr`]))}
Cargo space depends on your hull. Mining on planets fills your hold for free, and Commerce lowers buy prices and raises sell prices.

## Contracts

${t(['Contract', 'What to do'], [['Bounty', 'A named ship and its escorts spawn when you arrive in the target system. Destroy it.'], ['Recover black box', 'Board the derelict and loot the recorder from its bridge.'], ['Courier run', 'Dock at the named station.'], ['Survey', 'Land on the named planet.'], ['Raid', 'Land on the named planet and defeat the warlord.']])}
You can hold five contracts at once. Targets show as gold diamonds on the galaxy map and as ◆ markers in-system. Mission boards refresh over time. Bounty Hunter raises contract payouts.

## Ships and crew

${t(['Hull', 'Hull pts', 'Shield', 'Speed', 'Turn', 'Guns', 'Crew', 'Cargo', 'Price'], HULL_CLASSES.map(h => [`**${h.name}**`, h.hull, h.shield, h.speed, h.turn, h.slots, h.crew, h.cargo, `${h.price.toLocaleString('en-US')} cr`]))}
Every hull class has its own look. Scouts and interceptors are slim darts, gunships are flying slabs of armour with weapon pods, corvettes and frigates carry a raised bridge and turrets, freighters haul rows of cargo containers, and a Dreadnought is a three-tiered warship with a command tower. In the cockpit view you sit in your ship's own cockpit or on its bridge.

Buy hulls at station shipyards (your old ship is traded in for 45% of its price) or capture them by boarding. Dreadnoughts are rarely for sale.

**Crew** give passive bonuses that grow with their level. Leadership adds crew slots and strengthens bonuses.

${t(['Role', 'Crew bonus'], NPC_ROLES.map(r => [r.name, cap(r.crew.label)]))}
## Controls

### Keyboard and mouse: flying

${t(['Key', 'Action'], [['Mouse', 'Aim; the ship follows (click to capture)'], ['W / S · X', 'Throttle · all stop'], ['Scroll wheel', 'Throttle'], ['A / D · Q / E', 'Yaw · roll'], ['Shift · C', 'Boost · cruise'], ['Left mouse / Space', 'Guns'], ['Right mouse / F', 'Missile'], ['T · R', 'Cycle targets · target ahead'], ['E', 'Dock, board, hail'], ['L', 'Land'], ['V', 'Camera: chase, cockpit, wide'], ['M', 'Galaxy map']])}
### Keyboard and mouse: on foot

${t(['Key', 'Action'], [['WASD · Mouse', 'Move · look'], ['Left mouse', 'Fire'], ['R', 'Reload'], ['1 / 2', 'Switch weapon'], ['Space · Shift', 'Jump · sprint'], ['E', 'Talk, loot, mine, exit'], ['H', 'Medkit'], ['V', 'First / third person']])}
### Menus

${t(['Key', 'Menu'], [['I / Tab', 'Inventory'], ['K', 'Skills'], ['J', 'Missions'], ['M', 'Galaxy map'], ['G', 'Field Guide'], ['Esc / P', 'Pause']])}
### Touch

- **Left thumb:** steer (flying) or move (on foot).
- **Right thumb:** drag for throttle and roll (flying) or to look (on foot).
- **Buttons:** FIRE, MSL, BOOST, USE, TARGET, CRUISE when flying; FIRE, JUMP, USE, RELOAD, SWAP, HEAL, SPRINT on foot.
- **Top right:** VIEW (camera), MAP, GEAR, MENU.

### Gamepad (standard layout)

${t(['Input', 'Flying', 'On foot'], [['Left stick', 'Pitch / yaw', 'Move'], ['Right stick', 'Roll / throttle', 'Look'], ['RT · LT', 'Guns · missile', 'Fire'], ['RB', 'Boost', '—'], ['A', 'Interact', 'Jump'], ['B', 'Target ahead', 'Interact'], ['X', '—', 'Reload'], ['Y', 'Target', 'Swap weapon'], ['L3', 'Cruise', 'Sprint'], ['R3', 'Camera', 'First / third person'], ['D-pad down', '—', 'Medkit'], ['Back · Start', 'Inventory · pause', 'Inventory · pause']])}
In menus, the D-pad or left stick moves the highlight, **A** selects, **B** goes back and **LB / RB** switch tabs. On the galaxy map the D-pad picks stars, the triggers zoom and **A** engages the jump drive.

## Graphics, saving and troubleshooting

- Starward picks a **Low / Medium / High** preset for your device and adjusts render resolution to hold the frame rate. Change it under **Pause → Graphics**, which also has an FPS counter.
- Texture and terrain detail changes apply the next time you enter a system or land.
- Progress saves automatically in your browser (and when you dock or jump). Clearing site data erases it. Private browsing windows may not keep saves.
- **Choppy?** Switch to Low, turn glow (bloom) off, and close other heavy tabs.
- **Mouse won't steer on foot?** Click the game view to capture the mouse, and press **Esc** to release it.
- Found a bug? **[Open an issue](${LINKS.issues})** with your browser, device and what happened.

## About

Starward is made by **Jeremy Anderson** of **[Jeremy Anderson Tech](${LINKS.site})**, a software architect and WordPress engineer in Shrewsbury, Massachusetts, who builds websites, plugins, web apps and browser games.

- Website: **[jeremyanderson.tech](${LINKS.site})**
- Want something like this built? **[Book a call](${LINKS.book})**
- Play: **[cptnope.github.io/Starward](${LINKS.play})**
- Source: **[github.com/CptNope/Starward](${LINKS.repo})**

Built with [three.js](${LINKS.three}). MIT License.
`;
writeFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), md);
console.log('docs/PLAYER_GUIDE.md written');
