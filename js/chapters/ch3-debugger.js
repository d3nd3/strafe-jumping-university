// The step descriptions (ACCELERATE_DESCRIPTIONS / describeAccelerateStep)
// live in core/sourceText.js -- Chapter 6 and 7's "Freeze & inspect" panels
// walk this same function and share the exact same wording, not a copy.

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

    <a class="next-link" href="#ch4-air-vs-ground">Continue → Chapter 4: ground vs. air</a>
  `;

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
}
