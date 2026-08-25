// Real Quake-engine clients call PM_AirMove once per rendered frame, using
// that exact frame's duration as frametime -- so your client's frame rate is
// not cosmetic, it's a genuine input to the movement math. Competitive SoF
// play famously locks the client to ~7ms frames (142fps): more, smaller
// ticks per real second means your turn-vs-wishdir angle gets re-measured
// more often while circle-strafing, which is a real, historically documented
// advantage, not a display artifact. This starts at that same 142fps by
// default; the dropdown below lets you compare other real client rates.
// Independent of display framerate either way -- see the accumulator loop
// near the bottom of this file.
let CH6_FRAMETIME = 1 / 142;
let CH6_TRAIL_MAX = 220; // trail length in *ticks*, so its real-time duration shifts with the fps picked above

function mountCh6Simulator(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 7 · Try It Yourself</div>
    <h1>Now fly it yourself</h1>
    <p class="lede">This is the exact same code from every earlier chapter, running live off your keyboard. No gravity or ground on purpose — just the pure steering trick.</p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col">
          <canvas class="scene" id="sim-canvas" tabindex="0" style="height:420px;cursor:crosshair"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#7dffb0"></span>W/S move / back</span>
            <span><span class="swatch" style="background:#5fb4ff"></span>A/D strafe</span>
            <span><span class="swatch" style="background:#ffd166"></span>←/→ turn</span>
          </div>
        </div>
        <div class="panel-col" style="flex:0 0 260px">
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">SPEED</span><span class="v" id="sim-speed">300</span></div>
            <div class="hud-stat" id="sim-gain-stat"><span class="k">RIGHT NOW</span><span class="v" id="sim-gain">—</span></div>
          </div>
          <canvas id="sim-spark" width="240" height="60" style="width:100%;height:60px;margin-top:10px;background:#0b0f0c;border:1px solid var(--border);border-radius:6px"></canvas>
          <div class="controls" style="margin-top:14px">
            <div class="control-row">
              <label><span>client frame rate</span><span id="sim-fps-val">142 fps (7.0 ms)</span></label>
              <select id="sim-fps" style="width:100%;background:#0b0f0c;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:inherit">
                <option value="60">60 fps (16.7 ms)</option>
                <option value="100">100 fps (10.0 ms)</option>
                <option value="125">125 fps (8.0 ms)</option>
                <option value="142" selected>142 fps (7.0 ms) — SoF's classic rate</option>
                <option value="250">250 fps (4.0 ms)</option>
              </select>
            </div>
            <div class="control-row">
              <label><span>turning speed</span><span id="sim-turnrate-val">180°/s</span></label>
              <input type="range" id="sim-turnrate" min="30" max="400" step="10" value="180" />
            </div>
            <div class="btn-row">
              <button class="btn" id="sim-reset">⟲ Reset</button>
              <button class="btn primary" id="sim-debug">⏸ Freeze &amp; inspect</button>
            </div>
          </div>
          <p class="muted" style="font-size:13px">Click the box first. Hold <strong>W + D</strong>, then gently tap <strong>←</strong> — keep the ring green.</p>
        </div>
      </div>
    </div>

    <div class="callout">
      No gravity or landing here on purpose — this is just the turning trick from Chapter 5, with
      no timer running out, so you can feel it for as long as you want.
    </div>

    <div class="callout">
      Why is <b>client frame rate</b> a movement setting at all? Because the real client calls the
      exact function you're stepping through here once per rendered frame, using that frame's real
      duration as <span class="varname">frametime</span>. More frames per real second means more,
      smaller boost applications, each re-measuring your turn angle sooner — which is a real
      advantage while circle-strafing, not a display trick. That's why competitive SoF players
      have historically locked their client to specific rates like 142fps (≈7ms frames) instead of
      just letting it run as fast as their monitor allows.
    </div>

    <div id="sim-debugger-wrap" style="display:none">
      <h2>Frozen. Here's exactly what just happened.</h2>
      <p class="muted">These are the real numbers from the instant you paused — same debugger as Chapter 3.</p>
      <div class="panel" id="sim-debugger-mount"></div>
      <button class="btn primary" id="sim-resume">▶ Resume flying</button>
    </div>

    <a class="next-link" href="#ch7-playground">Continue → Chapter 8: the full picture in 3D</a>
  `;

  const canvas = section.querySelector("#sim-canvas");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.5, scale: 0.5 });
  const sparkCanvas = section.querySelector("#sim-spark");
  const sctx = sparkCanvas.getContext("2d");
  const speedEl = section.querySelector("#sim-speed");
  const gainEl = section.querySelector("#sim-gain");
  const gainStat = section.querySelector("#sim-gain-stat");
  const fpsSelect = section.querySelector("#sim-fps");
  const fpsVal = section.querySelector("#sim-fps-val");
  const turnRateInput = section.querySelector("#sim-turnrate");
  const turnRateVal = section.querySelector("#sim-turnrate-val");
  const resetBtn = section.querySelector("#sim-reset");
  const debugBtn = section.querySelector("#sim-debug");
  const resumeBtn = section.querySelector("#sim-resume");
  const debuggerWrap = section.querySelector("#sim-debugger-wrap");
  const debuggerMount = section.querySelector("#sim-debugger-mount");

  const keys = new Set();
  let state = { velocity: [300, 0, 0], yaw: 0 };
  let pos = [0, 0];
  let trail = [];
  let speedHistory = [];
  let lastFrame = null;
  let paused = false;

  canvas.addEventListener("keydown", (e) => {
    keys.add(e.key.toLowerCase());
    if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(e.key.toLowerCase())) e.preventDefault();
  });
  canvas.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener("click", () => canvas.focus());

  function resetRun() {
    state = { velocity: [300, 0, 0], yaw: 0 };
    pos = [0, 0];
    trail = [[0, 0]];
    speedHistory = [];
  }

  function tick() {
    const turnRateDegPerSec = +turnRateInput.value;
    if (keys.has("arrowleft")) state.yaw += ((turnRateDegPerSec * Math.PI) / 180) * CH6_FRAMETIME;
    if (keys.has("arrowright")) state.yaw -= ((turnRateDegPerSec * Math.PI) / 180) * CH6_FRAMETIME;

    let fmove = 0,
      smove = 0;
    if (keys.has("w")) fmove += 400;
    if (keys.has("s")) fmove -= 400;
    if (keys.has("d")) smove += 400;
    if (keys.has("a")) smove -= 400;

    const before = [...state.velocity];
    const cmd = { forwardmove: fmove, sidemove: smove };
    const gen = pmAirMoveSteps(state, cmd, CH6_FRAMETIME);
    let result;
    while (true) {
      const { value, done } = gen.next();
      if (done) {
        result = value;
        break;
      }
    }
    lastFrame = {
      velocityBefore: before,
      wishdir: result.wishdir,
      wishspeed: result.wishspeed,
      accel: 1,
      frametime: CH6_FRAMETIME,
      addspeed: result.addspeed,
    };

    pos = [pos[0] + state.velocity[0] * CH6_FRAMETIME, pos[1] + state.velocity[1] * CH6_FRAMETIME];

    // PM_SnapPosition's real velocity round-trip through a 16-bit short (see
    // physics.js) -- this tick's movement above already used the full-float
    // velocity (matches the real client: PM_StepSlideMove moves you before
    // PM_SnapPosition ever quantizes anything), so this only affects what
    // carries into the *next* tick, exactly like the real game.
    pmSnapVelocity(state.velocity);

    trail.push([...pos]);
    if (trail.length > CH6_TRAIL_MAX) trail.shift();
    const speed = VectorLength(state.velocity);
    speedHistory.push(speed);
    if (speedHistory.length > 240) speedHistory.shift();
  }

  // Camera always faces "up" the way you're looking, like a top-down racing
  // game — instead of a fixed north-up map, which turns any tight turning
  // into an unreadable tangle on screen.
  function drawSim() {
    scene.clear();
    scene.rings([0, 0], { step: 70, count: 4 });

    const theta = Math.PI / 2 - state.yaw;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    const toCam = (p) => {
      const rx = p[0] - pos[0];
      const ry = p[1] - pos[1];
      return [rx * ct - ry * st, rx * st + ry * ct];
    };

    const n = trail.length;
    for (let i = 1; i < n; i++) {
      const alpha = (i / n) * 0.75;
      scene.line(toCam(trail[i - 1]), toCam(trail[i]), {
        color: `rgba(125,255,176,${alpha})`,
        width: 2.5,
        dash: [],
      });
    }

    const speed = VectorLength(state.velocity);
    const gaining = lastFrame ? lastFrame.addspeed > 0 : false;
    const ringColor = gaining ? "#7dffb0" : "#5c6b62";

    // player marker: a ring that glows green while you're gaining speed,
    // plus a small triangle that always points "up" (your view direction).
    scene.ctx.save();
    const [px, py] = scene.toPixel(0, 0);
    scene.ctx.strokeStyle = ringColor;
    scene.ctx.lineWidth = 3;
    scene.ctx.beginPath();
    scene.ctx.arc(px, py, 11, 0, Math.PI * 2);
    scene.ctx.stroke();
    scene.ctx.fillStyle = "#eafff2";
    scene.ctx.beginPath();
    scene.ctx.moveTo(px, py - 9);
    scene.ctx.lineTo(px - 6, py + 6);
    scene.ctx.lineTo(px + 6, py + 6);
    scene.ctx.closePath();
    scene.ctx.fill();
    scene.ctx.restore();

    speedEl.textContent = speed.toFixed(0);
    if (lastFrame) {
      gainEl.textContent = gaining ? "gaining speed" : "not gaining";
      gainStat.classList.toggle("warn", !gaining);
    }

    sctx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
    sctx.strokeStyle = "#7dffb0";
    sctx.lineWidth = 1.5;
    sctx.beginPath();
    const maxS = Math.max(320, ...speedHistory);
    speedHistory.forEach((s, i) => {
      const x = (i / 240) * sparkCanvas.width;
      const y = sparkCanvas.height - (s / maxS) * sparkCanvas.height;
      if (i === 0) sctx.moveTo(x, y);
      else sctx.lineTo(x, y);
    });
    sctx.stroke();
  }

  // Fixed-timestep accumulator -- see Chapter 8's identical comment. Calling
  // tick() once per requestAnimationFrame callback made simulated speed
  // depend on the viewer's monitor refresh rate (slow motion at 60Hz, ~44%
  // too fast at 144Hz); this runs tick() as many times as needed to catch up
  // to real elapsed time instead, so speed gain is the same real-world speed
  // on every monitor.
  let lastTime = null;
  let accumulator = 0;
  function loop(now) {
    if (lastTime === null) lastTime = now;
    const realDt = Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;
    if (!paused) {
      accumulator += realDt;
      while (accumulator >= CH6_FRAMETIME) {
        tick();
        accumulator -= CH6_FRAMETIME;
      }
      drawSim();
    }
    requestAnimationFrame(loop);
  }

  function updateFps() {
    const fps = +fpsSelect.value;
    CH6_FRAMETIME = 1 / fps;
    fpsVal.textContent = `${fps} fps (${(1000 / fps).toFixed(1)} ms)`;
  }
  fpsSelect.addEventListener("change", updateFps);
  updateFps();

  resetBtn.addEventListener("click", resetRun);
  turnRateInput.addEventListener("input", () => {
    turnRateVal.textContent = turnRateInput.value + "°/s";
  });

  debugBtn.addEventListener("click", () => {
    if (!lastFrame) return;
    paused = true;
    debuggerWrap.style.display = "block";
    debuggerWrap.scrollIntoView({ behavior: "smooth", block: "start" });

    createDebugger({
      mount: debuggerMount,
      title: "The boost function — your real captured numbers",
      cSource: C_ACCELERATE,
      jsSource: JS_ACCELERATE,
      map: ACCELERATE_MAP,
      describe: describeAccelerateStep,
      makeGenerator: () =>
        pmAccelerateSteps(
          [...lastFrame.velocityBefore],
          lastFrame.wishdir,
          lastFrame.wishspeed,
          lastFrame.accel,
          lastFrame.frametime
        ),
    });
  });

  resumeBtn.addEventListener("click", () => {
    paused = false;
    debuggerWrap.style.display = "none";
  });

  resetRun();
  requestAnimationFrame(loop);
}
