// Chapter 13 -- ground strafing: beating pm_maxspeed on flat ground, with both
// feet down and the mouse held perfectly still.
//
// Every chapter up to here has treated 300 as the floor's hard ceiling and
// jumping as the only way past it. That's wrong, and the reason is already on
// screen in Chapter 4: PM_Accelerate never compares your SPEED to wishspeed --
// it compares DotProduct(velocity, wishdir), the part of your speed that
// points where you're pushing. Hold W and those are the same number, so 300 is
// a real wall. Tap A / D / A / D with W held and they aren't: the sideways
// halves cancel each other out every other tick, so your route stays straight
// while the push stays ~40 degrees off it, and the dot product never catches
// up to 300.
//
// Nothing new is modelled here. Every number on the page comes out of the same
// pmGroundFriction + pmAccelerateSteps pair the rest of the site runs, and the
// key angles come out of cmdChain (Chapter 12) -- because which angle your keys
// ask for is exactly what cl_forwardspeed/cl_sidespeed decide.
//
// Two results worth flagging, both computed live below rather than asserted:
//   - the ceiling is boost-per-tick / friction-per-tick, aimed forward:
//     (pm_accelerate * pm_maxspeed) / pm_friction * cos(angle) = 500*cos(angle).
//     The tick length cancels out of both halves, so unlike the landing lockout
//     (Chapter 11) this is genuinely framerate-proof.
//   - tapping keys with a frozen mouse settles at 383 u/s, and turning the
//     mouse perfectly to hold chainBestAngle every tick also settles at 383.
//     The ceiling is set by friction, not by technique.

const GS_FRAMETIME = 0.01; // 100 ticks/sec, matches every other chapter
const GS_WINDOW = 2.5; // seconds drawn in the speed graph
const GS_SETTLE_TICKS = 400; // 4s -- long past where any of these stop moving

// Flat ground, running, mouse never moves. The view stays pointed down +x the
// whole time; only the SIGN of the side key flips, every swapTicks ticks.
// swapTicks = Infinity means "hold the same two keys down forever".
function gsRun(angleDeg, swapTicks, push, ticks) {
  const th = (angleDeg * Math.PI) / 180;
  const v = [0, 0, 0];
  const fwd = [0];
  const spd = [0];
  let y = 0;
  let wander = 0;

  for (let t = 0; t < ticks; t++) {
    const sgn = swapTicks === Infinity ? 1 : Math.floor(t / swapTicks) % 2 === 0 ? 1 : -1;
    const wishdir = [Math.cos(th), sgn * Math.sin(th), 0];

    // exact real tick order: last tick's speed is taxed first, then this
    // tick's push is added on top (pmove.c:1540-1542)
    pmGroundFriction(v, GS_FRAMETIME);
    const acc = pmAccelerateSteps(v, wishdir, push, pm_accelerate, GS_FRAMETIME);
    while (!acc.next().done) {}

    y += v[1] * GS_FRAMETIME;
    if (Math.abs(y) > wander) wander = Math.abs(y);
    fwd.push(v[0]);
    spd.push(Math.hypot(v[0], v[1]));
  }

  return {
    fwd, // speed towards where you're looking, per tick
    spd, // what a speed meter would read, per tick
    forward: v[0],
    speed: Math.hypot(v[0], v[1]),
    wander, // furthest your route ever strays sideways, in units
  };
}

// Settled forward speed only -- the sweep needs thousands of these.
function gsSettled(angleDeg, swapTicks, push) {
  return gsRun(angleDeg, swapTicks, push, GS_SETTLE_TICKS).forward;
}

// The stock SOF config, run through Chapter 12's five-step chain. Both the
// angle the keys ask for and the push they end up with come from there.
const GS_STOCK = cmdChain(200, 160);
const GS_STOCK_ANGLE = Math.abs(GS_STOCK.keyAngle) * (180 / Math.PI);

// Best key angle, searched rather than asserted: 1 degree steps, then a fine
// pass either side of the winner.
const GS_BEST = (() => {
  let best = { angle: 0, speed: 0 };
  const test = (a) => {
    const s = gsSettled(a, 1, pm_maxspeed);
    if (s > best.speed) best = { angle: a, speed: s };
  };
  for (let a = 0; a <= 80; a += 1) test(a);
  const coarse = best.angle;
  for (let a = coarse - 1; a <= coarse + 1; a += 0.1) if (a >= 0) test(a);
  return best;
})();

// Jumping, for the honest comparison at the end: flat ground, SOF rules, the
// landing lockout in play -- Chapter 11's own model, run with and without
// strafing during the grounded part of each cycle.
const GS_JUMP_OPTS = {
  frametime: GS_FRAMETIME,
  gravity: CH7_GRAVITY,
  jumpVelocity: CH7_JUMP_VELOCITY,
  airMode: "track",
};
const GS_JUMP_STRAFE = chainGroundCycles(pm_maxspeed, 40, { ...GS_JUMP_OPTS, groundStrafe: true }).terminal;
const GS_JUMP_HOLDW = chainGroundCycles(pm_maxspeed, 40, { ...GS_JUMP_OPTS, groundStrafe: false }).terminal;

function mountChGroundstrafe(section) {
  const stockTap = gsSettled(GS_STOCK_ANGLE, 1, GS_STOCK.push);
  const stockHold = gsRun(GS_STOCK_ANGLE, Infinity, GS_STOCK.push, GS_SETTLE_TICKS);
  const holdW = gsSettled(0, Infinity, GS_STOCK.push);

  // how much sooner you cross 1000 units, tapping vs holding W
  const crossTime = (angle, swap) => {
    const r = gsRun(angle, swap, GS_STOCK.push, 1200);
    let x = 0;
    for (let i = 1; i < r.fwd.length; i++) {
      x += r.fwd[i] * GS_FRAMETIME;
      if (x >= 1000) return i * GS_FRAMETIME;
    }
    return NaN;
  };
  const crossHold = crossTime(0, Infinity);
  const crossTap = crossTime(GS_STOCK_ANGLE, 1);

  const presets = CVAR_PRESETS.map((p) => {
    const c = cmdChain(p.fwd, p.side);
    const deg = Math.abs(c.keyAngle) * (180 / Math.PI);
    const tap = gsSettled(deg, 1, c.push);
    const hold = gsSettled(0, Infinity, c.push);
    const pct = ((tap - hold) / hold) * 100;
    return { ...p, deg, push: c.push, tap, hold, pct };
  });
  // Chapter 12's own searched winner, measured on the floor instead of in the air.
  const cvarBestDeg = Math.abs(CVAR_BEST.chain.keyAngle) * (180 / Math.PI);
  const cvarBestHold = gsSettled(0, Infinity, CVAR_BEST.chain.push);
  const cvarBestGain = ((gsSettled(cvarBestDeg, 1, CVAR_BEST.chain.push) - cvarBestHold) / cvarBestHold) * 100;
  const presetRows = presets
    .map(
      (p) => `<tr>
      <td class="l">${p.label}</td>
      <td>${p.deg.toFixed(1)}°</td>
      <td>${p.push.toFixed(0)}</td>
      <td>${p.hold.toFixed(0)}</td>
      <td class="hot">${p.tap.toFixed(0)}</td>
      <td>${p.pct < 0.5 ? "—" : "+" + p.pct.toFixed(0) + "%"}</td>
    </tr>`
    )
    .join("");

  section.innerHTML = `
    <div class="chapter-kicker">Chapter 13 · Running Without Jumping</div>
    <h1>You can break the speed limit with both feet on the floor</h1>
    <p class="lede">
      Every chapter so far has treated 300 as the ground's hard ceiling, and jumping as the only way
      past it. It isn't. Hold forward, tap left–right–left–right, never touch the mouse, and you run
      about a quarter faster than holding forward alone — flat ground, no jump, no trick timing.
    </p>

    <h2>Three ways to run at the same wall</h2>
    <p class="muted">
      Same flat ground, same stock config (${GS_STOCK.cmd.f}/${GS_STOCK.cmd.s} after Chapter 12's five
      steps, asking for a ${GS_STOCK_ANGLE.toFixed(1)}° angle), same code. Only the keys differ. The
      number that matters is speed <em>towards where you're looking</em> — not what a speed meter reads.
    </p>
    <div class="panel">
      <div class="hud">
        <div class="hud-stat"><span class="k">HOLD FORWARD</span><span class="v">${holdW.toFixed(0)}</span></div>
        <div class="hud-stat"><span class="k">HOLD FORWARD + RIGHT</span><span class="v">${stockHold.forward.toFixed(0)}</span></div>
        <div class="hud-stat warn"><span class="k">TAP LEFT / RIGHT</span><span class="v">${stockTap.toFixed(0)}</span></div>
        <div class="hud-stat"><span class="k">1000 UNITS TAKES</span><span class="v">${crossTap.toFixed(2)}s <span style="color:var(--text-dim);font-size:13px">vs ${crossHold.toFixed(2)}s</span></span></div>
      </div>
    </div>
    <div class="callout good">
      Holding both keys is a trap. Your meter still says <b>${stockHold.speed.toFixed(0)}</b> — the same
      as holding forward — but you're now travelling off at ${GS_STOCK_ANGLE.toFixed(0)}°, so only
      <b>${stockHold.forward.toFixed(0)}</b> of it goes where you're pointed. Tapping the two keys
      alternately, instead of holding one, is worth <b>${(stockTap - holdW).toFixed(0)} u/s</b> of real
      progress and gets you 1000 units away <b>${(crossHold - crossTap).toFixed(2)}s</b> sooner.
    </div>

    <h2>Why tapping works and holding doesn't</h2>
    <p class="muted">
      The whole answer is the two highlighted lines — the same two Chapter 4 stepped through.
    </p>
    <div class="panel">
      ${renderStatic(C_ACCELERATE, [412, 413, 414, 415])}
    </div>
    <div class="callout">
      The game never asks <em>"is he going faster than 300?"</em>. It asks <em>"of the speed he already
      has, how much of it points the way he's pushing?"</em> — and only that part counts against the
      limit. Push sideways-ish and the answer stays small even when you're doing 380.
    </div>
    <p>
      So why doesn't <b>holding</b> forward+right do it? Your route swings round to follow the push.
      Give it half a second and you're travelling exactly where you're pushing, so the two numbers
      match again and you're back to 300, just aimed off to one side. Tapping the <em>other</em> key
      flips the push before your route can finish swinging — each tap undoes the last one's drift, so
      your route stays straight while the push stays off to one side. The two numbers never meet.
    </p>

    <h2>Try it</h2>
    <p class="muted">
      Left: speed towards where you're looking, tick by tick. Right: where the swap rate you picked
      tops out, at every possible key angle. One tick here is 10&nbsp;ms (100&nbsp;fps).
    </p>
    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 250px">
          <div class="control-row">
            <label><span>① swap keys every</span><span id="gs-swap-val">1 tick</span></label>
            <input type="range" id="gs-swap" min="1" max="24" step="1" value="1" />
          </div>
          <div class="control-row">
            <label><span>② key angle</span><span id="gs-angle-val">—</span></label>
            <input type="range" id="gs-angle" min="0" max="80" step="0.5" value="${GS_STOCK_ANGLE.toFixed(1)}" />
            <p class="muted" style="font-size:12px;margin:2px 0 0">set by your two cvars, not your mouse</p>
          </div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat warn"><span class="k">TOP SPEED, TAPPING</span><span class="v" id="gs-top">—</span></div>
            <div class="hud-stat"><span class="k">SIDEWAYS WEAVE</span><span class="v" id="gs-wander">—</span></div>
          </div>
          <p class="muted" style="font-size:12.5px;margin:4px 0 0">
            Swap slowly enough and your route has time to swing round between taps — the gain collapses
            back towards 300.
          </p>
        </div>
        <div class="panel-col" style="flex:1 1 300px;min-width:280px">
          <canvas class="scene" id="gs-speed" style="height:300px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#ffd166"></span>tap left / right</span>
            <span><span class="swatch" style="background:#5fb4ff"></span>hold forward</span>
            <span><span class="swatch" style="background:#8fa89a"></span>hold both</span>
          </div>
        </div>
        <div class="panel-col" style="flex:1 1 300px;min-width:280px">
          <canvas class="scene" id="gs-curve" style="height:300px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#7dffb0"></span>top speed vs key angle</span>
          </div>
        </div>
      </div>
    </div>

    <div class="callout">
      <b>Where the ceiling comes from.</b> Each tick the push hands you a fixed chunk of speed
      (<span class="varname">pm_accelerate</span> 10 × 300 × tick = 30 u/s at 100&nbsp;fps), and friction
      takes back a fixed <em>share</em> of whatever you're already doing
      (<span class="varname">pm_friction</span> 6 × tick = 6%). They balance when 6% of your speed equals
      the part of the chunk pointing forward:
      <div class="mono" style="margin:10px 0 6px;color:var(--accent);font-size:14.5px">
        top speed = 10 × 300 ÷ 6 × cos(angle) = 500 × cos(angle)
      </div>
      The tick length cancels out of both halves, so — unlike the landing lockout in Chapter 11 — this
      number is the same at 20&nbsp;fps and at 250&nbsp;fps. That formula holds down to about
      <b>${GS_BEST.angle.toFixed(0)}°</b>; push any straighter than that and the game starts trimming
      the chunk before it reaches you, which is the roll-over on the right-hand curve. The peak sits at
      <b>${GS_BEST.angle.toFixed(0)}° → ${GS_BEST.speed.toFixed(0)} u/s</b>.
    </div>

    <h2>Your config already chose your top speed</h2>
    <p class="muted">
      Chapter 12 showed the two cvars only buy an angle. This is what that angle is worth standing on
      the floor — same presets, run through the same chain.
    </p>
    <div class="panel">
      <table class="cvar-table">
        <thead>
          <tr>
            <td class="l">config</td><td>key angle</td><td>push</td>
            <td>hold forward</td><td>tapping</td><td>gain</td>
          </tr>
        </thead>
        <tbody>${presetRows}</tbody>
      </table>
    </div>
    <div class="callout good">
      The stock ${GS_STOCK.typed.f}/${GS_STOCK.typed.s} lands on ${GS_STOCK_ANGLE.toFixed(1)}°, which is
      within a degree and a half of the best angle there is (${GS_BEST.angle.toFixed(0)}°). Nobody tuned
      it for this — it falls out of the 200 and 160 trims in Chapter 12 by accident.
    </div>
    <div class="mystery">
      <strong>And here the two chapters disagree.</strong> Chapter 12's searched winner —
      <b>${CVAR_BEST.fwd}/${CVAR_BEST.side}</b>, the widest angle you can buy without losing top speed
      anywhere, best in the air because it puts your crosshair nearest your real route — is the
      <b>worst</b> config on this page. At ${cvarBestDeg.toFixed(1)}° it is past the point where
      500&nbsp;×&nbsp;cos runs out, so on the floor it is worth
      ${cvarBestGain < 0.5 ? "nothing at all" : "only +" + cvarBestGain.toFixed(0) + "%"}.
      Wide angles buy air speed; angles near ${GS_BEST.angle.toFixed(0)}° buy ground speed. No single
      pair of numbers wins both, so pick for the map you actually play.
    </div>

    <h2>So is jumping even worth it?</h2>
    <p>
      On flat ground, barely. Chapter 11's landing lockout glues you to the floor after every hop, and
      Chapter 6's friction bills you 6% a tick the whole time you're stuck there. Run the full hop
      cycle and it settles at <b>${GS_JUMP_STRAFE.toFixed(0)} u/s</b> — against
      <b>${GS_BEST.speed.toFixed(0)} u/s</b> for never leaving the ground at all.
    </p>
    <div class="callout">
      And that ${GS_JUMP_STRAFE.toFixed(0)} is only reachable because you keep strafing through the
      lockout. Hold plain forward during those grounded ticks instead and the whole hopping chain
      collapses to <b>${GS_JUMP_HOLDW.toFixed(0)}</b> — friction eats the entire flight's winnings
      before you can jump again. On flat ground the tapping is doing nearly all the work; the jump is
      worth about ${(((GS_JUMP_STRAFE - GS_BEST.speed) / GS_BEST.speed) * 100).toFixed(0)}%.
    </div>
    <div class="callout" style="margin-top:14px">
      <b>Two honest catches.</b> A tick where <em>both</em> side keys are down, or neither, is a plain
      forward tick — over 300 that does nothing but pay friction, so sloppy tapping lands well short of
      ${GS_BEST.speed.toFixed(0)}. And the swap has to be faster than your route can
      swing: at 20&nbsp;fps that means every single frame, so this is one more thing that quietly gets
      easier the higher your framerate.
    </div>

    <a class="next-link" href="#ch-zigzag">Continue → Chapter 14: flying the zig-zag</a>
  `;

  const speedCanvas = section.querySelector("#gs-speed");
  const curveCanvas = section.querySelector("#gs-curve");
  const sctx = speedCanvas.getContext("2d");
  const cctx = curveCanvas.getContext("2d");
  const swapInput = section.querySelector("#gs-swap");
  const angleInput = section.querySelector("#gs-angle");
  const swapVal = section.querySelector("#gs-swap-val");
  const angleVal = section.querySelector("#gs-angle-val");
  const topEl = section.querySelector("#gs-top");
  const wanderEl = section.querySelector("#gs-wander");

  const MAX_Y = 420;

  // One whole angle sweep costs ~150ms, and the angle slider doesn't change it
  // -- only the swap rate does. Cache per swap rate so dragging stays smooth.
  const curveCache = new Map();
  function curveFor(swap) {
    let hit = curveCache.get(swap);
    if (hit) return hit;
    const curve = [];
    let peak = { a: 0, v: 0 };
    for (let a = 0; a <= 80; a += 1) {
      const v = gsSettled(a, swap, GS_STOCK.push);
      if (v > peak.v) peak = { a, v };
      curve.push([a, v]);
    }
    hit = { curve, peak };
    curveCache.set(swap, hit);
    return hit;
  }

  function fit(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return rect;
  }

  function axes(ctx, w, h, pad, xTicks, yTicks, xLabel) {
    ctx.fillStyle = "#0b0f0c";
    ctx.fillRect(0, 0, w, h);
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    for (const yt of yTicks) {
      const y = pad.yOf(yt);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = "#8fa89a";
      ctx.fillText(String(yt), 5, y + 4);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, h - pad.b);
    ctx.lineTo(w - pad.r, h - pad.b);
    ctx.stroke();
    ctx.fillStyle = "#8fa89a";
    ctx.textAlign = "center";
    for (const xt of xTicks) ctx.fillText(xt.label, pad.xOf(xt.at), h - pad.b + 16);
    ctx.fillText(xLabel, (pad.l + w - pad.r) / 2, h - 3);
    ctx.textAlign = "left";
  }

  function polyline(ctx, pts, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }

  function drawSpeed(angle, swap) {
    const rect = fit(speedCanvas, sctx);
    const w = rect.width;
    const h = rect.height;
    const pad = { l: 42, r: 12, t: 14, b: 32 };
    pad.xOf = (t) => pad.l + (t / GS_WINDOW) * (w - pad.l - pad.r);
    pad.yOf = (v) => h - pad.b - (v / MAX_Y) * (h - pad.t - pad.b);

    const ticks = Math.round(GS_WINDOW / GS_FRAMETIME);
    const tap = gsRun(angle, swap, GS_STOCK.push, ticks);
    const fwdOnly = gsRun(0, Infinity, GS_STOCK.push, ticks);
    const both = gsRun(angle, Infinity, GS_STOCK.push, ticks);

    axes(
      sctx,
      w,
      h,
      pad,
      [0, 0.5, 1, 1.5, 2, 2.5].map((t) => ({ at: t, label: t.toFixed(1) + "s" })),
      [0, 100, 200, 300, 400],
      "speed towards where you're looking"
    );

    const toPts = (series) => series.map((v, i) => [pad.xOf(i * GS_FRAMETIME), pad.yOf(v)]);
    polyline(sctx, toPts(both.fwd), "#8fa89a", 2);
    polyline(sctx, toPts(fwdOnly.fwd), "#5fb4ff", 2);
    polyline(sctx, toPts(tap.fwd), "#ffd166", 2.5);

    // the 300 line everyone thinks is a wall
    sctx.strokeStyle = "rgba(255,107,107,0.55)";
    sctx.setLineDash([5, 5]);
    sctx.beginPath();
    sctx.moveTo(pad.l, pad.yOf(300));
    sctx.lineTo(w - pad.r, pad.yOf(300));
    sctx.stroke();
    sctx.setLineDash([]);
    sctx.fillStyle = "rgba(255,107,107,0.8)";
    sctx.fillText("300", w - pad.r - 26, pad.yOf(300) - 5);

    return tap;
  }

  function drawCurve(angle, swap) {
    const rect = fit(curveCanvas, cctx);
    const w = rect.width;
    const h = rect.height;
    const pad = { l: 42, r: 12, t: 14, b: 32 };
    pad.xOf = (a) => pad.l + (a / 80) * (w - pad.l - pad.r);
    pad.yOf = (v) => h - pad.b - (v / MAX_Y) * (h - pad.t - pad.b);

    axes(
      cctx,
      w,
      h,
      pad,
      [0, 20, 40, 60, 80].map((a) => ({ at: a, label: a + "°" })),
      [0, 100, 200, 300, 400],
      "how far off your route the keys push"
    );

    const { curve, peak } = curveFor(swap);
    polyline(cctx, curve.map(([a, v]) => [pad.xOf(a), pad.yOf(v)]), "#7dffb0", 2.5);

    const here = gsSettled(angle, swap, GS_STOCK.push);
    cctx.strokeStyle = "rgba(255,209,102,0.7)";
    cctx.setLineDash([4, 4]);
    cctx.beginPath();
    cctx.moveTo(pad.xOf(angle), pad.yOf(here));
    cctx.lineTo(pad.xOf(angle), h - pad.b);
    cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = "#ffd166";
    cctx.beginPath();
    cctx.arc(pad.xOf(angle), pad.yOf(here), 4, 0, Math.PI * 2);
    cctx.fill();
    cctx.textAlign = angle > 55 ? "right" : "left";
    cctx.fillText(here.toFixed(0) + " u/s", pad.xOf(angle) + (angle > 55 ? -8 : 8), pad.yOf(here) - 8);
    cctx.textAlign = "left";

    cctx.fillStyle = "rgba(125,255,176,0.75)";
    cctx.fillText("best " + peak.a + "° → " + peak.v.toFixed(0), pad.l + 8, pad.t + 12);
  }

  function draw() {
    const angle = +angleInput.value;
    const swap = +swapInput.value;
    swapVal.textContent = swap === 1 ? "1 tick" : swap + " ticks";
    angleVal.textContent = angle.toFixed(1) + "°";

    const tap = drawSpeed(angle, swap);
    drawCurve(angle, swap);

    const settled = gsSettled(angle, swap, GS_STOCK.push);
    topEl.textContent = settled.toFixed(0) + " u/s";
    wanderEl.textContent = tap.wander.toFixed(1) + " units";
  }

  swapInput.addEventListener("input", draw);
  angleInput.addEventListener("input", draw);
  window.addEventListener("resize", draw);
  draw();
}
