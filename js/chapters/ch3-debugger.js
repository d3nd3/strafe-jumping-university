
const DESCRIPTIONS = {
  decl: "PM_Accelerate takes a wishdir (a unit vector — the direction you're asking to go), a wishspeed (how fast you're asking to go), and accel (a tuning knob: 10 on the ground, usually 1 in the air). Its whole job is to nudge <code>velocity</code> a little bit closer to that wish.",
  currentspeed: "This is the single most important line in the whole mystery. <code>DotProduct(velocity, wishdir)</code> projects your current velocity onto the wishdir axis — it answers 'of my current speed, how much of it is already going the direction I just asked for?' Note it completely ignores any part of your velocity that's sideways to wishdir.",
  addspeed: "addspeed is just 'how much more speed, along wishdir, would it take to reach wishspeed'. If your projected speed is already at or past wishspeed, addspeed goes zero or negative.",
  "early-return": "Nothing to add — you're already going at least as fast as you wished for, along that direction. The function bails out here and velocity is untouched this tick.",
  accelspeed: "accelspeed is how much speed we're actually allowed to add <em>this tick</em>: accel × frametime × wishspeed. Smaller frametime (higher framerate) means smaller steps, but also more steps per second — this is why old Quake engines were famously framerate-sensitive for movement.",
  clamp: "Safety clamp: never overshoot. If the allowed accelspeed this tick is bigger than what's actually needed (addspeed), just add exactly addspeed instead.",
  apply: "The payoff line. accelspeed is added along wishdir — and <strong>only</strong> along wishdir. Any part of your velocity that was sideways to wishdir is left completely alone. That's the entire trick this app is built to explain.",
};

function mountCh3Debugger(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 3 · The Accelerate Debugger</div>
    <h1>Step through PM_Accelerate exactly like a debugger</h1>
    <p class="lede">
      This is the real function. Set up a scenario below, then hit <strong>Step</strong>
      repeatedly (or Play) to execute it one line at a time — in both the original C and this
      app's JS port, together, with live values.
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col" style="flex:0 0 300px">
          <div class="controls">
            <div class="control-row">
              <label><span>starting speed |velocity|</span><span id="d-speed-val">250</span></label>
              <input type="range" id="d-speed" min="0" max="500" step="5" value="250" />
            </div>
            <div class="control-row">
              <label><span>angle between velocity &amp; wishdir (θ)</span><span id="d-theta-val">40°</span></label>
              <input type="range" id="d-theta" min="0" max="179" step="1" value="40" />
            </div>
            <div class="control-row">
              <label><span>wishspeed</span><span id="d-wishspeed-val">300</span></label>
              <input type="range" id="d-wishspeed" min="0" max="400" step="5" value="300" />
            </div>
            <div class="control-row">
              <label><span>accel</span><span id="d-accel-val">1 (air)</span></label>
              <input type="range" id="d-accel" min="0" max="1" step="1" value="0" />
            </div>
            <div class="control-row">
              <label><span>frametime (ms this tick)</span><span id="d-ft-val">10</span></label>
              <input type="range" id="d-ft" min="1" max="100" step="1" value="10" />
            </div>
          </div>
          <canvas class="scene" id="d-canvas" style="height:280px;margin-top:14px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#888"></span>velocity (before)</span>
            <span><span class="swatch" style="background:#ffd166"></span>wishdir (× wishspeed)</span>
            <span><span class="swatch" style="background:#7dffb0"></span>velocity (after)</span>
          </div>
        </div>
        <div class="panel-col" id="d-mount" style="flex:1 1 560px"></div>
      </div>
    </div>

    <div class="callout good">
      Set θ around 90° with a high starting speed and step through it: <code>currentspeed</code>
      comes out near zero, so <code>addspeed</code> stays almost the full <code>wishspeed</code>
      even though you're already going fast. The new velocity's <em>magnitude</em> after Step
      "apply" can end up larger than before <strong>and</strong> larger than wishspeed — because
      the old velocity's sideways component never got touched.
    </div>

    <a class="next-link" href="#ch4-air-vs-ground">Continue → Chapter 4: why the air is so much stingier than the ground</a>
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

    scene.arrow([0, 0], [originalVelocity[0], originalVelocity[1]], { color: "#888", label: "velocity (before)" });
    scene.arrow([0, 0], [wishdirVec[0] * wishspeedNum, wishdirVec[1] * wishspeedNum], {
      color: "#ffd166",
      dash: true,
      label: "wishdir × wishspeed",
    });

    if (step && step.locals && "currentspeed" in step.locals) {
      const cs = step.locals.currentspeed;
      const proj = [wishdirVec[0] * cs, wishdirVec[1] * cs];
      scene.line([originalVelocity[0], originalVelocity[1]], proj, { color: "rgba(255,255,255,0.35)" });
      scene.point(proj, { color: "#fff", label: "currentspeed" });
      if ("addspeed" in step.locals) {
        const target = [wishdirVec[0] * wishspeedNum, wishdirVec[1] * wishspeedNum];
        scene.line(proj, target, { color: "rgba(255,209,102,0.7)", dash: [3, 3], width: 3 });
      }
    }

    if (step && step.locals && step.locals.velocity) {
      const v = step.locals.velocity;
      scene.arrow([0, 0], [v[0], v[1]], { color: "#7dffb0", width: 3.5, label: "velocity (after)" });
    }
  }

  const dbg = createDebugger({
    mount: section.querySelector("#d-mount"),
    title: "PM_Accelerate",
    cSource: C_ACCELERATE,
    jsSource: JS_ACCELERATE,
    map: ACCELERATE_MAP,
    makeGenerator,
    describe: (step) => `<div class="muted" style="margin-top:6px">${DESCRIPTIONS[step.id] || ""}</div>`,
  });
  dbg.onChange(draw);
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
