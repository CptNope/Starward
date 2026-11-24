# Input regression test (pip install playwright && playwright install chromium; run: python3 tests/input-test.py [kbm|pad|touch]).
# End-to-end input test: drives Starward through real keyboard/mouse events, a mocked
# standard gamepad and real multi-touch events, and checks game state after each action.
import asyncio, sys, json
from playwright.async_api import async_playwright
import os
# Serve the built game first, e.g.:  npm run build && cd dist && python3 -m http.server 8766
URL = os.environ.get("STARWARD_URL", "http://localhost:8766/index.html")
CHROME = dict(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
if os.environ.get("CHROME_PATH"): CHROME["executable_path"] = os.environ["CHROME_PATH"]
results = []
def check(group, name, ok, detail=""):
    results.append((group, name, bool(ok), detail)); print(("PASS " if ok else "FAIL ") + f"[{group}] {name}" + (f" — {detail}" if detail and not ok else ""))

PAD_INIT = """
window.__pad = { id: 'Mock pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0,0,0,0], buttons: Array.from({length: 17}, () => ({ pressed: false, value: 0 })) };
window.__padOn = false;
navigator.getGamepads = () => window.__padOn ? [window.__pad] : [];
"""
async def setup(p, touch=False, pad=False, viewport=(1280,720)):
    b = await p.chromium.launch(**CHROME)
    ctx = await b.new_context(viewport={"width":viewport[0],"height":viewport[1]}, has_touch=touch, is_mobile=touch)
    await ctx.add_init_script(PAD_INIT)
    pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    await pg.goto(URL); await pg.evaluate("localStorage.clear(); localStorage.setItem('starward-settings', JSON.stringify({quality:0, autoQuality:false, bloom:false}))"); await pg.reload(); await pg.wait_for_timeout(900)
    return b, pg, errs

async def frames(pg, n=3): await pg.wait_for_timeout(int(n * 40))
async def st(pg, js): return await pg.evaluate(js)
async def calm(pg):  # clear enemies/spawns so tests are deterministic
    await pg.evaluate("()=>{ const s=game.mode; if(s.kind!=='space') return; s.spawnTimer=1e9; s.proj.clear(); s.player.lastHit=-99; s.ships.filter(x=>!x.isPlayer).forEach(x=>s.removeShip(x)); s.ships=s.ships.filter(x=>x.isPlayer); s.player.hull=s.player.st.hullMax; }")
SHOTS = "(()=>{ const pr=game.mode.proj; if(!pr.__wrapped){ const f=pr.spawn.bind(pr); pr.spawn=(o)=>{ if(o.owner===game.mode.player) window.__shots=(window.__shots||0)+1; return f(o); }; pr.__wrapped=true; } return window.__shots||0; })()"
async def spawn_enemy(pg, d=900):
    await pg.evaluate(f"()=>{{ const s=game.mode,P=s.player; const e=s.spawnGroup({{faction: game.U.factions.filter(f=>f.ideology==='pirate')[0].id, n:1, role:'raid', cls:'fighter', level:1, at:P.pos.clone().addScaledVector(P.forward(),{d})}})[0]; e.hp=1e6; e.st.hullMax=1e6; e.hull=1e6; window.__e=e; }}")
FWD = "(()=>{ const f=game.mode.player.forward(); return [f.x,f.y,f.z]; })()"
NEAR_PLANET = "(d)=>{ if(game.ui.modal) game.ui.close(); const s=game.mode,P=s.player,pl=s.planets[0]; const out=P.pos.clone().sub(pl.pos).normalize(); P.pos.copy(pl.pos).addScaledVector(out, pl.radius+d); P.vel.set(0,0,0); P.throttle=0; }"
ON_GROUND = "()=>game.mode && game.mode.kind==='ground'"
def ang(a,b):
    import math; d=sum(x*y for x,y in zip(a,b)); return math.acos(max(-1,min(1,d)))

# ---------------------------------------------------------------- keyboard & mouse
async def test_kbm(p):
    G="KBM"; b, pg, errs = await setup(p)
    await pg.click("text=New game"); await frames(pg,5); await pg.click("text=Launch"); await pg.wait_for_timeout(1200)
    check(G,"title → new game → launch by mouse", await st(pg,"()=>game.mode && game.mode.kind")=='space')
    await calm(pg)
    await pg.evaluate("()=>{ game.mode.player.throttle=0.5; }")
    await pg.keyboard.down("KeyW"); await pg.wait_for_timeout(400); await pg.keyboard.up("KeyW")
    t1 = await st(pg,"()=>game.mode.player.throttle"); check(G,"W raises throttle", t1>0.6, t1)
    await pg.keyboard.down("KeyS"); await pg.wait_for_timeout(400); await pg.keyboard.up("KeyS")
    t2 = await st(pg,"()=>game.mode.player.throttle"); check(G,"S lowers throttle", t2<t1, (t1,t2))
    await pg.keyboard.press("KeyX"); await frames(pg); check(G,"X all stop", await st(pg,"()=>game.mode.player.throttle")==0)
    await pg.mouse.move(640,360); await pg.mouse.wheel(0,-100); await frames(pg,4); await pg.mouse.wheel(0,-100); await frames(pg,4)
    check(G,"scroll wheel raises throttle", await st(pg,"()=>game.mode.player.throttle")>0.1)
    f0 = await st(pg,FWD); await pg.keyboard.down("KeyA"); await pg.wait_for_timeout(400); await pg.keyboard.up("KeyA"); f1 = await st(pg,FWD)
    check(G,"A yaws the ship", ang(f0,f1)>0.1, ang(f0,f1))
    f0 = await st(pg,FWD); await pg.keyboard.down("ArrowUp"); await pg.wait_for_timeout(400); await pg.keyboard.up("ArrowUp"); f1 = await st(pg,FWD)
    check(G,"Arrow keys pitch the ship", ang(f0,f1)>0.1, ang(f0,f1))
    u0 = await st(pg,"(()=>{const q=game.mode.player.quat; return [q.x,q.y,q.z,q.w];})()"); await pg.keyboard.down("KeyQ"); await pg.wait_for_timeout(300); await pg.keyboard.up("KeyQ"); u1 = await st(pg,"(()=>{const q=game.mode.player.quat; return [q.x,q.y,q.z,q.w];})()")
    check(G,"Q rolls the ship", u0!=u1)
    await pg.evaluate("()=>{ game.mode.player.energy = game.mode.player.st.energyMax; game.mode.player.throttle=1; }")
    await pg.keyboard.down("ShiftLeft"); await pg.wait_for_timeout(300); bo = await st(pg,"()=>game.mode.player.boosting"); await pg.keyboard.up("ShiftLeft")
    check(G,"Shift boosts", bo)
    await spawn_enemy(pg)
    n0 = await st(pg,SHOTS); await pg.keyboard.down("Space"); await pg.wait_for_timeout(450); n1 = await st(pg,SHOTS); await pg.keyboard.up("Space")
    check(G,"Space fires guns", n1>n0, (n0,n1))
    await pg.mouse.move(640,360); await pg.mouse.down(); await pg.wait_for_timeout(250); n2 = await st(pg,"()=>game.mode.proj.list.filter(p=>p.owner===game.mode.player && !p.missile).length"); await pg.mouse.up()
    check(G,"Left mouse fires guns", n2>0)
    await pg.keyboard.press("KeyT"); await frames(pg); check(G,"T locks a target", await st(pg,"()=>!!game.mode.target"))
    await pg.evaluate("()=>{ game.mode.target=null; const P=game.mode.player, d=window.__e.pos.clone().sub(P.pos).normalize(); P.quat.setFromUnitVectors(new d.constructor(0,0,-1), d); game.mode.aimDir=null; game.input.vc.x=0; game.input.vc.y=0; }"); await frames(pg)
    await pg.keyboard.press("KeyR"); await frames(pg); check(G,"R targets whatever is ahead", await st(pg,"()=>game.mode.target===window.__e"))
    m0 = await st(pg,"()=>game.mode.player.missiles"); await pg.keyboard.press("KeyF"); await frames(pg); m1 = await st(pg,"()=>game.mode.player.missiles")
    check(G,"F fires a missile", m1==m0-1, (m0,m1))
    await pg.evaluate("()=>{ game.mode.player.missileCool=0; }"); m0=m1; await pg.mouse.click(640,360, button="right"); await frames(pg); m1 = await st(pg,"()=>game.mode.player.missiles")
    check(G,"Right mouse fires a missile", m1==m0-1, (m0,m1))
    await calm(pg)
    await pg.keyboard.press("KeyC"); await pg.wait_for_timeout(200); check(G,"C engages cruise", await st(pg,"()=>game.mode.cruiseOn")); await pg.keyboard.press("KeyC"); await frames(pg)
    v0 = await st(pg,"()=>game.mode.viewMode"); await pg.keyboard.press("KeyV"); await frames(pg); v1 = await st(pg,"()=>game.mode.viewMode")
    check(G,"V cycles the space camera", v1==(v0+1)%3, (v0,v1))
    for key, tab in [("KeyI","inventory"),("KeyK","skills"),("KeyJ","missions"),("KeyM","galaxy"),("KeyG","guide"),("Tab","inventory")]:
        await pg.keyboard.press(key); await frames(pg,4); o = await st(pg,"()=>[game.ui.modal, game.ui.tab]")
        await pg.keyboard.press(key); await frames(pg,4); c = await st(pg,"()=>game.ui.modal")
        check(G,f"{key} opens and closes {tab}", o[0]=='menu' and o[1]==tab and c is None, (o,c))
    await pg.keyboard.press("Escape"); await frames(pg,4); a = await st(pg,"()=>game.ui.modal"); await pg.keyboard.press("Escape"); await frames(pg,4); c = await st(pg,"()=>game.ui.modal")
    check(G,"Esc pauses and resumes", a=='pause' and c is None, (a,c))
    await pg.keyboard.press("KeyP"); await frames(pg,4); a = await st(pg,"()=>game.ui.modal"); await pg.keyboard.press("KeyP"); await frames(pg,4)
    check(G,"P pauses", a=='pause')
    # mouse aim: simulate a captured mouse and move it
    await pg.evaluate("()=>{ game.input.locked=true; game.input.lastDevice='kbm'; game.mode.aimDir=null; }"); await frames(pg,2)
    for i in range(6): await pg.mouse.move(640+i*25, 360-i*8); await frames(pg,1)
    ma = await st(pg,"()=>{ const s=game.mode; return [s.mouseAim, s.aimDir ? s.aimDir.angleTo(s.player.forward()) : -1]; }")
    check(G,"captured mouse moves the aim ring (mouse aim)", ma[0] and ma[1]>0.01, ma)
    # a connected-but-idle gamepad must not disable mouse aim
    await pg.evaluate("()=>{ window.__padOn = true; }"); await frames(pg,3)
    for i in range(4): await pg.mouse.move(700-i*30, 300+i*10); await frames(pg,1)
    check(G,"idle gamepad plugged in keeps mouse aim on", await st(pg,"()=>game.mode.mouseAim"))
    await pg.evaluate("()=>{ window.__padOn = false; }")
    # losing the pointer lock (Esc / alt-tab) pauses instead of handing steering to the cursor
    real = await pg.evaluate("async ()=>{ if (document.pointerLockElement) { const p = new Promise(r => document.addEventListener('pointerlockchange', r, { once: true })); document.exitPointerLock(); await p; return 'real lock released'; } game.input.locked = true; document.dispatchEvent(new Event('pointerlockchange')); return 'simulated'; }"); await frames(pg,3)
    print('lock release:', real)
    check(G,"losing mouse capture pauses the game", await st(pg,"()=>game.ui.modal")=='pause')
    await pg.keyboard.press("Escape"); await frames(pg,2)
    check(G,"the Esc that freed the mouse doesn't instantly unpause", await st(pg,"()=>game.ui.modal")=='pause')
    await pg.wait_for_timeout(500); await pg.keyboard.press("Escape"); await frames(pg,3)
    check(G,"a second Esc resumes", await st(pg,"()=>game.ui.modal") is None)
    # uncaptured cursor leaving the window stops the turn
    await pg.evaluate("()=>{ game.input.locked=false; game.input.vc.x=0.9; document.dispatchEvent(new MouseEvent('mouseleave')); }")
    check(G,"cursor leaving the window stops the turn", await st(pg,"()=>game.input.vc.x")==0)
    # prompts/hints are keyboard flavoured
    hint = await st(pg,"()=>document.querySelector('#hint').textContent"); check(G,"hint bar shows keyboard keys", 'W/S' in hint, hint[:60])
    # dock with E
    await pg.evaluate("()=>{ const s=game.mode, st=s.stations[0]; s.player.pos.copy(st.pos).add(new st.pos.constructor(st.radius+150,0,0)); }"); await frames(pg,3)
    pr = await st(pg,"()=>document.querySelector('#prompt').textContent"); check(G,"dock prompt names the E key", pr.startswith('E · '), pr)
    await pg.keyboard.press("KeyE"); await pg.wait_for_timeout(300); check(G,"E docks at a station", await st(pg,"()=>game.ui.modal")=='station')
    await pg.click("[data-a=undock]"); await pg.wait_for_timeout(300); check(G,"Undock button returns to space", await st(pg,"()=>game.ui.modal===null && game.mode.kind==='space'"))
    # ---- landing: fly close, pick a spot on the survey map, watch the touchdown
    await pg.evaluate(NEAR_PLANET, 1500); await frames(pg,5)
    pr = await st(pg,"()=>document.querySelector('#prompt').textContent"); check(G,"far from a planet the prompt says to fly closer", 'Fly closer' in pr, pr)
    await pg.evaluate(NEAR_PLANET, 250); await frames(pg,5)
    pr = await st(pg,"()=>document.querySelector('#prompt').textContent"); check(G,"land prompt names the L key", pr.startswith('L · Land on'), pr)
    await pg.keyboard.press("KeyE"); await pg.wait_for_timeout(300); check(G,"E opens the landing map", await st(pg,"()=>game.ui.modal")=='landing')
    box = await pg.locator('#landmap').bounding_box(); await pg.mouse.click(box['x']+box['width']*0.3, box['y']+box['height']*0.3); await frames(pg,3)
    sel = await st(pg,"()=>game.ui.land.sel"); check(G,"clicking the map moves the landing marker", abs(sel['x']+180)<12 and abs(sel['z']+180)<12, sel)
    await pg.keyboard.press("Enter"); await frames(pg,4); check(G,"Enter starts the descent", await st(pg,"()=>game.ui.modal===null && !!game.mode.descent"))
    await pg.wait_for_function(ON_GROUND, timeout=20000)
    check(G,"landed on foot", await st(pg,"()=>game.mode.kind")=='ground')
    check(G,"the pad is where the map was clicked", await st(pg,"()=>{ const p=game.mode.env.pad, s=game.mode.env.sites; return Math.hypot(p.x+180,p.z+180)<70 && s.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>=61.9); }"))
    await pg.wait_for_function("()=>game.mode.intro && game.mode.intro.t>0.6", timeout=10000)
    p0 = await st(pg,"()=>game.mode.me.pos.toArray()"); await pg.keyboard.down("KeyW"); await pg.wait_for_timeout(250); await pg.keyboard.up("KeyW"); p1 = await st(pg,"()=>game.mode.me.pos.toArray()")
    check(G,"controls are held during the touchdown", p0==p1 and await st(pg,"()=>!!game.mode.intro"))
    await pg.keyboard.press("Space"); await frames(pg,4); check(G,"Space skips the touchdown", await st(pg,"()=>!game.mode.intro && Math.abs(game.mode.env.shipMesh.position.y-3.2)<0.01 && game.mode.me.onGround"))
    await pg.evaluate("()=>{ game.input.locked=true; }")
    p0 = await st(pg,"()=>game.mode.me.pos.toArray()"); await pg.keyboard.down("KeyW"); await pg.wait_for_timeout(400); await pg.keyboard.up("KeyW"); p1 = await st(pg,"()=>game.mode.me.pos.toArray()")
    check(G,"W walks forward", ((p1[0]-p0[0])**2+(p1[2]-p0[2])**2)**.5>0.5)
    p0=p1; await pg.keyboard.down("KeyD"); await pg.wait_for_timeout(300); await pg.keyboard.up("KeyD"); p1 = await st(pg,"()=>game.mode.me.pos.toArray()")
    check(G,"D strafes", ((p1[0]-p0[0])**2+(p1[2]-p0[2])**2)**.5>0.4)
    await pg.keyboard.press("Space"); await pg.wait_for_timeout(120); check(G,"Space jumps", await st(pg,"()=>!game.mode.me.onGround || game.mode.me.velY>0"))
    await pg.wait_for_timeout(800)
    y0 = await st(pg,"()=>game.mode.yaw"); 
    for i in range(5): await pg.mouse.move(640+i*40, 360); await frames(pg,1)
    check(G,"mouse looks around (captured)", abs(await st(pg,"()=>game.mode.yaw")-y0)>0.05)
    mg0 = await st(pg,"()=>{ const w=game.mode.ps.weapons[game.mode.wIdx]; return w ? w._mag : null; }")
    await pg.mouse.down(); await pg.wait_for_timeout(200); await pg.mouse.up(); await frames(pg)
    mg1 = await st(pg,"()=>{ const w=game.mode.ps.weapons[game.mode.wIdx]; return w ? w._mag : null; }")
    check(G,"left mouse fires on foot", mg0 is None or mg1 < mg0, (mg0,mg1))
    await pg.keyboard.press("KeyR"); await frames(pg); check(G,"R reloads", await st(pg,"()=>game.mode.reloading>0 || game.mode.ps.weapons.length===0"))
    await pg.wait_for_timeout(2500)
    nw = await st(pg,"()=>game.mode.ps.weapons.length"); w0 = await st(pg,"()=>game.mode.wIdx"); await pg.keyboard.press("Digit2"); await frames(pg)
    check(G,"2 swaps weapon", nw<2 or await st(pg,"()=>game.mode.wIdx")!=w0, f"{nw} weapons")
    await pg.keyboard.press("Digit1"); await frames(pg); check(G,"1 selects first weapon", await st(pg,"()=>game.mode.wIdx")==0)
    await pg.evaluate("()=>{ game.player.inventory.push({id:'mk1', kind:'medkit', name:'Medkit', tier:0, level:1}); game.mode.me.hp = 10; }")
    await pg.keyboard.press("KeyH"); await frames(pg); check(G,"H uses a medkit", await st(pg,"()=>game.mode.me.hp")>10)
    await pg.keyboard.down("ShiftLeft"); await pg.keyboard.down("KeyW"); p0 = await st(pg,"()=>game.mode.me.pos.toArray()"); await pg.wait_for_timeout(300); p1 = await st(pg,"()=>game.mode.me.pos.toArray()"); await pg.keyboard.up("KeyW"); await pg.keyboard.up("ShiftLeft")
    sprint=((p1[0]-p0[0])**2+(p1[2]-p0[2])**2)**.5
    await pg.keyboard.down("KeyW"); p0 = await st(pg,"()=>game.mode.me.pos.toArray()"); await pg.wait_for_timeout(300); p1 = await st(pg,"()=>game.mode.me.pos.toArray()"); await pg.keyboard.up("KeyW")
    walk=((p1[0]-p0[0])**2+(p1[2]-p0[2])**2)**.5
    check(G,"Shift sprints faster than walking", sprint>walk*1.2, (sprint,walk))
    await pg.keyboard.press("KeyV"); await frames(pg); fp = await st(pg,"()=>game.mode.fp"); await pg.keyboard.press("KeyV"); await frames(pg)
    check(G,"V toggles first person on foot", fp!=await st(pg,"()=>game.mode.fp"))
    await pg.evaluate("()=>{ const m=game.mode; m.me.pos.copy(m.exit.pos); }"); await frames(pg,3)
    pr = await st(pg,"()=>document.querySelector('#prompt').textContent"); check(G,"exit prompt names the E key", pr.startswith('E · '), pr)
    await pg.keyboard.press("KeyE"); await pg.wait_for_timeout(1200); check(G,"E at the ship takes off", await st(pg,"()=>game.mode.kind")=='space')
    check(G,"no page errors", not errs, errs[:3]); await b.close()

# ---------------------------------------------------------------- gamepad
async def pad_btn(pg, i, hold=120):
    await pg.evaluate(f"()=>{{ window.__pad.buttons[{i}].pressed=true; window.__pad.buttons[{i}].value=1; }}"); await pg.wait_for_timeout(hold)
    await pg.evaluate(f"()=>{{ window.__pad.buttons[{i}].pressed=false; window.__pad.buttons[{i}].value=0; }}"); await pg.wait_for_timeout(90)
async def pad_axes(pg, ax): await pg.evaluate(f"()=>{{ window.__pad.axes={json.dumps(ax)}; }}")
async def focused(pg): return await st(pg,"()=>{ const e=document.querySelector('.gpfocus'); return e ? (e.dataset.a||'')+':'+e.textContent.trim().slice(0,20) : null; }")
async def pad_nav_to(pg, text, dirs=(13,15,12,14), tries=24):
    for i in range(tries):
        f = await focused(pg)
        if f and text in f: return True
        await pad_btn(pg, dirs[(i//4)%len(dirs)])
    return False

async def pad_nav_toward(pg, sel, tries=40):
    seen = {}
    for i in range(tries):
        r = await st(pg, f"""()=>{{ const t=document.querySelector('{sel}'), f=document.querySelector('.gpfocus'); if(!t) return ['missing']; if(f===t) return ['here']; if(!f) return [13,13,''];
            const a=f.getBoundingClientRect(), b=t.getBoundingClientRect(); const dx=(b.left+b.width/2)-(a.left+a.width/2), dy=(b.top+b.height/2)-(a.top+a.height/2);
            const v = dy>0?13:12, h = dx>0?15:14; const k = Math.round(a.left)+','+Math.round(a.top);
            return Math.abs(dy) > Math.abs(dx) ? [v, h, k] : [h, v, k]; }}""")
        if r[0] == 'here': return True
        if r[0] == 'missing': return False
        seen[r[2]] = seen.get(r[2], 0) + 1
        await pad_btn(pg, r[0] if seen[r[2]] < 2 else r[1])
    return False

async def test_pad(p):
    G="Gamepad"; b, pg, errs = await setup(p, pad=True)
    await pg.evaluate("()=>{ window.__padOn = true; }"); await pad_btn(pg, 13)
    check(G,"D-pad highlights a title-screen button", await focused(pg) is not None, await focused(pg))
    ok = await pad_nav_to(pg, "New game"); check(G,"D-pad reaches New game", ok)
    await pad_btn(pg, 0); await pg.wait_for_timeout(300); check(G,"A opens the new-game screen", await st(pg,"()=>!!document.querySelector('#ng-name')"))
    await pad_btn(pg, 1); await pg.wait_for_timeout(200); check(G,"B goes back to the title", await st(pg,"()=>!document.querySelector('#ng-name') && game.ui.modal==='title'"))
    await pad_nav_to(pg, "New game"); await pad_btn(pg, 0); await pg.wait_for_timeout(300)
    ok = await pad_nav_to(pg, "Launch", dirs=(13,15)); check(G,"D-pad reaches Launch", ok, await focused(pg))
    await pad_btn(pg, 0); await pg.wait_for_timeout(1300); check(G,"A launches a new game", await st(pg,"()=>game.mode && game.mode.kind")=='space')
    await calm(pg)
    hint = await st(pg,"()=>document.querySelector('#hint').textContent"); check(G,"hint bar switches to gamepad buttons", 'RT' in hint, hint[:50])
    f0 = await st(pg,FWD); await pad_axes(pg,[0.9,0,0,0]); await pg.wait_for_timeout(400); await pad_axes(pg,[0,0,0,0]); f1 = await st(pg,FWD)
    check(G,"left stick steers", ang(f0,f1)>0.15, ang(f0,f1))
    await pg.evaluate("()=>{ game.mode.player.throttle=0.3; }"); await pad_axes(pg,[0,0,0,-0.9]); await pg.wait_for_timeout(400); await pad_axes(pg,[0,0,0,0])
    check(G,"right stick up raises throttle", await st(pg,"()=>game.mode.player.throttle")>0.4)
    u0 = await st(pg,"(()=>{const q=game.mode.player.quat; return [q.x,q.y,q.z,q.w];})()"); await pad_axes(pg,[0,0,0.9,0]); await pg.wait_for_timeout(300); await pad_axes(pg,[0,0,0,0])
    check(G,"right stick sideways rolls", u0 != await st(pg,"(()=>{const q=game.mode.player.quat; return [q.x,q.y,q.z,q.w];})()"))
    await spawn_enemy(pg)
    await pg.evaluate("()=>{ window.__pad.buttons[7].value=1; }"); await pg.wait_for_timeout(250); n = await st(pg,"()=>game.mode.proj.list.filter(p=>p.owner===game.mode.player).length"); await pg.evaluate("()=>{ window.__pad.buttons[7].value=0; }")
    check(G,"RT fires guns", n>0)
    await pad_btn(pg, 3); check(G,"Y locks a target", await st(pg,"()=>!!game.mode.target"))
    await pg.evaluate("()=>{ game.mode.target=null; const P=game.mode.player, d=window.__e.pos.clone().sub(P.pos).normalize(); P.quat.setFromUnitVectors(new d.constructor(0,0,-1), d); game.mode.aimDir=null; game.input.vc.x=0; game.input.vc.y=0; }"); await pg.wait_for_timeout(60)
    await pad_btn(pg, 1); check(G,"B targets whatever is ahead", await st(pg,"()=>game.mode.target===window.__e"))
    m0 = await st(pg,"()=>game.mode.player.missiles"); await pg.evaluate("()=>{ window.__pad.buttons[6].value=1; }"); await pg.wait_for_timeout(150); await pg.evaluate("()=>{ window.__pad.buttons[6].value=0; }"); await frames(pg)
    check(G,"LT fires a missile", await st(pg,"()=>game.mode.player.missiles")==m0-1)
    await pg.evaluate("()=>{ game.mode.player.energy=game.mode.player.st.energyMax; }"); await pg.evaluate("()=>{ window.__pad.buttons[5].pressed=true; }"); await pg.wait_for_timeout(200); bo = await st(pg,"()=>game.mode.player.boosting"); await pg.evaluate("()=>{ window.__pad.buttons[5].pressed=false; }")
    check(G,"RB boosts", bo)
    await calm(pg); await pad_btn(pg, 10); check(G,"L3 engages cruise", await st(pg,"()=>game.mode.cruiseOn")); await pad_btn(pg, 10)
    v0 = await st(pg,"()=>game.mode.viewMode"); await pad_btn(pg, 11); check(G,"R3 cycles the camera", await st(pg,"()=>game.mode.viewMode")==(v0+1)%3)
    await pad_btn(pg, 9); check(G,"Start pauses", await st(pg,"()=>game.ui.modal")=='pause')
    await pad_btn(pg, 9); check(G,"Start resumes", await st(pg,"()=>game.ui.modal") is None)
    await pad_btn(pg, 8); check(G,"Back opens the menu", await st(pg,"()=>game.ui.modal")=='menu')
    t0 = await st(pg,"()=>game.ui.tab"); await pad_btn(pg, 5); await pg.wait_for_timeout(100); t1 = await st(pg,"()=>game.ui.tab")
    check(G,"RB switches menu tab", t0!=t1, (t0,t1))
    await pad_btn(pg, 4); check(G,"LB switches tab back", await st(pg,"()=>game.ui.tab")==t0)
    await pad_btn(pg, 13); await pad_btn(pg, 15); check(G,"D-pad highlights items in the menu", await focused(pg) is not None, await focused(pg))
    # equip by controller: highlight the test item, A selects it, then reach Equip and press A
    await pg.evaluate("()=>{ const it=JSON.parse(JSON.stringify(game.player.equip.engine)); it.id='tst2'; it.name='Pad Drive'; game.player.inventory.unshift(it); game.ui.openMenu('inventory'); }"); await pg.wait_for_timeout(150)
    ok = await pad_nav_toward(pg, "#overlay [data-tip=tst2]")
    await pad_btn(pg, 0); await pg.wait_for_timeout(150)
    ok2 = ok and await pad_nav_toward(pg, "#overlay [data-a=equip]")
    await pad_btn(pg, 0); await pg.wait_for_timeout(150)
    check(G,"select and equip an item with the D-pad and A", await st(pg,"()=>game.player.equip.engine && game.player.equip.engine.id==='tst2'"), (ok, ok2, await focused(pg)))
    await pad_btn(pg, 8); check(G,"Back closes the menu", await st(pg,"()=>game.ui.modal") is None)
    # galaxy map: pick a star in range and jump
    await pg.evaluate("()=>{ game.ui.openMenu('galaxy'); }"); await pg.wait_for_timeout(200)
    s0 = await st(pg,"()=>game.ui.mapSel ?? null")
    for d in (15,13,14,12): await pad_btn(pg, d)
    check(G,"D-pad picks stars on the galaxy map", await st(pg,"()=>game.ui.mapSel ?? null") is not None)
    target = await st(pg,"""()=>{ const g=game,U=g.U,h=U.systems[g.player.systemId]; const r=(window.__ss=window.__ss||0, 9); let best=null,bd=1e9; for(const s of U.systems){ if(s===h) continue; const d=Math.hypot(s.x-h.x,s.y-h.y); if(d<bd){bd=d;best=s;} } g.ui.mapSel=best.id; g.ui.drawMap(); return best.id; }""")
    await pad_btn(pg, 0); await pg.wait_for_timeout(2500)
    check(G,"A engages the jump drive", await st(pg,"()=>game.player.systemId")==target or await st(pg,"()=>!!game.jumping"), await st(pg,"()=>[game.player.systemId, game.jumping]"))
    await pg.wait_for_timeout(3500); await calm(pg)
    # dock with A, B to undock, and the A that closed a menu must not act in the game
    await pg.evaluate("()=>{ const s=game.mode; const st=s.stations[0]; if(!st) return; s.player.pos.copy(st.pos).add(new st.pos.constructor(st.radius+150,0,0)); }"); await pg.wait_for_timeout(200)
    has_st = await st(pg,"()=>game.mode.stations.length>0")
    if has_st:
        pr = await st(pg,"()=>document.querySelector('#prompt').textContent"); check(G,"dock prompt shows the A button", pr.startswith('A · '), pr)
        await pad_btn(pg, 0); await pg.wait_for_timeout(300); check(G,"A docks at a station", await st(pg,"()=>game.ui.modal")=='station')
        tb0 = await st(pg,"()=>document.querySelector('#overlay .tabs .on')?.dataset.v"); await pad_btn(pg, 5); await pg.wait_for_timeout(150)
        check(G,"RB switches station tabs", await st(pg,"()=>document.querySelector('#overlay .tabs .on')?.dataset.v")!=tb0)
        await pad_btn(pg, 1); await pg.wait_for_timeout(300); check(G,"B undocks", await st(pg,"()=>game.ui.modal") is None)
        await pg.wait_for_timeout(300); check(G,"undocking with B doesn't trigger anything else", await st(pg,"()=>game.ui.modal") is None)
    # landing with the pad: A opens the map, D-pad picks a site, A lands, A skips the touchdown
    await pg.evaluate(NEAR_PLANET, 250); await frames(pg,5)
    await pad_btn(pg, 0); await pg.wait_for_timeout(350); check(G,"A opens the landing map", await st(pg,"()=>game.ui.modal")=='landing')
    check(G,"landing map highlights Land at the marker", await st(pg,"()=>document.querySelector('#overlay .gpfocus')?.dataset.v")=='sel')
    await pad_btn(pg, 13); await pg.wait_for_timeout(200); check(G,"D-pad moves to a landing site", await st(pg,"()=>document.querySelector('#overlay .gpfocus')?.dataset.v")=='0')
    await pad_btn(pg, 0); await pg.wait_for_timeout(200); check(G,"A starts the descent", await st(pg,"()=>game.ui.modal===null && !!game.mode.descent"))
    await pg.wait_for_function(ON_GROUND, timeout=20000); await pg.wait_for_function("()=>game.mode.intro && game.mode.intro.t>0.6", timeout=10000)
    check(G,"landed beside the chosen site", await st(pg,"()=>{ const p=game.mode.env.pad, s=game.mode.env.sites[0]; return Math.abs(Math.hypot(s.x-p.x,s.z-p.z)-62)<1; }"))
    await pad_btn(pg, 0); await pg.wait_for_timeout(200); check(G,"A skips the touchdown without jumping", await st(pg,"()=>!game.mode.intro && game.mode.me.onGround"))
    p0 = await st(pg,"()=>game.mode.me.pos.toArray()"); await pad_axes(pg,[0,-0.9,0,0]); await pg.wait_for_timeout(400); await pad_axes(pg,[0,0,0,0]); p1 = await st(pg,"()=>game.mode.me.pos.toArray()")
    check(G,"left stick walks", ((p1[0]-p0[0])**2+(p1[2]-p0[2])**2)**.5>0.5)
    y0 = await st(pg,"()=>game.mode.yaw"); await pad_axes(pg,[0,0,0.9,0]); await pg.wait_for_timeout(300); await pad_axes(pg,[0,0,0,0])
    check(G,"right stick looks", abs(await st(pg,"()=>game.mode.yaw")-y0)>0.1)
    await pad_btn(pg, 0, 60); check(G,"A jumps", await st(pg,"()=>!game.mode.me.onGround || game.mode.me.velY!==0"))
    await pg.wait_for_timeout(800)
    mg0 = await st(pg,"()=>{ const w=game.mode.ps.weapons[game.mode.wIdx]; return w ? w._mag : null; }")
    await pg.evaluate("()=>{ window.__pad.buttons[7].value=1; }"); await pg.wait_for_timeout(200); await pg.evaluate("()=>{ window.__pad.buttons[7].value=0; }"); await frames(pg)
    check(G,"RT fires on foot", mg0 is None or await st(pg,"()=>game.mode.ps.weapons[game.mode.wIdx]._mag")<mg0)
    await pad_btn(pg, 2); check(G,"X reloads", await st(pg,"()=>game.mode.reloading>0 || game.mode.ps.weapons.length===0"))
    await pg.wait_for_timeout(2500)
    nw = await st(pg,"()=>game.mode.ps.weapons.length"); w0 = await st(pg,"()=>game.mode.wIdx"); await pad_btn(pg, 3)
    check(G,"Y swaps weapon", nw<2 or await st(pg,"()=>game.mode.wIdx")!=w0)
    fp = await st(pg,"()=>game.mode.fp"); await pad_btn(pg, 11); check(G,"R3 toggles first person", await st(pg,"()=>game.mode.fp")!=fp)
    await pg.evaluate("()=>{ game.player.inventory.push({id:'mk2', kind:'medkit', name:'Medkit', tier:0, level:1}); game.mode.me.hp = 10; }")
    await pad_btn(pg, 13); check(G,"D-pad down uses a medkit", await st(pg,"()=>game.mode.me.hp")>10)
    await pg.evaluate("()=>{ const m=game.mode; m.me.pos.copy(m.exit.pos); }"); await pg.wait_for_timeout(200)
    pr = await st(pg,"()=>document.querySelector('#prompt').textContent"); check(G,"exit prompt shows the B button", pr.startswith('B · '), pr)
    await pad_btn(pg, 1); await pg.wait_for_timeout(1300); check(G,"B at the ship takes off", await st(pg,"()=>game.mode.kind")=='space')
    # death screen reachable by pad
    await pg.evaluate("()=>{ const P=game.mode.player; P.hit(1e9,'kinetic',null); }"); await pg.wait_for_timeout(1500)
    if await st(pg,"()=>game.ui.modal")=='death':
        for i in range(6):
            if await focused(pg): break
            await pad_btn(pg, 13)
        await pad_btn(pg, 0); await pg.wait_for_timeout(1500); check(G,"A respawns from the death screen", await st(pg,"()=>game.ui.modal")!='death')
    check(G,"no page errors", not errs, errs[:3]); await b.close()

# ---------------------------------------------------------------- touch
async def touch(pg, pts, typ):
    await pg.evaluate("""([pts,typ])=>{}""", [pts,typ])
async def cdp_touch(cdp, typ, pts):
    await cdp.send("Input.dispatchTouchEvent", {"type": typ, "touchPoints": [{"x":x,"y":y,"id":i} for i,(x,y) in pts]})
async def test_touch(p):
    G="Touch"; b, pg, errs = await setup(p, touch=True, viewport=(844,390))
    cdp = await pg.context.new_cdp_session(pg)
    await pg.tap("text=New game"); await pg.wait_for_timeout(300); await pg.tap("text=Launch"); await pg.wait_for_timeout(1300)
    check(G,"tap New game → Launch", await st(pg,"()=>game.mode && game.mode.kind")=='space')
    await cdp_touch(cdp,"touchStart",[(0,(420,200))]); await cdp_touch(cdp,"touchEnd",[])
    await pg.wait_for_timeout(200); check(G,"touch controls appear", await st(pg,"()=>game.touch.active && getComputedStyle(document.querySelector('#touch')).display!=='none'"))
    await calm(pg)
    f0 = await st(pg,FWD)
    await cdp_touch(cdp,"touchStart",[(1,(150,250))]); await pg.wait_for_timeout(60)
    for k in range(1,6): await cdp_touch(cdp,"touchMove",[(1,(150+k*12,250))]); await pg.wait_for_timeout(40)
    await pg.wait_for_timeout(400); await cdp_touch(cdp,"touchEnd",[])
    f1 = await st(pg,FWD); check(G,"left thumb steers", ang(f0,f1)>0.1, ang(f0,f1))
    await pg.evaluate("()=>{ game.mode.player.throttle=0.3; }")
    await cdp_touch(cdp,"touchStart",[(2,(600,250))]); await pg.wait_for_timeout(60)
    for k in range(1,6): await cdp_touch(cdp,"touchMove",[(2,(600,250-k*12))]); await pg.wait_for_timeout(40)
    await pg.wait_for_timeout(400); await cdp_touch(cdp,"touchEnd",[])
    check(G,"right thumb up raises throttle", await st(pg,"()=>game.mode.player.throttle")>0.4)
    await spawn_enemy(pg)
    async def hold(sel, ms=250):
        r = await st(pg,f"()=>{{ const e=document.querySelector('{sel}'); if(!e) return null; const b=e.getBoundingClientRect(); return [b.left+b.width/2, b.top+b.height/2]; }}")
        if not r: return False
        await cdp_touch(cdp,"touchStart",[(5,(r[0],r[1]))]); await pg.wait_for_timeout(ms); await cdp_touch(cdp,"touchEnd",[]); await pg.wait_for_timeout(80); return True
    n0 = await st(pg,SHOTS)
    r = await st(pg,"()=>{ const b=document.querySelector('[data-b=fire]').getBoundingClientRect(); return [b.left+b.width/2,b.top+b.height/2]; }")
    await cdp_touch(cdp,"touchStart",[(5,tuple(r))]); await pg.wait_for_timeout(450); n1 = await st(pg,SHOTS); await cdp_touch(cdp,"touchEnd",[])
    check(G,"FIRE button fires", n1>n0, (n0,n1))
    await hold("[data-b=tgt]"); check(G,"TARGET button locks a target", await st(pg,"()=>!!game.mode.target"))
    m0 = await st(pg,"()=>game.mode.player.missiles"); await hold("[data-b=msl]"); check(G,"MSL button fires a missile", await st(pg,"()=>game.mode.player.missiles")==m0-1)
    await pg.evaluate("()=>{ game.mode.player.energy=game.mode.player.st.energyMax; }")
    r = await st(pg,"()=>{ const b=document.querySelector('[data-b=boost]').getBoundingClientRect(); return [b.left+b.width/2,b.top+b.height/2]; }")
    await cdp_touch(cdp,"touchStart",[(5,tuple(r))]); await pg.wait_for_timeout(200); bo = await st(pg,"()=>game.mode.player.boosting"); await cdp_touch(cdp,"touchEnd",[])
    check(G,"BOOST button boosts", bo)
    # two thumbs at once: steer while holding FIRE
    rf = await st(pg,"()=>{ const b=document.querySelector('[data-b=fire]').getBoundingClientRect(); return [b.left+b.width/2,b.top+b.height/2]; }")
    await pg.evaluate("()=>{ game.mode.player.energy=game.mode.player.st.energyMax; }")
    f0 = await st(pg,FWD); n0 = await st(pg,SHOTS)
    await cdp_touch(cdp,"touchStart",[(1,(150,250))]); await cdp_touch(cdp,"touchStart",[(1,(150,250)),(6,tuple(rf))])
    for k in range(1,6): await cdp_touch(cdp,"touchMove",[(1,(150,250-k*12)),(6,tuple(rf))]); await pg.wait_for_timeout(40)
    await pg.wait_for_timeout(300); f1 = await st(pg,FWD); n1 = await st(pg,SHOTS)
    await cdp_touch(cdp,"touchEnd",[])
    check(G,"steer and fire at the same time (multi-touch)", ang(f0,f1)>0.05 and n1>n0, (ang(f0,f1), n0, n1))
    await calm(pg)
    await hold("[data-b=cruise]"); check(G,"CRUISE button engages cruise", await st(pg,"()=>game.mode.cruiseOn")); await hold("[data-b=cruise]")
    v0 = await st(pg,"()=>game.mode.viewMode"); await hold("[data-t=view]"); check(G,"VIEW button cycles the camera", await st(pg,"()=>game.mode.viewMode")==(v0+1)%3)
    await hold("[data-t=map]"); check(G,"MAP button opens the galaxy map", await st(pg,"()=>[game.ui.modal,game.ui.tab]")==['menu','galaxy'])
    await pg.tap(".tabs [data-v=inventory]"); await pg.wait_for_timeout(150); check(G,"tapping a menu tab works", await st(pg,"()=>game.ui.tab")=='inventory')
    await pg.tap("[data-a=close]"); await pg.wait_for_timeout(150); check(G,"tapping ✕ closes the menu", await st(pg,"()=>game.ui.modal") is None)
    await hold("[data-t=bag]"); check(G,"GEAR button opens inventory", await st(pg,"()=>[game.ui.modal,game.ui.tab]")==['menu','inventory'])
    # equip by tapping: tap an inventory item, then its equip button
    await pg.evaluate("()=>{ const it=JSON.parse(JSON.stringify(game.player.equip.engine)); it.id='tst1'; it.name='Test Drive'; game.player.inventory.unshift(it); game.ui.openMenu('inventory'); }"); await pg.wait_for_timeout(150)
    await pg.tap("[data-tip=tst1]"); await pg.wait_for_timeout(150)
    eq = await st(pg,"()=>{ const b=[...document.querySelectorAll('#overlay [data-a=equip]')][0]; return b ? b.dataset.v : null; }")
    if eq: await pg.tap("#overlay [data-a=equip]"); await pg.wait_for_timeout(150)
    check(G,"tap an item then Equip equips it", await st(pg,"()=>game.player.equip.engine && game.player.equip.engine.id==='tst1'"), eq)
    await pg.tap("[data-a=close]"); await pg.wait_for_timeout(150)
    await hold("[data-t=menu]"); check(G,"MENU button pauses", await st(pg,"()=>game.ui.modal")=='pause')
    await pg.tap("text=Resume"); await pg.wait_for_timeout(150); check(G,"tap Resume unpauses", await st(pg,"()=>game.ui.modal") is None)
    await pg.evaluate("()=>{ if(game.ui.modal) game.ui.close(); const s=game.mode, st=s.stations[0]; s.player.pos.copy(st.pos).add(new st.pos.constructor(st.radius+150,0,0)); }"); await pg.wait_for_timeout(200)
    pr = await st(pg,"()=>document.querySelector('#prompt').textContent"); check(G,"dock prompt says USE", pr.startswith('USE · '), pr)
    await hold("[data-b=use]"); await pg.wait_for_timeout(200); check(G,"USE button docks", await st(pg,"()=>game.ui.modal")=='station')
    check(G,"touch controls hide while docked", await st(pg,"()=>getComputedStyle(document.querySelector('#touch')).display")=='none')
    await pg.tap("[data-a=undock]"); await pg.wait_for_timeout(300); check(G,"tap Undock", await st(pg,"()=>game.ui.modal") is None)
    # landing by touch: USE opens the map, tap the map, tap Land
    await pg.evaluate(NEAR_PLANET, 250); await pg.wait_for_timeout(250)
    pr = await st(pg,"()=>document.querySelector('#prompt').textContent"); check(G,"land prompt says USE", pr.startswith('USE · Land on'), pr)
    await hold("[data-b=use]"); await pg.wait_for_timeout(300); check(G,"USE opens the landing map", await st(pg,"()=>game.ui.modal")=='landing')
    box = await pg.locator('#landmap').bounding_box(); await pg.touchscreen.tap(box['x']+box['width']*0.7, box['y']+box['height']*0.3); await pg.wait_for_timeout(150)
    sel = await st(pg,"()=>game.ui.land && game.ui.land.sel"); check(G,"tapping the map moves the landing marker", bool(sel) and sel['x']>120 and sel['z']<-120, sel)
    check(G,"landing map fits the screen", await st(pg,"()=>{ const r=document.querySelector('#overlay .panel').getBoundingClientRect(); const b=[...document.querySelectorAll('#overlay [data-a=landgo]')].pop().getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth+1 && b.width>40; }"))
    await pg.tap("#overlay [data-a=landgo][data-v=sel]"); await pg.wait_for_timeout(200); check(G,"tap Land starts the descent", await st(pg,"()=>game.ui.modal===null && !!game.mode.descent"))
    await pg.wait_for_function(ON_GROUND, timeout=20000); await pg.wait_for_function("()=>!game.mode.intro", timeout=20000)
    check(G,"touchdown finishes on its own", await st(pg,"()=>game.mode.kind==='ground' && !game.mode.intro"))
    p0 = await st(pg,"()=>game.mode.me.pos.toArray()")
    await cdp_touch(cdp,"touchStart",[(1,(150,250))])
    for k in range(1,6): await cdp_touch(cdp,"touchMove",[(1,(150,250-k*12))]); await pg.wait_for_timeout(40)
    await pg.wait_for_timeout(400); await cdp_touch(cdp,"touchEnd",[])
    p1 = await st(pg,"()=>game.mode.me.pos.toArray()"); check(G,"left thumb walks", ((p1[0]-p0[0])**2+(p1[2]-p0[2])**2)**.5>0.5)
    y0 = await st(pg,"()=>game.mode.yaw")
    await cdp_touch(cdp,"touchStart",[(2,(600,200))])
    for k in range(1,6): await cdp_touch(cdp,"touchMove",[(2,(600+k*15,200))]); await pg.wait_for_timeout(40)
    await cdp_touch(cdp,"touchEnd",[]); check(G,"right thumb drag looks", abs(await st(pg,"()=>game.mode.yaw")-y0)>0.05)
    await hold("[data-b=jump]", 80); check(G,"JUMP button jumps", await st(pg,"()=>!game.mode.me.onGround || game.mode.me.velY!==0"))
    await pg.wait_for_timeout(800)
    mg0 = await st(pg,"()=>{ const w=game.mode.ps.weapons[game.mode.wIdx]; return w ? w._mag : null; }")
    await hold("[data-b=fire]", 200); check(G,"FIRE button shoots on foot", mg0 is None or await st(pg,"()=>game.mode.ps.weapons[game.mode.wIdx]._mag")<mg0)
    await hold("[data-b=rel]"); check(G,"RELOAD button reloads", await st(pg,"()=>game.mode.reloading>0 || game.mode.ps.weapons.length===0"))
    await pg.wait_for_timeout(2500)
    fp = await st(pg,"()=>game.mode.fp"); await hold("[data-t=view]"); check(G,"VIEW button toggles first person on foot", await st(pg,"()=>game.mode.fp")!=fp)
    await pg.evaluate("()=>{ game.player.inventory.push({id:'mk3', kind:'medkit', name:'Medkit', tier:0, level:1}); game.mode.me.hp = 10; }")
    await hold("[data-b=heal]"); check(G,"HEAL button uses a medkit", await st(pg,"()=>game.mode.me.hp")>10)
    await pg.evaluate("()=>{ const m=game.mode; m.me.pos.copy(m.exit.pos); }"); await pg.wait_for_timeout(200)
    await hold("[data-b=use]"); await pg.wait_for_timeout(1300); check(G,"USE at the ship takes off", await st(pg,"()=>game.mode.kind")=='space')
    # layout: top buttons must not cover the target panel or each other on a phone
    await spawn_enemy(pg); await hold("[data-b=tgt]"); await pg.wait_for_timeout(200)
    ov = await st(pg,"""()=>{ const a=document.querySelector('#ttop').getBoundingClientRect(), t=document.querySelector('#tpanel'); if(!t||getComputedStyle(t).display==='none') return 'no panel'; const b=t.getBoundingClientRect(); return !(a.right<b.left||a.left>b.right||a.bottom<b.top||a.top>b.bottom); }""")
    await pg.screenshot(path=os.path.join(os.environ.get("TMPDIR", "/tmp"), "starward-touch-phone.png"))
    check(G,"top buttons don't cover the target panel on a phone", ov is False, ov)
    check(G,"no page errors", not errs, errs[:3]); await b.close()

async def main():
    which = sys.argv[1:] or ['kbm','pad','touch']
    async with async_playwright() as p:
        for w in which:
            try: await {'kbm':test_kbm,'pad':test_pad,'touch':test_touch}[w](p)
            except Exception as e: check(w,"test crashed", False, repr(e)[:300])
    fails=[r for r in results if not r[2]]
    print(f"\n{len(results)-len(fails)}/{len(results)} passed")
    for r in fails: print("FAIL", r[0], r[1], r[3])
if __name__ == '__main__': asyncio.run(main())
