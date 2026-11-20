# Starward Developer Guide

How the game is put together, and how to extend it. For playing, see the [Player Guide](PLAYER_GUIDE.md).

Starward is plain JavaScript (ES modules) bundled by [esbuild](https://esbuild.github.io/) into one file, with [three.js](https://threejs.org/) for rendering. There's no framework, no server and no build-time assets: everything visual and every piece of content is generated at runtime.

## Setup

```bash
npm install
npm run build   # dist/index.html + dist/game.js + dist/og.jpg
npm run dev     # rebuilds on save and serves dist/ (run `npm run build` once first)
npm run docs    # regenerates docs/PLAYER_GUIDE.md from the game data
```

Open the URL esbuild prints (or serve `dist/` with any static server). In the browser console, `window.game` is the running `Game` instance, which is handy for debugging: `game.player`, `game.mode`, `game.U` (the universe), `game.getSystem(id)`.

## Project layout

```
index.html            page shell, all CSS, meta/share tags
src/
  main.js             Game: renderer, loop, mode stack, transitions, progression, save/load
  quality.js          device detection, Low/Medium/High presets (Q), frame-rate governor
  rng.js              seeded RNG (mulberry32), hashing, Perlin noise
  data.js             static tables: tiers, damage types, weapon bases, affixes, specials,
                      skills, biomes, ideologies, NPC roles, hull classes
  gen/
    names.js          phonetic "cultures" → names for people, stars, factions, ships, brands
    universe.js       galaxy, species, factions, relations, territory, systems, NPCs, ship defs
    items.js          item generator (tiers, affixes, specials, naming), loot, commodities
  player.js           player state, derived ship/personal stats, skill math, reputation
  space.js            SpaceMode: flight, ship AI (incl. capital-ship turrets), combat, loot crates, docking, interactions
  spacefeatures.js    asteroid mining, wingmen (ally ships + formation), signals/random events
  onfoot.js           OnFootMode: third-person controller, actors, AI, crates, deposits
  ground.js           planet surface environment (heightfield, props, outposts, wildlife)
  interior.js         ship interior environment (rooms + corridors grid, crew, loot)
  projectiles.js      shared projectile + particle FX system (instanced, one draw for FX)
  models.js           procedural meshes, geometry baking, time-sliced textures, materials
  missions.js         contract generator
  ui.js               HUD + every menu (event delegation via data-a="handler")
  guide.js            in-game Field Guide + About (built from data.js), version, links
  touch.js            on-screen controls → synthetic gamepad
  input.js            keyboard, mouse/pointer lock, gamepad, touch merge
  audio.js            tiny WebAudio synth effects
scripts/build-docs.js generates docs/PLAYER_GUIDE.md
docs/                 guides and screenshots
.github/workflows/    GitHub Pages deploy
```

## Core ideas

### Everything comes from seeds

`genUniverse(seed)` builds species, the galaxy layout, factions, relations, territory and system levels. A system's details (planets, stations, belts, market) come from `getSystem(U, id)`, generated lazily and cached. Planets, stations, NPCs and ships carry their own `seed`, so the same object always rebuilds identically. Saves only store the universe seed plus the player, never the world.

`RNG.fork(tag)` derives an independent stream, so adding a new random call in one generator doesn't shift everything else.

### Modes

`Game.modes` is a stack:

- `SpaceMode`: one star system.
- `OnFootMode`: either a `ground` environment (planet) or an `interior` environment (boarded ship).

Landing or boarding **pushes** an `OnFootMode` on top of the space mode, which stays alive (paused) underneath. Leaving **pops** it and calls `resume()`. Jumping or respawning clears the stack and builds a fresh `SpaceMode`.

Every mode exposes `scene`, `camera`, `update(dt)`, `resume()` and `dispose()`. An `OnFootMode` environment object exposes `build(scene)`, `height(x, z)`, `collide(pos, radius)`, `blocksShot(pos)`, `actors`, `crates`, `deposits` and `onExit()`. To add a new on-foot place (a station concourse, a cave), write a new environment maker in that shape.

### Teams in space

`SpaceMode.canHit(owner, target)` holds all the friend-or-foe rules:

- The player hits anything except wingmen and rocks they don't mean to. Attacking a non-hostile ship costs reputation.
- Wingmen (`ship.ally`) hit anything except the player and other allies.
- NPCs hit the player and wingmen only when they're hostile to the player (by reputation, pirate ideology, or being attacked).
- NPCs fight each other when `factionsAtWar` or when one has the other in its `aggro` set.

Rocks (`target.rock`) can only be hit by the player and allies.

### Signals

`spawnSignal(mode, nearPlayer)` places an unresolved signal. `updateSignals` resolves it when the player comes within about 2.5 km, by spawning the encounter through `mode.spawnGroup({ ..., at })`, and tracks win conditions (for example, a distress call's `watch` of the victim and its attackers). To add a signal type, add it to `SIGNAL_TYPES` and handle it in `resolveSignal`.

### Crafting

Every generated item keeps a `core` snapshot (its stats before bonuses). `rebuild(item)` reapplies affixes and specials on top of the core, which is what makes `upgradeItem` and `reforgeItem` exact. `ensureCore` reconstructs a core for items saved before v0.3.

### Stats

`shipStats(player)` and `personalStats(player)` recompute everything from: hull class → equipped gear stats → skill modifiers (`skillMods`) → crew bonuses. After changing equipment, skills or crew, call `game.statsChanged()`.

### Combat

`Projectiles` is shared by both modes. Targets are any objects with `{ pos, radius, alive, hit(dmg, dtype, projectile) }`. `canHit(owner, target)` decides friendly fire. `fireWeapon(proj, item, origin, dir, owner, mods, inheritVel, target)` turns an item's `weapon` block into projectiles, handling count, spread, homing, area damage, piercing, chain and crits.

Damage resolves shields first, using the per-type multipliers in `DAMAGE_TYPES`, then hull reduced by armor.

### Rendering and performance

- **Quality presets** live in `quality.js`. `Q` is the live preset object every module reads (`Q.planetRes`, `Q.npcCap`, `Q.lambert`, …). `FrameGovernor` scales resolution and can drop a tier at runtime.
- **`bake(group)`** in `models.js` merges every mesh in a procedural model into vertex-coloured geometry: one lit draw plus one glow draw. Ships, stations, characters and creatures are all baked (animated limbs and legs stay separate).
- **Textures** (planets, nebulae) are generated by generators queued in `texJobs`, a few rows per frame within a time budget, with a low-res preview first. They're cached in a small LRU.
- **Projectiles** are two `InstancedMesh`es. All flashes and explosions are one `Points` draw with a custom shader.
- No logarithmic depth buffer; the space camera uses near 1, far 210000.
- The HUD caches DOM writes, so unchanged values are never re-rendered, and the radar redraws at about 20 Hz.

When adding visuals, prefer `mat()` (cached, tier-aware) or `litMat()` over new `MeshStandardMaterial`s, and run `bake()` on new multi-part models.

## Adding content

All of these only need edits in `src/data.js` (plus the docs regenerate themselves).

**A ship weapon base.** Add an entry to `SHIP_WEAPONS`:

```js
{ base: 'Gauss Driver', dtype: 'kinetic', dmg: 30, rate: 1.8, speed: 2600, spread: 0.002, energy: 7, range: 2200 }
```

Optional fields: `count` (projectiles per shot), `aoe`, `homing`. Personal weapons (`PERSONAL_WEAPONS`) also use `mag` and `reload`, plus `gravity` for lobbed shots.

**An affix.** Add to `AFFIXES` with the stat it modifies, its base value, which item categories can roll it (`cats`), and the prefix/suffix used in item names. Weapon stats are applied in `applyAffix` in `gen/items.js`; gear stats are summed in `player.js`.

**A legendary special.** Add to `SPECIALS`, apply it in `genItem` (`gen/items.js`), and handle the behavior in `projectiles.js` if it's new.

**A skill.** Add to `SKILLS`:

```js
{ id: 'overclock', tree: 'Engineering', name: 'Overclock', max: 3, desc: '+5% energy regen', fx: { energyPct: 0.05 }, req: ['capacitor', 2] }
```

`fx` keys are summed per rank into `skillMods()`. Use an existing key or read your new key in `shipStats` / `personalStats`.

**A biome.** Add to `BIOMES` (ground palette, sky, fog, hazard, water), then add its prop mix to the `kinds` table in `ground.js` `scatterProps`.

**A hull class.** Add to `HULL_CLASSES`, and an interior grid size to `DIMS` in `interior.js`.

**A faction ideology.** Add to `IDEOLOGIES`, and naming words to `BY_IDEOLOGY` in `gen/names.js`. `genUniverse` assigns ideologies from the `ideos` list.

**A contract type.** Add a branch in `missions.js` `genMissions`, spawn its target where it belongs (`SpaceMode.spawnMissionTargets`, or the planet build in `ground.js`), and call `game.missionProgress(id, event)` when it's done.

## Testing

There's no unit test suite yet. Changes are checked by driving the real game in headless Chrome with Playwright: starting a game, flying, docking, landing, boarding, claiming, jumping, dying and continuing, while watching for page errors. Draw calls are read from `renderer.info`. When you change generators, it also helps to fuzz them in Node across several seeds.

## Deploying

Pushing to `main` runs `.github/workflows/pages.yml`, which runs `npm ci && npm run build` and publishes `dist/` to GitHub Pages. In the repo settings, set **Pages → Source** to **GitHub Actions**.

## Versioning

Bump `VERSION` in `src/guide.js` and `version` in `package.json`, and add an entry to `CHANGELOG.md`.
