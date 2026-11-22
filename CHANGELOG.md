# Changelog

## 0.4.1 — 2026-11-21 — Readable gunfights

### Changed
- **Enemies aim in before they shoot.** When a gunman spots you, or you step into its range, it raises its rifle and a glow builds at the muzzle for about a second before the first shot, with a soft rising whine. Hostiles glow red and allies glow blue. The glow stays readable at long range, and it flares as the shot fires. Thanks to Annagrace25 for the suggestion on itch.io.
- The Field Guide and Player Guide explain how to read the warning.

## 0.4.0 — 2026-11-21 — Soundtrack

### Added
- **An original soundtrack.** Seven instrumental tracks, one for each situation: *Starward* (title), *Drift* (flying), *Engage* (space combat), *Dreadnought* (capital-ship fights), *Dockside* (docked at a station), *Groundfall* (planet exploration) and *Breach* (boarding and fights on foot). Made with Suno.
- Music follows the action: it switches to combat when enemies engage you, to *Dreadnought* when a hostile capital ship is near, and back once things calm down. Tracks crossfade and pick up where they left off.
- Each track streams the first time it's needed, so the game still starts instantly. Tracks are level-matched so switching never jumps in volume.
- **Graphics & sound** settings: music and sound effects each have Off, Low, Medium and High, and the screen shows what's playing.

## 0.3.1 — 2026-11-21 — New character models

### Changed
- **Rebuilt characters.** Every captain, crew member and NPC now has a jointed rig: shoulders, elbows, hips and knees, a tapered chest with armor plates and shoulder pads, a glowing life-support pack, boots, gloves and a proper rifle held in the hand.
- **New animation.** Walking bends the knees and swings both arms against the stride, the hips bob and the torso twists, and characters breathe when standing still. Aiming raises the rifle with both hands and follows where you look up or down, with a small kick when firing. Sprinting lowers the rifle to a ready carry. Poses blend smoothly instead of snapping.
- Shots now leave from the rifle's barrel, for the player and NPCs.
- On the Low graphics preset, elbows and knees are folded into single segments to keep draw calls down.

### Fixed
- The player's right arm pointed backward toward the camera when aiming.
- Eyes were hidden inside the head on some species.

## 0.3.0 — 2026-11-20 — Living universe

### Added
- **Signals.** Random events in every system: distress calls (rescue freighters from pirates), ambushes, explorable derelicts, scannable anomalies and battles between factions at war. They appear as purple **?** markers and keep spawning while you fly.
- **Asteroid mining.** Belts have mineable rocks that drop ore, void crystals, rare relics and parts. Scavenger now boosts asteroid yields too.
- **Capital ships.** The Dreadnought hull class has six independent turrets, travels with escorts, and drops big loot. It prowls threat 4+ systems, can be boarded and claimed, and is rarely sold at shipyards.
- **Wingmen.** Up to two crew members fly escort ships in formation. They fight your targets, defend you, follow you through cruise and jumps, eject when shot down, and recover when you dock.
- **Workshop.** A new station tab. Salvage gear into parts, upgrade items a tier (new bonus, plus specials at Legendary and Mythic), or reforge their bonuses. Gear saved by earlier versions is upgraded automatically.
- Field Guide and Player Guide sections for all of the above.

### Fixed
- Dialog text was being rendered in Title Case.

## 0.2.0 — 2026-11-20

### Added
- In-game **Field Guide** (press **G**, or from the title and pause menus). It covers getting started, combat, damage types, boarding, planets, loot, skills, factions, trading, contracts, ships and crew, controls, and graphics. Its tables are built from the game data.
- **About** screen with the version, your universe seed, and links to [jeremyanderson.tech](https://jeremyanderson.tech/), booking a call, the live game, the source and bug reports.
- Title-screen credit line.
- Share preview tags (Open Graph, X/Twitter card, structured data), a description and a favicon.
- Docs: player guide (generated from game data with `npm run docs`), developer guide, contributing notes, issue templates and screenshots.

### Fixed
- Changing the universe seed on the New Game screen could throw an error.

## 0.1.1 — 2026-11-19

### Added
- **Adaptive quality.** Detects the device and picks a Low / Medium / High preset, adjusts resolution to hold the frame rate, and can drop a preset automatically. Pause → Graphics has the settings and an FPS counter.
- **Touch controls** for phones and tablets, plus touch-friendly map panning and pinch zoom, and a compact layout for short screens.
- Generous aim snapping for touch and gamepad on foot.
- GitHub Pages deploy workflow.

### Changed
- Planet and nebula textures generate a few rows per frame with an instant preview, so entering a system no longer freezes the game.
- Ships, stations, characters and creatures are baked into one or two draw calls each, bolts are instanced, and all particle effects are a single draw.
- Removed the logarithmic depth buffer, and bloom renders at reduced resolution (or is skipped on Low).
- The HUD only touches the DOM when values change.

## 0.1.0 — 2026-11-19

First playable build: a seeded galaxy with factions and species; space flight and combat; docking, stations, trading and shipyards; landing on planets; boarding and capturing ships; tiered procedural loot; 35 skills; crew; contracts; reputation; save and load.
