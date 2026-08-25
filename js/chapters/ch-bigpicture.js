// Chapter 2 -- the 10,000ft view, before any code. Every later chapter is
// really just answering one of three questions about a single repeated
// operation: velocity = velocity + nudge. This chapter shows that operation
// happening, geometrically, with nothing else in the way -- reusing the exact
// real pmAccelerateSteps generator (physics.js), just with a hand-picked
// wishdir instead of one derived from keys, so nothing shown here is fake.

const CH_BIGPICTURE_DT = 0.01;
const CH_BIGPICTURE_TRAIL_MAX = 420;

function mountChBigPicture(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 2 · The Big Picture</div>
    <h1>Zoom out: pmove.c does one thing, a hundred times a second</h1>
    <p class="lede">
      Every tick, the engine looks at your current <b>velocity</b> -- an arrow: a speed and a
      direction -- decides a direction it <b>wishes</b> you were heading, and adds a small
      <b>nudge</b> vector aimed that way onto what you already have.
    </p>
    <p class="lede" style="margin-top:-6px">
      <span class="varname">velocity = velocity + nudge</span>. That's it. That one line, run 100
      times a second, is the entire subject of this site. Every chapter ahead is really just
      answering one of three questions about it: which way does the nudge point, how big is it
      allowed to be, and what happens if you keep changing the answer to the first question every
      single tick. Watch it happen before any code shows up.
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col" style="flex:1 1 480px">
          <canvas class="scene" id="bp-canvas" style="height:420px"></canvas>
          <div class="legend">
            <span><span class="swatch" style="background:#eafff2"></span>velocity (this tick)</span>
            <span><span class="swatch" style="background:#ffd166"></span>nudge, just applied</span>
            <span><span class="swatch" style="background:rgba(255,209,102,0.5)"></span>wishdir (where it's aimed)</span>
            <span><span class="swatch" style="background:#5fb4ff"></span>trail of every past velocity</span>
          </div>
        </div>
        <div class="panel-col sticky-controls controls" style="flex:0 0 260px">
          <div class="control-row">
            <label><span>① steer angle (nudge vs. velocity)</span><span id="bp-angle-val">22°</span></label>
            <input type="range" id="bp-angle" min="-10" max="80" step="1" value="22" />
          </div>
          <div class="control-row">
            <label><span>② push strength</span></label>
            <select id="bp-mode" style="width:100%;padding:6px;background:var(--bg-raised);color:var(--text);border:1px solid var(--border);border-radius:6px">
              <option value="air" selected>air (weak push, accel = 1)</option>
              <option value="ground">ground (strong push, accel = 10)</option>
            </select>
          </div>
          <div class="btn-row">
            <button class="btn primary" id="bp-play">⏸ Pause</button>
            <button class="btn" id="bp-reset">⟲ Reset</button>
          </div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">SPEED RIGHT NOW</span><span class="v" id="bp-speed">300</span></div>
            <div class="hud-stat"><span class="k">TICKS SO FAR</span><span class="v" id="bp-ticks">0</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="callout">
      At <b>0°</b> the nudge points exactly where you're already going -- it closes the gap to top
      speed and then stops, same as walking in a straight line. Push the angle up around
      <b>15&ndash;30°</b> and the nudge is aimed slightly <em>off</em> to the side of where you're
      already moving. It still lengthens the arrow, but it also bends it -- so next tick's
      "straight ahead" is already a little different from this tick's. The process never settles.
      Watch the speed number.
    </div>

    <div class="mystery">
      <strong>Everything ahead is this one idea, made precise:</strong>
      <ul style="margin:8px 0 0;padding-left:20px;line-height:1.9">
        <li>What exactly decides which way the nudge points — Chapter 3</li>
        <li>The exact formula behind the nudge's size, line by line — Chapter 4</li>
        <li>Why the nudge is 10× bigger on the ground than in the air — Chapter 5</li>
        <li>The ground's other secret weapon: subtracting speed back out every tick — Chapter 6</li>
        <li>The exact angle that makes the nudge add speed forever — Chapter 7</li>
      </ul>
    </div>

    <a class="next-link" href="#ch2-wishdir">Continue → Chapter 3: what your keys actually do</a>
  `;

  const canvas = section.querySelector("#bp-canvas");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.5, scale: 1 });
  const angleInput = section.querySelector("#bp-angle");
  const angleVal = section.querySelector("#bp-angle-val");
  const modeSelect = section.querySelector("#bp-mode");
  const playBtn = section.querySelector("#bp-play");
  const resetBtn = section.querySelector("#bp-reset");
  const speedEl = section.querySelector("#bp-speed");
  const ticksEl = section.querySelector("#bp-ticks");

  let velocity, trail, ticks, playing;

  function reset() {
    velocity = [300, 0, 0];
    trail = [[300, 0]];
    ticks = 0;
    playing = true;
    playBtn.textContent = "⏸ Pause";
  }
  reset();

  function step() {
    const steerRad = (+angleInput.value * Math.PI) / 180;
    const heading = velocity[0] === 0 && velocity[1] === 0 ? 0 : Math.atan2(velocity[1], velocity[0]);
    const wishHeading = heading + steerRad;
    const wishdir = [Math.cos(wishHeading), Math.sin(wishHeading), 0];
    const accel = modeSelect.value === "ground" ? pm_accelerate : pm_airaccelerate;

    const gen = pmAccelerateSteps(velocity, wishdir, pm_maxspeed, accel, CH_BIGPICTURE_DT);
    while (!gen.next().done) {}

    trail.push([velocity[0], velocity[1]]);
    if (trail.length > CH_BIGPICTURE_TRAIL_MAX) trail.shift();
    ticks++;
    return wishdir;
  }

  function draw(wishdir) {
    const speed = VectorLength(velocity);
    const viewMax = Math.max(420, speed * 1.25);
    const rect = canvas.getBoundingClientRect();
    const halfExtent = Math.min(rect.width, rect.height) / 2 - 20;
    scene.setScale(Math.max(0.05, halfExtent / viewMax));

    scene.clear();
    scene.rings([0, 0], { step: viewMax / 4, count: 4, color: "rgba(120,255,170,0.1)" });

    // highlight the ground's 300 cap specifically, when it's in view
    if (viewMax > 60) {
      const [ox, oy] = scene.toPixel(0, 0);
      const [rx] = scene.toPixel(300, 0);
      const r = Math.abs(rx - ox);
      scene.ctx.save();
      scene.ctx.strokeStyle = "rgba(255,209,102,0.35)";
      scene.ctx.setLineDash([3, 4]);
      scene.ctx.beginPath();
      scene.ctx.arc(ox, oy, r, 0, Math.PI * 2);
      scene.ctx.stroke();
      scene.ctx.restore();
      scene.text([300 / Math.SQRT2, 300 / Math.SQRT2], "300 (ground cap)", {
        color: "rgba(255,209,102,0.6)",
        font: "11px 'JetBrains Mono', monospace",
      });
    }

    // trail of every past velocity vector's tip
    scene.ctx.save();
    scene.ctx.strokeStyle = "rgba(95,180,255,0.55)";
    scene.ctx.lineWidth = 2;
    scene.ctx.beginPath();
    trail.forEach((p, i) => {
      const [x, y] = scene.toPixel(p[0], p[1]);
      if (i === 0) scene.ctx.moveTo(x, y);
      else scene.ctx.lineTo(x, y);
    });
    scene.ctx.stroke();
    scene.ctx.restore();

    const prev = trail.length > 1 ? trail[trail.length - 2] : [0, 0];
    const cur = [velocity[0], velocity[1]];

    // wishdir ray -- direction only, drawn long enough to read clearly
    scene.arrow([0, 0], [wishdir[0] * viewMax * 0.55, wishdir[1] * viewMax * 0.55], {
      color: "rgba(255,209,102,0.55)",
      dash: true,
      width: 2,
    });

    // this tick's nudge, tip-to-tail from the previous velocity to this one
    scene.arrow(prev, cur, { color: "#ffd166", width: 3, label: "nudge" });

    // the resultant: velocity itself, from the origin
    scene.arrow([0, 0], cur, { color: "#eafff2", width: 3.5, label: `${speed.toFixed(0)} u/s` });

    scene.angleArc([0, 0], cur, wishdir, { radius: 34, color: "rgba(255,209,102,0.8)", label: `${(+angleInput.value).toFixed(0)}°` });

    speedEl.textContent = speed.toFixed(0);
    ticksEl.textContent = ticks;
  }

  let wishdirNow = [1, 0, 0];
  function frame() {
    if (playing) {
      wishdirNow = step();
    }
    draw(wishdirNow);
    requestAnimationFrame(frame);
  }

  angleInput.addEventListener("input", () => {
    angleVal.textContent = angleInput.value + "°";
  });
  playBtn.addEventListener("click", () => {
    playing = !playing;
    playBtn.textContent = playing ? "⏸ Pause" : "▶ Play";
  });
  resetBtn.addEventListener("click", reset);
  scene.setRedraw(() => draw(wishdirNow));

  requestAnimationFrame(frame);
}
