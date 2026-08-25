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
const CH6_MOUSE_SENSITIVITY = 0.0022; // radians of yaw per pixel of mouse movement, same feel as Chapter 9's 3D scene

function mountCh6Simulator(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 8 · Try It Yourself</div>
    <h1>Now fly it yourself</h1>
    <p class="lede">This is the exact same code from every earlier chapter, running live off your
    keyboard (or mouse). No gravity or ground on purpose — just the pure steering trick.</p>

    <div class="callout">
      <b>What you're looking at:</b> a bird's-eye view, and the camera always faces the way
      <em>you're</em> facing — so on screen, "up" always means "wherever you're currently looking."
      That means turning spins the whole world around you, not the other way around. The faint
      yellow spokes are fixed compass directions in the world, so you can actually <em>see</em> that
      spin happen instead of just taking it on faith — watch the labeled <span class="varname">0°</span>
      spoke sweep as you turn. The ring around you glows green exactly when this instant is adding
      speed; the trail behind you is everywhere you've already been.
    </div>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col">
          <div style="position:relative">
            <canvas class="scene" id="sim-canvas" tabindex="0" style="height:420px;cursor:crosshair;outline:none"></canvas>
            <div id="sim-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;background:rgba(11,15,12,0.72);border-radius:8px;pointer-events:none;font-size:15px;padding:20px">
              <div>
                <div style="font-size:22px;margin-bottom:8px">▶ Click to start</div>
                <div id="sim-overlay-hint" class="muted">Then hold <b>W</b> (or <b>W+D</b>) and tap <b>←</b> — keep the ring green.</div>
              </div>
            </div>
          </div>
          <div class="legend">
            <span><span class="swatch" style="background:#7dffb0"></span>trail (where you've flown)</span>
            <span><span class="swatch" style="background:#eafff2"></span>you (ring glows green = gaining speed)</span>
            <span><span class="swatch" style="background:#ffd166"></span>compass spokes (fixed world directions)</span>
          </div>
        </div>
        <div class="panel-col" style="flex:0 0 260px">
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">SPEED</span><span class="v" id="sim-speed">300</span></div>
            <div class="hud-stat" id="sim-gain-stat"><span class="k">RIGHT NOW</span><span class="v" id="sim-gain">—</span></div>
            <div class="hud-stat"><span class="k">DOING</span><span class="v" id="sim-doing" style="font-size:13px">nothing yet</span></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:10px">
            <canvas id="sim-compass" width="70" height="70" style="flex:0 0 70px;background:#0b0f0c;border:1px solid var(--border);border-radius:50%"></canvas>
            <div>
              <div class="muted" style="font-size:11px">HEADING</div>
              <div id="sim-heading" style="font-size:18px;color:var(--accent)">0°</div>
            </div>
          </div>
          <canvas id="sim-spark" width="240" height="60" style="width:100%;height:60px;margin-top:10px;background:#0b0f0c;border:1px solid var(--border);border-radius:6px"></canvas>
          <div class="controls" style="margin-top:14px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-dim)">
              <input type="checkbox" id="sim-mouselook" style="accent-color:var(--accent)" />
              ① turn with mouse (click scene to lock)
            </label>
            <div class="control-row">
              <label><span>② turning speed (arrow keys)</span><span id="sim-turnrate-val">180°/s</span></label>
              <input type="range" id="sim-turnrate" min="30" max="400" step="10" value="180" />
            </div>
            <div class="control-row">
              <label><span>③ client frame rate</span><span id="sim-fps-val">142 fps (7.0 ms)</span></label>
              <select id="sim-fps" style="width:100%;background:#0b0f0c;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px;font-family:inherit">
                <option value="60">60 fps (16.7 ms)</option>
                <option value="100">100 fps (10.0 ms)</option>
                <option value="125">125 fps (8.0 ms)</option>
                <option value="142" selected>142 fps (7.0 ms) — SoF's classic rate</option>
                <option value="250">250 fps (4.0 ms)</option>
              </select>
            </div>
            <div class="btn-row">
              <button class="btn" id="sim-reset">⟲ Reset</button>
              <button class="btn primary" id="sim-debug">⏸ Freeze &amp; inspect</button>
            </div>
          </div>
          <p class="muted" style="font-size:12.5px" id="sim-hint">
            <b>W/S</b> move / back, <b>A/D</b> strafe, <b>←/→</b> turn (or check the box above and
            move your mouse). Clicking away, or alt-tabbing, safely lets go of every key.
          </p>
        </div>
      </div>
    </div>

    <div class="callout">
      No gravity or landing here on purpose — this is just the turning trick from Chapter 7, with
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
      <p class="muted">These are the real numbers from the instant you paused — same debugger as Chapter 4.</p>
      <div class="panel" id="sim-debugger-mount"></div>
      <button class="btn primary" id="sim-resume">▶ Resume flying</button>
    </div>

    <a class="next-link" href="#ch7-playground">Continue → Chapter 9: the full picture in 3D</a>
  `;

  const canvas = section.querySelector("#sim-canvas");
  const overlay = section.querySelector("#sim-overlay");
  const overlayHint = section.querySelector("#sim-overlay-hint");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.5, scale: 0.5 });
  const compassCanvas = section.querySelector("#sim-compass");
  const cctx = compassCanvas.getContext("2d");
  const headingEl = section.querySelector("#sim-heading");
  const doingEl = section.querySelector("#sim-doing");
  const sparkCanvas = section.querySelector("#sim-spark");
  const sctx = sparkCanvas.getContext("2d");
  const speedEl = section.querySelector("#sim-speed");
  const gainEl = section.querySelector("#sim-gain");
  const gainStat = section.querySelector("#sim-gain-stat");
  const fpsSelect = section.querySelector("#sim-fps");
  const fpsVal = section.querySelector("#sim-fps-val");
  const turnRateInput = section.querySelector("#sim-turnrate");
  const turnRateVal = section.querySelector("#sim-turnrate-val");
  const mouselookToggle = section.querySelector("#sim-mouselook");
  const hintEl = section.querySelector("#sim-hint");
  const defaultHintHTML = hintEl.innerHTML;
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
  let pendingYawDelta = 0;

  function isLocked() {
    return document.pointerLockElement === canvas;
  }

  // The one real bug this chapter used to have: keydown/keyup only fired
  // while the canvas had focus, but nothing ever cleared `keys` when focus
  // left it -- click the FPS dropdown (or alt-tab) mid-turn and that key
  // stayed "held" forever, since its keyup event never reached this canvas.
  // Clearing on every way focus can be lost fixes it, and doubles as the
  // "paused" state for the onboarding overlay.
  function releaseAllKeys() {
    keys.clear();
    pendingYawDelta = 0;
  }

  canvas.addEventListener("keydown", (e) => {
    keys.add(e.key.toLowerCase());
    if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(e.key.toLowerCase())) e.preventDefault();
  });
  canvas.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener("click", () => {
    canvas.focus();
    if (mouselookToggle.checked && canvas.requestPointerLock) canvas.requestPointerLock();
  });
  canvas.addEventListener("focus", () => {
    overlay.style.display = "none";
  });
  canvas.addEventListener("blur", () => {
    releaseAllKeys();
    overlay.style.display = "flex";
  });
  window.addEventListener("blur", releaseAllKeys);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAllKeys();
  });

  document.addEventListener("mousemove", (e) => {
    if (isLocked()) pendingYawDelta += e.movementX * CH6_MOUSE_SENSITIVITY;
  });
  document.addEventListener("pointerlockchange", () => {
    const locked = isLocked();
    canvas.style.cursor = locked ? "none" : "crosshair";
    hintEl.innerHTML = locked
      ? "Mouse locked — move the mouse to turn, <b>Esc</b> to release. W/S move, A/D strafe."
      : defaultHintHTML;
    overlayHint.textContent = locked
      ? "Move your mouse to turn, W/S move, A/D strafe."
      : mouselookToggle.checked
      ? "Then move your mouse to turn, and hold W (or W+D)."
      : "Then hold W (or W+D) and tap ← — keep the ring green.";
  });
  mouselookToggle.addEventListener("change", () => {
    if (!mouselookToggle.checked && isLocked()) document.exitPointerLock();
    overlayHint.textContent = mouselookToggle.checked
      ? "Click the scene to lock your mouse, then hold W and turn by looking."
      : "Then hold W (or W+D) and tap ← — keep the ring green.";
  });

  function resetRun() {
    state = { velocity: [300, 0, 0], yaw: 0 };
    pos = [0, 0];
    trail = [[0, 0]];
    speedHistory = [];
  }

  function currentActionLabel() {
    const parts = [];
    if (keys.has("w")) parts.push("moving forward");
    if (keys.has("s")) parts.push("moving back");
    if (keys.has("d")) parts.push("strafing right");
    if (keys.has("a")) parts.push("strafing left");
    if (keys.has("arrowleft") || pendingYawDelta > 0.0005) parts.push("turning left");
    if (keys.has("arrowright") || pendingYawDelta < -0.0005) parts.push("turning right");
    return parts.length ? parts.join(" + ") : "nothing — hold a key";
  }

  function tick() {
    const turnRateDegPerSec = +turnRateInput.value;
    if (keys.has("arrowleft")) state.yaw += ((turnRateDegPerSec * Math.PI) / 180) * CH6_FRAMETIME;
    if (keys.has("arrowright")) state.yaw -= ((turnRateDegPerSec * Math.PI) / 180) * CH6_FRAMETIME;
    // Mouse-right must turn you right, same as arrowright above -- so it
    // shares that exact sign, not the naive "+= movementX" you'd guess.
    if (pendingYawDelta) {
      state.yaw -= pendingYawDelta;
      pendingYawDelta = 0;
    }

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
  // into an unreadable tangle on screen. The compass spokes below are what
  // make that turning visible again despite the camera following you.
  function drawSim() {
    scene.clear();
    scene.rings([0, 0], { step: 70, count: 4 });

    const theta = Math.PI / 2 - state.yaw;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    const rotOnly = (dx, dy) => [dx * ct - dy * st, dx * st + dy * ct];
    const toCam = (p) => rotOnly(p[0] - pos[0], p[1] - pos[1]);

    // fixed compass spokes -- world-anchored directions, rotated into camera
    // space same as everything else. Perfectly circular rings alone give zero
    // visual cue that you've turned at all; these sweep visibly when you do.
    const spokeR = 280;
    for (let deg = 0; deg < 360; deg += 45) {
      const rad = (deg * Math.PI) / 180;
      const dir = rotOnly(Math.cos(rad), Math.sin(rad));
      const end = [dir[0] * spokeR, dir[1] * spokeR];
      scene.line([0, 0], end, { color: deg === 0 ? "rgba(255,209,102,0.55)" : "rgba(255,209,102,0.18)", width: deg === 0 ? 2 : 1, dash: [] });
      if (deg === 0) {
        scene.text([end[0] * 0.92, end[1] * 0.92], "0°", { color: "rgba(255,209,102,0.8)", font: "11px 'JetBrains Mono', monospace" });
      }
    }

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
    doingEl.textContent = currentActionLabel();

    // heading readout + a small always-north-up compass widget, independent
    // of the rotating main view -- a second, unambiguous orientation cue.
    let headingDeg = ((state.yaw * 180) / Math.PI) % 360;
    if (headingDeg < 0) headingDeg += 360;
    headingEl.textContent = headingDeg.toFixed(0) + "°";

    cctx.clearRect(0, 0, compassCanvas.width, compassCanvas.height);
    const cx = compassCanvas.width / 2,
      cy = compassCanvas.height / 2,
      cr = compassCanvas.width / 2 - 6;
    cctx.strokeStyle = "rgba(255,255,255,0.25)";
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.arc(cx, cy, cr, 0, Math.PI * 2);
    cctx.stroke();
    cctx.fillStyle = "#8fa89a";
    cctx.font = "10px 'JetBrains Mono', monospace";
    cctx.textAlign = "center";
    cctx.fillText("0°", cx, cy - cr + 10);
    const needleAngle = Math.PI / 2 - state.yaw; // screen-up = 0 deg world, matches main view
    cctx.strokeStyle = "#eafff2";
    cctx.lineWidth = 2.5;
    cctx.beginPath();
    cctx.moveTo(cx, cy);
    cctx.lineTo(cx + Math.cos(needleAngle) * (cr - 8), cy - Math.sin(needleAngle) * (cr - 8));
    cctx.stroke();
    cctx.fillStyle = "#eafff2";
    cctx.beginPath();
    cctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    cctx.fill();

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

  // Fixed-timestep accumulator -- see Chapter 9's identical comment. Calling
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
