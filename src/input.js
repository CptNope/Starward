// Keyboard, mouse (with optional pointer lock) and gamepad.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set(); this.edges = new Set();
    this.mb = [false, false, false]; this.mbEdge = [false, false, false];
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.vc = { x: 0, y: 0 }; // virtual flight cursor, -1..1
    this.locked = false;
    this.gp = null; this.gpPrev = []; this.gpEdge = [];
    this.lastDevice = 'kbm';
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (this.onKey) this.onKey();
      if (!this.keys.has(e.code)) this.edges.add(e.code);
      this.keys.add(e.code); this.lastDevice = 'kbm';
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'F1'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mb = [false, false, false]; });
    canvas.addEventListener('mousedown', (e) => { this.mb[e.button] = true; this.mbEdge[e.button] = true; this.lastDevice = 'kbm'; });
    addEventListener('mouseup', (e) => { this.mb[e.button] = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.touchActive && !this.locked) return;
      if (this.locked) {
        this.dx += e.movementX; this.dy += e.movementY;
        if (Math.abs(e.movementX) + Math.abs(e.movementY) > 3) this.lastDevice = 'kbm';
        this.vc.x += e.movementX / 260; this.vc.y += e.movementY / 260;
        const l = Math.hypot(this.vc.x, this.vc.y); if (l > 1) { this.vc.x /= l; this.vc.y /= l; }
      } else {
        const r = canvas.getBoundingClientRect();
        this.vc.x = ((e.clientX - r.left) / r.width - 0.5) * 2.4;
        this.vc.y = ((e.clientY - r.top) / r.height - 0.5) * 2.4;
        this.vc.x = Math.max(-1, Math.min(1, this.vc.x)); this.vc.y = Math.max(-1, Math.min(1, this.vc.y));
        if (this.mb[2]) { this.dx += e.movementX; this.dy += e.movementY; }
      }
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && !this.selfRelease && this.onLockLost) this.onLockLost();
      this.selfRelease = false;
    });
    // an uncaptured cursor that leaves the window shouldn't keep the ship turning
    document.addEventListener('mouseleave', () => { if (!this.locked) { this.vc.x = 0; this.vc.y = 0; } });
    addEventListener('blur', () => { this.vc.x = 0; this.vc.y = 0; });
  }
  requestLock() {
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* sandbox may refuse */ }
  }
  releaseLock() { try { if (document.pointerLockElement) { this.selfRelease = true; document.exitPointerLock(); } } catch (e) {} }
  down(c) { return this.keys.has(c); }
  pressed(c) { return this.edges.has(c); }
  mouse(b) { return this.mb[b]; }
  click(b) { return this.mbEdge[b]; }
  pollGamepad() {
    let g = null;
    try { const pads = navigator.getGamepads ? navigator.getGamepads() : []; g = pads && Array.from(pads).find(Boolean); } catch (e) { g = null; }
    const t = this.touchSource ? this.touchSource.state() : null;
    if (!g && !t) { this.gp = null; this.gpPrev = []; return; }
    const dz = (v) => Math.abs(v) < 0.15 ? 0 : v;
    let gp;
    if (g) {
      gp = { lx: dz(g.axes[0] || 0), ly: dz(g.axes[1] || 0), rx: dz(g.axes[2] || 0), ry: dz(g.axes[3] || 0), lt: g.buttons[6]?.value || 0, rt: g.buttons[7]?.value || 0, b: g.buttons.map(x => x.pressed), touch: false };
      if (gp.b.some(Boolean) || Math.abs(gp.lx) + Math.abs(gp.ly) + Math.abs(gp.rx) + Math.abs(gp.ry) > 0) this.lastDevice = 'pad';
    }
    if (t) {
      if (!gp) gp = t;
      else { for (const k of ['lx', 'ly', 'rx', 'ry', 'lt', 'rt']) gp[k] = Math.max(-1, Math.min(1, gp[k] + t[k])); gp.b = gp.b.map((v, i) => v || t.b[i]); }
    }
    this.gpEdge = gp.b.map((v, i) => v && !this.gpPrev[i]);
    this.gpPrev = gp.b.slice();
    this.gp = gp;
  }
  // Standard mapping: 0 A,1 B,2 X,3 Y,4 LB,5 RB,6 LT,7 RT,8 Back,9 Start,10 LS,11 RS,12-15 dpad
  gpDown(i) { return !!(this.gp && this.gp.b[i]); }
  gpPressed(i) { return !!(this.gp && this.gpEdge[i]); }
  // a real controller (not the touch screen's synthetic one) is what the player is using
  get padActive() { return !!(this.gp && !this.gp.touch && this.lastDevice === 'pad'); }
  endFrame() { this.edges.clear(); this.mbEdge = [false, false, false]; this.dx = 0; this.dy = 0; this.wheel = 0; }
}
