import { TIERS, SKILLS, SKILL_TREES, SLOT_LABELS, HULL_CLASSES, DAMAGE_TYPES, SPECIALS, NPC_ROLES } from './data.js';
import { shipStats, personalStats, canLearn, repLabel, crewCap, cargoUsed, SHIP_SLOTS, PERSONAL_SLOTS, slotAccepts, xpForLevel, changeRep } from './player.js';
import { getSystem, dist, npcLine, genNPC } from './gen/universe.js';
import { genItem, COMMODITIES, itemPower, salvageParts, upgradeCost, reforgeCost, upgradeItem, reforgeItem, canCraft } from './gen/items.js';
import { genMissions } from './missions.js';
import { RNG, hashInts } from './rng.js';
import { PRESETS, detectTier } from './quality.js';
import { guideHTML, aboutHTML, VERSION, LINKS } from './guide.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const fmt = (n) => Math.round(n).toLocaleString();
const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 1000) / 10}%`;

export function weaponDps(it) { const w = it.weapon; return w.dmg * (w.count || 1) * w.rate * (1 + w.crit * (w.critDmg - 1)); }

export function itemHTML(it, cmp) {
  const T = TIERS[it.tier];
  let h = `<div class="it-name" style="color:${T.color}">${esc(it.name)}</div><div class="it-sub">${T.name} · Level ${it.level} · ${kindLabel(it)}${it.maker ? ' · ' + esc(it.maker) : ''}</div>`;
  if (it.weapon) {
    const w = it.weapon, dps = weaponDps(it);
    const cd = cmp && cmp.weapon ? dps - weaponDps(cmp) : null;
    h += `<div class="it-big">${dps.toFixed(1)} <small>DPS</small>${cd !== null ? ` <span class="${cd >= 0 ? 'up' : 'down'}">${cd >= 0 ? '▲' : '▼'} ${Math.abs(cd).toFixed(1)}</span>` : ''}</div>`;
    h += `<div class="it-row"><span>Damage</span><b>${w.dmg.toFixed(1)}${w.count > 1 ? ' × ' + w.count : ''} <i class="dtype" style="color:${hex(DAMAGE_TYPES[w.dtype].color)}">${w.dtype}</i></b></div>`;
    h += `<div class="it-row"><span>Fire rate</span><b>${w.rate.toFixed(2)}/s</b></div>`;
    h += `<div class="it-row"><span>Velocity · Range</span><b>${Math.round(w.speed)} · ${w.range}</b></div>`;
    h += `<div class="it-row"><span>Crit</span><b>${Math.round(w.crit * 100)}% × ${w.critDmg.toFixed(2)}</b></div>`;
    if (w.energy) h += `<div class="it-row"><span>Energy / shot</span><b>${w.energy.toFixed(1)}</b></div>`;
    if (w.mag) h += `<div class="it-row"><span>Magazine · Reload</span><b>${w.mag} · ${w.reload.toFixed(1)}s</b></div>`;
    if (w.ammo) h += `<div class="it-row"><span>Capacity</span><b>${w.ammo}</b></div>`;
    if (w.homing) h += `<div class="it-row"><span>Guidance</span><b>Homing</b></div>`;
    if (w.aoe) h += `<div class="it-row"><span>Blast radius</span><b>${w.aoe}</b></div>`;
  } else {
    for (const [k, v] of Object.entries(it.stats)) {
      const c = cmp && cmp.stats ? v - (cmp.stats[k] || 0) : null;
      h += `<div class="it-row"><span>${statLabel(k)}</span><b>${fmtStat(k, v)}${c ? ` <span class="${c > 0 ? 'up' : 'down'}">${c > 0 ? '▲' : '▼'}${fmtStat(k, Math.abs(c))}</span>` : ''}</b></div>`;
    }
  }
  if (it.affixes?.length) h += `<div class="it-aff">${it.affixes.map(a => `<div>◆ ${a.label} ${a.pct ? pct(a.value) : (a.value > 0 ? '+' : '') + a.value}</div>`).join('')}</div>`;
  if (it.specials?.length) h += `<div class="it-spec">${it.specials.map(s => `<div>★ ${SPECIALS.find(x => x.id === s).label}</div>`).join('')}</div>`;
  if (it.kind === 'skillchip') h += `<div class="it-aff">Use to gain a rank in <b>${esc(SKILLS.find(s => s.id === it.skill).name)}</b>.</div>`;
  if (it.kind === 'medkit') h += `<div class="it-aff">Restores ${it.heal} health (H on foot).</div>`;
  h += `<div class="it-val">Value ${fmt(it.value)} cr</div>`;
  return h;
}
const STAT_NAMES = { hullMax: 'Hull', shieldMax: 'Shield', shieldRegen: 'Shield regen/s', energyMax: 'Energy', energyRegen: 'Energy regen/s', speed: 'Speed', turn: 'Turn rate', jumpRange: 'Jump range (ly)', armor: 'Armor', hpMax: 'Health', pShieldMax: 'Personal shield', pShieldRegen: 'P. shield regen/s', moveSpeed: 'Move speed', crit: 'Crit chance', luck: 'Loot quality' };
const statLabel = (k) => STAT_NAMES[k] || k;
const fmtStat = (k, v) => ['moveSpeed', 'crit', 'luck'].includes(k) ? pct(v) : (Math.round(v * 100) / 100);
function kindLabel(it) { return { sweapon: 'Ship weapon', missile: 'Missile launcher', shield: 'Ship shield', engine: 'Engine', reactor: 'Reactor', plating: 'Hull plating', pweapon: 'Personal weapon', suit: 'Suit', shieldgen: 'Personal shield', implant: 'Implant', skillchip: 'Datachip', medkit: 'Consumable' }[it.kind] || it.kind; }

const HINTS = {
  space: {
    kbm: '<b>Mouse</b> aim · <b>W/S</b> throttle · <b>Shift</b> boost · <b>LMB/Space</b> fire · <b>RMB/F</b> missile · <b>T</b> target · <b>C</b> cruise · <b>E</b> interact · <b>L</b> land · <b>V</b> camera · <b>M</b> map · <b>I</b> inventory · <b>G</b> guide · <b>Esc</b> pause',
    pad: '<b>L stick</b> steer · <b>R stick</b> roll / throttle · <b>RT</b> fire · <b>LT</b> missile · <b>RB</b> boost · <b>Y</b> target · <b>B</b> target ahead · <b>A</b> interact · <b>L3</b> cruise · <b>R3</b> camera · <b>Back</b> menu · <b>Start</b> pause',
  },
  foot: {
    kbm: '<b>WASD</b> move · <b>Mouse</b> look · <b>LMB</b> fire · <b>R</b> reload · <b>1/2</b> weapons · <b>Space</b> jump · <b>Shift</b> sprint · <b>E</b> interact · <b>H</b> medkit · <b>V</b> view · <b>I</b> inventory · <b>G</b> guide · <b>Esc</b> pause',
    pad: '<b>L stick</b> move · <b>R stick</b> look · <b>RT</b> fire · <b>A</b> jump · <b>B</b> interact · <b>X</b> reload · <b>Y</b> swap · <b>L3</b> sprint · <b>R3</b> view · <b>D-pad ↓</b> medkit · <b>Back</b> menu · <b>Start</b> pause',
  },
};
export class UI {
  constructor(game) {
    this.game = game; this.modal = null; this.freeCursor = false; this.mode = 'menu';
    this.root = document.getElementById('ui');
    this.root.innerHTML = HUD_HTML;
    this.hud = $('#hud'); this.overlay = $('#overlay'); this.tip = $('#tooltip');
    this.navPool = []; this.barPool = []; this.toastQ = [];
    this.radarCv = $('#radar'); this.rctx = this.radarCv.getContext('2d');
    this.overlay.addEventListener('click', (e) => this.onClick(e));
    this.overlay.addEventListener('mousemove', (e) => this.onHover(e));
    this.overlay.addEventListener('mouseleave', () => this.tip.style.display = 'none');
    this.sel = null; this.tab = 'inventory';
    this.last = {};
  }
  // ---------------- HUD ----------------
  setMode(m) {
    this.mode = m;
    this.hud.dataset.mode = m;
    if (this.game.touch) this.game.touch.setMode(m);
    this.last = {};
    this.hud.style.display = m === 'menu' ? 'none' : '';
    this.hintKey = null; this.refreshHint();
    this.navMarkers([]); this.worldBars([]); this.target(null);
  }
  // Bottom hint bar follows the device you're using.
  refreshHint() {
    if (this.mode !== 'space' && this.mode !== 'foot') return;
    const dev = this.game.input.padActive ? 'pad' : 'kbm', k = this.mode + dev;
    if (this.hintKey === k) return; this.hintKey = k;
    $('#hint').innerHTML = HINTS[this.mode][dev];
  }
  // Same as Esc: step back out of whatever is open, or pause.
  back() {
    const g = this.game;
    if (!g.mode) { if (this.modal === 'title' && !$('#ng-name')) return; return this.title(); }
    if (this.modal === 'death') return;
    if (this.modal === 'shop') { this.shopOpen = false; return this.close(); }
    if (this.modal === 'guide') return this.handlers.guideback.call(this);
    if (this.modal) return this.close();
    this.pause();
  }
  // Gamepad control of menus: D-pad / left stick moves a highlight, A presses it, B goes back,
  // LB / RB switch tabs. On the galaxy map the stick picks stars and the triggers zoom.
  gamepadNav(inp, dt) {
    const gp = inp.gp;
    if (!gp || gp.touch) { if (this.gpEl) { this.gpEl.classList.remove('gpfocus'); this.gpEl = null; } return; }
    const now = performance.now();
    let dir = null;
    if (gp.b[12] || gp.ly < -0.55) dir = 'up'; else if (gp.b[13] || gp.ly > 0.55) dir = 'down';
    else if (gp.b[14] || gp.lx < -0.55) dir = 'left'; else if (gp.b[15] || gp.lx > 0.55) dir = 'right';
    let step = null;
    if (dir) {
      if (!this.navHold || this.navHold.dir !== dir) { this.navHold = { dir, t: now + 380 }; step = dir; }
      else if (now >= this.navHold.t) { this.navHold.t = now + 120; step = dir; }
    } else this.navHold = null;
    const used = step || [0, 1, 4, 5, 8, 9].some(i => inp.gpPressed(i));
    if (used) inp.lastDevice = 'pad';
    if (!inp.padActive && !used) return;
    const onMap = this.modal === 'menu' && this.tab === 'galaxy' && $('#map');
    if (onMap) {
      if (step) this.mapStep(step);
      const z = (gp.rt || 0) - (gp.lt || 0);
      if (Math.abs(z) > 0.3 && this.mapView) { this.mapView.z = Math.max(3, Math.min(60, this.mapView.z * (1 + z * dt * 1.5))); this.mapRedraw && this.mapRedraw(); }
    }
    const items = this.navItems();
    if (this.gpEl && !items.includes(this.gpEl)) {
      const key = this.gpKey; this.gpEl = items.find(e => this.navKey(e) === key) || null;
    }
    if (!this.gpEl && items.length) this.gpEl = items.find(e => e.classList.contains('primary')) || items.find(e => e.tagName === 'BUTTON' && !e.closest('.tabs')) || items[0];
    if (step && !onMap && this.gpEl) { const nx = this.navMove(items, this.gpEl, step); if (nx) this.gpEl = nx; }
    for (const e of this.overlay.querySelectorAll('.gpfocus')) if (e !== this.gpEl) e.classList.remove('gpfocus');
    if (this.gpEl) {
      if (!this.gpEl.classList.contains('gpfocus')) {
        this.gpEl.classList.add('gpfocus'); this.gpEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const r = this.gpEl.getBoundingClientRect(); this.onHover({ target: this.gpEl, clientX: r.right, clientY: r.top });
      }
      this.gpKey = this.navKey(this.gpEl);
    }
    if (inp.gpPressed(4) || inp.gpPressed(5)) {
      const tabs = [...this.overlay.querySelectorAll('.tabs [data-a="tab"], .tabs [data-a="stab"]')];
      const cur = tabs.findIndex(t => t.classList.contains('on'));
      if (tabs.length) { const n = tabs[(cur + (inp.gpPressed(5) ? 1 : -1) + tabs.length) % tabs.length]; this.gpEl = null; this.gpKey = null; n.click(); }
    } else if (inp.gpPressed(0)) {
      if (onMap) { const j = this.overlay.querySelector('#mapinfo [data-a="jump"]:not([disabled])'); if (j) j.click(); else if (this.gpEl) this.gpEl.click(); }
      else if (this.gpEl) this.gpEl.click();
    } else if (inp.gpPressed(1) || inp.gpPressed(9)) this.back();
    else if (inp.gpPressed(8) && this.modal === 'menu') this.close();
    // menus swallow controller presses so they don't also act in the game this frame
    if (this.modal || used) inp.gpEdge = inp.gpEdge.map(() => false);
  }
  navItems() {
    return [...this.overlay.querySelectorAll('button:not([disabled]), [data-a]:not(button)')].filter((e) => {
      if (e.tagName === 'INPUT' || e.closest('[disabled]')) return false;
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    });
  }
  navKey(e) { return `${e.dataset.a || ''}|${e.dataset.v || ''}|${e.textContent.trim().slice(0, 24)}`; }
  navMove(items, from, dir) {
    const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    let best = null, bs = Infinity;
    for (const e of items) {
      if (e === from) continue;
      const r = e.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      const along = dx * v[0] + dy * v[1]; if (along <= 4) continue;
      const across = Math.abs(dx * v[1] - dy * v[0]);
      const sc = along + across * 2.2; if (sc < bs) { bs = sc; best = e; }
    }
    return best;
  }
  // Move the galaxy-map selection to the nearest star in a direction.
  mapStep(dir) {
    const g = this.game, U = g.U, V = this.mapView, cv = $('#map'); if (!V || !cv) return;
    const from = U.systems[this.mapSel ?? g.player.systemId];
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    let best = null, bs = Infinity;
    for (const s of U.systems) {
      if (s === from) continue;
      const dx = s.x - from.x, dy = s.y - from.y, along = dx * v[0] + dy * v[1]; if (along <= 0.05) continue;
      const sc = along + Math.abs(dx * v[1] - dy * v[0]) * 2; if (sc < bs) { bs = sc; best = s; }
    }
    if (!best) return;
    this.mapSel = best.id;
    const px = (best.x - V.cx) * V.z + cv.width / 2, py = (best.y - V.cy) * V.z + cv.height / 2;
    if (px < 60 || px > cv.width - 60 || py < 60 || py > cv.height - 60) { V.cx = best.x; V.cy = best.y; }
    this.drawMap();
  }
  toast(msg, color = '#e6f4ff') {
    const box = $('#toasts');
    const d = document.createElement('div'); d.className = 'toast'; d.style.borderColor = color; d.innerHTML = `<span style="color:${color}">●</span> ${esc(msg)}`;
    box.prepend(d); while (box.children.length > (innerHeight < 500 ? 3 : 6)) box.lastChild.remove();
    setTimeout(() => d.classList.add('out'), 3600); setTimeout(() => d.remove(), 4200);
  }
  prompt(t) {
    if (t && this.game.touch && this.game.touch.active) t = t.replace(/^[EL] · /, 'USE · ');
    else if (t && this.game.input.padActive) t = t.replace(/^[EL] · /, this.mode === 'foot' ? 'B · ' : 'A · '); if (this.last.prompt === t) return; this.last.prompt = t; const p = $('#prompt'); p.textContent = t || ''; p.style.display = t ? '' : 'none'; }
  set(id, html) { if (this.last[id] === html) return; this.last[id] = html; $(id).innerHTML = html; }
  top() {
    const P = this.game.player; if (!P) return;
    const key = `${P.level}|${P.xp}|${Math.round(P.credits)}|${P.skillPoints}|${P.systemId}`;
    if (this.last.top === key) return; this.last.top = key;
    const sys = this.game.U.systems[P.systemId];
    $('#tl').innerHTML = `<div class="sys">${esc(sys.name)}</div><div class="lv">Level <b>${P.level}</b>${P.skillPoints ? ` · <span class="sp">${P.skillPoints} skill point${P.skillPoints > 1 ? 's' : ''} (K)</span>` : ''}</div><div class="xpbar"><i style="width:${Math.min(100, P.xp / xpForLevel(P.level) * 100)}%"></i></div><div class="cr">${fmt(P.credits)} cr</div>`;
  }
  bar(id, f, txt) { const w = Math.round(Math.max(0, Math.min(1, f)) * 200) / 2; const k = id + w + txt; if (this.last[id] === k) return; this.last[id] = k; const el = $(id); el.querySelector('i').style.width = `${w}%`; el.querySelector('em').textContent = txt; }
  label(id, txt) { const k = id + 'L'; if (this.last[k] === txt) return; this.last[k] = txt; $(id).textContent = txt; }
  show(id, on) { const k = id + 'V'; if (this.last[k] === on) return; this.last[k] = on; $(id).style.display = on ? '' : 'none'; }
  spaceHud(d) {
    this.show('#lockhint', !this.game.input.locked && this.game.input.lastDevice === 'kbm' && this.game.settings.flight !== 'classic' && !(this.game.touch && this.game.touch.active));
    this.bar('#b1', d.shield, d.shieldTxt); this.bar('#b2', d.hull, d.hullTxt); this.bar('#b3', d.energy, `${Math.round(d.energy * 100)}%`);
    this.label('#b1 span', 'Shield'); this.label('#b2 span', 'Hull'); this.show('#b3', true);
    this.set('#spd', `<b>${Math.round(d.speed / 5) * 5}</b> m/s ${d.cruise ? '<span class="cruise">CRUISE</span>' : d.boost ? '<span class="boost">BOOST</span>' : ''}<div class="thr"><i style="width:${Math.round(d.throttle * 20) * 5}%"></i></div><div class="mis">Missiles ${d.missiles}</div>`);
    const touch = this.game.touch && this.game.touch.active;
    // gun reticle follows where the guns actually point
    const ch = $('#crosshair');
    if (d.reticle && !d.reticle.behind) { ch.style.left = `${d.reticle.x}px`; ch.style.top = `${d.reticle.y}px`; } else { ch.style.left = ''; ch.style.top = ''; }
    this.show('#vcursor', !touch);
    if (!touch) {
      if (d.aimCursor) $('#vcursor').style.transform = d.aimCursor.behind ? 'translate(-99px,-99px)' : `translate(${d.aimCursor.x}px, ${d.aimCursor.y}px)`;
      else { const vc = this.game.input.vc; $('#vcursor').style.transform = `translate(${(vc.x / 2.4 + 0.5) * innerWidth}px, ${(vc.y / 2.4 + 0.5) * innerHeight}px)`; }
      $('#vcursor').classList.toggle('aim', !!d.aimCursor);
    }
    this.top();
  }
  footHud(d) {
    const ch = $('#crosshair'); if (ch.style.left) { ch.style.left = ''; ch.style.top = ''; }
    this.bar('#b1', d.shield, d.shieldTxt); this.bar('#b2', d.hp, d.hpTxt); this.show('#b3', false);
    this.label('#b1 span', 'Shield'); this.label('#b2 span', 'Health');
    this.show('#lockhint', !this.game.input.locked && this.game.input.lastDevice === 'kbm' && !(this.game.touch && this.game.touch.active));
    this.set('#spd', `<div class="wpn" style="color:${TIERS[d.tier].color}">${esc(d.weapon)}</div><div class="ammo">${d.ammo}</div><div class="mis">Medkits ${d.medkits}${d.hazard ? ` · <span class="haz">Hazard ${d.hazard}</span>` : ''}</div>`);
    this.top();
  }
  target(t) {
    const tp = $('#tpanel'), br = $('#bracket'), ld = $('#lead');
    if (!t) { if (this.last.tOff) return; this.last.tOff = true; this.last['#tpanel'] = null; tp.style.display = 'none'; br.style.display = 'none'; ld.style.display = 'none'; return; }
    this.last.tOff = false; tp.style.display = '';
    this.set('#tpanel', `<div class="tn" style="color:${t.hostile ? '#ff6b6b' : t.color}">${esc(t.name)}</div><div class="ts">${esc(t.cls)} · <span style="color:${t.color}">${esc(t.faction)}</span></div><div class="ts">${t.disabled ? '<b style="color:#ffd34d">DISABLED — board with USE/E</b>' : t.hostile ? '<b style="color:#ff6b6b">HOSTILE</b>' : 'Neutral'} · ${fmt(Math.round(t.dist / 10) * 10)} m</div><div class="tb sh"><i style="width:${Math.round(t.shield * 100)}%"></i></div><div class="tb hu"><i style="width:${Math.round(Math.max(0, t.hull) * 100)}%"></i></div>`);
    if (t.screen && !t.screen.behind) { br.style.display = ''; br.style.transform = `translate(${t.screen.x}px,${t.screen.y}px)`; br.style.borderColor = t.hostile ? '#ff5a5a' : '#7ee08a'; } else br.style.display = 'none';
    if (t.lead && !t.lead.behind && t.hostile) { ld.style.display = ''; ld.style.transform = `translate(${t.lead.x}px,${t.lead.y}px) rotate(45deg)`; } else ld.style.display = 'none';
  }
  radar(blips) {
    this.radarTick = ((this.radarTick || 0) + 1) % 3; if (this.radarTick) return;
    const c = this.rctx, W = this.radarCv.width, R = W / 2;
    c.clearRect(0, 0, W, W);
    c.strokeStyle = 'rgba(120,200,255,0.25)'; c.lineWidth = 1;
    for (const k of [1, 0.66, 0.33]) { c.beginPath(); c.arc(R, R, R * k - 1, 0, 6.29); c.stroke(); }
    c.beginPath(); c.moveTo(R, 0); c.lineTo(R, W); c.moveTo(0, R); c.lineTo(W, R); c.stroke();
    for (const b of blips) {
      const x = R + b.x * R, y = R + b.z * R;
      c.fillStyle = b.c; c.beginPath(); c.arc(x, y, b.t ? 4 : 2.6, 0, 6.29); c.fill();
      if (b.y && Math.abs(b.y) > 0.05) { c.strokeStyle = b.c; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - b.y * R * 0.5); c.stroke(); }
      if (b.t) { c.strokeStyle = '#fff'; c.strokeRect(x - 6, y - 6, 12, 12); }
    }
    c.fillStyle = '#4dd6ff'; c.beginPath(); c.moveTo(R, R - 6); c.lineTo(R - 4, R + 4); c.lineTo(R + 4, R + 4); c.fill();
  }
  pool(arr, layer, n, cls) { while (arr.length < n) { const d = document.createElement('div'); d.className = cls; layer.appendChild(d); arr.push(d); } for (let i = 0; i < arr.length; i++) arr[i].style.display = i < n ? '' : 'none'; }
  navMarkers(list) {
    const vis = list.filter(m => m.s && !m.s.behind && m.s.x > -50 && m.s.x < innerWidth + 50 && m.s.y > -50 && m.s.y < innerHeight + 50);
    this.pool(this.navPool, $('#navlayer'), vis.length, 'nav');
    vis.forEach((m, i) => { const d = this.navPool[i]; d.style.transform = `translate(${m.s.x}px,${m.s.y}px)`; d.style.color = m.c; const t = `${m.name}<br><small>${m.d > 9999 ? (m.d / 1000).toFixed(1) + ' km' : Math.round(m.d) + ' m'}</small>`; if (d._t !== t) { d.innerHTML = t; d._t = t; } });
  }
  worldBars(list) {
    this.pool(this.barPool, $('#barlayer'), list.length, 'wbar');
    list.forEach((b, i) => { const d = this.barPool[i]; d.style.transform = `translate(${b.x}px,${b.y}px)`; const t = `<div class="wn" style="color:${b.hostile ? '#ff8a8a' : '#9fe8a8'}">${esc(b.name)}</div><div class="wb"><i style="width:${Math.max(0, b.f) * 100}%;background:${b.hostile ? '#ff4d4d' : '#5be37d'}"></i></div>`; if (d._t !== t) { d.innerHTML = t; d._t = t; } });
  }
  hitMarker(crit) { const h = $('#hitmark'); h.className = crit ? 'show crit' : 'show'; clearTimeout(this._hm); this._hm = setTimeout(() => h.className = '', 120); }
  damageFlash() { const v = $('#vignette'); v.style.opacity = 0.55; clearTimeout(this._dv); this._dv = setTimeout(() => v.style.opacity = 0, 140); }
  warpFx(on) { $('#warp').className = on ? 'on' : ''; }

  // ---------------- Overlay framework ----------------
  open(kind, html) {
    this.modal = kind; this.overlay.innerHTML = html; this.overlay.style.display = 'flex';
    this.game.input.releaseLock(); this.tip.style.display = 'none';
  }
  close() { this.modal = null; this.overlay.style.display = 'none'; this.overlay.innerHTML = ''; this.tip.style.display = 'none'; this.game.audio.ui(); this.game.afterMenu(); }
  onHover(e) {
    const el = e.target.closest('[data-tip]');
    if (!el) { this.tip.style.display = 'none'; return; }
    const it = this.findItem(el.dataset.tip);
    if (!it) { this.tip.style.display = 'none'; return; }
    const cmp = this.equippedFor(it);
    this.tip.innerHTML = itemHTML(it, cmp && cmp !== it ? cmp : null);
    this.tip.style.display = 'block';
    const x = Math.min(e.clientX + 18, innerWidth - 300), y = Math.min(e.clientY + 12, innerHeight - this.tip.offsetHeight - 10);
    this.tip.style.left = x + 'px'; this.tip.style.top = y + 'px';
  }
  findItem(id) {
    const P = this.game.player;
    return P.inventory.find(i => i.id === id) || Object.values(P.equip).find(i => i && i.id === id) || Object.values(P.pequip).find(i => i && i.id === id) || (this.shopStock || []).find(i => i.id === id);
  }
  equippedFor(it) {
    const P = this.game.player;
    if (it.kind === 'sweapon') return P.equip.weapon1; if (it.kind === 'pweapon') return P.pequip.pweapon1;
    return P.equip[it.kind] || P.pequip[it.kind] || null;
  }
  onClick(e) {
    const el = e.target.closest('[data-a]'); if (!el) return;
    const a = el.dataset.a, v = el.dataset.v, g = this.game, P = g.player;
    g.audio.ui();
    const H = this.handlers[a]; if (H) H.call(this, v, el);
  }

  // ---------------- Main menu (tabs) ----------------
  openMenu(tab = this.tab) {
    this.tab = tab;
    const tabs = [['inventory', 'Inventory'], ['character', 'Character'], ['skills', 'Skills'], ['missions', 'Missions'], ['factions', 'Factions'], ['galaxy', 'Galaxy Map'], ['guide', 'Guide']];
    const body = this['tab_' + tab]();
    this.open('menu', `<div class="panel big"><div class="tabs">${tabs.map(([k, n]) => `<button data-a="tab" data-v="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}<button class="x" data-a="close">✕</button></div><div class="pbody">${body}</div></div>`);
    if (tab === 'galaxy') this.drawMap();
  }
  refresh() { if (this.modal === 'menu') this.openMenu(this.tab); else if (this.modal === 'station') this.openStation(this.station, this.stationMode, this.stab); }

  tab_inventory() {
    const g = this.game, P = g.player; const ss = shipStats(P);
    const slotRow = (slot, it, personal) => {
      if (slot.startsWith('weapon') && +slot.slice(6) > ss.slots) return '';
      return `<div class="slot ${this.sel === (it && it.id) ? 'sel' : ''}" data-a="sel" data-v="${it ? it.id : ''}" ${it ? `data-tip="${it.id}"` : ''}><span class="sl">${SLOT_LABELS[slot] || slot}</span>${it ? `<span style="color:${TIERS[it.tier].color}">${esc(it.name)}</span><span class="pw">${it.weapon ? weaponDps(it).toFixed(0) + ' dps' : 'L' + it.level}</span>` : '<span class="empty">— empty —</span>'}</div>`;
    };
    const inv = P.inventory.slice().sort((a, b) => b.tier - a.tier || b.level - a.level);
    const selIt = this.sel ? this.findItem(this.sel) : null;
    return `<div class="cols3">
      <div><h3>Ship · ${esc(P.ship.name)} <small>${HULL_CLASSES.find(h => h.id === P.ship.cls).name}</small></h3>${SHIP_SLOTS.map(s => slotRow(s, P.equip[s])).join('')}
      <h3>Personal</h3>${PERSONAL_SLOTS.map(s => slotRow(s, P.pequip[s], true)).join('')}</div>
      <div><h3>Inventory <small>${P.inventory.length}/40</small></h3><div class="invlist">${inv.length ? inv.map(it => `<div class="irow ${this.sel === it.id ? 'sel' : ''}" data-a="sel" data-v="${it.id}" data-tip="${it.id}"><span class="dot" style="background:${TIERS[it.tier].color}"></span><span style="color:${TIERS[it.tier].color}">${esc(it.name)}</span><span class="pw">${kindLabel(it)}</span></div>`).join('') : '<div class="empty pad">Empty. Destroy ships, open caches and explore planets to find gear.</div>'}</div>
      <h3>Cargo <small>${cargoUsed(P)}/${ss.cargo} · Parts ${fmt(P.parts || 0)}</small></h3><div class="cargo">${Object.entries(P.cargo).filter(([, n]) => n > 0).map(([k, n]) => `<span>${COMMODITIES.find(c => c.id === k).name} × ${n}</span>`).join('') || '<span class="empty">Empty hold</span>'}</div></div>
      <div class="detail">${selIt ? itemHTML(selIt, this.equippedFor(selIt) !== selIt ? this.equippedFor(selIt) : null) + this.itemActions(selIt) : '<div class="empty pad">Select an item to see details and actions. Hover anything for a quick comparison.</div>'}</div></div>`;
  }
  itemActions(it) {
    const P = this.game.player; const ss = shipStats(P);
    const equippedSlot = [...SHIP_SLOTS.map(s => [s, P.equip[s]]), ...PERSONAL_SLOTS.map(s => [s, P.pequip[s]])].find(([, x]) => x === it);
    let b = '<div class="acts">';
    if (equippedSlot) b += `<button data-a="unequip" data-v="${equippedSlot[0]}">Unequip</button>`;
    else if (it.kind === 'sweapon') { for (let i = 1; i <= ss.slots; i++) b += `<button data-a="equip" data-v="weapon${i}">Equip → Gun ${i}</button>`; }
    else if (it.kind === 'pweapon') { b += `<button data-a="equip" data-v="pweapon1">Equip → Primary</button><button data-a="equip" data-v="pweapon2">Equip → Secondary</button>`; }
    else if (it.kind === 'skillchip') b += `<button data-a="usechip">Use datachip</button>`;
    else if (it.kind === 'medkit') b += `<button data-a="usemed">Use medkit</button>`;
    else if (SHIP_SLOTS.includes(it.kind) || PERSONAL_SLOTS.includes(it.kind)) b += `<button data-a="equip" data-v="${it.kind}">Equip</button>`;
    if (!equippedSlot) {
      if (this.modal === 'station' || this.shopOpen) b += `<button data-a="sell">Sell · ${fmt(this.sellPrice(it))} cr</button>`;
      b += `<button class="danger" data-a="drop">Discard</button>`;
    }
    return b + '</div>';
  }
  sellPrice(it) { return Math.round(it.value * 0.35 * (1 + (this.game.player.skills.commerce || 0) * 0.04)); }
  buyPrice(it) { return Math.round(it.value * (1 - (this.game.player.skills.commerce || 0) * 0.04)); }

  tab_character() {
    const g = this.game, P = g.player, ss = shipStats(P), ps = personalStats(P), sp = g.U.species[P.species || 0];
    const row = (k, v) => `<div class="it-row"><span>${k}</span><b>${v}</b></div>`;
    return `<div class="cols3"><div><h3>${esc(P.name)}</h3>${row('Species', esc(sp.name))}${row('Level', P.level)}${row('XP', `${fmt(P.xp)} / ${fmt(xpForLevel(P.level))}`)}${row('Credits', fmt(P.credits))}${row('Ships destroyed / disabled', P.kills)}${row('Ships boarded', P.boarded)}${row('Planetfalls', P.landed)}${row('Systems discovered', P.discovered.length)}
      <h3>Personal</h3>${row('Health', Math.round(ps.hpMax))}${row('Armor', Math.round(ps.armor))}${row('Shield', `${Math.round(ps.pShieldMax)} (+${ps.pShieldRegen.toFixed(1)}/s)`)}${row('Move speed', ps.move.toFixed(1))}${row('Weapon damage', pct(ps.weaponMods.dmg - 1))}${row('Crit bonus', pct(ps.weaponMods.crit))}</div>
      <div><h3>Ship · ${esc(P.ship.name)}</h3>${row('Hull', Math.round(ss.hullMax))}${row('Shield', `${Math.round(ss.shieldMax)} (+${ss.shieldRegen.toFixed(1)}/s)`)}${row('Energy', `${Math.round(ss.energyMax)} (+${ss.energyRegen.toFixed(1)}/s)`)}${row('Speed', Math.round(ss.speed))}${row('Turn rate', ss.turn.toFixed(2))}${row('Jump range', ss.jumpRange.toFixed(1) + ' ly')}${row('Armor', Math.round(ss.armor))}${row('Weapon damage', pct(ss.weaponMods.dmg - 1))}${row('Loot quality', pct(ss.luck))}${row('Cargo', ss.cargo)}${row('Gun slots', ss.slots)}</div>
      <div><h3>Crew <small>${P.crew.length}/${crewCap(P)} · up to 2 wingmen</small></h3>${P.crew.length ? P.crew.map((c, i) => { const role = NPC_ROLES.find(r => r.id === c.role); return `<div class="crew"><b>${esc(c.name)}</b> <small>${esc(c.speciesName)} ${role.name} · Lv ${c.level}</small><div class="muted">Bonus: ${role.crew.label}${c.wing ? ' · <span class="up">flying as wingman</span>' : ''}${c.injured ? ' · <span class="down">recovering (dock to treat)</span>' : ''}</div><button data-a="wing" data-v="${i}" ${!c.wing && P.crew.filter(x => x.wing).length >= 2 ? 'disabled' : ''}>${c.wing ? 'Recall from wing' : 'Fly as wingman'}</button><button data-a="dismiss" data-v="${i}">Dismiss</button></div>`; }).join('') : '<div class="empty pad">No crew. Hire spacers in station bars or recruit them on your travels.</div>'}</div></div>`;
  }
  tab_skills() {
    const P = this.game.player;
    return `<div class="sp-head">Skill points: <b>${P.skillPoints}</b> <span class="muted">· earned each level (bonus every 5), from datachips, or bought at station training sims</span></div><div class="trees">${SKILL_TREES.map(t => `<div class="tree"><h3>${t}</h3>${SKILLS.filter(s => s.tree === t).map(s => {
      const rank = P.skills[s.id] || 0; const ok = canLearn(P, s) && P.skillPoints > 0; const req = s.req ? SKILLS.find(x => x.id === s.req[0]) : null; const locked = s.req && (P.skills[s.req[0]] || 0) < s.req[1];
      return `<div class="skill ${locked ? 'locked' : ''} ${rank ? 'has' : ''}"><div class="sn">${s.name}</div><div class="pips">${Array.from({ length: s.max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</div><div class="sd">${s.desc} per rank</div>${locked ? `<div class="req">Requires ${req.name} ${s.req[1]}</div>` : ''}<button data-a="learn" data-v="${s.id}" ${ok ? '' : 'disabled'}>${rank >= s.max ? 'Mastered' : 'Learn'}</button></div>`;
    }).join('')}</div>`).join('')}</div>`;
  }
  tab_missions() {
    const P = this.game.player;
    const act = P.missions.filter(m => !m.done);
    return `<div class="cols2"><div><h3>Active contracts <small>${act.length}/5</small></h3>${act.length ? act.map(m => this.missionCard(m, true)).join('') : '<div class="empty pad">No contracts. Check the mission board when docked at a station.</div>'}</div>
      <div><h3>Tips</h3><div class="muted pad">Contract targets show on the galaxy map in gold and as ◆ markers in-system. Bounties and derelicts spawn when you arrive in the target system. Raids and surveys need you to land (L) on the named planet.</div></div></div>`;
  }
  missionCard(m, active) {
    const P = this.game.player; const here = this.game.U.systems[P.systemId]; const d = dist(here, this.game.U.systems[m.sysId]);
    return `<div class="mcard"><div class="mt">${esc(m.title)}</div><div class="md">${esc(m.desc)}</div><div class="mm">${esc(m.sysName)} · ${d < 0.1 ? 'this system' : d.toFixed(1) + ' ly'} · Lv ${m.level} · <span class="gold">${fmt(m.reward.credits)} cr</span> · ${m.reward.xp} xp${m.reward.item ? ' · + gear' : ''}</div>${active ? `<button data-a="abandon" data-v="${m.id}">Abandon</button> <button data-a="mapto" data-v="${m.sysId}">Show on map</button>` : `<button data-a="accept" data-v="${m.id}">Accept</button>`}</div>`;
  }
  tab_factions() {
    const U = this.game.U, P = this.game.player;
    return `<div class="facs">${U.factions.map(f => {
      const [lab, col] = repLabel(P.rep[f.id]); const allies = U.factions.filter(o => o.id !== f.id && f.relations[o.id] > 30).map(o => o.name); const foes = U.factions.filter(o => o.id !== f.id && f.relations[o.id] <= -45).map(o => o.name);
      const owned = U.systems.filter(s => s.owner === f.id).length;
      return `<div class="fac"><div class="fh"><span class="sw" style="background:${hex(f.color)}"></span><b>${esc(f.name)}</b> <small>${f.ideoName} · ${esc(U.species[f.species].name)} · ${owned} systems</small></div><div class="muted">“${esc(f.motto)}”</div><div class="rep"><div class="rb"><i style="left:${(P.rep[f.id] + 100) / 2}%;background:${col}"></i></div><span style="color:${col}">${lab} (${Math.round(P.rep[f.id])})</span></div><div class="rel">${allies.length ? `<span class="up">Allies:</span> ${allies.map(esc).join(', ')}` : ''}${foes.length ? ` <span class="down">At war:</span> ${foes.map(esc).join(', ')}` : ''}</div></div>`;
    }).join('')}</div>`;
  }
  tab_guide() { return guideHTML(this.game, this.guideSec); }
  openGuide(sec = 'start') {
    this.guideSec = sec;
    this.open('guide', `<div class="panel big"><div class="tabs"><b class="ttl">Field Guide</b><button class="x" data-a="guideback">✕</button></div><div class="pbody">${guideHTML(this.game, sec)}</div></div>`);
  }
  tab_galaxy() {
    return `<div class="mapwrap"><canvas id="map"></canvas><div id="mapinfo" class="mapinfo"></div><div class="mapzoom"><button data-a="mapz" data-v="1.3">+</button><button data-a="mapz" data-v="0.77">−</button><button data-a="mapz" data-v="home">◎</button></div></div>`;
  }
  drawMap() {
    const g = this.game, U = g.U, P = g.player, cv = $('#map'); if (!cv) return;
    const box = cv.parentElement.getBoundingClientRect(); cv.width = box.width; cv.height = box.height;
    const ctx = cv.getContext('2d');
    const here = U.systems[P.systemId];
    if (!this.mapView) this.mapView = { cx: here.x, cy: here.y, z: Math.min(cv.width, cv.height) / 60 };
    const V = this.mapView, ss = shipStats(P);
    const tx = (x) => (x - V.cx) * V.z + cv.width / 2, ty = (y) => (y - V.cy) * V.z + cv.height / 2;
    const draw = () => {
      ctx.fillStyle = '#04060c'; ctx.fillRect(0, 0, cv.width, cv.height);
      // territory haze
      for (const s of U.systems) if (s.owner !== null) { ctx.fillStyle = hex(U.factions[s.owner].color) + '22'; ctx.beginPath(); ctx.arc(tx(s.x), ty(s.y), 5.5 * V.z, 0, 6.29); ctx.fill(); }
      ctx.strokeStyle = 'rgba(77,214,255,0.5)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(tx(here.x), ty(here.y), ss.jumpRange * V.z, 0, 6.29); ctx.stroke(); ctx.setLineDash([]);
      const mset = new Set(P.missions.filter(m => !m.done).map(m => m.sysId));
      for (const s of U.systems) {
        const x = tx(s.x), y = ty(s.y); const known = P.discovered.includes(s.id);
        ctx.fillStyle = hex(s.star.color); ctx.globalAlpha = known ? 1 : 0.55;
        ctx.beginPath(); ctx.arc(x, y, (known ? 3.2 : 2.2) * Math.max(0.8, V.z / 10), 0, 6.29); ctx.fill(); ctx.globalAlpha = 1;
        if (s.owner !== null) { ctx.strokeStyle = hex(U.factions[s.owner].color); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.29); ctx.stroke(); ctx.lineWidth = 1; }
        if (mset.has(s.id)) { ctx.fillStyle = '#ffd34d'; ctx.save(); ctx.translate(x, y - 12); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore(); }
        if (s.id === P.systemId) { ctx.strokeStyle = '#4dd6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 10, 0, 6.29); ctx.stroke(); ctx.lineWidth = 1; }
        if (s.id === this.mapSel) { ctx.strokeStyle = '#fff'; ctx.strokeRect(x - 11, y - 11, 22, 22); ctx.beginPath(); ctx.moveTo(tx(here.x), ty(here.y)); ctx.lineTo(x, y); ctx.stroke(); }
        if (V.z > 9 || known) { ctx.fillStyle = known ? '#cfe6ff' : '#6a7a90'; ctx.font = '11px "Chakra Petch", sans-serif'; ctx.fillText(s.name, x + 8, y + 4); }
      }
    };
    draw();
    const info = () => {
      const el = $('#mapinfo'); if (!el) return;
      const s = this.mapSel !== undefined && this.mapSel !== null ? U.systems[this.mapSel] : here;
      const det = getSystem(U, s.id); const d = dist(here, s);
      const owner = s.owner !== null ? U.factions[s.owner] : null;
      const inRange = d <= ss.jumpRange && s.id !== here.id;
      const ms = P.missions.filter(m => !m.done && m.sysId === s.id);
      el.innerHTML = `<h3>${esc(s.name)}</h3><div class="muted">${s.star.k}</div><div class="it-row"><span>Control</span><b style="color:${owner ? hex(owner.color) : '#aaa'}">${owner ? esc(owner.name) : 'Unclaimed'}</b></div><div class="it-row"><span>Threat · Level</span><b>${s.danger} · ${s.level}</b></div><div class="it-row"><span>Planets · Stations</span><b>${det.planets.length} · ${det.stations.length}</b></div><div class="it-row"><span>Distance</span><b>${d.toFixed(1)} ly</b></div>${ms.map(m => `<div class="gold">◆ ${esc(m.title)}</div>`).join('')}
        ${s.id === here.id ? '<div class="muted">You are here.</div>' : `<button data-a="jump" data-v="${s.id}" ${inRange ? '' : 'disabled'}>${inRange ? 'Engage jump drive' : 'Out of jump range'}</button>`}<div class="muted small">Drag to pan · wheel to zoom · click a star</div>`;
    };
    info();
    let drag = null; const pts = new Map(); let pinch = null;
    this.mapRedraw = draw;
    cv.style.touchAction = 'none';
    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: V.z }; drag = null; } else drag = { x: e.clientX, y: e.clientY, cx: V.cx, cy: V.cy, moved: false }; };
    cv.onpointermove = (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; V.z = Math.max(3, Math.min(60, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); draw(); return; }
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true; V.cx = drag.cx - dx / V.z; V.cy = drag.cy - dy / V.z; draw();
    };
    cv.onpointercancel = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; drag = null; };
    cv.onpointerup = (e) => {
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (drag && !drag.moved) {
        const r = cv.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
        let best = null, bd = 14; for (const s of U.systems) { const d = Math.hypot(tx(s.x) - mx, ty(s.y) - my); if (d < bd) { bd = d; best = s; } }
        if (best) { this.mapSel = best.id; draw(); info(); }
      }
      drag = null;
    };
    cv.onwheel = (e) => { e.preventDefault(); V.z = Math.max(3, Math.min(60, V.z * (e.deltaY > 0 ? 0.85 : 1.18))); draw(); };
  }

  // ---------------- Station ----------------
  openStation(station, spaceMode, tab = 'market') {
    this.station = station; this.stationMode = spaceMode; this.stab = tab;
    const g = this.game, U = g.U, f = U.factions[station.faction];
    const tabs = [['market', 'Gear Market'], ['commodities', 'Commodities'], ['services', 'Services'], ['missions', 'Mission Board'], ['bar', 'Bar'], ['workshop', 'Workshop'], ...(station.shipyard ? [['shipyard', 'Shipyard']] : []), ['inventory', 'Inventory']];
    const body = tab === 'inventory' ? this.tab_inventory() : this['st_' + tab]();
    this.open('station', `<div class="panel big"><div class="st-head"><span class="sw" style="background:${hex(f.color)}"></span><div><div class="st-name">${esc(station.name)}</div><div class="muted">${esc(f.name)} · ${esc(g.U.systems[g.player.systemId].name)} · ${fmt(g.player.credits)} cr</div></div></div><div class="tabs">${tabs.map(([k, n]) => `<button data-a="stab" data-v="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}<button class="undock" data-a="undock">Undock ▸</button></div><div class="pbody">${body}</div></div>`);
  }
  stock(key, level, seed, n = 12) {
    const g = this.game; g.stockCache = g.stockCache || {};
    if (!g.stockCache[key]) { const r = new RNG(seed); const out = []; for (let i = 0; i < n; i++) out.push(genItem(r, { level: Math.max(1, level + r.int(-1, 2)), luck: 0.1 + level * 0.01 })); g.stockCache[key] = out; }
    return g.stockCache[key];
  }
  st_market() {
    const g = this.game, st = this.station, sys = g.U.systems[g.player.systemId];
    const day = Math.floor(g.player.time / 600);
    this.shopStock = this.stock(`${sys.id}:${st.id}:${day}`, sys.level, hashInts(st.seed, day));
    return this.shopHTML(this.shopStock, 'buy');
  }
  shopHTML(stock, act) {
    const P = this.game.player;
    const selIt = this.sel ? this.findItem(this.sel) : null;
    return `<div class="cols3"><div><h3>For sale</h3><div class="invlist">${stock.map(it => `<div class="irow ${this.sel === it.id ? 'sel' : ''}" data-a="sel" data-v="${it.id}" data-tip="${it.id}"><span class="dot" style="background:${TIERS[it.tier].color}"></span><span style="color:${TIERS[it.tier].color}">${esc(it.name)}</span><span class="pw">${fmt(this.buyPrice(it))} cr</span></div>`).join('') || '<div class="empty pad">Sold out</div>'}</div></div>
      <div><h3>Your inventory <small>${P.inventory.length}/40</small></h3><div class="invlist">${P.inventory.map(it => `<div class="irow ${this.sel === it.id ? 'sel' : ''}" data-a="sel" data-v="${it.id}" data-tip="${it.id}"><span class="dot" style="background:${TIERS[it.tier].color}"></span><span style="color:${TIERS[it.tier].color}">${esc(it.name)}</span><span class="pw">${fmt(this.sellPrice(it))} cr</span></div>`).join('') || '<div class="empty pad">Nothing to sell</div>'}</div>${P.inventory.length ? '<button data-a="sellscrap">Sell all Scrap & Common</button>' : ''}</div>
      <div class="detail">${selIt ? itemHTML(selIt, this.equippedFor(selIt)) + (stock.includes(selIt) ? `<div class="acts"><button data-a="${act}" data-v="${selIt.id}" ${P.credits >= this.buyPrice(selIt) ? '' : 'disabled'}>Buy · ${fmt(this.buyPrice(selIt))} cr</button></div>` : this.itemActions(selIt)) : '<div class="empty pad">Select an item.</div>'}</div></div>`;
  }
  st_commodities() {
    const g = this.game, P = g.player, det = getSystem(g.U, P.systemId), ss = shipStats(P);
    const tr = (P.skills.commerce || 0) * 0.02;
    return `<h3>Commodity exchange <small>Hold ${cargoUsed(P)}/${ss.cargo}</small></h3><table class="tbl"><tr><th>Good</th><th>Buy</th><th>Sell</th><th>Held</th><th></th></tr>${COMMODITIES.map(c => {
      const price = det.market[c.id]; const buy = Math.round(price * (1.05 - tr)), sell = Math.round(price * (0.92 + tr));
      const trend = price / c.base;
      return `<tr><td>${c.name} <small class="${trend < 0.85 ? 'up' : trend > 1.2 ? 'down' : 'muted'}">${trend < 0.85 ? 'cheap here' : trend > 1.2 ? 'in demand' : ''}</small></td><td>${buy}</td><td>${sell}</td><td>${P.cargo[c.id] || 0}</td><td><button data-a="cbuy" data-v="${c.id}" ${P.credits >= buy ? '' : 'disabled'}>Buy</button><button data-a="cbuy5" data-v="${c.id}">×5</button><button data-a="csell" data-v="${c.id}" ${(P.cargo[c.id] || 0) > 0 ? '' : 'disabled'}>Sell</button><button data-a="csellall" data-v="${c.id}" ${(P.cargo[c.id] || 0) > 0 ? '' : 'disabled'}>All</button></td></tr>`;
    }).join('')}</table><div class="muted pad">Prices differ between systems. Buy where goods are cheap, sell where they're in demand. Mine ore and crystals on planets for free cargo.</div>`;
  }
  st_services() {
    const g = this.game, P = g.player, ss = shipStats(P), sys = g.U.systems[P.systemId];
    const rep = this.repairCost(), mis = this.missileCost();
    const trained = P.bought || 0; const tc = this.trainCost();
    return `<div class="cols2"><div><h3>Hangar</h3><div class="svc"><b>Repair hull</b><span>${Math.round(P.ship.hull * 100)}% hull</span><button data-a="repair" ${rep > 0 && P.credits >= rep ? '' : 'disabled'}>${rep > 0 ? fmt(rep) + ' cr' : 'Fully repaired'}</button></div>
      <div class="svc"><b>Restock missiles</b><span>${P.ship.missiles ?? 0}/${ss.missileCap}</span><button data-a="missiles" ${mis > 0 && P.credits >= mis ? '' : 'disabled'}>${mis > 0 ? fmt(mis) + ' cr' : 'Full'}</button></div>
      <div class="svc"><b>Medical bay</b><span>${Math.round(P.hp * 100)}% health</span><button data-a="heal" ${P.hp < 1 ? '' : 'disabled'}>Free</button></div>
      <div class="svc"><b>Buy medkit</b><span>Restores health on foot</span><button data-a="buymed" ${P.credits >= 60 + sys.level * 10 ? '' : 'disabled'}>${60 + sys.level * 10} cr</button></div>
      <div class="svc"><b>Rename ship</b><span>${esc(P.ship.name)}</span><button data-a="rename">Rename</button></div></div>
      <div><h3>Training simulator</h3><div class="muted pad">Buy an extra skill point with a sim session. Each session costs more.</div><div class="svc"><b>Sim session #${trained + 1}</b><span>+1 skill point</span><button data-a="train" ${P.credits >= tc ? '' : 'disabled'}>${fmt(tc)} cr</button></div>
      <h3>Save</h3><div class="svc"><b>Log flight record</b><span>Saves your game</span><button data-a="save">Save</button></div></div></div>`;
  }
  repairCost() { const P = this.game.player, ss = shipStats(P); return Math.round((1 - P.ship.hull) * ss.hullMax * 1.2); }
  missileCost() { const P = this.game.player, ss = shipStats(P); return Math.max(0, ss.missileCap - (P.ship.missiles ?? 0)) * (25 + P.level * 6); }
  trainCost() { return Math.round(1500 * Math.pow((this.game.player.bought || 0) + 1, 1.5)); }
  st_missions() {
    const g = this.game, P = g.player, st = this.station;
    const day = Math.floor(P.time / 600);
    g.boardCache = g.boardCache || {};
    const key = `${P.systemId}:${st.id}:${day}`;
    if (!g.boardCache[key]) g.boardCache[key] = genMissions(g.U, P.systemId, st, day);
    this.board = g.boardCache[key].filter(m => !P.missions.some(x => x.id === m.id));
    return `<div class="cols2"><div><h3>Available contracts</h3>${this.board.map(m => this.missionCard(m, false)).join('') || '<div class="empty pad">No more contracts today.</div>'}</div><div><h3>Your contracts <small>${P.missions.filter(m => !m.done).length}/5</small></h3>${P.missions.filter(m => !m.done).map(m => this.missionCard(m, true)).join('') || '<div class="empty pad">None yet.</div>'}</div></div>`;
  }
  st_bar() {
    const g = this.game, P = g.player, st = this.station, U = g.U;
    const day = Math.floor(P.time / 600);
    g.barCache = g.barCache || {};
    const key = `${P.systemId}:${st.id}:${day}`;
    if (!g.barCache[key]) { const r = new RNG(hashInts(st.seed, day, 5)); const n = r.int(3, 5); g.barCache[key] = Array.from({ length: n }, () => genNPC(U, r, { faction: r.chance(0.6) ? st.faction : null, level: U.systems[P.systemId].level })); }
    const npcs = g.barCache[key].filter(n => !P.crew.some(c => c.id === n.id));
    this.barNpcs = npcs;
    return `<h3>The bar is quiet tonight</h3><div class="bar">${npcs.map(n => { const role = NPC_ROLES.find(r => r.id === n.role); return `<div class="crew"><b>${esc(n.name)}</b> <small>${esc(n.speciesName)} ${role.name} · Lv ${n.level} · ${n.traits.join(', ')}</small><div class="muted">${n.faction !== null ? esc(U.factions[n.faction].name) : 'Independent'} · Crew bonus: ${role.crew.label}</div><button data-a="bartalk" data-v="${n.id}">Talk</button><button data-a="hire" data-v="${n.id}" ${P.credits >= n.hireCost && P.crew.length < crewCap(P) ? '' : 'disabled'}>Hire · ${fmt(n.hireCost)} cr</button></div>`; }).join('')}</div><div class="muted pad">Crew ${P.crew.length}/${crewCap(P)}. Bigger hulls and the Leadership skill hold more crew.</div>`;
  }
  st_workshop() {
    const P = this.game.player; P.parts = P.parts || 0;
    const eq = [...SHIP_SLOTS.map(s => P.equip[s]), ...PERSONAL_SLOTS.map(s => P.pequip[s])].filter(Boolean);
    const inv = P.inventory.filter(canCraft).sort((a, b) => b.tier - a.tier || b.level - a.level);
    const row = (it, tag) => `<div class="irow ${this.sel === it.id ? 'sel' : ''}" data-a="sel" data-v="${it.id}" data-tip="${it.id}"><span class="dot" style="background:${TIERS[it.tier].color}"></span><span style="color:${TIERS[it.tier].color}">${esc(it.name)}</span><span class="pw">${tag}</span></div>`;
    const it = this.sel ? this.findItem(this.sel) : null;
    let acts = '';
    if (it && canCraft(it)) {
      const equipped = eq.includes(it), up = upgradeCost(it), rf = reforgeCost(it), maxed = it.tier >= TIERS.length - 1;
      acts = `<div class="ws">
        <div class="svc"><b>Upgrade to ${maxed ? '—' : `<span style="color:${TIERS[it.tier + 1].color}">${TIERS[it.tier + 1].name}</span>`}</b><span>Stronger stats, +1 bonus${it.weapon && it.tier >= 4 ? ', special effect' : ''}</span><button data-a="wup" ${!maxed && P.parts >= up.parts && P.credits >= up.credits ? '' : 'disabled'}>${maxed ? 'Max tier' : `${up.parts} parts · ${fmt(up.credits)} cr`}</button></div>
        <div class="svc"><b>Reforge</b><span>Re-roll its bonus stats</span><button data-a="wref" ${P.parts >= rf.parts && P.credits >= rf.credits ? '' : 'disabled'}>${rf.parts} parts · ${fmt(rf.credits)} cr</button></div>
        <div class="svc"><b>Salvage</b><span>${equipped ? 'Unequip it first' : 'Break it down for parts'}</span><button class="danger" data-a="wsalv" ${equipped ? 'disabled' : ''}>+${salvageParts(it)} parts</button></div></div>`;
    }
    return `<div class="cols3"><div><h3>Equipped</h3><div class="invlist">${eq.map(x => row(x, 'equipped')).join('')}</div></div>
      <div><h3>Inventory</h3><div class="invlist">${inv.map(x => row(x, '+' + salvageParts(x) + ' parts')).join('') || '<div class="empty pad">No gear to work on.</div>'}</div>${inv.some(x => x.tier <= 1) ? '<button data-a="wsalvall">Salvage all Scrap & Common</button>' : ''}</div>
      <div class="detail"><div class="parts">Parts: <b>${fmt(P.parts)}</b></div>${it ? itemHTML(it) + acts : '<div class="empty pad">Select a piece of gear. Salvage spare loot into parts, then spend parts to upgrade the gear you love or reforge its bonuses.</div>'}</div></div>`;
  }
  st_shipyard() {
    const g = this.game, P = g.player, st = this.station;
    const cur = HULL_CLASSES.find(h => h.id === P.ship.cls); const trade = Math.round(cur.price * 0.45);
    const r = new RNG(st.seed); const avail = HULL_CLASSES.filter(h => h.capital ? r.chance(0.12) : r.chance(0.7));
    if (!avail.length) avail.push(HULL_CLASSES[1]);
    return `<h3>Shipyard <small>Trade-in value of your ${cur.name}: ${fmt(trade)} cr</small></h3><table class="tbl"><tr><th>Hull</th><th>Hull</th><th>Shield</th><th>Speed</th><th>Turn</th><th>Guns</th><th>Crew</th><th>Cargo</th><th>Price</th><th></th></tr>${avail.map(h => { const cost = Math.max(0, h.price - trade); return `<tr class="${h.id === cur.id ? 'cur' : ''}"><td><b>${h.name}</b></td><td>${h.hull}</td><td>${h.shield}</td><td>${h.speed}</td><td>${h.turn}</td><td>${h.slots}</td><td>${h.crew}</td><td>${h.cargo}</td><td>${fmt(cost)}</td><td>${h.id === cur.id ? 'Current' : `<button data-a="buyship" data-v="${h.id}" ${P.credits >= cost ? '' : 'disabled'}>Buy</button>`}</td></tr>`; }).join('')}</table><div class="muted pad">Your gear moves to the new hull. Guns beyond the new hull's slots go to your inventory. You can also capture ships by disabling and boarding them.</div>`;
  }

  // ---------------- Dialogs ----------------
  dialog(title, sub, text, buttons, portrait) {
    this.open('dialog', `<div class="panel dlg"><div class="dh">${portrait || ''}<div><div class="dn">${esc(title)}</div><div class="muted">${sub}</div></div></div><div class="dt">${text}</div><div class="acts">${buttons.map((b, i) => `<button data-a="dlg" data-v="${i}" ${b.disabled ? 'disabled' : ''}>${esc(b.label)}</button>`).join('')}</div></div>`);
    this.dlgButtons = buttons;
  }
  portrait(npc, U = this.game.U) {
    const sp = U.species[npc.species]; const h = Math.round(sp.skin[0] * 360), s = Math.round(sp.skin[1] * 100), l = Math.round(sp.skin[2] * 100);
    return `<div class="portrait" style="background:radial-gradient(circle at 50% 40%, hsl(${h} ${s}% ${l}%) 0 28%, transparent 29%), radial-gradient(circle at 50% 110%, hsl(${(h + 180) % 360} 30% 30%) 0 45%, transparent 46%), #0b1220"><span>${sp.eyes > 0 ? '•'.repeat(Math.min(4, sp.eyes)) : ''}</span></div>`;
  }
  talk(npc, footMode, actor) {
    const g = this.game, U = g.U, P = g.player, r = new RNG(Date.now());
    const line = npcLine(U, npc, r, U.systems[P.systemId].name);
    const role = NPC_ROLES.find(x => x.id === npc.role);
    const fac = npc.faction !== null ? U.factions[npc.faction].name : 'Independent';
    const btns = [{ label: 'Any news?', fn: () => { this.dlgText(`“${line.rumor}”`); } }];
    if (npc.role === 'merchant') btns.push({ label: 'Show me your wares', fn: () => this.openShop(`${npc.name}'s wares`, this.stock(`npc:${npc.id}`, npc.level, npc.seed, 8)) });
    if (npc.role === 'medic') btns.push({ label: 'Patch me up (50 cr)', disabled: P.credits < 50, fn: () => { g.addCredits(-50); footMode.me.hp = footMode.ps.hpMax; this.dlgText('“Hold still... there. Good as new.”'); } });
    if (npc.role === 'engineer' || npc.role === 'scientist') btns.push({ label: 'Teach me something (1 skill point · 2,000 cr)', disabled: P.credits < 2000 || actor._taught, fn: () => { g.addCredits(-2000); P.skillPoints++; actor._taught = true; this.dlgText('“Watch closely. You\'ll pick it up.” (+1 skill point)'); } });
    if (!actor.captain) btns.push({ label: `Join my crew (${fmt(npc.hireCost)} cr)`, disabled: P.credits < npc.hireCost || P.crew.length >= crewCap(P), fn: () => { g.addCredits(-npc.hireCost); P.crew.push(npc); actor.alive = false; footMode.scene.remove(actor.mesh); this.close(); this.toast(`${npc.name} joined your crew`, '#7ee08a'); } });
    btns.push({ label: 'Goodbye', fn: () => this.close() });
    this.dialog(npc.name, `${esc(npc.speciesName)} ${role.name} · Lv ${npc.level} · ${esc(fac)}`, `“${esc(line.greet)}”`, btns, this.portrait(npc));
  }
  dlgText(t) { const el = $('.dt', this.overlay); if (el) el.innerHTML = t; }
  hail(spaceMode, ship) {
    const g = this.game, U = g.U, P = g.player, npc = ship.def.captain, r = new RNG(Date.now());
    const line = npcLine(U, npc, r, U.systems[P.systemId].name);
    const fac = ship.faction !== null ? U.factions[ship.faction] : null;
    const inti = P.skills.intimidate || 0;
    const btns = [
      { label: 'Any news?', fn: () => this.dlgText(`“${esc(line.rumor)}”`) },
      { label: 'What are you carrying?', fn: () => this.openShop(`${ship.name} — cargo`, this.stock(`ship:${ship.def.seed}`, ship.level, ship.def.seed, 6)) },
      { label: 'Request to come aboard', fn: () => { this.close(); g.board(spaceMode, ship, true); } },
      { label: `Demand their cargo (${Math.round(this.demandChance(ship) * 100)}%)`, fn: () => {
        const ok = Math.random() < this.demandChance(ship);
        changeRep(U, P, ship.faction, -7);
        if (ok) { const loot = Math.round((150 + ship.level * 90) * (ship.hc.size)); g.addCredits(loot, 'tribute'); g.addCargo(r.pick(['lux', 'tech', 'med', 'arms']), r.int(1, 4)); this.dlgText('“F-fine! Take it and go!”'); ship.role = 'fleeing'; ship.state = 'flee'; ship.target = spaceMode.player; }
        else { this.dlgText('“You picked the wrong ship.” — They power weapons!'); ship.aggro.add(spaceMode.player); ship.target = spaceMode.player; ship.state = 'attack'; }
        this.dlgButtons = [{ label: 'Close', fn: () => this.close() }]; $('.acts', this.overlay).innerHTML = '<button data-a="dlg" data-v="0">Close</button>';
      } },
      { label: 'End transmission', fn: () => this.close() },
    ];
    this.dialog(`${ship.name}`, `${ship.hc.name} · Captain ${esc(npc.name)} · ${fac ? esc(fac.name) : 'Independent'}`, `“${esc(line.greet)}”`, btns, this.portrait(npc));
  }
  demandChance(ship) { const P = this.game.player; return Math.max(0.05, Math.min(0.9, 0.25 + (P.skills.intimidate || 0) * 0.15 + (P.level - ship.level) * 0.05 - (ship.hc.size - 1) * 0.2)); }
  openShop(title, stock) {
    this.shopStock = stock; this.shopOpen = true; this.shopTitle = title;
    this.open('shop', `<div class="panel big"><div class="tabs"><b class="ttl">${esc(title)} · ${fmt(this.game.player.credits)} cr</b><button class="x" data-a="closeshop">✕</button></div><div class="pbody">${this.shopHTML(stock, 'buy')}</div></div>`);
  }
  interiorExit(opts) {
    this.dialog('Airlock', 'Leaving the ship', opts.text, opts.buttons);
  }
  showDeath(text, cb) {
    this.open('death', `<div class="panel dlg death"><div class="dn big">${esc(text)}</div><div class="dt">Your clone wakes in the medbay of the last station you docked at. You lost some credits and your cargo.</div><div class="acts"><button data-a="respawn">Respawn</button></div></div>`);
    this.respawnCb = cb;
  }
  pause() {
    const has = this.game.hasSave();
    this.open('pause', `<div class="panel dlg"><div class="dn big">Paused</div><div class="acts col"><button data-a="close">Resume</button><button data-a="save">Save game</button><button data-a="openguide" data-v="start">Field guide</button><button data-a="controls">Controls</button><button data-a="gfx">Graphics & sound</button><button data-a="openguide" data-v="about">About</button><button data-a="quit">Save & quit to title</button></div></div>`);
  }
  graphics() {
    const g = this.game, s = g.settings;
    const opt = (v, label) => `<button data-a="setq" data-v="${v}" class="${String(s.quality) === String(v) ? 'on' : ''}">${label}</button>`;
    const vol = (key, def, off) => [['0', 'Off'], ['0.3', 'Low'], ['0.6', 'Medium'], ['1', 'High']].map(([v, l]) => { const cur = off ? 0 : (s[key] ?? def); return `<button data-a="setvol" data-v="${key}:${v}" class="${Math.abs(cur - +v) < 0.01 ? 'on' : ''}">${l}</button>`; }).join('');
    this.open('pause', `<div class="panel dlg"><div class="dn big">Graphics & sound</div><div class="muted">Now running: <b>${PRESETS[g.tier].name}</b> at ${Math.round(g.renderer.getPixelRatio() * 100) / 100}x resolution${s.quality === 'auto' ? ' (picked for this device)' : ''}.</div>
      <h3>Quality</h3><div class="seg">${opt('auto', 'Auto')}${opt(0, 'Low')}${opt(1, 'Medium')}${opt(2, 'High')}</div>
      <div class="muted small">Textures, terrain detail and crowd sizes update the next time you enter a system or land.</div>
      <h3>Options</h3><div class="acts col"><button data-a="toggleAuto">Auto-adjust resolution to hold frame rate: ${s.autoQuality ? 'On' : 'Off'}</button><button data-a="toggleBloom">Glow (bloom): ${s.bloom ? 'On' : 'Off'}</button><button data-a="toggleFps">Show FPS: ${s.showFps ? 'On' : 'Off'}</button></div>
      <h3>Sound</h3><div class="muted small">Music${g.music.nowPlaying() ? `: now playing <b>${g.music.nowPlaying()}</b>` : ''}</div><div class="seg">${vol('musicVol', 0.6, s.music === false)}</div>
      <div class="muted small">Sound effects</div><div class="seg">${vol('sfxVol', 1, false)}</div>
      <div class="acts"><button data-a="${g.player ? 'pauseback' : 'titleback'}">Back</button></div></div>`);
  }
  controls() {
    this.open('pause', `<div class="panel dlg wide"><div class="dn big">Controls</div><div class="cols2"><div><h3>Flying</h3><div class="keys">Mouse — aim; the ship turns to follow (click to capture the mouse)<br>W / S or wheel — throttle · X — all stop<br>A / D — yaw · Q / E — roll<br>Shift — boost · C — cruise drive<br>LMB / Space — guns · RMB / F — missile<br>T — cycle targets · R — target ahead<br>E — dock / board / hail · L — land<br>V — camera (chase, cockpit, wide) · M — galaxy map</div>
      <div class="acts col"><button data-a="toggleFlight">Mouse flight: ${this.game.settings.flight === 'classic' ? 'Classic (cursor sets turn rate)' : 'Mouse aim (ship follows the cursor)'}</button></div></div><div><h3>On foot</h3><div class="keys">WASD — move · Mouse — look<br>LMB — fire · R — reload · 1 / 2 — swap weapon<br>Space — jump · Shift — sprint<br>E — talk / loot / mine / exit · H — medkit<br>V — first / third person</div><h3>Menus</h3><div class="keys">I / Tab — inventory · K — skills · J — missions<br>M — galaxy map · Esc / P — pause</div><h3>Gamepad</h3><div class="keys">Sticks fly / move & look · RT fire · LT missile · RB boost · A interact/jump · B target ahead/interact · Y target/swap · X reload · L3 cruise / sprint · R3 camera · Start pause<br>Menus: D-pad moves · A selects · B back · LB / RB tabs</div></div></div><div class="acts"><button data-a="${this.game.player ? 'pauseback' : 'titleback'}">Back</button></div></div>`);
  }
  title() {
    const has = this.game.hasSave();
    this.open('title', `<div class="title"><div class="logo">STARWARD</div><div class="tag">An open sandbox among procedural stars</div><div class="acts col">${has ? '<button data-a="continue" class="primary">Continue</button>' : ''}<button data-a="newgame" class="${has ? '' : 'primary'}">New game</button><button data-a="openguide" data-v="start">Field guide</button><button data-a="controls">Controls</button><button data-a="gfx">Graphics & sound</button><button data-a="openguide" data-v="about">About</button></div><div class="muted small foot">Every galaxy, faction, species, planet, NPC, ship and weapon is generated from a seed.</div><div class="credit">v${VERSION} · Made by <a href="${LINKS.site}" target="_blank" rel="noopener">Jeremy Anderson Tech</a> · <a href="${LINKS.repo}" target="_blank" rel="noopener">Source on GitHub</a></div></div>`);
  }
  newGameScreen() {
    const seed = this.pendingSeed || Math.floor(Math.random() * 1e6).toString(36).toUpperCase();
    this.pendingSeed = seed;
    const U = this.game.previewUniverse(seed);
    this.open('title', `<div class="panel dlg wide"><div class="dn big">New captain</div><div class="form"><label>Name<input id="ng-name" maxlength="24" value="${esc(this.pendingName || 'Captain Vey')}"></label><label>Universe seed<span class="row"><input id="ng-seed" value="${esc(seed)}"><button data-a="reseed">🎲</button></span></label></div><h3>Species</h3><div class="species">${U.species.map(s => `<button data-a="species" data-v="${s.id}" class="${(this.pendingSpecies || 0) === s.id ? 'on' : ''}">${this.portrait({ species: s.id }, U)}<b>${esc(s.name)}</b><small>${s.head} head · ${s.eyes} eye${s.eyes > 1 ? 's' : ''}${s.horns ? ' · horned' : ''}${s.tail ? ' · tail' : ''}</small></button>`).join('')}</div><h3>Known powers</h3><div class="minifacs">${U.factions.map(f => `<span><i style="background:${hex(f.color)}"></i>${esc(f.name)} <small>${f.ideoName}</small></span>`).join('')}</div><div class="acts"><button data-a="titleback">Back</button><button class="primary" data-a="start">Launch</button></div></div>`);
    $('#ng-seed').addEventListener('change', (e) => { const v = e.target.value.trim() || 'STARWARD'; if (v === this.pendingSeed) return; this.pendingSeed = v; this.pendingName = $('#ng-name').value; setTimeout(() => { if (this.modal === 'title' && $('#ng-seed')) this.newGameScreen(); }, 0); });
  }
}

// ---------------- Click handlers ----------------
UI.prototype.handlers = {
  close() { this.close(); },
  tab(v) { this.sel = null; this.openMenu(v); },
  stab(v) { this.sel = null; this.openStation(this.station, this.stationMode, v); },
  sel(v) { this.sel = v || null; this.refreshShopAware(); },
  equip(slot) { const it = this.findItem(this.sel); if (it) this.game.equip(it, slot); this.refreshShopAware(); },
  unequip(slot) { this.game.unequip(slot); this.refreshShopAware(); },
  drop() { const P = this.game.player; P.inventory = P.inventory.filter(i => i.id !== this.sel); this.sel = null; this.refreshShopAware(); },
  sell() { const g = this.game, P = g.player; const it = P.inventory.find(i => i.id === this.sel); if (!it) return; P.inventory = P.inventory.filter(i => i !== it); g.addCredits(this.sellPrice(it)); this.sel = null; this.refreshShopAware(); },
  sellscrap() { const g = this.game, P = g.player; let n = 0; P.inventory = P.inventory.filter(i => { if (i.tier <= 1 && (i.kind !== 'medkit')) { n += this.sellPrice(i); return false; } return true; }); if (n) g.addCredits(n); this.refreshShopAware(); },
  buy(id) { const g = this.game, P = g.player; const it = this.shopStock.find(i => i.id === id); if (!it) return; const c = this.buyPrice(it); if (P.credits < c) return; if (P.inventory.length >= 40) return this.toast('Inventory full', '#ff7a5a'); g.addCredits(-c); P.inventory.push(it); this.shopStock.splice(this.shopStock.indexOf(it), 1); this.sel = it.id; this.refreshShopAware(); },
  closeshop() { this.shopOpen = false; this.close(); },
  usechip() { const g = this.game, P = g.player; const it = P.inventory.find(i => i.id === this.sel); if (!it) return; const sk = SKILLS.find(s => s.id === it.skill); if ((P.skills[sk.id] || 0) >= sk.max) return this.toast(`${sk.name} already mastered — sell the chip`, '#ff7a5a'); P.skills[sk.id] = (P.skills[sk.id] || 0) + 1; P.inventory = P.inventory.filter(i => i !== it); this.toast(`Learned ${sk.name} rank ${P.skills[sk.id]}`, '#b766ff'); g.statsChanged(); this.sel = null; this.refreshShopAware(); },
  usemed() { const g = this.game, P = g.player; const it = P.inventory.find(i => i.id === this.sel); if (!it) return; P.hp = 1; P.inventory = P.inventory.filter(i => i !== it); if (g.mode && g.mode.me) g.mode.me.hp = g.mode.ps.hpMax; this.toast('Health restored', '#7ee08a'); this.sel = null; this.refreshShopAware(); },
  learn(id) { const g = this.game, P = g.player; const sk = SKILLS.find(s => s.id === id); if (P.skillPoints > 0 && canLearn(P, sk)) { P.skillPoints--; P.skills[id] = (P.skills[id] || 0) + 1; g.audio.loot(4); g.statsChanged(); } this.openMenu('skills'); },
  wing(i) { const P = this.game.player, c = P.crew[+i]; if (!c) return; if (!c.wing && P.crew.filter(x => x.wing).length >= 2) return; c.wing = !c.wing; this.toast(c.wing ? `${c.name} will fly as your wingman (from your next launch or jump)` : `${c.name} recalled`, '#9fd8ff'); this.game.wingmenChanged(); this.openMenu('character'); },
  dismiss(i) { this.game.player.crew.splice(+i, 1); this.game.statsChanged(); this.game.wingmenChanged(); this.openMenu('character'); },
  abandon(id) { const P = this.game.player; P.missions = P.missions.filter(m => m.id !== id); this.refresh(); },
  accept(id) { const P = this.game.player; if (P.missions.filter(m => !m.done).length >= 5) return this.toast('Contract limit reached (5)', '#ff7a5a'); const m = this.board.find(x => x.id === id); if (m) { P.missions.push(m); this.toast(`Accepted: ${m.title}`, '#ffd34d'); } this.refresh(); },
  guide(v) { this.guideSec = v; if (this.modal === 'menu') this.openMenu('guide'); else this.openGuide(v); const b = $('.gbody', this.overlay); if (b) b.scrollTop = 0; },
  openguide(v) { this.openGuide(v); },
  guideback() { if (!this.game.player) this.title(); else this.pause(); },
  mapz(v) { const V = this.mapView; if (!V) return; if (v === 'home') { const h = this.game.U.systems[this.game.player.systemId]; V.cx = h.x; V.cy = h.y; } else V.z = Math.max(3, Math.min(60, V.z * +v)); this.mapRedraw && this.mapRedraw(); },
  mapto(v) { this.mapSel = +v; this.mapView = null; this.openMenu('galaxy'); },
  jump(v) { this.game.jump(+v); },
  undock() { this.close(); },
  cbuy(id) { this.game.tradeCommodity(id, 1); this.refresh(); },
  cbuy5(id) { this.game.tradeCommodity(id, 5); this.refresh(); },
  csell(id) { this.game.tradeCommodity(id, -1); this.refresh(); },
  csellall(id) { this.game.tradeCommodity(id, -(this.game.player.cargo[id] || 0)); this.refresh(); },
  repair() { const g = this.game, c = this.repairCost(); if (g.player.credits >= c) { g.addCredits(-c); g.player.ship.hull = 1; g.statsChanged(true); } this.refresh(); },
  missiles() { const g = this.game, c = this.missileCost(); if (g.player.credits >= c) { g.addCredits(-c); g.player.ship.missiles = shipStats(g.player).missileCap; g.statsChanged(true); } this.refresh(); },
  heal() { this.game.player.hp = 1; this.game.player.pshield = 1; this.refresh(); },
  buymed() { const g = this.game; const c = 60 + g.U.systems[g.player.systemId].level * 10; if (g.player.credits >= c && g.player.inventory.length < 40) { g.addCredits(-c); g.giveItem({ id: 'i' + Math.random().toString(36).slice(2), kind: 'medkit', tier: 1, level: g.player.level, name: 'Medkit', heal: 40 + g.player.level * 8, value: 40, stats: {}, affixes: [], specials: [] }, true); } this.refresh(); },
  rename() { const el = $('.svc:nth-child(6) span', this.overlay) || $('.svc span', this.overlay); const P = this.game.player; const n = ['Wayfarer', 'Lucky Star', 'Night Heron', 'Ember Wake', 'Second Chance', 'Quiet Storm', 'Long Odds', 'Vagrant Sun'][Math.floor(Math.random() * 8)]; P.ship.name = n; this.toast(`Ship renamed: ${n}`, '#9fd8ff'); this.refresh(); },
  train() { const g = this.game, c = this.trainCost(); if (g.player.credits >= c) { g.addCredits(-c); g.player.bought = (g.player.bought || 0) + 1; g.player.skillPoints++; this.toast('+1 skill point', '#b766ff'); } this.refresh(); },
  save() { this.game.save(true); },
  bartalk(id) { const n = this.barNpcs.find(x => x.id === id); const r = new RNG(Date.now()); const l = npcLine(this.game.U, n, r, this.game.U.systems[this.game.player.systemId].name); this.toast(`${n.name}: “${l.greet} ${l.rumor}”`, '#cfe6ff'); },
  hire(id) { const g = this.game, P = g.player; const n = this.barNpcs.find(x => x.id === id); if (!n || P.credits < n.hireCost || P.crew.length >= crewCap(P)) return; g.addCredits(-n.hireCost); P.crew.push(n); g.statsChanged(); this.toast(`${n.name} joined your crew`, '#7ee08a'); this.refresh(); },
  wup() { const g = this.game, P = g.player, it = this.findItem(this.sel); if (!it) return; const c = upgradeCost(it); if (P.parts < c.parts || P.credits < c.credits) return; if (upgradeItem(it, new RNG(Date.now()))) { P.parts -= c.parts; g.addCredits(-c.credits); g.statsChanged(); g.audio.loot(it.tier); this.toast(`Upgraded: ${it.name}`, TIERS[it.tier].color); } this.refresh(); },
  wref() { const g = this.game, P = g.player, it = this.findItem(this.sel); if (!it) return; const c = reforgeCost(it); if (P.parts < c.parts || P.credits < c.credits) return; if (reforgeItem(it, new RNG(Date.now()))) { P.parts -= c.parts; g.addCredits(-c.credits); g.statsChanged(); this.toast(`Reforged: ${it.name}`, TIERS[it.tier].color); } this.refresh(); },
  wsalv() { const P = this.game.player, it = P.inventory.find(i => i.id === this.sel); if (!it) return; P.parts = (P.parts || 0) + salvageParts(it); P.inventory = P.inventory.filter(i => i !== it); this.sel = null; this.refresh(); },
  wsalvall() { const P = this.game.player; let n = 0; P.inventory = P.inventory.filter(i => { if (canCraft(i) && i.tier <= 1) { n += salvageParts(i); return false; } return true; }); P.parts = (P.parts || 0) + n; this.toast(`+${n} parts`, '#9fd8ff'); this.refresh(); },
  buyship(id) { this.game.buyShip(id); this.refresh(); },
  dlg(i) { const b = this.dlgButtons[+i]; if (b && !b.disabled) b.fn(); },
  respawn() { const cb = this.respawnCb; this.modal = null; this.overlay.style.display = 'none'; cb && cb(); },
  controls() { this.controls(); },
  pauseback() { this.pause(); },
  titleback() { this.title(); },
  toggleFlight() { const s = this.game.settings; s.flight = s.flight === 'classic' ? 'aim' : 'classic'; this.game.persistSettings(); this.controls(); },
  toggleBloom() { this.game.settings.bloom = !this.game.settings.bloom; this.game.persistSettings(); this.graphics(); },
  toggleFps() { this.game.settings.showFps = !this.game.settings.showFps; this.game.persistSettings(); this.graphics(); },
  toggleAuto() { const g = this.game; g.settings.autoQuality = !g.settings.autoQuality; if (!g.settings.autoQuality) { g.governor.scale = 1; g.applyResolution(); } g.persistSettings(); this.graphics(); },
  gfx() { this.graphics(); },
  setvol(v) { const g = this.game, [key, val] = v.split(':'), n = +val; if (key === 'musicVol') { g.settings.music = n > 0; if (n > 0) g.settings.musicVol = n; } else { g.settings.sfxVol = n; g.audio.vol = 0.35 * n; if (g.audio.master) g.audio.master.gain.value = g.audio.vol; } g.persistSettings(); this.graphics(); },
  setq(v) { const g = this.game; g.settings.quality = v === 'auto' ? 'auto' : +v; delete g.settings.autoTier; g.governor.scale = 1; g.setTier(v === 'auto' ? detectTier(g.renderer) : +v, false); g.applyResolution(); g.persistSettings(); this.graphics(); },
  quit() { this.game.save(false); location.reload(); },
  continue() { this.game.loadGame(); },
  newgame() { this.newGameScreen(); },
  reseed() { this.pendingSeed = Math.floor(Math.random() * 1e6).toString(36).toUpperCase(); this.pendingName = $('#ng-name').value; this.newGameScreen(); },
  species(v) { this.pendingSpecies = +v; this.pendingName = $('#ng-name').value; this.pendingSeed = $('#ng-seed').value; this.newGameScreen(); },
  start() { const name = $('#ng-name').value.trim() || 'Captain'; const seed = $('#ng-seed').value.trim() || this.pendingSeed; this.modal = null; this.overlay.style.display = 'none'; this.game.newGame(seed, name, this.pendingSpecies || 0); },
};
UI.prototype.refreshShopAware = function () { if (this.modal === 'shop') this.openShop(this.shopTitle, this.shopStock); else this.refresh(); };

const HUD_HTML = `
<div id="hud" style="display:none">
  <div id="tl"></div>
  <div id="toasts"></div>
  <div id="tpanel" style="display:none"></div>
  <div id="navlayer"></div><div id="barlayer"></div>
  <div id="bracket" style="display:none"></div><div id="lead" style="display:none"></div>
  <div id="crosshair"></div><div id="vcursor"></div><div id="hitmark"></div>
  <div id="bl"><div id="spd"></div><div class="hb sh" id="b1"><span>Shield</span><div><i></i></div><em></em></div><div class="hb hu" id="b2"><span>Hull</span><div><i></i></div><em></em></div><div class="hb en" id="b3"><span>Energy</span><div><i></i></div><em></em></div></div>
  <canvas id="radar" width="170" height="170"></canvas>
  <div id="prompt" style="display:none"></div><div id="lockhint" style="display:none">Click to capture the mouse</div>
  <div id="hint"></div>
</div>
<div id="vignette"></div><div id="warp"></div><div id="fps" style="display:none"></div>
<div id="overlay" style="display:none"></div>
<div id="tooltip"></div>`;
