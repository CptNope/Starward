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
6. [Planets and exploration](#planets-and-exploration)
7. [Loot and gear](#loot-and-gear)
8. [Skills](#skills)
9. [Factions and reputation](#factions-and-reputation)
10. [Trading and economy](#trading-and-economy)
11. [Contracts](#contracts)
12. [Ships and crew](#ships-and-crew)
13. [Controls](#controls)
14. [Graphics, saving and troubleshooting](#graphics-saving-and-troubleshooting)
15. [About](#about)

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

- Steer with the mouse; the gold square is your virtual stick. Click the view to capture the mouse for finer control.
- **W / S** set throttle, **X** stops, **A / D** yaw, **Q / E** roll.
- **Boost** (**Shift**) burns energy. **Cruise** (**C**) crosses a system fast but can't start near hostiles and drops out when you're hit.
- **T** cycles targets (hostiles first); **R** targets whatever is ahead.
- Guns are gimballed: aim near the **gold lead diamond** and shots bend onto it.
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

You can also **hail** friendly or neutral ships (**E** when close) to hear rumors, trade, visit aboard peacefully, or demand their cargo. Demanding is piracy: it costs reputation, and they may fight back. Your odds improve with Intimidation and level.

## Planets and exploration

Fly within range of a planet and press **L** to land. Terrain, props, outposts, wildlife and loot are all generated from the planet's seed.

${t(['Biome', 'Hazard'], BIOMES.map(b => [b.name, b.hazard ? `${b.hazard} (drains shields, then health)` : 'None']))}
- **Faction outposts** have merchants, medics and engineers. Engineers and scientists can teach you a skill point.
- **Pirate camps** are hostile and guard caches.
- **Alien ruins** hold relic vaults guarded by creatures. Relics sell for a fortune.
- **Deposits** of ore, void crystals and relics can be extracted into your cargo hold.
- **Locked caches** (red) need the Hacking skill.

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
Buy hulls at station shipyards (your old ship is traded in for 45% of its price) or capture them by boarding.

**Crew** give passive bonuses that grow with their level. Leadership adds crew slots and strengthens bonuses.

${t(['Role', 'Crew bonus'], NPC_ROLES.map(r => [r.name, cap(r.crew.label)]))}
## Controls

### Keyboard and mouse: flying

${t(['Key', 'Action'], [['Mouse', 'Steer (click to capture)'], ['W / S · X', 'Throttle · all stop'], ['A / D · Q / E', 'Yaw · roll'], ['Shift · C', 'Boost · cruise'], ['Left mouse / Space', 'Guns'], ['Right mouse / F', 'Missile'], ['T · R', 'Cycle targets · target ahead'], ['E', 'Dock, board, hail'], ['L', 'Land'], ['V', 'Camera'], ['M', 'Galaxy map']])}
### Keyboard and mouse: on foot

${t(['Key', 'Action'], [['WASD · Mouse', 'Move · look'], ['Left mouse', 'Fire'], ['R', 'Reload'], ['1 / 2', 'Switch weapon'], ['Space · Shift', 'Jump · sprint'], ['E', 'Talk, loot, mine, exit'], ['H', 'Medkit']])}
### Menus

${t(['Key', 'Menu'], [['I / Tab', 'Inventory'], ['K', 'Skills'], ['J', 'Missions'], ['M', 'Galaxy map'], ['G', 'Field Guide'], ['Esc / P', 'Pause']])}
### Touch

- **Left thumb:** steer (flying) or move (on foot).
- **Right thumb:** drag for throttle and roll (flying) or to look (on foot).
- **Buttons:** FIRE, MSL, BOOST, USE, TARGET, CRUISE when flying; FIRE, JUMP, USE, RELOAD, SWAP, HEAL, SPRINT on foot.
- **Top right:** MAP, GEAR, MENU.

### Gamepad (standard layout)

${t(['Input', 'Flying', 'On foot'], [['Left stick', 'Pitch / yaw', 'Move'], ['Right stick', 'Roll / throttle', 'Look'], ['RT · LT', 'Guns · missile', 'Fire'], ['RB', 'Boost', '—'], ['A', 'Interact', 'Jump'], ['B', '—', 'Interact'], ['X', '—', 'Reload'], ['Y', 'Target', 'Swap weapon'], ['L3', 'Cruise', 'Sprint'], ['Back · Start', 'Inventory · pause', 'Inventory · pause']])}
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
