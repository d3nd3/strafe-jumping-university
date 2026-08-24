// The step descriptions (ACCELERATE_DESCRIPTIONS / describeAccelerateStep,
// AIR_MOVE_DESCRIPTIONS / describeAirMoveToAccelerate, AIR_ACCELERATE_DESCRIPTIONS
// / describeAirAccelerateStep) live in core/sourceText.js -- Chapter 6 and 7's
// "Freeze & inspect" panels reuse describeAccelerateStep, not a copy of it.

function mountCh3Debugger(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 3 · Step Through the Real Code</div>
    <h1>The one function that does all of this</h1>
    <p class="lede">Press <strong>Step</strong> and watch it run, one line at a time, in the real game code and a JS copy, side by side.</p>

    <p class="muted" style="margin-bottom:4px">Plain words on the left, the real code's name on the right — same thing, always shown together:</p>
    <div class="term-strip">
      <span class="term-chip"><b>target direction</b> <span class="varname">wishdir</span> = the way you're steering</span>
      <span class="term-chip"><b>target speed</b> <span class="varname">wishspeed</span> = how fast you're trying to go</span>
      <span class="term-chip"><b>boost power</b> <span class="varname">accel</span> = how strong the push is (10 on ground, 1 in air)</span>
      <span class="term-chip"><b>tick length</b> <span class="varname">frametime</span> = time since the last update</span>
      <span class="term-chip"><b>direction only</b> <span class="varname">wishdir</span> = always exactly 1 unit long (a "unit vector") — carries a direction, no speed</span>
      <span class="term-chip"><b>your real speed</b> <span class="varname">velocity</span> = NOT a unit vector — its length literally <em>is</em> your current speed</span>
    </div>
    <p class="muted" style="margin-top:2px">
      Confirmed straight from id Software's own Quake 2 source (<span class="varname">qcommon/pmove.c</span>):
      right before <span class="varname">PM_AirMove</span> calls this function, it runs
      <span class="varname">wishspeed = VectorNormalize(wishdir)</span> — that line divides
      <span class="varname">wishdir</span> by its own length, which forces its length to exactly 1
      and hands the length it used to have over to <span class="varname">wishspeed</span> instead.
      So every time this function runs, <span class="varname">wishdir</span> is guaranteed to be
      a pure direction (length 1) and <span class="varname">velocity</span> is never touched that
      way — its length is always your real, uncapped speed.
    </p>

    <div class="mystery">
      <strong>Common question: if wishspeed is "the length wishdir had," does that mean wishspeed
      equals the length of velocity (your actual speed)?</strong> No — and this trips people up
      constantly. <span class="varname">wishspeed</span> is the length of <span class="varname">wishvel</span>,
      a totally different, short-lived vector built fresh every tick from your <em>keys and view
      angle</em> (Section 1 below shows exactly how). <span class="varname">velocity</span> is your
      <em>actual</em>, accumulated motion — built up over many previous ticks, and never directly
      set from your input at all. They're two unrelated numbers that happen to share the word
      "speed." <span class="varname">wishspeed</span> is capped at 300 (or 100 crouched);
      <span class="varname">velocity</span>'s length has no such cap, and can climb well past 300 —
      that gap between "what you're asking for" and "what you actually have" is the entire reason
      circle-strafing works.
    </div>

    <h2>Section 1 — where wishdir and wishspeed actually come from</h2>
    <p class="muted">
      This isn't a separate example — it's the real calling function, <span class="varname">PM_AirMove</span>,
      stepped live. Set your view angle and which keys you're holding, then watch it build
      <span class="varname">wishdir</span>/<span class="varname">wishspeed</span> from scratch and
      flow straight into the same boost function below, in one continuous run.
    </p>
    <div class="panel">
      <div class="panel-row">
        <div class="panel-col" style="flex:0 0 300px">
          <div class="controls">
            <div class="control-row">
              <label><span>your current speed (velocity)</span><span id="c-speed-val">200</span></label>
              <input type="range" id="c-speed" min="0" max="500" step="5" value="200" />
            </div>
            <div class="control-row">
              <label><span>view angle (yaw)</span><span id="c-yaw-val">40°</span></label>
              <input type="range" id="c-yaw" min="0" max="359" step="1" value="40" />
            </div>
            <div class="control-row">
              <label><span>forward key, W/S</span><span id="c-fmove-val">400</span></label>
              <input type="range" id="c-fmove" min="-400" max="400" step="10" value="400" />
            </div>
            <div class="control-row">
              <label><span>strafe key, A/D</span><span id="c-smove-val">0</span></label>
              <input type="range" id="c-smove" min="-400" max="400" step="10" value="0" />
            </div>
            <div class="control-row">
              <label><span>tick length (ms)</span><span id="c-ft-val">10</span></label>
              <input type="range" id="c-ft" min="1" max="100" step="1" value="10" />
            </div>
          </div>
          <canvas class="scene" id="c-canvas" style="height:280px;margin-top:14px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#888"></span>velocity (before)</span>
            <span><span class="swatch" style="background:#ffd166"></span>wishdir × wishspeed</span>
            <span><span class="swatch" style="background:#7dffb0"></span>velocity (after)</span>
          </div>
        </div>
        <div class="panel-col" id="c-mount" style="flex:1 1 560px"></div>
      </div>
    </div>

    <div class="callout">
      Notice <span class="varname">velocity</span> (grey arrow) never lines up with
      <span class="varname">wishdir</span>×<span class="varname">wishspeed</span> (amber arrow)
      unless you point your view exactly at your current direction of travel. That's normal —
      they're independent the whole time. Try setting speed to 400 (above the 300 cap) and watch
      <span class="varname">wishspeed</span> stay capped at 300 regardless.
    </div>

    <h2>Section 2 — experiment freely</h2>
    <p class="muted">
      Section 1 only lets you reach velocity/wishdir combinations a real key+view input could
      produce. This panel drops that restriction — punch in <em>any</em> starting speed, any
      angle, any target speed directly, to explore the boost math on its own.
    </p>
    <div class="panel">
      <div class="panel-row">
        <div class="panel-col" style="flex:0 0 300px">
          <div class="controls">
            <div class="control-row">
              <label><span>your starting speed</span><span id="d-speed-val">250</span></label>
              <input type="range" id="d-speed" min="0" max="500" step="5" value="250" />
            </div>
            <div class="control-row">
              <label><span>angle to your target direction</span><span id="d-theta-val">40°</span></label>
              <input type="range" id="d-theta" min="0" max="179" step="1" value="40" />
            </div>
            <div class="control-row">
              <label><span>target speed</span><span id="d-wishspeed-val">300</span></label>
              <input type="range" id="d-wishspeed" min="0" max="400" step="5" value="300" />
            </div>
            <div class="control-row">
              <label><span>boost power</span><span id="d-accel-val">1 (air)</span></label>
              <input type="range" id="d-accel" min="0" max="1" step="1" value="0" />
            </div>
            <div class="control-row">
              <label><span>tick length (ms)</span><span id="d-ft-val">10</span></label>
              <input type="range" id="d-ft" min="1" max="100" step="1" value="10" />
            </div>
          </div>
          <canvas class="scene" id="d-canvas" style="height:280px;margin-top:14px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#888"></span>motion before</span>
            <span><span class="swatch" style="background:#ffd166"></span>target</span>
            <span><span class="swatch" style="background:#7dffb0"></span>motion after</span>
          </div>
        </div>
        <div class="panel-col" id="d-mount" style="flex:1 1 560px"></div>
      </div>
    </div>

    <div class="callout good">
      Try angle ≈ 90° with a high starting speed. Your speed toward target comes out near zero
      (almost none of your motion points the target way yet), so nearly the whole boost gets
      added — and your <em>total</em> speed after can end up higher than your target speed.
      That's the whole trick.
    </div>

    <h2>Section 3 — PM_AirAccelerate: real Quake 2 code, not SoF's own</h2>
    <p class="muted">
      id's public <span class="varname">pmove.c</span> has a <em>second</em> boost function meant
      for the air, with a gentler 30-unit cap baked in, gated behind
      <span class="varname">pm_airaccelerate</span> as a boolean: nonzero calls the capped
      function, zero falls back to the ordinary boost with power 1. But decompiling the actual
      retail <span class="varname">SoF.exe</span> binary directly — cross-checked against a Linux
      build too — shows no such branch at all. There's one boost computation in the air, and
      <span class="varname">pm_airaccelerate</span> feeds it directly as the strength, exactly the
      way <span class="varname">pm_accelerate</span> feeds the ground/ladder boost. It's hardcoded
      to <b>1</b> (not 0 — always on, just weak), and the capped 30-unit formula is nowhere in the
      compiled code: no <code>30.0</code> constant, no separate <em>addspeed</em> computed from a
      clamped wish speed — the tell that would have to survive even if the call were merely
      inlined. So it's not that SoF ships this function disabled; SoF's own
      <span class="varname">PM_AirMove</span> was written without it. Worth understanding anyway —
      it's real code, and some other Quake 2 engines and mods do wire it up.
    </p>
    <div class="panel">
      <div class="panel-row">
        <div class="panel-col" style="flex:0 0 300px">
          <div class="controls">
            <div class="control-row">
              <label><span>your starting speed</span><span id="e-speed-val">250</span></label>
              <input type="range" id="e-speed" min="0" max="500" step="5" value="250" />
            </div>
            <div class="control-row">
              <label><span>angle to your target direction</span><span id="e-theta-val">40°</span></label>
              <input type="range" id="e-theta" min="0" max="179" step="1" value="40" />
            </div>
            <div class="control-row">
              <label><span>target speed (wishspeed)</span><span id="e-wishspeed-val">300</span></label>
              <input type="range" id="e-wishspeed" min="0" max="400" step="5" value="300" />
            </div>
            <div class="control-row">
              <label><span>tick length (ms)</span><span id="e-ft-val">10</span></label>
              <input type="range" id="e-ft" min="1" max="100" step="1" value="10" />
            </div>
          </div>
          <p class="muted" style="font-size:12.5px">
            No boost-power slider here — this function's only real caller always passes
            <span class="varname">accel</span> = <code>pm_accelerate</code> = <b>10</b> (the
            ground's strength, not air's usual 1), which is exactly why the 30-unit cap exists:
            to keep that much power from feeling absurd in the air.
          </p>
          <canvas class="scene" id="e-canvas" style="height:280px;margin-top:4px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#888"></span>motion before</span>
            <span><span class="swatch" style="background:#ffd166"></span>target</span>
            <span><span class="swatch" style="background:#7dffb0"></span>motion after</span>
          </div>
        </div>
        <div class="panel-col" id="e-mount" style="flex:1 1 560px"></div>
      </div>
    </div>

    <div class="callout">
      Watch the locals panel for <span class="varname">wishspd</span> vs
      <span class="varname">wishspeed</span> — this function uses the 30-capped copy to decide
      how much <em>room</em> is left to accelerate, but the FULL, uncapped target speed to size
      how big the boost itself is. Two different numbers, same name, same function.
    </div>

    <a class="next-link" href="#ch4-air-vs-ground">Continue → Chapter 4: ground vs. air</a>
  `;

  // ---- Section 1: PM_AirMove -> PM_Accelerate, the real calling chain ----
  const cCanvas = section.querySelector("#c-canvas");
  const cScene = createScene(cCanvas, { originX: 0.5, originY: 0.5, scale: 0.6 });
  const speedC = section.querySelector("#c-speed");
  const yawC = section.querySelector("#c-yaw");
  const fmoveC = section.querySelector("#c-fmove");
  const smoveC = section.querySelector("#c-smove");
  const ftC = section.querySelector("#c-ft");
  const speedCVal = section.querySelector("#c-speed-val");
  const yawCVal = section.querySelector("#c-yaw-val");
  const fmoveCVal = section.querySelector("#c-fmove-val");
  const smoveCVal = section.querySelector("#c-smove-val");
  const ftCVal = section.querySelector("#c-ft-val");

  let callerState = { velocity: [200, 0, 0], yaw: 0 };
  let callerOriginalVelocity = [200, 0, 0];
  let callerWishdir = null;
  let callerWishspeed = 0;

  function makeCallerGenerator() {
    const speed = +speedC.value;
    const yaw = (+yawC.value * Math.PI) / 180;
    const fmove = +fmoveC.value;
    const smove = +smoveC.value;
    const frametime = +ftC.value / 1000;
    callerState = { velocity: [speed, 0, 0], yaw };
    callerOriginalVelocity = [speed, 0, 0];
    callerWishdir = null;
    callerWishspeed = 0;
    return pmAirMoveSteps(callerState, { forwardmove: fmove, sidemove: smove }, frametime);
  }

  function updateCallerLabels() {
    speedCVal.textContent = speedC.value;
    yawCVal.textContent = yawC.value + "°";
    fmoveCVal.textContent = fmoveC.value;
    smoveCVal.textContent = smoveC.value;
    ftCVal.textContent = ftC.value;
  }

  // wishdir/wishspeed only appear in the locals of one step ("wishdir") --
  // every step after that (the clamp, the branch, and every delegated
  // PM_Accelerate step) needs them too, so remember the last values seen.
  function drawCaller(step) {
    cScene.clear();
    cScene.grid();
    cScene.arrow([0, 0], [callerOriginalVelocity[0], callerOriginalVelocity[1]], { color: "#888", label: "before" });

    if (step && step.locals && step.locals.wishdir) {
      callerWishdir = step.locals.wishdir;
    }
    if (step && step.locals && "wishspeed" in step.locals) {
      callerWishspeed = step.locals.wishspeed;
    }
    if (callerWishdir) {
      cScene.arrow([0, 0], [callerWishdir[0] * callerWishspeed, callerWishdir[1] * callerWishspeed], {
        color: "#ffd166",
        dash: true,
        label: "wishdir × wishspeed",
      });
    }

    if (callerWishdir && step && step.locals && "currentspeed" in step.locals) {
      const cs = step.locals.currentspeed;
      const proj = [callerWishdir[0] * cs, callerWishdir[1] * cs];
      cScene.line([callerOriginalVelocity[0], callerOriginalVelocity[1]], proj, { color: "rgba(255,255,255,0.35)" });
      cScene.point(proj, { color: "#fff", label: "speed toward target" });
      if ("addspeed" in step.locals) {
        const target = [callerWishdir[0] * callerWishspeed, callerWishdir[1] * callerWishspeed];
        cScene.line(proj, target, { color: "rgba(255,209,102,0.7)", dash: [3, 3], width: 3 });
      }
    }

    if (step && step.locals && step.locals.velocity) {
      const v = step.locals.velocity;
      cScene.arrow([0, 0], [v[0], v[1]], { color: "#7dffb0", width: 3.5, label: "after" });
    }
  }

  const dbgCaller = createDebugger({
    mount: section.querySelector("#c-mount"),
    title: "PM_AirMove -> PM_Accelerate (the real calling chain)",
    cSource: C_AIRMOVE_TO_ACCELERATE,
    jsSource: JS_AIRMOVE_TO_ACCELERATE,
    map: AIRMOVE_TO_ACCELERATE_MAP,
    makeGenerator: makeCallerGenerator,
    describe: describeAirMoveToAccelerate,
  });
  dbgCaller.onChange(drawCaller);
  cScene.setRedraw(() => drawCaller(dbgCaller.currentStep));
  drawCaller(null);

  [speedC, yawC, fmoveC, smoveC, ftC].forEach((el) =>
    el.addEventListener("input", () => {
      updateCallerLabels();
      dbgCaller.reset();
      drawCaller(null);
    })
  );
  updateCallerLabels();

  // ---- Section 2: PM_Accelerate, free experimentation (unchanged) ----
  const canvas = section.querySelector("#d-canvas");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.5, scale: 0.6 });
  const speedInput = section.querySelector("#d-speed");
  const thetaInput = section.querySelector("#d-theta");
  const wishspeedInput = section.querySelector("#d-wishspeed");
  const accelInput = section.querySelector("#d-accel");
  const ftInput = section.querySelector("#d-ft");
  const speedVal = section.querySelector("#d-speed-val");
  const thetaVal = section.querySelector("#d-theta-val");
  const wishspeedVal = section.querySelector("#d-wishspeed-val");
  const accelVal = section.querySelector("#d-accel-val");
  const ftVal = section.querySelector("#d-ft-val");

  let velocity = [0, 0, 0];
  let originalVelocity = [0, 0, 0];
  let wishdirVec = [1, 0, 0];
  let wishspeedNum = 300;

  function makeGenerator() {
    const speed = +speedInput.value;
    const theta = (+thetaInput.value * Math.PI) / 180;
    wishspeedNum = +wishspeedInput.value;
    const accel = +accelInput.value === 1 ? 10 : 1;
    const frametime = +ftInput.value / 1000;

    velocity = [speed, 0, 0];
    originalVelocity = [speed, 0, 0];
    wishdirVec = [Math.cos(theta), Math.sin(theta), 0];

    return pmAccelerateSteps(velocity, wishdirVec, wishspeedNum, accel, frametime);
  }

  function updateLabels() {
    speedVal.textContent = speedInput.value;
    thetaVal.textContent = thetaInput.value + "°";
    wishspeedVal.textContent = wishspeedInput.value;
    accelVal.textContent = +accelInput.value === 1 ? "10 (ground)" : "1 (air)";
    ftVal.textContent = ftInput.value;
  }

  function draw(step) {
    scene.clear();
    scene.grid();

    scene.arrow([0, 0], [originalVelocity[0], originalVelocity[1]], { color: "#888", label: "before" });
    scene.arrow([0, 0], [wishdirVec[0] * wishspeedNum, wishdirVec[1] * wishspeedNum], {
      color: "#ffd166",
      dash: true,
      label: "target",
    });

    if (step && step.locals && "currentspeed" in step.locals) {
      const cs = step.locals.currentspeed;
      const proj = [wishdirVec[0] * cs, wishdirVec[1] * cs];
      scene.line([originalVelocity[0], originalVelocity[1]], proj, { color: "rgba(255,255,255,0.35)" });
      scene.point(proj, { color: "#fff", label: "speed toward target" });
      if ("addspeed" in step.locals) {
        const target = [wishdirVec[0] * wishspeedNum, wishdirVec[1] * wishspeedNum];
        scene.line(proj, target, { color: "rgba(255,209,102,0.7)", dash: [3, 3], width: 3 });
      }
    }

    if (step && step.locals && step.locals.velocity) {
      const v = step.locals.velocity;
      scene.arrow([0, 0], [v[0], v[1]], { color: "#7dffb0", width: 3.5, label: "after" });
    }
  }

  const dbg = createDebugger({
    mount: section.querySelector("#d-mount"),
    title: "PM_Accelerate",
    cSource: C_ACCELERATE,
    jsSource: JS_ACCELERATE,
    map: ACCELERATE_MAP,
    makeGenerator,
    describe: describeAccelerateStep,
  });
  dbg.onChange(draw);
  scene.setRedraw(() => draw(dbg.currentStep));
  draw(null);

  [speedInput, thetaInput, wishspeedInput, accelInput, ftInput].forEach((el) =>
    el.addEventListener("input", () => {
      updateLabels();
      dbg.reset();
      draw(null);
    })
  );
  updateLabels();

  // ---- Section 3: PM_AirAccelerate, the 30-cap variant ----
  const eCanvas = section.querySelector("#e-canvas");
  const eScene = createScene(eCanvas, { originX: 0.5, originY: 0.5, scale: 0.6 });
  const speedE = section.querySelector("#e-speed");
  const thetaE = section.querySelector("#e-theta");
  const wishspeedE = section.querySelector("#e-wishspeed");
  const ftE = section.querySelector("#e-ft");
  const speedEVal = section.querySelector("#e-speed-val");
  const thetaEVal = section.querySelector("#e-theta-val");
  const wishspeedEVal = section.querySelector("#e-wishspeed-val");
  const ftEVal = section.querySelector("#e-ft-val");

  let eVelocity = [0, 0, 0];
  let eOriginalVelocity = [0, 0, 0];
  let eWishdirVec = [1, 0, 0];
  let eWishspeedNum = 300;

  function makeAirAccelGenerator() {
    const speed = +speedE.value;
    const theta = (+thetaE.value * Math.PI) / 180;
    eWishspeedNum = +wishspeedE.value;
    const frametime = +ftE.value / 1000;

    eVelocity = [speed, 0, 0];
    eOriginalVelocity = [speed, 0, 0];
    eWishdirVec = [Math.cos(theta), Math.sin(theta), 0];

    return pmAirAccelerateSteps(eVelocity, eWishdirVec, eWishspeedNum, pm_accelerate, frametime);
  }

  function updateAirAccelLabels() {
    speedEVal.textContent = speedE.value;
    thetaEVal.textContent = thetaE.value + "°";
    wishspeedEVal.textContent = wishspeedE.value;
    ftEVal.textContent = ftE.value;
  }

  function drawAirAccel(step) {
    eScene.clear();
    eScene.grid();

    eScene.arrow([0, 0], [eOriginalVelocity[0], eOriginalVelocity[1]], { color: "#888", label: "before" });
    eScene.arrow([0, 0], [eWishdirVec[0] * eWishspeedNum, eWishdirVec[1] * eWishspeedNum], {
      color: "#ffd166",
      dash: true,
      label: "target",
    });

    if (step && step.locals && "currentspeed" in step.locals) {
      const cs = step.locals.currentspeed;
      const proj = [eWishdirVec[0] * cs, eWishdirVec[1] * cs];
      eScene.line([eOriginalVelocity[0], eOriginalVelocity[1]], proj, { color: "rgba(255,255,255,0.35)" });
      eScene.point(proj, { color: "#fff", label: "speed toward target" });
    }

    if (step && step.locals && step.locals.velocity) {
      const v = step.locals.velocity;
      eScene.arrow([0, 0], [v[0], v[1]], { color: "#7dffb0", width: 3.5, label: "after" });
    }
  }

  const dbgAirAccel = createDebugger({
    mount: section.querySelector("#e-mount"),
    title: "PM_AirAccelerate",
    cSource: C_AIR_ACCELERATE,
    jsSource: JS_AIR_ACCELERATE,
    map: AIR_ACCELERATE_MAP,
    makeGenerator: makeAirAccelGenerator,
    describe: describeAirAccelerateStep,
  });
  dbgAirAccel.onChange(drawAirAccel);
  eScene.setRedraw(() => drawAirAccel(dbgAirAccel.currentStep));
  drawAirAccel(null);

  [speedE, thetaE, wishspeedE, ftE].forEach((el) =>
    el.addEventListener("input", () => {
      updateAirAccelLabels();
      dbgAirAccel.reset();
      drawAirAccel(null);
    })
  );
  updateAirAccelLabels();
}
