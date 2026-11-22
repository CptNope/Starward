# Starward Player Guide

*Version 0.4.0. This guide is generated from the game's data (`npm run docs`). The same guide is in the game: press **G**.*

**[▶ Play Starward](https://cptnope.github.io/Starward/)** · Made by **[Jeremy Anderson Tech](https://jeremyanderson.tech/)**

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
11. [Planets and exploration](#planets-and-exploration)
12. [Loot and gear](#loot-and-gear)
13. [Skills](#skills)
14. [Factions and reputation](#factions-and-reputation)
15. [Trading and economy](#trading-and-economy)
16. [Contracts](#contracts)
17. [Ships and crew](#ships-and-crew)
18. [Controls](#controls)
19. [Graphics, saving and troubleshooting](#graphics-saving-and-troubleshooting)
20. [About](#about)

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

| Type | vs Shields | vs Hull | Notes |
|---|---|---|---|
| **Kinetic** | ×0.6 | ×1.3 | Cheap and reliable, rips hull |
| **Energy** | ×1.2 | ×0.9 | All-rounder, good on shields |
| **Ion** | ×1.9 | ×0.3 | Strips shields; raises the chance to disable ships for boarding |
| **Plasma** | ×1 | ×1.15 | Heavy, slow bolts |
| **Explosive** | ×0.75 | ×1.5 | Area damage: missiles, flak, grenades |

A good loadout pairs an ion or energy gun (to drop shields) with a kinetic or explosive one (to finish the hull).

## Weapons

Every weapon is generated from one of these bases, then scaled by tier and level and given bonus stats. The numbers below are base values at level 1, Common tier.

**Ship guns**

| Base | Type | Damage | Shots/s | Range |
|---|---|---|---|---|
| Pulse Laser | Energy | 9 | 7 | 1600 |
| Autocannon | Kinetic | 7 | 10 | 1400 |
| Railgun | Kinetic | 48 | 1.1 | 2600 |
| Ion Cannon | Ion | 14 | 3.5 | 1500 |
| Plasma Lance | Plasma | 22 | 2.4 | 1300 |
| Flak Projector | Explosive | 6 × 6 | 2.2 | 900 |

**Missile launchers**

| Base | Damage | Capacity | Range |
|---|---|---|---|
| Seeker Pod | 60 | 12 | 2400 |
| Swarm Rack | 18 × 4 | 10 | 2000 |
| Torpedo Tube | 220 | 4 | 3000 |

**Personal weapons**

| Base | Type | Damage | Shots/s | Magazine |
|---|---|---|---|---|
| Sidearm | Kinetic | 14 | 4 | 12 |
| Assault Rifle | Kinetic | 10 | 9 | 30 |
| SMG | Kinetic | 6 | 15 | 40 |
| Scattergun | Kinetic | 8 × 8 | 1.4 | 6 |
| Longrifle | Kinetic | 70 | 0.9 | 5 |
| Plasma Caster | Plasma | 24 | 2.5 | 10 |
| Ion Blaster | Ion | 12 | 5 | 20 |
| Beam Carbine | Energy | 9 | 8 | 28 |
| Grenade Launcher | Explosive | 55 | 0.9 | 4 |

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

| Signal | What happens |
|---|---|
| Distress call | A freighter under pirate attack. Save it for credits, XP, reputation with its faction and sometimes gear. |
| Ambush | The distress call was bait. Pirates jump in around you. |
| Derelict | An abandoned ship to explore (**E**) for extra caches. A few scavengers may be aboard. Scuttle it on the way out for parts. |
| Anomaly | Fly within 300 m, press **E** and hold position for 5 seconds. Rewards: XP plus a relic, datachip, high-tier gear or parts. |
| Battle | Two factions at war fighting it out. Watch, pick a side, or loot what is left. |

Signals aren't saved: every visit to a system rolls new ones.

## Asteroid mining

Systems with an asteroid belt have mineable rocks, marked **Asteroid field** on the HUD and shown as brown radar dots. Shoot them; kinetic and explosive weapons break rock fastest.

| Rock | Drops |
|---|---|
| Grey-brown | Raw Ore |
| Glowing violet | Void Crystals |
| Gold (rare) | Xeno Relics |

Fly through the cargo crate to collect it. Some rocks also give Workshop parts. **Scavenger** increases the yield.

## Capital ships

**Dreadnoughts** prowl dangerous systems (threat 4+), usually with escorts. They turn slowly, but six independent turrets track everything around them, and many carry missile racks. Stay mobile, strip shields with ion or energy weapons, and bring wingmen.

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

## Planets and exploration

Fly within range of a planet and press **L** to land. Terrain, props, outposts, wildlife and loot are all generated from the planet's seed.

| Biome | Hazard |
|---|---|
| Desert | None |
| Frozen | 2 (drains shields, then health) |
| Jungle | None |
| Volcanic | 5 (drains shields, then health) |
| Toxic | 4 (drains shields, then health) |
| Barren | 1 (drains shields, then health) |
| Oceanic | None |
| Crystalline | 2 (drains shields, then health) |

- **Faction outposts** have merchants, medics and engineers. Engineers and scientists can teach you a skill point.
- **Pirate camps** are hostile and guard caches.
- **Alien ruins** hold relic vaults guarded by creatures. Relics sell for a fortune.
- **Deposits** of ore, void crystals and relics can be extracted into your cargo hold.
- **Locked caches** (red) need the Hacking skill.

Walk back to your ship and press **E** to launch.

## Loot and gear

| Tier | Power | Bonus stats |
|---|---|---|
| **Scrap** | ×0.7 | 0 |
| **Common** | ×1 | 1 |
| **Uncommon** | ×1.22 | 1 |
| **Rare** | ×1.48 | 2 |
| **Epic** | ×1.8 | 3 |
| **Legendary** | ×2.2 | 4 |
| **Mythic** | ×2.75 | 5 |

**Legendary and Mythic special effects:**

- **Twinned**: +1 projectile per shot
- **Seeking**: projectiles seek targets
- **Detonating**: shots explode on impact
- **Piercing**: shots pierce through targets
- **Arcing**: hits arc to a nearby enemy
- **Desperate**: +50% damage below 30% shields

**Ship slots:** up to 4 guns (depends on hull), missiles, shield, engine, reactor, plating.
**Personal slots:** primary, secondary, suit, personal shield, implant.

Item level follows the system you found it in. Hover any item for a comparison with what you have equipped. **Datachips** teach a skill rank instantly; **medkits** heal on foot (**H**). Inventory holds 40 items.

## Skills

You earn a skill point every level (two every fifth level). You can also get them from datachips, station training sims, and engineers or scientists on planets. There are 35 skills across 7 trees; some need a rank in another skill first.

### Piloting

| Skill | Ranks | Per rank | Requires |
|---|---|---|---|
| **Flight Training** | 5 | +5% ship speed | — |
| **Evasive Maneuvers** | 5 | +7% turn rate | Flight Training 1 |
| **Afterburner Mastery** | 5 | +10% boost power, -6% boost drain | Flight Training 2 |
| **Astrogation** | 5 | +0.6 jump range | — |
| **Cruise Efficiency** | 3 | +15% cruise speed | Astrogation 1 |

### Gunnery

| Skill | Ranks | Per rank | Requires |
|---|---|---|---|
| **Ship Weapons** | 5 | +6% ship weapon damage | — |
| **Rapid Cycling** | 5 | +5% ship fire rate | Ship Weapons 1 |
| **Targeting Computers** | 5 | +2.5% ship crit chance | Ship Weapons 2 |
| **Ordnance** | 5 | +12% missile damage, +1 missile capacity | — |
| **Ion Specialist** | 3 | +15% ion & energy damage | Ship Weapons 3 |
| **Ballistics** | 3 | +8% projectile speed | — |

### Engineering

| Skill | Ranks | Per rank | Requires |
|---|---|---|---|
| **Hull Reinforcement** | 5 | +8% hull | — |
| **Shield Harmonics** | 5 | +8% shield capacity | — |
| **Fast Recharge** | 5 | +10% shield regen, -0.2s regen delay | Shield Harmonics 1 |
| **Capacitors** | 5 | +10% energy & energy regen | — |
| **Damage Control** | 5 | Repair 0.6 hull/s | Hull Reinforcement 2 |

### Combat

| Skill | Ranks | Per rank | Requires |
|---|---|---|---|
| **Firearms** | 5 | +6% personal weapon damage | — |
| **Trigger Discipline** | 5 | +5% personal fire rate | Firearms 1 |
| **Deadeye** | 5 | +3% personal crit chance | Firearms 2 |
| **Toughness** | 5 | +10% health | — |
| **Shield Discipline** | 5 | +10% personal shields | — |
| **Athletics** | 5 | +5% move speed, higher jumps | — |
| **Quick Hands** | 3 | -10% reload time | Trigger Discipline 1 |

### Tech

| Skill | Ranks | Per rank | Requires |
|---|---|---|---|
| **Hacking** | 5 | Open locked caches, +10% boarding loot | — |
| **Salvaging** | 5 | +6% loot quality, +10% drop chance | — |
| **Scanning** | 5 | +15% radar range | — |
| **Disabling Strikes** | 3 | +20% chance ships are disabled (boardable) instead of destroyed | Hacking 1 |

### Social

| Skill | Ranks | Per rank | Requires |
|---|---|---|---|
| **Commerce** | 5 | Buy 4% cheaper, sell 4% higher | — |
| **Diplomacy** | 5 | +15% reputation gains, -10% losses | — |
| **Leadership** | 5 | +12% crew bonuses, +1 crew slot per 2 ranks | — |
| **Bounty Hunter** | 5 | +10% mission rewards | — |
| **Intimidation** | 3 | Better odds when demanding cargo | — |

### Survival

| Skill | Ranks | Per rank | Requires |
|---|---|---|---|
| **Field Medic** | 5 | +20% healing from medkits | — |
| **Environmental Training** | 5 | -15% hazard damage | — |
| **Scavenger** | 5 | +20% minerals from deposits and asteroids | — |

## Factions and reputation

Seven factions share each galaxy. Each has an ideology, a home species, territory, and relations with the others. Factions at war fight on sight.

| Ideology | Starting attitude |
|---|---|
| Militarist | Neutral |
| Mercantile | Friendly |
| Pirate | Hostile |
| Scientific | Friendly |
| Zealot | Neutral |
| Isolationist | Neutral |

Reputation runs from −100 to +100:

| Range | Standing |
|---|---|
| −100 to −60 | Nemesis |
| −59 to −30 | Hostile (attacks on sight) |
| −29 to 9 | Neutral |
| 10 to 39 | Friendly |
| 40 to 74 | Trusted |
| 75 to 100 | Allied |

- Attacking or destroying a faction's ships costs reputation with them and their allies, and earns a little with their enemies.
- Completing contracts raises reputation with the faction that posted them.
- Diplomacy increases gains and reduces losses.

## Trading and economy

Each system sets its own prices. In the Commodity exchange, goods marked *cheap here* are worth buying and goods marked *in demand* are worth selling.

| Commodity | Base price |
|---|---|
| Raw Ore | 30 cr |
| Void Crystals | 140 cr |
| Rations | 22 cr |
| Medical Supplies | 90 cr |
| Electronics | 120 cr |
| Munitions | 110 cr |
| Luxury Goods | 260 cr |
| Fuel Cells | 45 cr |
| Xeno Relics | 520 cr |

Cargo space depends on your hull. Mining on planets fills your hold for free, and Commerce lowers buy prices and raises sell prices.

## Contracts

| Contract | What to do |
|---|---|
| Bounty | A named ship and its escorts spawn when you arrive in the target system. Destroy it. |
| Recover black box | Board the derelict and loot the recorder from its bridge. |
| Courier run | Dock at the named station. |
| Survey | Land on the named planet. |
| Raid | Land on the named planet and defeat the warlord. |

You can hold five contracts at once. Targets show as gold diamonds on the galaxy map and as ◆ markers in-system. Mission boards refresh over time. Bounty Hunter raises contract payouts.

## Ships and crew

| Hull | Hull pts | Shield | Speed | Turn | Guns | Crew | Cargo | Price |
|---|---|---|---|---|---|---|---|---|
| **Scout** | 180 | 80 | 260 | 1.9 | 1 | 1 | 10 | 9,000 cr |
| **Fighter** | 260 | 120 | 230 | 1.7 | 2 | 1 | 12 | 18,000 cr |
| **Interceptor** | 220 | 140 | 300 | 2.1 | 2 | 1 | 8 | 26,000 cr |
| **Gunship** | 480 | 220 | 180 | 1.2 | 3 | 3 | 20 | 48,000 cr |
| **Corvette** | 620 | 300 | 170 | 1 | 3 | 4 | 30 | 75,000 cr |
| **Freighter** | 700 | 180 | 140 | 0.7 | 1 | 3 | 80 | 52,000 cr |
| **Frigate** | 1100 | 480 | 140 | 0.75 | 4 | 6 | 45 | 140,000 cr |
| **Dreadnought** | 4200 | 1800 | 95 | 0.38 | 4 | 12 | 120 | 950,000 cr |

Buy hulls at station shipyards (your old ship is traded in for 45% of its price) or capture them by boarding. Dreadnoughts are rarely for sale.

**Crew** give passive bonuses that grow with their level. Leadership adds crew slots and strengthens bonuses.

| Role | Crew bonus |
|---|---|
| Merchant | Better prices |
| Soldier | Personal damage |
| Pilot | Turn rate |
| Engineer | Shield regen |
| Gunner | Ship damage |
| Scientist | Loot quality |
| Medic | Health |
| Smuggler | Ship speed |

## Controls

### Keyboard and mouse: flying

| Key | Action |
|---|---|
| Mouse | Steer (click to capture) |
| W / S · X | Throttle · all stop |
| A / D · Q / E | Yaw · roll |
| Shift · C | Boost · cruise |
| Left mouse / Space | Guns |
| Right mouse / F | Missile |
| T · R | Cycle targets · target ahead |
| E | Dock, board, hail |
| L | Land |
| V | Camera |
| M | Galaxy map |

### Keyboard and mouse: on foot

| Key | Action |
|---|---|
| WASD · Mouse | Move · look |
| Left mouse | Fire |
| R | Reload |
| 1 / 2 | Switch weapon |
| Space · Shift | Jump · sprint |
| E | Talk, loot, mine, exit |
| H | Medkit |

### Menus

| Key | Menu |
|---|---|
| I / Tab | Inventory |
| K | Skills |
| J | Missions |
| M | Galaxy map |
| G | Field Guide |
| Esc / P | Pause |

### Touch

- **Left thumb:** steer (flying) or move (on foot).
- **Right thumb:** drag for throttle and roll (flying) or to look (on foot).
- **Buttons:** FIRE, MSL, BOOST, USE, TARGET, CRUISE when flying; FIRE, JUMP, USE, RELOAD, SWAP, HEAL, SPRINT on foot.
- **Top right:** MAP, GEAR, MENU.

### Gamepad (standard layout)

| Input | Flying | On foot |
|---|---|---|
| Left stick | Pitch / yaw | Move |
| Right stick | Roll / throttle | Look |
| RT · LT | Guns · missile | Fire |
| RB | Boost | — |
| A | Interact | Jump |
| B | — | Interact |
| X | — | Reload |
| Y | Target | Swap weapon |
| L3 | Cruise | Sprint |
| Back · Start | Inventory · pause | Inventory · pause |

## Graphics, saving and troubleshooting

- Starward picks a **Low / Medium / High** preset for your device and adjusts render resolution to hold the frame rate. Change it under **Pause → Graphics**, which also has an FPS counter.
- Texture and terrain detail changes apply the next time you enter a system or land.
- Progress saves automatically in your browser (and when you dock or jump). Clearing site data erases it. Private browsing windows may not keep saves.
- **Choppy?** Switch to Low, turn glow (bloom) off, and close other heavy tabs.
- **Mouse won't steer on foot?** Click the game view to capture the mouse, and press **Esc** to release it.
- Found a bug? **[Open an issue](https://github.com/CptNope/Starward/issues/new)** with your browser, device and what happened.

## About

Starward is made by **Jeremy Anderson** of **[Jeremy Anderson Tech](https://jeremyanderson.tech/)**, a software architect and WordPress engineer in Shrewsbury, Massachusetts, who builds websites, plugins, web apps and browser games.

- Website: **[jeremyanderson.tech](https://jeremyanderson.tech/)**
- Want something like this built? **[Book a call](https://jeremyanderson.tech/book-a-call/)**
- Play: **[cptnope.github.io/Starward](https://cptnope.github.io/Starward/)**
- Source: **[github.com/CptNope/Starward](https://github.com/CptNope/Starward)**

Built with [three.js](https://threejs.org/). MIT License.
