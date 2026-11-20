// In-game Field Guide + About. Tables are built from the live game data so they never drift.
import { TIERS, DAMAGE_TYPES, BIOMES, HULL_CLASSES, SKILLS, SKILL_TREES, SPECIALS, NPC_ROLES, IDEOLOGIES } from './data.js';
import { COMMODITIES } from './gen/items.js';

export const VERSION = '0.2.0';
export const LINKS = {
  site: 'https://jeremyanderson.tech/',
  book: 'https://jeremyanderson.tech/book-a-call/',
  play: 'https://cptnope.github.io/Starward/',
  repo: 'https://github.com/CptNope/Starward',
  issues: 'https://github.com/CptNope/Starward/issues/new',
  docs: 'https://github.com/CptNope/Starward/blob/main/docs/PLAYER_GUIDE.md',
  three: 'https://threejs.org/',
};
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const table = (head, rows) => `<div class="scroll"><table class="tbl"><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;

export const GUIDE = [
  { id: 'start', title: 'Getting started', html: () => `
    <p>You captain a small fighter in a galaxy generated from a seed. There is no script: pick a direction, take contracts, trade, explore planets, board ships and grow your captain, ship and crew.</p>
    <ol class="steps"><li><b>Dock</b> at the station you start next to (fly close, press <kbd>E</kbd> / <kbd>USE</kbd>). Look at the <b>Mission Board</b> and the <b>Gear Market</b>.</li>
    <li><b>Spend your skill points</b> (<kbd>K</kbd>). Ship Weapons, Shield Harmonics and Flight Training are strong first picks.</li>
    <li><b>Take a nearby contract</b>. Surveys and courier runs are safe; bounties pay more.</li>
    <li><b>Open the galaxy map</b> (<kbd>M</kbd>), pick a star inside the dashed circle and engage the jump drive.</li>
    <li><b>Land</b> on planets (<kbd>L</kbd>) to mine ore, open caches and find relics in alien ruins.</li></ol>
    <p class="muted">Danger and loot level rise the farther you travel from your starting system. Unclaimed space and pirate territory are the most dangerous — and the most rewarding.</p>` },
  { id: 'flight', title: 'Flying & combat', html: () => `
    <p>Steer with the mouse (the gold square is your virtual stick), set throttle with <kbd>W</kbd>/<kbd>S</kbd>, roll with <kbd>Q</kbd>/<kbd>E</kbd>. <b>Boost</b> (<kbd>Shift</kbd>) burns energy; <b>cruise</b> (<kbd>C</kbd>) crosses a system fast but can't be used near hostiles and drops out when you're hit.</p>
    <p>Lock a target with <kbd>T</kbd> (or <kbd>R</kbd> for whatever is ahead). Your guns are gimballed: aim near the <b>gold lead diamond</b> and shots bend onto it. Missiles (<kbd>RMB</kbd>/<kbd>F</kbd>) home on your locked target; restock them at stations.</p>
    <p>Shields regenerate after a few seconds without taking damage. Hull doesn't — repair it at a station, or learn <b>Damage Control</b>.</p>
    <p>If your ship is destroyed you wake at the last station you docked at, minus some credits and your cargo.</p>` },
  { id: 'damage', title: 'Damage types', html: () => `
    <p>Every weapon deals one of five damage types. Match the type to the job:</p>
    ${table(['Type', 'vs Shields', 'vs Hull', 'Notes'], Object.entries(DAMAGE_TYPES).map(([k, d]) => [`<b style="color:${hex(d.color)};text-transform:capitalize">${k}</b>`, `×${d.shield}`, `×${d.hull}`,
      { kinetic: 'Cheap and reliable, rips hull', energy: 'All-rounder, good on shields', ion: 'Strips shields; raises the chance to disable ships for boarding', plasma: 'Heavy, slow bolts', explosive: 'Area damage; missiles, flak, grenades' }[k]]))}
    <p class="muted">A good loadout pairs an ion or energy gun (to drop shields) with a kinetic or explosive one (to finish the hull).</p>` },
  { id: 'boarding', title: 'Boarding & capturing ships', html: () => `
    <p>When you knock out a ship it sometimes ends up <b>disabled</b> (shown in gold) instead of destroyed. Ion damage and the <b>Disabling Strikes</b> skill make this much more likely.</p>
    <p>Fly close, slow down, and press <kbd>E</kbd> to board. Inside, fight through the crew to the bridge, where the captain and a locked cache wait.</p>
    <p>When the ship is clear, head back to the airlock and choose:</p>
    <ul><li><b>Claim it</b> — it becomes your ship (your gear moves over; its guns go to your inventory).</li><li><b>Scuttle it</b> — salvage two pieces of gear, credits and XP.</li><li><b>Leave</b> — it stays adrift.</li></ul>
    <p>You can also <b>hail</b> friendly or neutral ships (<kbd>E</kbd> when close) to hear rumors, trade with them, visit aboard peacefully or demand their cargo. Demanding is piracy: it costs reputation, and they may fight back.</p>` },
  { id: 'planets', title: 'Planets & exploration', html: () => `
    <p>Fly within range of a planet and press <kbd>L</kbd> to land. Every planet is generated from its seed: terrain, props, outposts, wildlife and loot.</p>
    ${table(['Biome', 'Hazard'], BIOMES.map(b => [`<span class="sw" style="background:${hex(b.ground[0])}"></span> ${b.name}`, b.hazard ? `${b.hazard} (drains shields)` : 'None']))}
    <ul><li><b>Faction outposts</b> have merchants, medics and engineers. Engineers and scientists can teach you a skill point.</li><li><b>Pirate camps</b> are hostile and guard caches.</li><li><b>Alien ruins</b> hold relic vaults guarded by creatures; relics sell for a fortune.</li><li><b>Deposits</b> of ore, void crystals and relics can be extracted into your cargo hold.</li><li><b>Locked caches</b> (red) need the Hacking skill.</li></ul>
    <p>Walk back to your ship and press <kbd>E</kbd> to launch.</p>` },
  { id: 'loot', title: 'Loot & gear', html: () => `
    <p>Gear comes in seven tiers. Higher tiers roll more bonus stats, and Legendary and Mythic weapons also roll special effects.</p>
    ${table(['Tier', 'Power', 'Bonus stats'], TIERS.map(t => [`<b style="color:${t.color}">${t.name}</b>`, `×${t.mult}`, t.affixes]))}
    <p><b>Special effects:</b> ${SPECIALS.map(s => `<b>${s.name}</b> — ${s.label.toLowerCase()}`).join('; ')}.</p>
    <p><b>Ship slots:</b> up to 4 guns (by hull), missiles, shield, engine, reactor, plating. <b>Personal slots:</b> primary, secondary, suit, personal shield, implant.</p>
    <p>Item level follows the system you found it in. Hover any item for a comparison against what you have equipped. <b>Datachips</b> teach a skill rank instantly; <b>medkits</b> heal on foot (<kbd>H</kbd>).</p>` },
  { id: 'skills', title: 'Skills', html: () => `
    <p>You earn a skill point every level (two every fifth level). You can also get them from datachips, station training sims and some planet-side NPCs. ${SKILLS.length} skills across ${SKILL_TREES.length} trees; some need a rank in another skill first.</p>
    ${SKILL_TREES.map(t => `<h4>${t}</h4><ul class="cols">${SKILLS.filter(s => s.tree === t).map(s => `<li><b>${s.name}</b> <span class="muted">(${s.max})</span> — ${s.desc}</li>`).join('')}</ul>`).join('')}` },
  { id: 'factions', title: 'Factions & reputation', html: (g) => `
    <p>Seven factions share the galaxy, each with an ideology, a home species, territory and relations with the others. Factions at war fight on sight — you'll often fly into battles that have nothing to do with you.</p>
    ${table(['Ideology', 'Starting attitude'], IDEOLOGIES.map(i => [i.name, i.baseRep >= 10 ? 'Friendly' : i.baseRep <= -30 ? 'Hostile' : 'Neutral']))}
    <p>Reputation runs from −100 to +100. At <b>−30 or below</b> a faction is hostile. Attacking or destroying a faction's ships costs reputation with them and their allies, and earns a little with their enemies. Completing contracts raises reputation with the faction that posted them. The <b>Factions</b> tab shows where you stand.</p>
    ${g && g.U ? `<p class="muted">This galaxy: ${g.U.factions.map(f => `<span style="color:${hex(f.color)}">${f.name}</span>`).join(', ')}.</p>` : ''}` },
  { id: 'trade', title: 'Trading & economy', html: () => `
    <p>Each system sets its own prices. In the Commodity exchange, goods marked <span class="up">cheap here</span> are worth buying and goods marked <span class="down">in demand</span> are worth selling.</p>
    ${table(['Commodity', 'Base price'], COMMODITIES.map(c => [c.name, `${c.base} cr`]))}
    <p>Cargo space depends on your hull. Freighters carry the most. Mining on planets fills your hold for free. Commerce lowers buy prices and raises sell prices.</p>` },
  { id: 'contracts', title: 'Contracts', html: () => `
    <ul><li><b>Bounty</b> — a named ship and its escorts spawn when you arrive in the target system. Destroy it.</li><li><b>Recover black box</b> — board a derelict and loot the recorder from its bridge.</li><li><b>Courier run</b> — dock at the named station.</li><li><b>Survey</b> — land on the named planet.</li><li><b>Raid</b> — land on the named planet and defeat the warlord.</li></ul>
    <p>You can hold five contracts at once. Targets show as gold diamonds on the galaxy map and ◆ markers in-system. Mission boards refresh over time.</p>` },
  { id: 'ships', title: 'Ships & crew', html: () => `
    ${table(['Hull', 'Hull pts', 'Shield', 'Speed', 'Guns', 'Crew', 'Cargo', 'Price'], HULL_CLASSES.map(h => [`<b>${h.name}</b>`, h.hull, h.shield, h.speed, h.slots, h.crew, h.cargo, h.price.toLocaleString()]))}
    <p>Buy hulls at station shipyards (your old ship is traded in) or capture them by boarding.</p>
    <p><b>Crew</b> give passive bonuses that grow with their level: ${NPC_ROLES.map(r => `${r.name.toLowerCase()} → ${r.crew.label}`).join(', ')}. Hire them in station bars or recruit them on planets and aboard friendly ships.</p>` },
  { id: 'controls', title: 'Controls', html: () => `
    <h4>Keyboard & mouse — flying</h4>${table(['Key', 'Action'], [['Mouse', 'Steer (click to capture)'], ['W / S · X', 'Throttle · all stop'], ['A / D · Q / E', 'Yaw · roll'], ['Shift · C', 'Boost · cruise'], ['LMB / Space · RMB / F', 'Guns · missile'], ['T · R', 'Cycle targets · target ahead'], ['E · L', 'Dock / board / hail · land'], ['V · M', 'Camera · galaxy map']])}
    <h4>On foot</h4>${table(['Key', 'Action'], [['WASD · Mouse', 'Move · look'], ['LMB · R · 1/2', 'Fire · reload · swap'], ['Space · Shift', 'Jump · sprint'], ['E · H', 'Interact · medkit']])}
    <h4>Menus</h4><p>I / Tab inventory · K skills · J missions · M map · G guide · Esc / P pause</p>
    <h4>Touch</h4><p>Left thumb steers (flying) or moves (on foot). Right thumb drags for throttle and roll, or to look. Buttons cover fire, missiles, boost, use, target and cruise, or jump, reload, swap, heal and sprint. MAP, GEAR and MENU are top right.</p>
    <h4>Gamepad</h4><p>Sticks fly / move and look · RT fire · LT missile · RB boost · A interact (flying) / jump (on foot) · B interact on foot · Y target / swap · X reload · L3 cruise / sprint · Back inventory · Start pause.</p>` },
  { id: 'graphics', title: 'Graphics & performance', html: (g) => `
    <p>Starward picks a quality preset for your device and then watches the frame rate. When frames drop it lowers render resolution first, and drops a preset only if that isn't enough.</p>
    <p>Change it under <b>Pause → Graphics</b>: Auto, Low, Medium or High, plus glow (bloom) and an FPS counter. Texture and terrain detail apply the next time you enter a system or land.</p>
    ${g ? `<p class="muted">Running now: ${['Low', 'Medium', 'High'][g.tier]} at ${Math.round(g.renderer.getPixelRatio() * 100) / 100}× resolution.</p>` : ''}
    <p>Progress saves automatically in this browser. Clearing site data erases it.</p>` },
  { id: 'about', title: 'About', html: (g) => aboutHTML(g) },
];

export function aboutHTML(g) {
  const seed = g && g.U ? g.U.seed : null;
  return `<div class="about">
    <div class="ab-logo">STARWARD</div><div class="muted">Version ${VERSION} · an open sandbox among procedural stars</div>
    <p>Starward is a three.js space sandbox RPG: fly and fight, land on planets, board and capture ships, trade, join or betray factions, and build a captain over time. Every galaxy, faction, species, planet, NPC, ship and weapon is generated from a seed${seed ? `. Yours is <b class="gold">${String(seed).replace(/[<>&"]/g, '')}</b>. Share it so friends can explore the same galaxy.` : '.'}</p>
    <h3>Made by Jeremy Anderson Tech</h3>
    <p>Jeremy Anderson is a software architect and WordPress engineer in Shrewsbury, Massachusetts. He builds websites, plugins, web apps and browser games like this one.</p>
    <div class="links">
      ${a(LINKS.site, '<b>jeremyanderson.tech</b><small>Website, projects and more games</small>')}
      ${a(LINKS.book, '<b>Book a call</b><small>Want something like this built?</small>')}
      ${a(LINKS.play, '<b>Play Starward</b><small>cptnope.github.io/Starward</small>')}
      ${a(LINKS.repo, '<b>Source code</b><small>github.com/CptNope/Starward</small>')}
      ${a(LINKS.issues, '<b>Report a bug</b><small>Open a GitHub issue</small>')}
      ${a(LINKS.docs, '<b>Player guide</b><small>The full guide on GitHub</small>')}
    </div>
    <p class="muted small">Built with ${a(LINKS.three, 'three.js')}. Released under the MIT License. No ads or analytics; saves stay in your browser.</p>
  </div>`;
}

export function guideHTML(g, id) {
  const sec = GUIDE.find(s => s.id === id) || GUIDE[0];
  return `<div class="guide"><nav class="gnav">${GUIDE.map(s => `<button data-a="guide" data-v="${s.id}" class="${s.id === sec.id ? 'on' : ''}">${s.title}</button>`).join('')}</nav><article class="gbody"><h2>${sec.title}</h2>${sec.html(g)}</article></div>`;
}
