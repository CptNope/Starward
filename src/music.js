// Soundtrack: one looping track per situation, crossfaded. Tracks stream from music/<file>.mp3 and are
// only fetched the first time they're needed, so the game still opens instantly. A missing file is
// skipped quietly, which lets tracks be added one at a time.
export const TRACKS = {
  title: { file: 'starward-main-theme', name: 'Starward (Main Theme)' },
  space: { file: 'drift', name: 'Drift' },
  combat: { file: 'engage', name: 'Engage' },
  capital: { file: 'dreadnought', name: 'Dreadnought' },
  station: { file: 'dockside', name: 'Dockside' },
  ground: { file: 'groundfall', name: 'Groundfall' },
  breach: { file: 'breach', name: 'Breach' },
};
const FADE = 2.5;      // seconds for a full crossfade
const COMBAT_HOLD = 7; // keep fight music this long after the last threat

export class Music {
  constructor(game) {
    this.game = game; this.els = {}; this.missing = new Set(); this.want = null; this.unlocked = false;
    this.combatT = 0; this.capitalT = 0;
  }
  get enabled() { return this.game.settings.music !== false; }
  get volume() { const v = this.game.settings.musicVol; return v === undefined ? 0.6 : v; }
  unlock() { this.unlocked = true; }
  el(key) {
    if (this.els[key]) return this.els[key];
    const a = document.createElement('audio');
    a.src = `music/${TRACKS[key].file}.mp3`; a.loop = true; a.preload = 'auto'; a.volume = 0;
    a.addEventListener('error', () => { this.missing.add(key); });
    return (this.els[key] = a);
  }
  // What should be playing right now?
  pick(dt) {
    const g = this.game, m = g.mode;
    if (!m) return 'title';
    if (g.ui.modal === 'station') return 'station';
    if (m.kind === 'space') {
      const p = m.player; let threat = false, capital = false;
      if (p && p.alive !== false) for (const s of m.ships) {
        if (s.isPlayer || !s.alive || s.disabled || s.ally || !m.isHostileToPlayer(s)) continue;
        const d = s.pos.distanceTo(p.pos);
        const engaged = s.state === 'attack' && (s.target === p || (s.target && s.target.ally));
        if (s.turrets && s.turrets.length && (d < 1800 || (engaged && d < 3500))) capital = true;
        if ((engaged && d < 2500) || d < 900) threat = true;
      }
      if (capital) this.capitalT = COMBAT_HOLD; else this.capitalT -= dt;
      if (threat) this.combatT = COMBAT_HOLD; else this.combatT -= dt;
      if (this.capitalT > 0) return 'capital';
      return this.combatT > 0 ? 'combat' : 'space';
    }
    if (m.kind === 'interior') return 'breach';
    // planet surface: exploration music until something hostile comes for you
    const me = m.me; let threat = false;
    if (me && me.alive) for (const a of m.actors) if (a.alive && a.team === 'h' && a.target === me) { threat = true; break; }
    if (threat) this.combatT = COMBAT_HOLD; else this.combatT -= dt;
    return this.combatT > 0 ? 'breach' : 'ground';
  }
  update(dt) {
    let want = this.pick(dt);
    if (this.missing.has(want)) want = (want === 'capital' && !this.missing.has('combat')) ? 'combat' : null; // fall back, else silence
    this.want = want;
    const on = this.enabled && this.unlocked, top = this.volume, step = (top / FADE) * dt;
    if (want && on && !this.els[want]) this.el(want);
    for (const [key, a] of Object.entries(this.els)) {
      const target = on && key === want && !this.missing.has(key) ? top : 0;
      if (a.volume < target) a.volume = Math.min(target, a.volume + step);
      else if (a.volume > target) a.volume = Math.max(target, a.volume - step);
      if (target > 0 && a.paused) a.play().catch(() => {}); // autoplay can refuse until a gesture; we retry next frame
      if (target === 0 && a.volume === 0 && !a.paused) a.pause(); // keeps its position, so a track resumes where it left off
    }
  }
  nowPlaying() { return this.want && this.els[this.want] && !this.els[this.want].paused ? TRACKS[this.want].name : null; }
}
