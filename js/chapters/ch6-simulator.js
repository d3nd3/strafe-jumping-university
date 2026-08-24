
const CH6_FRAMETIME = 0.01; // fixed 100Hz physics tick, independent of display framerate

function mountCh6Simulator(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 6 · The Live Simulator</div>
    <h1>Now fly it yourself</h1>
    <p class="lede">
      This runs <code>pmAirMoveSteps</code> — the exact generator from every earlier chapter —
      100 times a second, for real, driven by your keyboard. There's no gravity or ground here on
      purpose (see the callout below): this is a pure, honest model of the horizontal air-strafe
      math so nothing about jumping/landing/collision distracts from it.
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col">
          <canvas class="scene" id="sim-canvas" tabindex="0" style="height:420px;cursor:crosshair"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#7dffb0"></span>W/S forward-back</span>
            <span><span class="swatch" style="background:#5fb4ff"></span>A/D strafe</span>
            <span><span class="swatch" style="background:#ffd166"></span>←/→ turn view</span>
          </div>
        </div>
        <div class="panel-col" style="flex:0 0 260px">
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">SPEED</span><span class="v" id="sim-speed">300</span></div>
            <div class="hud-stat" id="sim-gain-stat"><span class="k">THIS TICK</span><span class="v" id="sim-gain">—</span></div>
          </div>
          <canvas id="sim-spark" width="240" height="60" style="width:100%;height:60px;margin-top:10px;background:#0b0f0c;border:1px solid var(--border);border-radius:6px"></canvas>
          <div class="controls" style="margin-top:14px">
            <div class="control-row">
              <label><span>turn rate</span><span id="sim-turnrate-val">180°/s</span></label>
              <input type="range" id="sim-turnrate" min="30" max="400" step="10" value="180" />
            </div>
            <div class="btn-row">
              <button class="btn" id="sim-reset">⟲ Reset run</button>
              <button class="btn primary" id="sim-debug">⏸ Debug this frame</button>
            </div>
          </div>
          <p class="muted" style="font-size:13px">Click the canvas first so it can see your key presses. Try holding <strong>W + D</strong> and tapping <strong>←</strong> gently — that's a real air-strafe.</p>
        </div>
      </div>
    </div>

    <div class="callout">
      <strong>Why no gravity or landing?</strong> Real strafe-jumping is bounded by how long
      you're airborne, which depends on jump arcs, map geometry, and <code>PM_StepSlideMove</code>'s
      collision handling — all mechanically separate from the acceleration formula this app is
      about. Chapter 5 modeled a single realistic jump's air-time explicitly; this simulator lets
      you fly indefinitely so you can feel the steering by hand without a clock running out.
    </div>

    <div id="sim-debugger-wrap" style="display:none">
      <h2>You paused mid-flight. Here's exactly what that tick's numbers are.</h2>
      <p class="muted">This is not a replay or a fabricated example — it's the real <code>velocity</code>, <code>wishdir</code> and <code>wishspeed</code> your simulator had at the instant you clicked pause, stepped through the same debugger as Chapter 3.</p>
      <div class="panel" id="sim-debugger-mount"></div>
      <button class="btn primary" id="sim-resume">▶ Resume flying</button>
    </div>

    <a class="next-link" href="#ch7-recap">Continue → Chapter 7: recap &amp; glossary</a>
  `;

  const canvas = section.querySelector("#sim-canvas");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.5, scale: 0.5 });
  const sparkCanvas = section.querySelector("#sim-spark");
  const sctx = sparkCanvas.getContext("2d");
  const speedEl = section.querySelector("#sim-speed");
  const gainEl = section.querySelector("#sim-gain");
  const gainStat = section.querySelector("#sim-gain-stat");
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
  let rafId = null;

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
    trail.push([...pos]);
    if (trail.length > 800) trail.shift();
    const speed = VectorLength(state.velocity);
    speedHistory.push(speed);
    if (speedHistory.length > 240) speedHistory.shift();
  }

  function drawSim() {
    scene.clear();
    scene.grid({ step: 60 });
    const camScale = 0.45;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1],
        b = trail[i];
      scene.line(
        [(a[0] - pos[0]) * (camScale / 0.5), (a[1] - pos[1]) * (camScale / 0.5)],
        [(b[0] - pos[0]) * (camScale / 0.5), (b[1] - pos[1]) * (camScale / 0.5)],
        { color: "rgba(125,255,176,0.55)", width: 2, dash: [] }
      );
    }
    const fwd = [Math.cos(state.yaw) * 40, Math.sin(state.yaw) * 40];
    scene.arrow([0, 0], fwd, { color: "#ffd166", label: "view" });
    scene.point([0, 0], { color: "#eafff2", radius: 6 });

    const speed = VectorLength(state.velocity);
    speedEl.textContent = speed.toFixed(0);
    if (lastFrame) {
      const gaining = lastFrame.addspeed > 0;
      gainEl.textContent = gaining ? "+" + lastFrame.addspeed.toFixed(1) : lastFrame.addspeed.toFixed(1);
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

  function loop() {
    if (!paused) {
      tick();
      drawSim();
    }
    rafId = requestAnimationFrame(loop);
  }

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
      title: "PM_Accelerate — real captured values from your last tick",
      cSource: C_ACCELERATE,
      jsSource: JS_ACCELERATE,
      map: ACCELERATE_MAP,
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
  loop();
}
