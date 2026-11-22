// On-screen controls for phones and tablets. Produces a synthetic gamepad that the
// game already understands, plus swipe-look deltas for on-foot aiming.
const LAYOUT = {
  space: [['fire', 'FIRE', 'rt', 'big'], ['msl', 'MSL', 'lt'], ['boost', 'BOOST', 5], ['use', 'USE', 0], ['tgt', 'TARGET', 3], ['cruise', 'CRUISE', 10]],
  foot: [['fire', 'FIRE', 'rt', 'big'], ['jump', 'JUMP', 0], ['use', 'USE', 1], ['rel', 'RELOAD', 2], ['swap', 'SWAP', 3], ['heal', 'HEAL', 13], ['sprint', 'SPRINT', 10]],
};

export class Touch {
  constructor(game) {
    this.game = game; this.active = false; this.mode = 'space';
    this.L = { id: null, ox: 0, oy: 0, x: 0, y: 0 }; this.R = { id: null, ox: 0, oy: 0, x: 0, y: 0, lx: 0, ly: 0 };
    this.btn = {}; this.btnTouch = {};
    const el = this.el = document.createElement('div'); el.id = 'touch'; el.style.display = 'none';
    el.innerHTML = `<div class="tz" id="tzL"></div><div class="tz" id="tzR"></div><div class="stick" id="stL"><i></i></div><div class="stick" id="stR"><i></i></div><div id="tbtns"></div>
      <div id="ttop"><button data-t="view">VIEW</button><button data-t="map">MAP</button><button data-t="bag">GEAR</button><button data-t="menu">MENU</button></div>`;
    document.body.appendChild(el);
    const opts = { passive: false };
    addEventListener('touchstart', (e) => { if (!this.active) this.activate(); }, { passive: true });
    el.querySelector('#tzL').addEventListener('touchstart', (e) => this.stickStart(e, this.L, 'stL'), opts);
    el.querySelector('#tzR').addEventListener('touchstart', (e) => this.stickStart(e, this.R, 'stR'), opts);
    el.addEventListener('touchmove', (e) => this.move(e), opts);
    el.addEventListener('touchend', (e) => this.end(e), opts);
    el.addEventListener('touchcancel', (e) => this.end(e), opts);
    el.querySelector('#ttop').addEventListener('touchstart', (e) => {
      const b = e.target.closest('[data-t]'); if (!b) return; e.preventDefault();
      const ui = this.game.ui; if (!this.game.mode) return;
      if (b.dataset.t === 'view') { if (!ui.modal) this.game.mode.cycleView?.(); }
      else if (b.dataset.t === 'menu') ui.modal ? ui.close() : ui.pause();
      else { const tab = b.dataset.t === 'map' ? 'galaxy' : 'inventory'; if (ui.modal === 'menu' && ui.tab === tab) ui.close(); else if (!ui.modal || ui.modal === 'menu') { ui.sel = null; ui.openMenu(tab); } }
    }, opts);
    this.setMode('space');
  }
  activate() {
    this.active = true; this.game.input.touchActive = true; this.game.input.lastDevice = 'touch';
    document.body.classList.add('is-touch');
    this.refreshVisible();
  }
  refreshVisible() { this.el.style.display = this.active && this.game.mode && !this.game.ui.modal ? '' : 'none'; }
  setMode(m) {
    this.mode = m === 'foot' ? 'foot' : 'space';
    const box = this.el.querySelector('#tbtns');
    box.innerHTML = LAYOUT[this.mode].map(([id, label, , big]) => `<button data-b="${id}" class="${big || ''}">${label}</button>`).join('');
    this.btn = {}; this.btnTouch = {};
    box.querySelectorAll('button').forEach((b) => {
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); for (const t of e.changedTouches) this.btnTouch[t.identifier] = b.dataset.b; this.btn[b.dataset.b] = true; b.classList.add('on'); }, { passive: false });
    });
  }
  stickStart(e, S, knob) {
    e.preventDefault();
    const t = e.changedTouches[0]; if (S.id !== null) return;
    S.id = t.identifier; S.ox = S.x = S.lx = t.clientX; S.oy = S.y = S.ly = t.clientY;
    const k = this.el.querySelector('#' + knob); k.style.display = 'block'; k.style.transform = `translate(${S.ox}px,${S.oy}px)`; S.knob = k;
  }
  move(e) {
    e.preventDefault();
    const inp = this.game.input;
    for (const t of e.changedTouches) {
      for (const S of [this.L, this.R]) {
        if (S.id !== t.identifier) continue;
        S.x = t.clientX; S.y = t.clientY;
        if (S === this.R) { inp.dx += (S.x - S.lx) * 1.5; inp.dy += (S.y - S.ly) * 1.5; S.lx = S.x; S.ly = S.y; }
        const dx = Math.max(-60, Math.min(60, S.x - S.ox)), dy = Math.max(-60, Math.min(60, S.y - S.oy));
        S.knob.querySelector('i').style.transform = `translate(${dx}px,${dy}px)`;
      }
    }
  }
  end(e) {
    for (const t of e.changedTouches) {
      for (const S of [this.L, this.R]) if (S.id === t.identifier) { S.id = null; S.x = S.ox; S.y = S.oy; if (S.knob) { S.knob.style.display = 'none'; S.knob.querySelector('i').style.transform = ''; } }
      const b = this.btnTouch[t.identifier];
      if (b) { delete this.btnTouch[t.identifier]; if (!Object.values(this.btnTouch).includes(b)) { this.btn[b] = false; this.el.querySelector(`[data-b="${b}"]`)?.classList.remove('on'); } }
    }
  }
  axis(S, k) { if (S.id === null) return 0; const v = (k === 'x' ? S.x - S.ox : S.y - S.oy) / 60; return Math.max(-1, Math.min(1, Math.abs(v) < 0.12 ? 0 : v)); }
  state() {
    if (!this.active) return null;
    const b = new Array(17).fill(false);
    let lt = 0, rt = 0;
    for (const [id, , map] of LAYOUT[this.mode]) {
      if (!this.btn[id]) continue;
      if (map === 'rt') rt = 1; else if (map === 'lt') lt = 1; else b[map] = true;
    }
    return { lx: this.axis(this.L, 'x'), ly: this.axis(this.L, 'y'), rx: this.axis(this.R, 'x'), ry: this.axis(this.R, 'y'), lt, rt, b, touch: true };
  }
}
