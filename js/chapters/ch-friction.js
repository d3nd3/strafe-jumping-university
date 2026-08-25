// Chapter 6 — PM_Friction (pmove.c:369-411, no #ifdef SOF -- identical in both
// engines). The site has used pmGroundFriction (physics.js) since Chapter 9's
// 3D playground, but never taught it as its own idea. It's the missing other
// half of Chapter 5's "ground is 10x stronger" story: ground doesn't just push
// harder, it also fights back every tick. Air does neither.

const CH_FRICTION_FRAMETIME = 0.01; // 100 ticks/sec, matches every other chapter
const CH_FRICTION_WINDOW = 2.5; // seconds simulated for the graph

// Runs the exact real tick order: PM_Friction happens BEFORE this tick's
// accelerate call (pmove.c:1540-1542 -- PM_CheckJump, then PM_Friction, then
// PM_AirMove). Ground fights back on last tick's velocity, then this tick's
// push is added on top. Air never calls PM_Friction at all -- there's simply
// no equivalent line in PM_AirMove's airborne branch.
function runFrictionSim(holdSeconds) {
  const wishdir = [1, 0, 0];
  const groundV = [0, 0, 0];
  const airV = [0, 0, 0];
  const ground = [0];
  const air = [0];
  const ticks = Math.round(CH_FRICTION_WINDOW / CH_FRICTION_FRAMETIME);
  for (let i = 0; i < ticks; i++) {
    const t = i * CH_FRICTION_FRAMETIME;
    const holding = t < holdSeconds;
    const wishspeed = holding ? pm_maxspeed : 0;

    pmGroundFriction(groundV, CH_FRICTION_FRAMETIME);
    const g = pmAccelerateSteps(groundV, wishdir, wishspeed, pm_accelerate, CH_FRICTION_FRAMETIME);
    while (!g.next().done) {}

    // no friction call at all -- this is the entire difference
    const a = pmAccelerateSteps(airV, wishdir, wishspeed, pm_airaccelerate, CH_FRICTION_FRAMETIME);
    while (!a.next().done) {}

    ground.push(groundV[0]);
    air.push(airV[0]);
  }
  return { ground, air };
}

function mountChFriction(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 6 · Friction</div>
    <h1>The ground fights back. The air doesn't.</h1>
    <p class="lede">
      Chapter 5 showed the ground pushing 10× harder than the air. That's only half the story --
      every tick you're on the ground, something is also <em>removing</em> speed, whether you're
      pushing a key or not. In the air, that something never runs at all.
    </p>

    <div class="panel">
      ${renderStatic(C_FRICTION, FRICTION_HIGHLIGHT)}
    </div>

    <div class="callout">
      Two speeds, two behaviors. Below <span class="varname">pm_stopspeed</span> (100), <span class="varname">control</span>
      is forced up to 100 regardless of your actual speed -- so <span class="varname">drop</span> is a
      <b>flat amount</b> every tick, the same whether you're crawling at 20 or coasting at 90. That's what
      brings you to a crisp stop instead of an endless crawl. Above 100, <span class="varname">control</span>
      just <em>is</em> your speed -- so <span class="varname">drop</span> is a fixed <b>percentage</b> of
      whatever you're currently going, every tick, no matter how fast that is.
    </div>

    <div class="callout good">
      Nothing like this exists in the air. Not "weaker" friction -- <b>zero</b>. <span class="varname">PM_AirMove</span>'s
      airborne branch never calls <span class="varname">PM_Friction</span>, not even once. Whatever
      sideways speed you're carrying when you leave the ground is still there, completely undiminished,
      the instant you land -- however long the flight was.
    </div>

    <h2>Watch it happen: hold forward, then let go</h2>
    <p class="muted">
      Same input schedule, ground vs. air, using the exact same <span class="varname">pmAccelerateSteps</span>
      /<span class="varname">pmGroundFriction</span> functions the rest of this site runs. Drag the slider to
      change how long you hold forward before releasing the key.
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 260px">
          <div class="control-row">
            <label><span>① hold forward for</span><span id="fr-hold-val">0.60s</span></label>
            <input type="range" id="fr-hold" min="0.2" max="2" step="0.05" value="0.6" />
            <p class="muted" style="font-size:12px;margin:2px 0 0">then let go for the rest of the window</p>
          </div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">SPEED THE INSTANT YOU LET GO</span><span class="v" id="fr-release">—</span></div>
            <div class="hud-stat warn"><span class="k">1s AFTER LETTING GO</span><span class="v" id="fr-after">—</span></div>
          </div>
          <p class="muted" style="font-size:12.5px;margin:10px 0 0">
            Notice the release-instant numbers differ too -- ground's 10× accel already caught up closer
            to 300 than air has, even before either one starts losing (or not losing) speed.
          </p>
        </div>
        <div class="panel-col" style="flex:1 1 420px">
          <canvas class="scene" id="fr-graph" style="height:320px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#5fb4ff"></span>ground (friction fights back)</span>
            <span><span class="swatch" style="background:#ffd166"></span>air (nothing fights back, ever)</span>
          </div>
        </div>
      </div>
    </div>

    <div class="mystery">
      <strong>So why doesn't speed grow forever on the ground too?</strong> Every tick, accelerate
      (Chapter 4) adds toward your target speed and friction claws some back -- the two settle into
      balance right around your target speed, never past it. In the air there's nothing clawing
      anything back, which is exactly why leftover <em>sideways</em> speed (Chapter 7) is free to just
      sit there, tick after tick, waiting to be turned into more forward speed.
    </div>

    <div class="callout" style="margin-top:18px">
      <b>One more real quirk, for the curious:</b> <span class="varname">PM_Friction</span> runs
      <em>before</em> this tick's own movement, on last tick's velocity and last tick's ground state
      (pmove.c:1540-1542). <span class="varname">PM_CheckJump</span> runs even earlier in the same
      tick and clears <span class="varname">groundentity</span> the instant a jump fires -- so the
      exact tick you leave the ground, friction is already skipped. Jumping never eats one last
      partial tick of ground friction on the way out.
    </div>

    <a class="next-link" href="#ch5-angle-mystery">Continue → Chapter 7: the angle mystery</a>
  `;

  const graphCanvas = section.querySelector("#fr-graph");
  const gctx = graphCanvas.getContext("2d");
  const holdInput = section.querySelector("#fr-hold");
  const holdVal = section.querySelector("#fr-hold-val");
  const releaseEl = section.querySelector("#fr-release");
  const afterEl = section.querySelector("#fr-after");

  function resizeGraph() {
    const rect = graphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    graphCanvas.width = rect.width * dpr;
    graphCanvas.height = rect.height * dpr;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    const holdSeconds = +holdInput.value;
    holdVal.textContent = holdSeconds.toFixed(2) + "s";
    const { ground, air } = runFrictionSim(holdSeconds);

    const releaseIdx = Math.round(holdSeconds / CH_FRICTION_FRAMETIME);
    const afterIdx = Math.min(ground.length - 1, releaseIdx + Math.round(1 / CH_FRICTION_FRAMETIME));
    releaseEl.textContent = `ground ${ground[releaseIdx].toFixed(0)} / air ${air[releaseIdx].toFixed(0)}`;
    afterEl.textContent = `ground ${ground[afterIdx].toFixed(0)} / air ${air[afterIdx].toFixed(0)}`;

    resizeGraph();
    const rect = graphCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const padL = 46, padR = 16, padT = 16, padB = 30;
    gctx.fillStyle = "#0b0f0c";
    gctx.fillRect(0, 0, w, h);

    const maxY = 320;
    const xOf = (t) => padL + (t / CH_FRICTION_WINDOW) * (w - padL - padR);
    const yOf = (v) => h - padB - (v / maxY) * (h - padT - padB);

    gctx.strokeStyle = "rgba(255,255,255,0.2)";
    gctx.beginPath();
    gctx.moveTo(padL, padT);
    gctx.lineTo(padL, h - padB);
    gctx.lineTo(w - padR, h - padB);
    gctx.stroke();

    gctx.font = "11px monospace";
    gctx.fillStyle = "#8fa89a";
    gctx.textAlign = "left";
    for (let v = 0; v <= maxY; v += 100) {
      const y = yOf(v);
      gctx.strokeStyle = "rgba(255,255,255,0.06)";
      gctx.beginPath();
      gctx.moveTo(padL, y);
      gctx.lineTo(w - padR, y);
      gctx.stroke();
      gctx.fillStyle = "#8fa89a";
      gctx.fillText(String(v), 6, y + 4);
    }
    for (let t = 0; t <= CH_FRICTION_WINDOW; t += 0.5) {
      gctx.fillStyle = "#8fa89a";
      gctx.fillText(t.toFixed(1) + "s", xOf(t) - 10, h - padB + 16);
    }

    // release marker
    gctx.strokeStyle = "rgba(255,255,255,0.3)";
    gctx.setLineDash([4, 4]);
    gctx.beginPath();
    gctx.moveTo(xOf(holdSeconds), padT);
    gctx.lineTo(xOf(holdSeconds), h - padB);
    gctx.stroke();
    gctx.setLineDash([]);
    gctx.fillStyle = "rgba(255,255,255,0.55)";
    gctx.fillText("let go", xOf(holdSeconds) + 4, padT + 12);

    function drawSeries(series, color) {
      gctx.strokeStyle = color;
      gctx.lineWidth = 2.5;
      gctx.beginPath();
      series.forEach((v, i) => {
        const x = xOf(i * CH_FRICTION_FRAMETIME);
        const y = yOf(v);
        if (i === 0) gctx.moveTo(x, y);
        else gctx.lineTo(x, y);
      });
      gctx.stroke();
    }
    drawSeries(ground, "#5fb4ff");
    drawSeries(air, "#ffd166");

    gctx.textAlign = "center";
    gctx.fillStyle = "#8fa89a";
    gctx.fillText("→ time", (padL + w - padR) / 2, h - 4);
    gctx.textAlign = "left";
  }

  holdInput.addEventListener("input", draw);
  window.addEventListener("resize", draw);
  draw();
}
