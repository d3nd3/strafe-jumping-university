// Chapter 12 -- cl_forwardspeed / cl_sidespeed. Every simulator on this site
// so far hardcodes forwardmove=400, sidemove=400 (a maxed-out diagonal) --
// none of them model what these two client cvars actually do. PM_AirMove
// reads pm->cmd.forwardmove/sidemove directly (pmove.c:612-613, 624), and
// those are exactly cl_forwardspeed/cl_sidespeed while the matching key is
// held. This chapter is the two mechanisms that fall out of that: the
// diagonal's ANGLE (which interacts with Chapter 7's theta_min law) and its
// MAGNITUDE (which interacts with the wishspeed clamp feeding PM_Accelerate).

// theta_min from Chapter 7, generalized: Chapter 7 always fed PM_Accelerate
// a maxed-out wishspeed (400/400 diagonal, clamped to 300), so it wrote the
// law as acos(300/v). The real law -- straight out of PM_Accelerate's own
// addspeed = wishspeed - currentspeed -- is acos(wishspeed/v), for whatever
// wishspeed YOUR cl_forwardspeed/cl_sidespeed actually produce. Below your
// own wishspeed, any angle gains (matches Chapter 7 exactly when wishspeed
// happens to be 300). Verified against pmAccelerateSteps directly: at
// v=300, wishspeed=212.1 (a 150/150 diagonal), every angle under ~45.0°
// yields accelspeed EXACTLY 0 -- not reduced, zero -- because addspeed goes
// negative.
function cvarThetaMin(v, wishspeed) {
  if (wishspeed >= v) return 0; // still below your own cap -- any angle gains
  return Math.acos(wishspeed / v);
}

// Solve cvarThetaMin(v, wishspeed) = angleRad for v: the highest chain speed
// a fixed keyboard diagonal still clears on its own, zero mouse input.
function cvarCrossoverSpeed(angleRad, wishspeed) {
  const c = Math.cos(angleRad);
  if (c <= 0) return Infinity; // angle >= 90 deg never runs out
  return wishspeed / c;
}

function cvarAnalyze(fwd, side) {
  const angle = Math.atan2(side, fwd); // radians, off view-forward
  const rawMag = Math.hypot(fwd, side);
  const wishspeed = Math.min(rawMag, pm_maxspeed); // PM_AirMove's clamp, pmove.c:647
  const accelspeed = pm_airaccelerate * CH_FRICTION_FRAMETIME * wishspeed; // pmove.c:430
  const crossover = cvarCrossoverSpeed(angle, wishspeed);
  return { angle, rawMag, wishspeed, accelspeed, crossover };
}

// One real tick of PM_Accelerate, isolated: current speed v pointed along
// +x, wishdir at world angle phiDeg away from it, target wishspeedMag. Used
// below to show the actual accelspeed PM_Accelerate produces at a few flick
// angles -- not a formula, the real generator function.
function cvarOneTickAccel(v, wishspeedMag, phiDeg) {
  const velocity = [v, 0, 0];
  const phi = (phiDeg * Math.PI) / 180;
  const wishdir = [Math.cos(phi), Math.sin(phi), 0];
  const gen = pmAccelerateSteps(velocity, wishdir, wishspeedMag, pm_airaccelerate, CH_FRICTION_FRAMETIME);
  let r;
  do {
    r = gen.next();
  } while (!r.done);
  return r.value.accelspeed;
}

const CVAR_PRESETS = [
  { label: "SOF default", fwd: 200, side: 160 },
  { label: "your config", fwd: 150, side: 170 },
  { label: "1:1, under cap", fwd: 150, side: 150 },
  { label: "1:1, over cap", fwd: 400, side: 400 },
];

function mountChCvars(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 12 · cl_forwardspeed &amp; cl_sidespeed</div>
    <h1>Your keybinds already set an angle</h1>
    <p class="lede">
      Every simulator so far in this site holds both movement keys at their maximum, 400 units --
      it never asked what happens with real config values. <span class="varname">PM_AirMove</span>
      builds <span class="varname">wishvel</span> straight out of two client cvars, and holding
      forward+strafe together doesn't give you 45° by default. It gives you whatever angle those
      two numbers say.
    </p>

    <div class="panel">
      ${renderStatic(C_AIR_MOVE, [612, 613, 624, 630, 647])}
    </div>

    <div class="callout">
      <span class="varname">fmove</span> is <span class="varname">cl_forwardspeed</span> while W is
      held, <span class="varname">smove</span> is <span class="varname">cl_sidespeed</span> while
      A/D is held (pmove.c:612-613). Hold both and <span class="varname">wishvel</span> is the
      diagonal sum of the two (pmove.c:624) -- its direction off your view axis is
      <span class="varname">atan2(smove, fmove)</span>, and its length gets clamped to
      <span class="varname">pm_maxspeed</span> (300) right there at pmove.c:647, before it's ever
      handed to <span class="varname">PM_Accelerate</span>.
    </div>

    <h2>Two numbers, two completely separate jobs</h2>
    <p class="muted">Drag either slider, or click a preset. Both effects update live.</p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 280px">
          <div class="control-row">
            <label><span>① cl_forwardspeed</span><span id="cv-fwd-val">200</span></label>
            <input type="range" id="cv-fwd" min="0" max="500" step="5" value="200" />
          </div>
          <div class="control-row">
            <label><span>② cl_sidespeed</span><span id="cv-side-val">160</span></label>
            <input type="range" id="cv-side" min="0" max="500" step="5" value="160" />
          </div>
          <div class="btn-row" id="cv-presets" style="flex-wrap:wrap"></div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">DIAGONAL ANGLE (off view-forward)</span><span class="v" id="cv-angle">—</span></div>
            <div class="hud-stat"><span class="k">RAW MAGNITUDE √(fwd²+side²)</span><span class="v" id="cv-mag">—</span></div>
            <div class="hud-stat warn"><span class="k">WISHSPEED AFTER 300 CLAMP</span><span class="v" id="cv-wishspeed">—</span></div>
            <div class="hud-stat warn"><span class="k">ACCELSPEED PER TICK (accel×frametime×wishspeed)</span><span class="v" id="cv-accel">—</span></div>
            <div class="hud-stat"><span class="k">FREE-GAIN CEILING (no mouse input at all)</span><span class="v" id="cv-crossover">—</span></div>
          </div>
        </div>
        <div class="panel-col" style="flex:1 1 420px">
          <canvas class="scene" id="cv-graph" style="height:320px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#5fb4ff"></span>θ_min(v) at YOUR wishspeed</span>
            <span><span class="swatch" style="background:rgba(255,255,255,0.35)"></span>θ_min(v) if maxed to 300 (Chapter 7's version)</span>
            <span><span class="swatch" style="background:#eafff2"></span>your current diagonal angle</span>
          </div>
        </div>
      </div>
    </div>

    <div class="callout good" id="cv-explain">—</div>

    <h2>Why the ratio matters more than you'd think</h2>
    <p class="muted">
      SOF default (200/160) sits at <b>38.7°</b>, wishspeed <b>256.1</b>. Your config (150/170) sits at
      <b>48.6°</b>, wishspeed <b>226.7</b>. Chapter 7's <span class="varname">θ_min = acos(300/|velocity|)</span>
      quietly assumed a maxed-out diagonal (it always fed PM_Accelerate a 400/400 input, clamped to exactly
      300) -- the real law straight out of <span class="varname">addspeed = wishspeed - currentspeed</span> is
      <span class="varname">θ_min = acos(wishspeed/|velocity|)</span>, using <em>your</em> wishspeed, not a
      flat 300. Below your own wishspeed, any angle gains -- so a wider baked-in keyboard angle keeps gaining
      speed passively long after a narrower one has stalled out and started demanding active mouse-flicking
      just to keep up. That's the whole "wider, steeper zigzag" feeling: your keys are doing part of
      Chapter 7's job for you.
    </p>

    <h2>Why 150/150 isn't 400/400, even at the same 1:1 ratio</h2>
    <p class="muted">
      This section used to claim the difference was a flat, single-tick <span class="varname">accelspeed</span>
      comparison -- "same angle both times, 400/400 just pushes harder." Re-derived it against real multi-tick
      play instead of a single snapshot, and that explanation doesn't survive: run both configs at each one's
      own best turning technique and the raw accelspeed gap barely shows up. What actually moves is
      <b>θ_min itself</b> -- exactly the law above, just evaluated at a wishspeed that isn't always 300.
    </p>
    <div class="panel">
      <p class="muted" style="margin-top:0">
        Both 150/150 and 400/400 sit at the <em>same</em> 45° diagonal. Starting from a normal 300 u/s run
        and flicking at various angles, here's what <span class="varname">PM_Accelerate</span> actually
        hands back each tick -- the real generator function, not a formula:
      </p>
      <div class="panel-row" style="gap:0;flex-wrap:wrap">
        <table class="mono" style="border-collapse:collapse;width:100%;font-size:13px">
          <thead>
            <tr style="text-align:right;color:var(--text-dim)">
              <td style="padding:4px 10px;text-align:left">flick angle from your current heading</td>
              ${[0, 20, 44, 45, 46, 60, 90].map((a) => `<td style="padding:4px 10px">${a}°</td>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:4px 10px;text-align:left;color:var(--text-dim)">150/150 (wishspeed 212.1)</td>
              ${[0, 20, 44, 45, 46, 60, 90]
                .map((a) => `<td style="padding:4px 10px;text-align:right">${cvarOneTickAccel(300, Math.min(Math.hypot(150, 150), pm_maxspeed), a).toFixed(2)}</td>`)
                .join("")}
            </tr>
            <tr>
              <td style="padding:4px 10px;text-align:left;color:var(--text-dim)">400/400 (wishspeed 300)</td>
              ${[0, 20, 44, 45, 46, 60, 90]
                .map((a) => `<td style="padding:4px 10px;text-align:right">${cvarOneTickAccel(300, Math.min(Math.hypot(400, 400), pm_maxspeed), a).toFixed(2)}</td>`)
                .join("")}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="callout">
      At v=300 -- your ordinary running speed -- 150/150's wishspeed (212.1) is <em>below</em> 300, so
      <span class="varname">θ_min(300, 212.1) = 45.0°</span>. Every flick under that is <b>exactly zero</b>
      accelspeed, not smaller: <span class="varname">addspeed = wishspeed - currentspeed</span> goes negative
      and <span class="varname">PM_Accelerate</span> returns immediately (pmove.c:414). 400/400's wishspeed
      hits the 300 cap, so its <span class="varname">θ_min</span> is 0° -- any flick at all, however tiny,
      starts gaining that same instant.
    </div>
    <div class="callout good">
      But that's <em>only</em> a problem once your speed is already above 212.1. Hold the 150/150 diagonal
      itself the whole time, from a dead stop, zero mouse -- its crossover ceiling (the stat above) works out
      to almost exactly <b>300 u/s</b>, dead on normal running speed. Passive strafing feels completely
      normal, because it never has to cross its own dead zone. The two configs only pull apart once a real
      bhop chain pushes your speed <em>past</em> 300 -- both then need active flicking, but 150/150 needs it
      a little sooner, and once everyone's flicking, 400/400's per-tick ceiling (3.00 vs 2.12 accelspeed,
      past 46° in the table above) stays a bit higher too. At ordinary jump speeds, though, "we didn't notice
      any difference" is exactly what the numbers predict -- there isn't one yet.
    </div>

    <div class="mystery">
      <strong>The old "150×2=300" idea, precisely:</strong> that's true for a <em>single</em> axis held
      alone. The instant you hold forward+strafe together, it's the diagonal's hypotenuse that has to
      clear 300, not either axis by itself -- 150/150 only reaches ${Math.hypot(150,150).toFixed(0)}, well
      under the cap that assumption expected. It just doesn't cost you anything until you're already going
      faster than a normal run.
    </div>

    <a class="next-link" href="#ch-zigzag">Continue → Chapter 13: flying the zig-zag</a>
  `;

  const fwdInput = section.querySelector("#cv-fwd");
  const sideInput = section.querySelector("#cv-side");
  const fwdVal = section.querySelector("#cv-fwd-val");
  const sideVal = section.querySelector("#cv-side-val");
  const angleEl = section.querySelector("#cv-angle");
  const magEl = section.querySelector("#cv-mag");
  const wishEl = section.querySelector("#cv-wishspeed");
  const accelEl = section.querySelector("#cv-accel");
  const crossEl = section.querySelector("#cv-crossover");
  const explainEl = section.querySelector("#cv-explain");
  const presetRow = section.querySelector("#cv-presets");
  const graphCanvas = section.querySelector("#cv-graph");
  const gctx = graphCanvas.getContext("2d");

  CVAR_PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = p.label;
    btn.addEventListener("click", () => {
      fwdInput.value = p.fwd;
      sideInput.value = p.side;
      render();
    });
    presetRow.appendChild(btn);
  });

  function resizeGraph() {
    const rect = graphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    graphCanvas.width = rect.width * dpr;
    graphCanvas.height = rect.height * dpr;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawGraph(angleDeg, wishspeed) {
    resizeGraph();
    const rect = graphCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const padL = 46, padR = 16, padT = 16, padB = 30;
    gctx.fillStyle = "#0b0f0c";
    gctx.fillRect(0, 0, w, h);

    const minV = 300, maxV = 700;
    const xOf = (v) => padL + ((v - minV) / (maxV - minV)) * (w - padL - padR);
    const yOf = (deg) => h - padB - (deg / 90) * (h - padT - padB);

    gctx.strokeStyle = "rgba(255,255,255,0.2)";
    gctx.beginPath();
    gctx.moveTo(padL, padT);
    gctx.lineTo(padL, h - padB);
    gctx.lineTo(w - padR, h - padB);
    gctx.stroke();

    gctx.font = "11px monospace";
    gctx.fillStyle = "#8fa89a";
    gctx.textAlign = "left";
    for (let deg = 0; deg <= 90; deg += 15) {
      const y = yOf(deg);
      gctx.strokeStyle = "rgba(255,255,255,0.06)";
      gctx.beginPath();
      gctx.moveTo(padL, y);
      gctx.lineTo(w - padR, y);
      gctx.stroke();
      gctx.fillText(deg + "°", 6, y + 4);
    }
    for (let v = minV; v <= maxV; v += 100) {
      gctx.fillText(v + "", xOf(v) - 12, h - padB + 16);
    }

    // reference theta_min(v) curve if you were maxed out to 300 (Chapter 7's
    // version) -- only worth drawing when it actually differs from yours
    if (wishspeed < pm_maxspeed - 0.5) {
      gctx.strokeStyle = "rgba(255,255,255,0.3)";
      gctx.lineWidth = 1.5;
      gctx.setLineDash([2, 3]);
      gctx.beginPath();
      let s2 = false;
      for (let v = minV; v <= maxV; v += 2) {
        const deg = (Math.acos(Math.min(1, pm_maxspeed / v)) * 180) / Math.PI;
        const x = xOf(v), y = yOf(deg);
        if (!s2) { gctx.moveTo(x, y); s2 = true; } else gctx.lineTo(x, y);
      }
      gctx.stroke();
      gctx.setLineDash([]);
    }

    // theta_min(v) curve at YOUR actual wishspeed
    gctx.strokeStyle = "#5fb4ff";
    gctx.lineWidth = 2.5;
    gctx.beginPath();
    let started = false;
    for (let v = minV; v <= maxV; v += 2) {
      const deg = (Math.acos(Math.min(1, wishspeed / v)) * 180) / Math.PI;
      const x = xOf(v), y = yOf(deg);
      if (!started) { gctx.moveTo(x, y); started = true; } else gctx.lineTo(x, y);
    }
    gctx.stroke();

    // current diagonal angle as a horizontal line
    gctx.strokeStyle = "#eafff2";
    gctx.setLineDash([5, 4]);
    gctx.beginPath();
    gctx.moveTo(padL, yOf(angleDeg));
    gctx.lineTo(w - padR, yOf(angleDeg));
    gctx.stroke();
    gctx.setLineDash([]);

    gctx.textAlign = "center";
    gctx.fillStyle = "#8fa89a";
    gctx.fillText("→ chain speed (u/s)", (padL + w - padR) / 2, h - 4);
    gctx.save();
    gctx.translate(14, (padT + h - padB) / 2);
    gctx.rotate(-Math.PI / 2);
    gctx.fillText("angle needed to gain ↑", 0, 0);
    gctx.restore();
    gctx.textAlign = "left";
  }

  function render() {
    const fwd = +fwdInput.value, side = +sideInput.value;
    fwdVal.textContent = fwd;
    sideVal.textContent = side;
    const { angle, rawMag, wishspeed, accelspeed, crossover } = cvarAnalyze(fwd, side);
    const angleDeg = angle * 180 / Math.PI;
    angleEl.textContent = angleDeg.toFixed(1) + "°";
    magEl.textContent = rawMag.toFixed(1);
    wishEl.textContent = wishspeed.toFixed(1) + (rawMag > pm_maxspeed ? " (clamped)" : "");
    accelEl.textContent = accelspeed.toFixed(3);
    crossEl.textContent = crossover === Infinity ? "never runs out" : crossover.toFixed(0) + " u/s";

    if (fwd === 0 && side === 0) {
      explainEl.textContent = "No input at all -- wishspeed is zero, nothing to show.";
    } else {
      explainEl.innerHTML = `At this ratio, holding both keys with <b>zero mouse movement</b> keeps
        gaining speed passively up to about <b>${crossover === Infinity ? "any speed" : crossover.toFixed(0) + " u/s"}</b>.
        Past that, θ_min exceeds what this diagonal alone provides, and Chapter 7's angle-turning becomes
        mandatory just to keep climbing.`;
    }

    drawGraph(angleDeg, wishspeed);
  }

  fwdInput.addEventListener("input", render);
  sideInput.addEventListener("input", render);
  window.addEventListener("resize", render);
  render();
}
