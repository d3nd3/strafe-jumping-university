// Every plain-English term below is immediately followed by the exact
// variable name it refers to in the code panel (amber, monospace) -- so
// "target direction" and "wishdir" are always visibly the same thing,
// without needing a hover or a separate legend to look up.
const V = (name) => `<span class="varname">${name}</span>`;
const DESCRIPTIONS = {
  decl: `We know 3 things: which way you're trying to go (${V("wishdir")}), how fast you want to go (${V("wishspeed")}), and how strong the boost is (${V("accel")}).`,
  currentspeed: `Check how much of your current motion (${V("velocity")}) is already pointed the way you're trying to go. That amount is ${V("currentspeed")}.`,
  addspeed: `Work out how much speed room is left (${V("addspeed")}) before you'd hit your target speed.`,
  "early-return": `No room left (${V("addspeed")} ≤ 0) — you're already going fast enough that way. Nothing changes.`,
  accelspeed: `Work out this step's boost (${V("accelspeed")}): boost power × tick length × target speed.`,
  clamp: `Don't overshoot. If the boost (${V("accelspeed")}) is bigger than the room left (${V("addspeed")}), shrink it to fit.`,
  apply: `Add the boost — but <strong>only</strong> in the direction you're trying to go (${V("wishdir")}). Everything sideways to that is left completely alone.`,
};

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
    </div>

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
      Try angle ≈ 90° with a high starting speed. Almost none of your speed already points the
      target way, so nearly the whole boost gets added — and your <em>total</em> speed after can
      end up higher than your target speed. That's the whole trick.
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
      scene.point(proj, { color: "#fff", label: "already matches" });
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
    describe: (step) => `<div>${DESCRIPTIONS[step.id] || ""}</div>`,
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
