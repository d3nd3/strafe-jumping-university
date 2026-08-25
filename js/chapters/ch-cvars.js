// Chapter 12 -- cl_forwardspeed / cl_sidespeed. Every simulator on this site
// so far hardcodes forwardmove=400, sidemove=400 (a maxed-out diagonal) --
// none of them model what these two client cvars actually do. PM_AirMove
// reads pm->cmd.forwardmove/sidemove directly (pmove.c:612-613, 624), and
// those are exactly cl_forwardspeed/cl_sidespeed while the matching key is
// held. This chapter is the two mechanisms that fall out of that: the
// diagonal's ANGLE (which interacts with Chapter 7's theta_min law) and its
// MAGNITUDE (which interacts with the wishspeed clamp feeding PM_Accelerate).

// theta_min from Chapter 7: acos(300/v), the minimum turn angle that gains
// any speed at all at velocity v. Solved the other way here: given a fixed
// keyboard-diagonal angle, what's the highest chain speed it still clears
// on its own, with zero mouse input?
function cvarCrossoverSpeed(angleRad) {
  const c = Math.cos(angleRad);
  if (c <= 0) return Infinity; // angle >= 90 deg never runs out
  return pm_maxspeed / c;
}

function cvarAnalyze(fwd, side) {
  const angle = Math.atan2(side, fwd); // radians, off view-forward
  const rawMag = Math.hypot(fwd, side);
  const wishspeed = Math.min(rawMag, pm_maxspeed); // PM_AirMove's clamp, pmove.c:647
  const accelspeed = pm_airaccelerate * CH_FRICTION_FRAMETIME * wishspeed; // pmove.c:430
  const crossover = cvarCrossoverSpeed(angle);
  return { angle, rawMag, wishspeed, accelspeed, crossover };
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
            <span><span class="swatch" style="background:#5fb4ff"></span>θ_min(v) — Chapter 7's real minimum turn angle</span>
            <span><span class="swatch" style="background:#eafff2"></span>your current diagonal angle</span>
          </div>
        </div>
      </div>
    </div>

    <div class="callout good" id="cv-explain">—</div>

    <h2>Why the ratio matters more than you'd think</h2>
    <p class="muted">
      SOF default (200/160) sits at <b>38.7°</b>. Your config (150/170) sits at <b>48.6°</b>. Chapter 7's
      <span class="varname">θ_min = acos(300/|velocity|)</span> means the angle you need just to break even
      <em>grows</em> as you go faster -- so a wider baked-in keyboard angle keeps gaining speed passively
      long after a narrower one has stalled out and started demanding active mouse-flicking just to keep up.
      That's the whole "wider, steeper zigzag" feeling: your keys are doing part of Chapter 7's job for you.
    </p>

    <h2>Why 150/150 isn't 400/400, even at the same 1:1 ratio</h2>
    <p class="muted">
      Angle only decides <em>whether</em> you gain. Magnitude decides <em>how much</em>, completely
      separately. <span class="varname">wishspeed</span> feeds straight into
      <span class="varname">accelspeed = accel × frametime × wishspeed</span> (pmove.c:430) --
      so a wishspeed that's stuck under the 300 cap is a strictly weaker push every single tick, angle aside.
    </p>
    <div class="panel">
      <div class="panel-row" style="gap:24px;flex-wrap:wrap">
        <div class="panel-col" style="flex:1 1 220px">
          <div style="font-family:var(--mono);font-size:12px;color:var(--text-dim)">150 / 150</div>
          <div style="font-size:22px;margin:4px 0">magnitude <span class="varname">${Math.hypot(150,150).toFixed(1)}</span> — never reaches the cap</div>
          <div class="muted">accelspeed/tick = ${(pm_airaccelerate * CH_FRICTION_FRAMETIME * Math.min(Math.hypot(150,150), pm_maxspeed)).toFixed(3)}</div>
        </div>
        <div class="panel-col" style="flex:1 1 220px">
          <div style="font-family:var(--mono);font-size:12px;color:var(--text-dim)">400 / 400</div>
          <div style="font-size:22px;margin:4px 0">magnitude <span class="varname">${Math.hypot(400,400).toFixed(1)}</span> — clamped straight to 300</div>
          <div class="muted">accelspeed/tick = ${(pm_airaccelerate * CH_FRICTION_FRAMETIME * Math.min(Math.hypot(400,400), pm_maxspeed)).toFixed(3)}</div>
        </div>
      </div>
    </div>
    <div class="callout">
      Same 45° angle both times -- clamping <span class="varname">wishvel</span> down to the cap
      preserves its direction, it just shortens it. What's different is purely the leftover magnitude,
      and that alone is worth about <b>41%</b> more push per tick at 400/400. Two configs with an
      identical ratio can still feel completely different if only one of them actually reaches 300.
    </div>

    <div class="mystery">
      <strong>The old "150×2=300" idea, precisely:</strong> that's true for a <em>single</em> axis held
      alone. The instant you hold forward+strafe together, it's the diagonal's hypotenuse that has to
      clear 300, not either axis by itself -- 150/150 only reaches ${Math.hypot(150,150).toFixed(0)}, well
      under the cap that assumption expected.
    </div>

    <a class="next-link" href="#ch7-recap">Continue → Chapter 13: recap</a>
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

  function drawGraph(angleDeg) {
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

    // theta_min(v) curve
    gctx.strokeStyle = "#5fb4ff";
    gctx.lineWidth = 2.5;
    gctx.beginPath();
    let started = false;
    for (let v = minV; v <= maxV; v += 2) {
      const deg = Math.acos(Math.min(1, pm_maxspeed / v)) * 180 / Math.PI;
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

    drawGraph(angleDeg);
  }

  fwdInput.addEventListener("input", render);
  sideInput.addEventListener("input", render);
  window.addEventListener("resize", render);
  render();
}
