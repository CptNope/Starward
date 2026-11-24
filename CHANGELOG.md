# Changelog

## 0.7.1 — 2026-11-23 — Phone layout and fresh screenshots

### Fixed
- On short landscape phones the target panel sat under the BOOST, MSL, TARGET, USE and FIRE buttons. It now sits at the top centre of the screen, and messages appear at the bottom centre between your thumbs.

### Developer notes
- Every screenshot in the repository was retaken from the current build, so the README, the social preview image and the itch.io page show the current models and screens. New pictures: a hostile Dreadnought, the station bar, the Workshop and touch controls.

## 0.7.0 — 2026-11-23 — Player feedback

Changes made from feedback by **Rob Rastaban**, who played Starward and posted a detailed list of what annoyed him in the Indie Game Players & Developers group on Facebook. Thanks, Rob.

### Changed
- **Dogfights you can follow.** Enemy fighters fly at 80% of their hull's top speed (was 90%), ease off the throttle once they are in gun range and break away without boost, so a fight is a turning fight instead of a string of high-speed passes. Your own gunfire has a slightly generous hit box against ships, and with mouse aim the guns lock onto the lead marker from a little further off (about 9° instead of 6°). In simulated fights against a pirate fighter, a pilot steering with a stick went from about a minute on average, with one fight in eight unfinished after 90 seconds, to between 10 and 20 seconds with every fight won. With mouse aim the simulated times were about the same as before, roughly 20 seconds.
- **Automatic target lock.** With nothing locked, the nearest hostile is locked for you, so the lead marker and gun tracking are there as soon as a fight starts.
- **Missiles reload.** The rack reloads itself, about 90 seconds from empty to full whatever its size. Stations still restock it at once. The HUD shows the count, the capacity and the time to the next missile.
- **Landing.** You now have to fly close to a planet to land (420 m from the surface, was 900 m), and the prompt tells you how much further to go. Pressing **L** opens a survey map of the landing zone with outposts, pirate camps and ruins marked: click anywhere to choose where to set down, or pick a site from the list. The ship then dives into the atmosphere, and on the surface you watch it descend onto the pad before you step out. Any key skips the touchdown.
- **Tougher wildlife.** Creatures have more health, set by body plan: about one and a half times what they had for flyers, up to nearly four times for crawlers. Beasts and crawlers soak up fire, raptors and flyers are fast. Hurting one animal brings the rest of its pack, and a pack of three or more is led by a bigger alpha with more health and a harder bite, worth more XP and guaranteed loot. Ruin Guardians have about five times their old health. Health bars name the creature.
- **Jump away from a fight.** The jump drive is no longer blocked when hostiles are close. It takes 4 seconds to spool up instead, with a countdown, and then jumps.

### Fixed
- **Bar talk was unreadable.** What someone says at a station bar now appears in the bar panel under their name and stays there, instead of in a message behind the blurred menu.
- **Messages behind menus.** Any message that appears while a menu is open now sits above the menu at the bottom of the screen. Long messages stay up longer.

### Added
- The in-game About screen and the Player Guide link to the [Starward page on jeremyanderson.tech](https://jeremyanderson.tech/project/starward-threejs-space-sandbox-rpg/).

### Developer notes
- `tests/input-test.py` lands the way a player does on each device (keys, gamepad, touch) and has 146 checks, up from 126.

## 0.6.0 — 2026-11-22 — New models

Every model in the game was rebuilt. See them all in [docs/images/models.jpg](docs/images/models.jpg).

### Changed
- **Ships.** Each of the eight hull classes now has its own shape instead of one shape at eight sizes: slim scouts and interceptors, slab-armoured gunships with weapon pods, corvettes and frigates with a raised bridge and turrets, freighters hauling rows of containers, and a three-tiered Dreadnought with a command tower, hangar bays and six turrets.
- **Capital ship turrets are real.** A Dreadnought's shots now leave from the turrets you can see on its hull.
- **Cockpit view** puts the camera in your ship's own cockpit or on its bridge.
- **Stations.** Seven kinds, chosen by the station's name: Station (spinning wheel), Spire, Citadel, Dock (shipyard), Exchange (trade hub), Outpost and Haven (asteroid base). Wheels, spires and hubs turn slowly.
- **Creatures.** Six body plans (four-legged beasts, raptors, armoured crawlers and scorpions, spiders, floaters and flyers) with jointed legs, tails, wings and tentacles that move, and a lunge when they bite. Ruin Guardians are now stone golems with a glowing core.
- **Characters.** A second pass on the 0.3.1 rig: rounded limbs, layered armour, and gear by job. Soldiers and gunners wear full helmets, pilots a flight helmet and jetpack, engineers a hard hat and radio pack, medics white armour, merchants and scientists long coats, smugglers a hood and a single pauldron. Bosses get a crest and bigger pauldrons.
- Parked ships on landing pads idle their engines instead of burning at full glow.

### Performance
- Ships and stations still bake to two draw calls each. In a test scene with 8 creatures and 6 characters, the Low preset draws the same as before (130 draw calls against 128); High goes from 171 to 190 draw calls with the same frame time.
- On the Low preset, characters drop small plates, limbs use four sides instead of eight, and crawler legs move as two rigid sets.

### Developer notes
- New modules: `geo.js` (lofted hulls, wings, mirroring), `ships.js`, `stations.js`, `creatures.js`.
- The Player Guide generator now includes the 0.4.1 and 0.5.0 guide text that had only been edited into the generated file.

## 0.5.0 — 2026-11-21 — Better dogfights and views

### Changed
- **Mouse aim.** With the mouse captured, the mouse now moves an aim ring and your ship turns to follow it, instead of acting as a joystick that never re-centres. The old steering is still available under Pause → Controls.
- **An honest gun reticle.** In the chase view, the old crosshair only lined up with your guns at 200 m. The reticle now sits where your shots will actually go, at the range you're fighting at.
- **Guns lock onto the lead.** Guns swivel up to about 11° toward your aim, and lock onto the gold lead diamond when your aim is on it.
- **Aim assist on gamepad and touch.** The ship nudges itself toward a locked target's lead diamond when it's near the nose. Your own stick input always wins.
- In testing against a pirate fighter, a pilot with human reaction time went from winning 4 of 6 fights in about a minute to winning every fight in about 9 seconds with mouse aim, or 16 seconds with a stick.

### Added
- **Switch views everywhere.** On foot, on planets and while boarding, **V** (or R3 on a gamepad) now switches between third person and a new first-person view with your rifle in hand. In space, **V** cycles chase, cockpit and a new wide chase camera. Touch screens get a VIEW button. Your choice is remembered.

- **Play entirely on a gamepad.** Menus, stations, shops, the inventory, the galaxy map, the title screen and the death screen can now all be used with a controller: the D-pad or left stick moves a highlight, A selects, B goes back, and LB / RB switch tabs. On the galaxy map the D-pad picks stars, the triggers zoom and A engages the jump drive.
- In space, **B** on a gamepad targets whatever is ahead, and the **scroll wheel** sets throttle.
- Button prompts and the hint bar show the buttons for the device you're using: keys, gamepad buttons or USE on touch.

### Fixed
- The gold lead diamond lost its diamond shape when a target was locked.
- Having a gamepad plugged in, even unused, switched off mouse aim.
- Pressing Esc while flying freed the mouse but kept the game running, and the ship started steering toward the cursor. Losing mouse capture now pauses the game.
- With the mouse not captured, moving the cursor out of the window left the ship turning.
- After closing a menu in space, the mouse wasn't captured again.
- Pressing A or B to close a menu on a gamepad could also act in the game on the same frame.

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
