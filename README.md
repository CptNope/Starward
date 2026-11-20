# Starward

**Play it:** https://cptnope.github.io/Starward/

An open-universe space sandbox RPG built with three.js. Fly, fight, trade, land on planets, board ships and build a captain over time. Every galaxy, faction, species, planet, NPC, ship and weapon is generated from a seed.

## Play locally

```bash
npm install
npm run build        # bundles to dist/
npx serve dist       # or any static server, then open the URL
```

For development: `npm run build` once (copies `index.html`), then `npm run dev` to rebuild on save and serve `dist/`.

Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml` (Settings → Pages → Source: "GitHub Actions").

## Runs on any device

- Picks Low / Medium / High graphics from the device's GPU, memory and screen, then keeps watching the frame rate: it lowers render resolution first and drops a preset only if that isn't enough. Change it under Pause → Graphics (also shows an FPS counter).
- Procedural planet and nebula textures are generated a few rows per frame, so entering a system doesn't freeze the game.
- Ships, stations and characters are baked into one or two draw calls each; all bolts are instanced and all explosions/flashes are a single particle draw.
- Touch controls appear automatically on phones and tablets (left thumb steers or moves, right thumb drags to look / throttle and roll, buttons for fire, missiles, use and more). Gamepads work everywhere.

## What's in this version

**Universe (seeded)**
- 140-star spiral galaxy, 7 factions with their own ideologies (mercantile, pirate, militarist, scientific, zealot, isolationist), territory, relations and wars
- 5–8 procedural species with their own naming languages and body plans
- Each system: star type, 2–7 planets (8 biomes), stations, asteroid belts, local commodity prices, threat level and loot level that rise with distance from the start

**Space**
- Arcade 6DOF flight: throttle, boost, cruise drive, mouse or gamepad steering
- Gimballed guns with lead indicator, homing missiles, 5 damage types with shield/hull multipliers (ion strips shields, kinetic and explosive wreck hulls)
- Faction AI that patrols, trades, raids and fights other factions at war; reputation ripples through allies and enemies
- Ships can be disabled instead of destroyed (ion weapons and the Disabling Strikes skill help), then boarded
- Hail any non-hostile ship: rumors, trade, visit aboard, or demand their cargo
- Galaxy map with jump range, territory and contract markers

**On foot**
- Third-person shooter controls on planet surfaces and inside ships
- Planets: heightmapped terrain, biome props, hazards, faction outposts, pirate camps, alien ruins with relic vaults, wildlife packs, mineable ore/crystal/relic deposits, locked caches (Hacking)
- Ship interiors: procedurally laid-out rooms and corridors, hostile crews with a captain boss, or friendly crews when visiting
- After clearing a boarded ship: claim it as your own, or scuttle it for salvage

**RPG**
- 7-tier loot (Scrap → Mythic) with level scaling, random affixes, procedural names and manufacturer brands; Legendary+ weapons roll specials (twin shot, homing, detonating, piercing, arcing, desperate)
- 10 gear slots across ship and personal equipment, with comparison tooltips
- 35 skills across 7 trees (Piloting, Gunnery, Engineering, Combat, Tech, Social, Survival) with prerequisites; points from levels, datachips and station training sims
- Hireable crew with role bonuses, seven hull classes, shipyards and trade-ins
- Contracts: bounties, derelict recovery, courier runs, surveys and ground raids
- Stations: gear market, commodity exchange, repairs, missile restock, medbay, bar, mission board, shipyard
- Autosave to localStorage

## Controls

| Flying | |
|---|---|
| Mouse | Steer (click to capture) |
| W / S, X | Throttle, all stop |
| A / D, Q / E | Yaw, roll |
| Shift, C | Boost, cruise drive |
| LMB / Space, RMB / F | Guns, missile |
| T, R | Cycle targets, target ahead |
| E, L | Dock / board / hail, land |
| V, M | Camera, galaxy map |

| On foot | |
|---|---|
| WASD, mouse | Move, look |
| LMB, R, 1 / 2 | Fire, reload, swap weapon |
| Space, Shift | Jump, sprint |
| E, H | Interact, medkit |

Touch: left thumb steers/moves, right thumb drags to look (on foot) or throttle and roll (flying); MAP, GEAR and MENU buttons sit top-right.

Menus: I / Tab inventory · K skills · J missions · M map · Esc / P pause. Gamepads use the standard mapping.

## Code map

```
src/
  main.js         game loop, mode stack, progression, save/load
  rng.js          seeded RNG + Perlin noise
  data.js         tiers, damage types, weapon bases, affixes, skills, biomes, hulls
  gen/            universe, factions, species, names, items
  space.js        flight, ship AI, combat, docking, loot
  onfoot.js       shared third-person mode for planets and interiors
  ground.js       planet surface generator
  interior.js     ship interior generator
  projectiles.js  shared projectile/FX system
  missions.js     contract generator
  ui.js           HUD and every menu
  quality.js      device detection, quality presets, frame-rate governor
  touch.js        on-screen controls for phones and tablets
  models.js       procedural meshes and textures
```

## License

MIT — see [LICENSE](LICENSE).
