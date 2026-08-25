// Chapter 11 — why classic Quake/CS-style "flat" bunny-hopping (jump the
// instant you land, repeat) barely works in SOF, unlike almost every other
// game in this genre. Chapter 10 (SOF vs. Q2) already established PMF_TIME_LAND
// as a real, SOF-specific landing lockout (pmove.c:788-800, corroborated by
// hooks.cpp's _sf_sv_q2_style_jump). This chapter is the payoff: it runs the
// exact real thresholds (-200/-400 u/s, pm_time 18/25) against Chapter 7's own
// jump-arc constants (CH5_JUMP_VELOCITY, CH5_GRAVITY) to show precisely which
// landings dodge the lockout and which never can.
//
// CORRECTION vs. an earlier version of this chapter: pm_time is NOT a tick
// count. It is a byte counted down in units of 8 ms -- Pmove_REAL does
// `msec = cmd.msec >> 3; if (!msec) msec = 1; pm_time -= msec` (verified in
// retail SoF.exe at 0x200549fd, matching pmove.c:1558-1572). So 18 means 144 ms
// nominally, not 18 ticks. The old text said "0.18s", which happens to be right
// at exactly 100 fps and wrong everywhere else -- and it hid the interesting
// part, which is that the `if (!msec) msec = 1` floor makes the lockout SHORTER
// at high framerates. See chainLockoutMs in core/cmdchain.js.

// Vertical velocity the instant you land on ground `h` units above (or below)
// your takeoff point, for a flat CH5_JUMP_VELOCITY launch. Same energy-
// conservation relationship Chapter 7 already uses to decide when you land --
// this just also asks *how fast* you're going at that moment.
// h > 0 (landing above takeoff) is always caught rising (positive velocity):
// the platform intercepts your arc on the way up, before the fall back down
// ever happens. h <= 0 is always caught falling (negative velocity).
function landingVelocity(h) {
  const disc = CH5_JUMP_VELOCITY * CH5_JUMP_VELOCITY - 2 * CH5_GRAVITY * h;
  if (disc < 0) return null; // above the apex -- this jump can never reach it
  const v = Math.sqrt(disc);
  return h > 0 ? v : -v;
}

// The exact real thresholds, pmove.c:792-799, no #ifdef -- identical in the
// leaked Q2 branch too. What actually differs SOF-vs-Q2 (Chapter 10, item 1)
// is whether the check upstream of this ever sees a fast enough number to
// begin with -- in Q2 it usually doesn't, because PM_StepSlideMove already
// overwrote velocity[2] with a slower, ground-clipped value first.
function lockoutTicks(v) {
  if (v === null) return null;
  if (v >= -200) return 0;
  if (v >= -400) return 18;
  return 25;
}

function mountChBhopLockout(section) {
  const stairHeight = 40; // safely under CH5_APEX_HEIGHT (~45.56)
  const stairDisc = CH5_JUMP_VELOCITY * CH5_JUMP_VELOCITY - 2 * CH5_GRAVITY * stairHeight;
  const stairHopTime = (CH5_JUMP_VELOCITY - Math.sqrt(stairDisc)) / CH5_GRAVITY;
  const flatAirtime = (2 * CH5_JUMP_VELOCITY) / CH5_GRAVITY;
  // Lockout at the site-wide 100 fps / 10 ms frame the rest of the course
  // simulates. chainLockoutMs does the real >>3 arithmetic (core/cmdchain.js).
  const SIM_FRAME_MS = CH_FRICTION_FRAMETIME * 1000;
  const flatLockMs = chainLockoutMs(18, SIM_FRAME_MS);
  const flatCycleTime = flatAirtime + flatLockMs / 1000;
  const LOCKOUT_FPS_ROWS = [500, 250, 125, 100, 62.5, 50, 30]
    .map((fps) => {
      const ms = 1000 / fps;
      const step = Math.max(1, Math.floor(ms) >> 3);
      return `<tr>
        <td class="l">${fps} fps</td>
        <td>${ms.toFixed(1)} ms</td>
        <td>${step}</td>
        <td>${Math.ceil(18 / step)}</td>
        <td class="hot">${chainLockoutMs(18, ms).toFixed(0)} ms</td>
        <td>${chainLockoutMs(25, ms).toFixed(0)} ms</td>
      </tr>`;
    })
    .join("");

  section.innerHTML = `
    <div class="chapter-kicker">Chapter 11 · Bunny-Hopping</div>
    <h1>Why chaining flat jumps barely works here</h1>
    <p class="lede">
      In a lot of games in this family, the fastest way to move is to jump the instant you land and
      never stop touching the ground for more than one tick. Chapter 10 already found the reason that
      mostly doesn't work in SOF: a hard landing locks out your next jump. This chapter runs the real
      numbers on exactly when that lockout fires -- and the one loophole around it.
    </p>

    <div class="callout">
      <span class="varname">PM_CatagorizePosition</span> (pmove.c:792-799): the instant you touch
      ground, if your vertical velocity is below <b>&minus;200 u/s</b>, <span class="varname">PMF_TIME_LAND</span>
      is set and <span class="varname">PM_CheckJump</span> refuses to fire until a countdown reaches
      zero -- it starts at <b>18</b>, or <b>25</b> if you were below &minus;400. No
      <code>#ifdef SOF</code> here at all: both engines run this exact check. What differs is whether
      your velocity is ever fast enough to trip it (Chapter 10, item 1).
    </div>

    <div class="mystery">
      <b>Those aren't ticks.</b> The countdown is a single byte measured in units of <b>8 ms</b>,
      and every frame it drops by your frame time in milliseconds divided by 8 -- but never by
      less than 1:
      <div class="formula" style="margin:10px 0 8px">
        msec = cmd.msec &gt;&gt; 3;<br />
        if (!msec) msec = 1;<br />
        if (msec &gt;= pm_time) { clear the flag; pm_time = 0; }<br />
        else pm_time -= msec;
      </div>
      So 18 is <b>144 ms</b> nominally, not 18 ticks. And that <span class="varname">msec = 1</span>
      floor has teeth: once your frame time drops under 8 ms — anything above <b>125 fps</b> — the
      counter can only fall by 1 per frame, so the lockout becomes a fixed <em>18 frames</em> and
      gets shorter in real time the faster you run.
    </div>

    <div class="panel">
      <table class="cvar-table mono">
        <thead>
          <tr>
            <td class="l">your framerate</td>
            <td>frame time</td>
            <td>countdown drops by</td>
            <td>frames to clear 18</td>
            <td>flat-landing lockout</td>
            <td>hard landing (25)</td>
          </tr>
        </thead>
        <tbody>${LOCKOUT_FPS_ROWS}</tbody>
      </table>
    </div>
    <div class="callout good">
      Read the last two columns. Between 50 and 125 fps the lockout wobbles around 144–180 ms and
      framerate buys you nothing. Above 125 fps it falls off a cliff: at 250 fps a flat landing
      costs <b>${chainLockoutMs(18, 4).toFixed(0)} ms</b> instead of
      <b>${chainLockoutMs(18, 8).toFixed(0)} ms</b>. Same code, same landing — the counter simply
      cannot express a step smaller than one, so it spends one per frame however short the frame
      is. It is the only place in this entire course where raw framerate changes the physics.
    </div>

    <h2>Where you land decides everything</h2>
    <p class="muted">
      Same launch as Chapter 7 -- 270 u/s up, 800 u/s² gravity pulling back down. Drag the slider to
      pick a landing height and watch the vertical landing speed and resulting lockout, computed live
      from that exact arc.
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 260px">
          <div class="control-row">
            <label><span>① where you land</span><span id="bh-land-val">0u</span></label>
            <input type="range" id="bh-land" min="-150" max="40" step="5" value="0" />
            <p class="muted" style="font-size:12px;margin:2px 0 0" id="bh-land-desc">flat ground</p>
          </div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">VERTICAL SPEED AT LANDING</span><span class="v" id="bh-vel">—</span></div>
            <div class="hud-stat warn"><span class="k">NEXT JUMP LOCKED FOR</span><span class="v" id="bh-lock" style="font-size:15px">—</span></div>
          </div>
        </div>
        <div class="panel-col" style="flex:1 1 420px">
          <canvas class="scene" id="bh-graph" style="height:300px"></canvas>
          <p class="muted" style="margin:6px 0 0">The <span class="varname">pm_time</span> value set on landing, for every landing height from a full drop up to the apex. Multiply by 8 ms for the nominal wait, or read it off the framerate table above.</p>
        </div>
      </div>
    </div>

    <div class="callout good">
      <b>The rule falls out cleanly:</b> land on anything <em>above</em> your takeoff point (up to the
      ~${Math.round(CH5_APEX_HEIGHT)}u apex) and you're always still <em>rising</em> when you touch down --
      positive vertical velocity can never be below &minus;200, so the check structurally can't fire.
      Land at or below your takeoff height -- flat ground, a step down, a ledge -- and you're always
      falling. A perfectly flat jump lands at exactly &minus;270 u/s every single time, by the same
      energy conservation Chapter 7 already uses, which is comfortably past &minus;200. <b>There is no
      way to make a flat, same-height jump in SOF that skips the lockout.</b> Stepping <em>up</em> is the
      only loophole.
    </div>

    <h2>What that's actually worth</h2>
    <p class="muted">Real numbers, same 270/800 constants, five jumps each:</p>
    <div class="panel">
      <div class="panel-row" style="gap:24px;flex-wrap:wrap">
        <div class="panel-col" style="flex:1 1 220px">
          <div style="font-family:var(--mono);font-size:12px;color:var(--text-dim)">FLAT-GROUND HOPPING</div>
          <div style="font-size:22px;margin:4px 0"><span class="varname">${flatAirtime.toFixed(3)}s</span> flight + <span class="varname">${(flatLockMs / 1000).toFixed(3)}s</span> locked out</div>
          <div class="muted" style="font-size:12px">lockout shown at 100 fps — see the table above</div>
          <div class="muted">= ${flatCycleTime.toFixed(3)}s per hop → ${(5 * flatCycleTime).toFixed(2)}s for 5 hops</div>
        </div>
        <div class="panel-col" style="flex:1 1 220px">
          <div style="font-family:var(--mono);font-size:12px;color:var(--text-dim)">HOPPING UP A ${stairHeight}u STAIRCASE</div>
          <div style="font-size:22px;margin:4px 0"><span class="varname">${stairHopTime.toFixed(3)}s</span> flight, no lockout</div>
          <div class="muted">= ${stairHopTime.toFixed(3)}s per hop → ${(5 * stairHopTime).toFixed(2)}s for 5 hops</div>
        </div>
      </div>
    </div>
    <div class="callout">
      Roughly <b>${(flatCycleTime / stairHopTime).toFixed(1)}×</b> faster hop cadence (at 100 fps), purely from
      landing on rising ground instead of flat ground. This is why SOF (and real Quake/Half-Life
      level design generally) rewards stairs, ramps, and ledges for hop-chaining, while flat-ground
      bunny-hopping the way Half-Life or CS players know it barely exists here at all -- it's not a
      skill issue, it's <span class="varname">PMF_TIME_LAND</span> doing exactly what it was written to do.
    </div>

    <div class="mystery">
      <strong>Note what this chapter isn't:</strong> a single long strafe-jump (Chapter 7) never
      touches any of this -- you only land once, at the very end. The lockout only matters once you
      try to <em>chain</em> jumps, landing and leaving the ground over and over. Chapter 7's whole
      subject -- turning speed, air-strafe gain -- is exactly as strong either way; this chapter is
      about how often you get to restart the clock on a fresh launch.
    </div>

    <a class="next-link" href="#ch-cvars">Continue → Chapter 12: cl_forwardspeed &amp; cl_sidespeed</a>
  `;

  const graphCanvas = section.querySelector("#bh-graph");
  const gctx = graphCanvas.getContext("2d");
  const landInput = section.querySelector("#bh-land");
  const landVal = section.querySelector("#bh-land-val");
  const landDesc = section.querySelector("#bh-land-desc");
  const velEl = section.querySelector("#bh-vel");
  const lockEl = section.querySelector("#bh-lock");

  function resizeGraph() {
    const rect = graphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    graphCanvas.width = rect.width * dpr;
    graphCanvas.height = rect.height * dpr;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawGraph(currentH) {
    resizeGraph();
    const rect = graphCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const padL = 40, padR = 16, padT = 16, padB = 30;
    gctx.fillStyle = "#0b0f0c";
    gctx.fillRect(0, 0, w, h);

    const minH = -150, maxH = 40;
    const xOf = (hv) => padL + ((hv - minH) / (maxH - minH)) * (w - padL - padR);
    const maxTicks = 25;
    const yOf = (ticks) => h - padB - (ticks / maxTicks) * (h - padT - padB);

    gctx.strokeStyle = "rgba(255,255,255,0.2)";
    gctx.beginPath();
    gctx.moveTo(padL, padT);
    gctx.lineTo(padL, h - padB);
    gctx.lineTo(w - padR, h - padB);
    gctx.stroke();

    gctx.font = "11px monospace";
    gctx.fillStyle = "#8fa89a";
    gctx.textAlign = "left";
    [0, 18, 25].forEach((v) => {
      const y = yOf(v);
      gctx.strokeStyle = "rgba(255,255,255,0.06)";
      gctx.beginPath();
      gctx.moveTo(padL, y);
      gctx.lineTo(w - padR, y);
      gctx.stroke();
      gctx.fillText(String(v), 6, y + 4);
    });
    for (let hv = -150; hv <= 40; hv += 30) {
      gctx.fillText(hv + "u", xOf(hv) - 10, h - padB + 16);
    }

    // step curve across landing heights
    gctx.strokeStyle = "#7dffb0";
    gctx.lineWidth = 2.5;
    gctx.beginPath();
    let started = false;
    for (let hv = minH; hv <= maxH; hv += 1) {
      const v = landingVelocity(hv);
      const ticks = lockoutTicks(v);
      if (ticks === null) continue;
      const x = xOf(hv), y = yOf(ticks);
      if (!started) {
        gctx.moveTo(x, y);
        started = true;
      } else gctx.lineTo(x, y);
    }
    gctx.stroke();

    // current-selection marker
    const v = landingVelocity(currentH);
    const ticks = lockoutTicks(v);
    if (ticks !== null) {
      const cx = xOf(currentH), cy = yOf(ticks);
      gctx.fillStyle = "#eafff2";
      gctx.beginPath();
      gctx.arc(cx, cy, 5, 0, Math.PI * 2);
      gctx.fill();
      gctx.strokeStyle = "#0b0f0c";
      gctx.lineWidth = 2;
      gctx.stroke();
    }

    gctx.textAlign = "center";
    gctx.fillStyle = "#8fa89a";
    gctx.fillText("→ landing height (0 = takeoff height)", (padL + w - padR) / 2, h - 4);
    gctx.save();
    gctx.translate(12, (padT + h - padB) / 2);
    gctx.rotate(-Math.PI / 2);
    gctx.fillText("pm_time set on landing ↑", 0, 0);
    gctx.restore();
    gctx.textAlign = "left";
  }

  function describeLanding(hv) {
    if (hv === 0) return "flat ground -- lands at exactly the fastest a flat jump can fall";
    if (hv < 0) return `dropping ${-hv}u below takeoff -- falls even faster`;
    return `landing ${hv}u up -- caught mid-rise, before the fall ever happens`;
  }

  function render() {
    const hv = +landInput.value;
    landVal.textContent = (hv > 0 ? "+" : "") + hv + "u";
    landDesc.textContent = describeLanding(hv);
    const v = landingVelocity(hv);
    const ticks = lockoutTicks(v);
    velEl.textContent = v === null ? "unreachable" : v.toFixed(0) + " u/s";
    lockEl.textContent =
      ticks === null
        ? "—"
        : ticks === 0
          ? "not locked"
          : `pm_time ${ticks} → ${chainLockoutMs(ticks, SIM_FRAME_MS).toFixed(0)} ms @100fps`;
    drawGraph(hv);
  }

  landInput.addEventListener("input", render);
  window.addEventListener("resize", render);
  render();
}
