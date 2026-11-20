# Changelog

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
