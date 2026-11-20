# Changelog

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
