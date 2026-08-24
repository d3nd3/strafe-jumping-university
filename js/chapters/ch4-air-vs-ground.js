
function renderStatic(lines, highlight) {
  const set = new Set(highlight);
  return (
    `<pre class="code" style="max-height:420px">` +
    lines
      .map(
        (l) =>
          `<div class="code-line${set.has(l.n) ? " active" : ""}" data-line="${l.n}"><span class="ln">${l.n}</span><span class="src">${escapeHtml(l.content)}</span></div>`
      )
      .join("") +
    `</pre>`
  );
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mountCh4AirVsGround(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 4 · Why Air Is Different</div>
    <h1>On the ground you accelerate 10× faster than in the air</h1>
    <p class="lede">
      <code>PM_Accelerate</code> from Chapter 3 doesn't know or care whether you're on the ground
      or in the air — it just does what its <code>accel</code> argument tells it. The difference
      between "walking" and "strafe-jumping" is entirely about <em>which value of accel gets
      passed in</em>, and that's decided one branch away, in <code>PM_AirMove</code>.
    </p>

    <div class="panel">
      ${renderStatic(C_AIR_MOVE, AIR_MOVE_MAP.branch.c)}
    </div>

    <p>
      Look closely at line 666: <code>if (pm_airaccelerate)</code>. In vanilla Quake&nbsp;2 and
      SoF, that cvar defaults to <strong>0</strong> (pmove.c:57). Zero is falsy in C, so this
      branch is <em>always</em> taken by default:
    </p>
    <div class="callout">
      <code>PM_Accelerate (wishdir, wishspeed, 1);</code> — airborne movement uses
      <code>accel&nbsp;=&nbsp;1</code>. Compare that to line 648, the ground branch, which passes
      <code>pm_accelerate</code>, a cvar that defaults to <strong>10</strong>. Ground movement
      accelerates ten times faster per tick than air movement, for the exact same input.
    </div>

    <h2>See it, don't just read it</h2>
    <p class="muted">Both bars below run the real <code>pmAccelerateSteps</code> generator from
    Chapter 3, tick by tick, starting from a dead stop with wishdir pointed straight at wishspeed
    (300) — i.e. just holding W. No turning, no tricks. This is the boring, honest case.</p>

    <div class="panel">
      <div class="controls">
        <div class="control-row">
          <label>ground (accel = 10)</label>
          <div style="background:#0b0f0c;border:1px solid var(--border);border-radius:6px;height:22px;overflow:hidden">
            <div id="bar-ground" style="height:100%;width:0%;background:#5fb4ff;transition:width .08s linear"></div>
          </div>
          <span class="mono" id="val-ground" style="color:#5fb4ff">0.0 u/s</span>
        </div>
        <div class="control-row">
          <label>air, default (accel = 1)</label>
          <div style="background:#0b0f0c;border:1px solid var(--border);border-radius:6px;height:22px;overflow:hidden">
            <div id="bar-air" style="height:100%;width:0%;background:#ffd166;transition:width .08s linear"></div>
          </div>
          <span class="mono" id="val-air" style="color:#ffd166">0.0 u/s</span>
        </div>
        <div class="btn-row">
          <button class="btn primary" id="race-play">▶ Run the race</button>
          <button class="btn" id="race-reset">⟲ Reset</button>
        </div>
        <p class="muted" style="margin:4px 0 0">Ticking at 50ms/frame, wishspeed 300, straight-line input for both.</p>
      </div>
    </div>

    <div class="mystery">
      <strong>So why doesn't air movement feel useless?</strong> Because <code>accel=1</code>
      only limits how fast you catch up to <code>wishspeed</code> <em>along your current
      wishdir</em>. It says nothing about velocity you already have sideways to that direction.
      Chapter 5 shows what happens when you deliberately keep wishdir at an angle from your
      velocity, instead of pointing it straight ahead like this honest, boring race did.
    </div>

    <a class="next-link" href="#ch5-angle-mystery">Continue → Chapter 5: the angle that breaks the speed limit</a>
  `;

  const barGround = section.querySelector("#bar-ground");
  const barAir = section.querySelector("#bar-air");
  const valGround = section.querySelector("#val-ground");
  const valAir = section.querySelector("#val-air");
  const playBtn = section.querySelector("#race-play");
  const resetBtn = section.querySelector("#race-reset");

  const wishdir = [1, 0, 0];
  const wishspeed = 300;
  const frametime = 0.05;
  let groundV, airV, timer;

  function reset() {
    clearInterval(timer);
    timer = null;
    groundV = [0, 0, 0];
    airV = [0, 0, 0];
    render();
    playBtn.textContent = "▶ Run the race";
  }

  function render() {
    const gs = groundV[0];
    const as = airV[0];
    barGround.style.width = Math.min(100, (gs / wishspeed) * 100) + "%";
    barAir.style.width = Math.min(100, (as / wishspeed) * 100) + "%";
    valGround.textContent = gs.toFixed(1) + " u/s";
    valAir.textContent = as.toFixed(1) + " u/s";
  }

  function tick() {
    let done = true;
    const g = pmAccelerateSteps(groundV, wishdir, wishspeed, 10, frametime);
    while (!g.next().done) done = false;
    const a = pmAccelerateSteps(airV, wishdir, wishspeed, 1, frametime);
    while (!a.next().done) done = false;
    render();
    if (groundV[0] >= wishspeed - 0.5 && airV[0] >= wishspeed - 0.5) {
      clearInterval(timer);
      timer = null;
      playBtn.textContent = "▶ Run the race";
    }
  }

  playBtn.addEventListener("click", () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      playBtn.textContent = "▶ Run the race";
      return;
    }
    playBtn.textContent = "⏸ Pause";
    timer = setInterval(tick, 60);
  });
  resetBtn.addEventListener("click", reset);

  reset();
}
