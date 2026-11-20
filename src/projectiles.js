import * as THREE from 'three';
import { DAMAGE_TYPES } from './data.js';
import { glowTexture } from './models.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);

const FX_MAX = 1200;
const FX_VS = `attribute float size; attribute float alpha; attribute vec3 tint; varying vec3 vC; varying float vA; uniform float scale;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * scale / max(0.1, -mv.z), 512.0); gl_Position = projectionMatrix * mv; vC = tint; vA = alpha; }`;
const FX_FS = `uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb * vA * t.a, 1.0); }`;
const _m4 = new THREE.Matrix4(), _s = new THREE.Vector3(), _col = new THREE.Color();

// Shared projectile + effects system for space and on-foot modes.
// Bolts and missiles are two InstancedMeshes; every flash/explosion is one Points draw.
export class Projectiles {
  constructor(scene, { scale = 1, canHit, onHit, collideWorld, max = 700 } = {}) {
    this.scene = scene; this.scale = scale; this.canHit = canHit; this.onHit = onHit; this.collideWorld = collideWorld;
    this.list = []; this.pool = []; this.fx = []; this.lines = [];
    this.colors = {};
    for (const [k, d] of Object.entries(DAMAGE_TYPES)) this.colors[k] = new THREE.Color(d.color).multiplyScalar(2.2);
    const bolt = new THREE.BoxGeometry(0.12 * scale, 0.12 * scale, 1.6 * scale);
    const cone = new THREE.ConeGeometry(0.25 * scale, 1.2 * scale, 5); cone.rotateX(Math.PI / 2);
    const mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }), n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, _col.set(1, 1, 1)); m.count = 0; m.frustumCulled = false; scene.add(m); return m; };
    this.bolts = mk(bolt, max); this.missiles = mk(cone, 96);
    // FX points
    const g = new THREE.BufferGeometry();
    this.fxPos = new Float32Array(FX_MAX * 3); this.fxCol = new Float32Array(FX_MAX * 3); this.fxSize = new Float32Array(FX_MAX); this.fxAlpha = new Float32Array(FX_MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.fxPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tint', new THREE.BufferAttribute(this.fxCol, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.fxSize, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.fxAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.fxMat = new THREE.ShaderMaterial({ uniforms: { map: { value: glowTexture() }, scale: { value: 500 } }, vertexShader: FX_VS, fragmentShader: FX_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.fxPoints = new THREE.Points(g, this.fxMat); this.fxPoints.frustumCulled = false; scene.add(this.fxPoints);
    this.lineMat = new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true });
    this.fxBudget = 1;
  }
  setCamera(cam, renderer) {
    const h = renderer.getDrawingBufferSize(_s).y;
    this.fxMat.uniforms.scale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
  }
  spawn(o) {
    let p = this.pool.pop();
    if (!p) p = { vel: new THREE.Vector3(), pos: new THREE.Vector3(), prev: new THREE.Vector3() };
    Object.assign(p, { dmg: 10, dtype: 'energy', range: 1000, life: 0, homing: 0, target: null, crit: 0.05, critDmg: 1.5, aoe: 0, pierce: 0, chain: 0, leech: 0, gravity: 0, missile: false, hitSet: null, overload: 0 }, o);
    p.pos.copy(o.pos); p.prev.copy(o.pos);
    p.vel.copy(o.dir).multiplyScalar(o.speed); if (o.inherit) p.vel.add(o.inherit);
    p.maxLife = o.range / Math.max(1, o.speed) * 1.15;
    const s = p.missile ? 1.5 : Math.min(3, 0.7 + Math.sqrt(p.dmg) / (this.scale > 3 ? 4 : 6));
    p.sx = s; p.sz = p.missile ? s : (this.scale > 3 ? 4 + s : 1 + s * 0.4);
    p.color = this.colors[p.dtype] || this.colors.energy;
    if (p.pierce) p.hitSet = new Set();
    this.list.push(p);
    if (p.missile) this.flash(p.pos, 0xffaa55, 3 * this.scale, 0.15);
    return p;
  }
  update(dt, targets) {
    let nb = 0, nm = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      if (p.homing && p.target && p.target.alive) {
        _v.copy(p.target.pos).sub(p.pos).normalize();
        const sp = p.vel.length();
        _w.copy(p.vel).normalize().lerp(_v, Math.min(1, p.homing * dt)).normalize();
        p.vel.copy(_w).multiplyScalar(sp);
      }
      if (p.gravity) p.vel.y -= 20 * p.gravity * dt;
      p.prev.copy(p.pos); p.pos.addScaledVector(p.vel, dt);
      if (p.missile && Math.random() < 0.6 * this.fxBudget) this.flash(p.prev, 0xff9955, 1.6 * this.scale, 0.25, 0.5);
      let dead = p.life > p.maxLife;
      if (!dead && this.collideWorld && this.collideWorld(p.pos)) { dead = true; this.impact(p, null, targets); }
      if (!dead) {
        for (const t of targets) {
          if (!t.alive || t === p.owner || (p.hitSet && p.hitSet.has(t))) continue;
          if (this.canHit && !this.canHit(p.owner, t)) continue;
          if (segSphere(p.prev, p.pos, t.pos, t.radius + (p.missile ? 2 * this.scale : 0))) {
            this.impact(p, t, targets);
            if (p.pierce && p.hitSet.size < p.pierce) { p.hitSet.add(t); continue; }
            dead = true; break;
          }
        }
      }
      if (dead) { this.list.splice(i, 1); p.target = null; p.owner = null; this.pool.push(p); continue; }
      // write instance
      const mesh = p.missile ? this.missiles : this.bolts;
      const idx = p.missile ? nm++ : nb++;
      if (idx >= mesh.instanceMatrix.count) continue;
      _v.copy(p.vel).normalize(); _q.setFromUnitVectors(_z, _v);
      _m4.compose(p.pos, _q, _s.set(p.sx, p.sx, p.sz));
      mesh.setMatrixAt(idx, _m4); mesh.setColorAt(idx, p.color);
    }
    for (const [mesh, n] of [[this.bolts, nb], [this.missiles, nm]]) {
      mesh.count = Math.min(n, mesh.instanceMatrix.count);
      if (n) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    }
    // fx particles
    let k = 0;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const u = f.t / f.life;
      if (u >= 1) { this.fx[i] = this.fx[this.fx.length - 1]; this.fx.pop(); continue; }
      if (k >= FX_MAX) continue;
      this.fxPos[k * 3] = f.x; this.fxPos[k * 3 + 1] = f.y; this.fxPos[k * 3 + 2] = f.z;
      this.fxCol[k * 3] = f.r; this.fxCol[k * 3 + 1] = f.g; this.fxCol[k * 3 + 2] = f.b;
      this.fxSize[k] = f.size * (f.grow ? 0.4 + u * 1.4 : 1); this.fxAlpha[k] = (1 - u) * f.op;
      k++;
    }
    const ga = this.fxPoints.geometry.attributes;
    ga.position.needsUpdate = ga.tint.needsUpdate = ga.size.needsUpdate = ga.alpha.needsUpdate = true;
    this.fxPoints.geometry.setDrawRange(0, k);
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i]; l.t += dt; l.obj.material.opacity = 1 - l.t / l.life;
      if (l.t >= l.life) { this.scene.remove(l.obj); l.obj.geometry.dispose(); l.obj.material.dispose(); this.lines.splice(i, 1); }
    }
  }
  impact(p, t, targets) {
    let dmg = p.dmg, crit = false;
    if (Math.random() < p.crit) { dmg *= p.critDmg; crit = true; }
    if (p.overload && p.owner && p.owner.shieldFrac && p.owner.shieldFrac() < 0.3) dmg *= 1 + p.overload;
    if (t) this.onHit && this.onHit(t, dmg, p.dtype, p, crit);
    if (p.aoe) {
      this.flash(p.pos, 0xff8844, p.aoe * 1.8, 0.5, 1, true);
      for (const o of targets) {
        if (o === t || !o.alive || o === p.owner || (this.canHit && !this.canHit(p.owner, o))) continue;
        const d = o.pos.distanceTo(p.pos);
        if (d < p.aoe + o.radius) this.onHit && this.onHit(o, dmg * 0.6 * (1 - d / (p.aoe + o.radius) * 0.5), p.dtype, p, false);
      }
    } else this.flash(p.pos, DAMAGE_TYPES[p.dtype]?.color || 0xffffff, (crit ? 3 : 1.8) * this.scale * Math.min(3, 0.6 + Math.sqrt(p.dmg) / 5), 0.18, 1, true);
    if (p.chain && t) {
      let best = null, bd = 60 * this.scale;
      for (const o of targets) {
        if (o === t || !o.alive || o === p.owner || (this.canHit && !this.canHit(p.owner, o))) continue;
        const d = o.pos.distanceTo(t.pos); if (d < bd) { bd = d; best = o; }
      }
      if (best) { this.onHit && this.onHit(best, dmg * 0.5, p.dtype, p, false); this.bolt(t.pos, best.pos); }
    }
  }
  flash(pos, color, size, life = 0.3, op = 1, grow = false) {
    if (this.fx.length >= FX_MAX) return;
    _col.set(color);
    this.fx.push({ x: pos.x, y: pos.y, z: pos.z, r: _col.r, g: _col.g, b: _col.b, size, life, t: 0, op, grow });
  }
  explosion(pos, size) {
    this.flash(pos, 0xffcc66, size, 0.6, 1, true);
    this.flash(pos, 0xff5522, size * 1.6, 0.9, 0.7, true);
    const n = Math.round(8 * this.fxBudget);
    for (let i = 0; i < n; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(size * 0.8).add(pos);
      this.flash(_v, 0xffaa44, size * 0.4, 0.4 + Math.random() * 0.5, 1, true);
    }
  }
  bolt(a, b) {
    const pts = [a.clone()];
    for (let i = 1; i < 6; i++) pts.push(a.clone().lerp(b, i / 6).add(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6).multiplyScalar(this.scale * 0.3)));
    pts.push(b.clone());
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.lineMat.clone());
    this.scene.add(l); this.lines.push({ obj: l, t: 0, life: 0.25 });
  }
  clear() {
    for (const l of this.lines) this.scene.remove(l.obj);
    this.list = []; this.fx = []; this.lines = []; this.bolts.count = 0; this.missiles.count = 0;
  }
}

// Does segment a->b pass within r of c?
export function segSphere(a, b, c, r) {
  _v.copy(b).sub(a); const len2 = _v.lengthSq();
  _w.copy(c).sub(a);
  let t = len2 > 0 ? _w.dot(_v) / len2 : 0; t = Math.max(0, Math.min(1, t));
  _w.copy(a).addScaledVector(_v, t);
  return _w.distanceToSquared(c) <= r * r;
}

// Fire a weapon item from an origin. mods: {dmg, rate, crit, vel, ion, missile}
export function fireWeapon(proj, item, origin, dir, owner, mods = {}, inherit = null, target = null) {
  const w = item.weapon;
  let dmg = w.dmg * (mods.dmg || 1);
  if ((w.dtype === 'ion' || w.dtype === 'energy') && mods.ion) dmg *= mods.ion;
  if (item.kind === 'missile' && mods.missile) dmg *= mods.missile;
  const count = w.count || 1;
  for (let i = 0; i < count; i++) {
    const d = dir.clone();
    const sp = w.spread + (count > 1 && item.kind === 'missile' ? 0.25 : 0);
    if (sp) { d.x += (Math.random() - 0.5) * sp * 2; d.y += (Math.random() - 0.5) * sp * 2; d.z += (Math.random() - 0.5) * sp * 2; d.normalize(); }
    proj.spawn({
      pos: origin, dir: d, speed: w.speed * (mods.vel || 1), inherit, dmg, dtype: w.dtype, range: w.range * (item.kind === 'pweapon' ? 1 : 1.2),
      owner, homing: w.homing, target: w.homing ? target : null, crit: w.crit + (mods.crit || 0), critDmg: w.critDmg, aoe: w.aoe, pierce: w.pierce,
      chain: w.chain, leech: w.leech, gravity: w.gravity, missile: item.kind === 'missile', overload: w.overload,
    });
  }
}
