
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
    <div class="chapter-kicker">Chapter 4 · Ground vs. Air</div>
    <h1>On the ground you speed up 10× faster</h1>
    <p class="lede">
      The boost function from Chapter 3 doesn't care if you're on the ground or in the air — it
      just uses whatever <b>boost power</b> number it's handed. That number is picked one step
      earlier, right here:
    </p>

    <div class="panel">
      ${renderStatic(C_AIR_MOVE, AIR_MOVE_MAP.branch.c)}
    </div>

    <div class="callout">
      In the air, boost power (<span class="varname">accel</span>) is <b>1</b>. On the ground, it's <b>10</b> (line 648, not shown).
      Same keys, same code — ten times less push per instant, just because your feet left the
      floor.
    </div>

    <h2>See it happen</h2>
    <p class="muted">Both bars use the exact Chapter 3 function, just holding forward, no turning.</p>

    <div class="panel">
      <div class="controls">
        <div class="control-row">
          <label>on the ground (boost power 10)</label>
          <div style="background:#0b0f0c;border:1px solid var(--border);border-radius:6px;height:22px;overflow:hidden">
            <div id="bar-ground" style="height:100%;width:0%;background:#5fb4ff;transition:width .08s linear"></div>
          </div>
          <span class="mono" id="val-ground" style="color:#5fb4ff">0.0</span>
        </div>
        <div class="control-row">
          <label>in the air (boost power 1)</label>
          <div style="background:#0b0f0c;border:1px solid var(--border);border-radius:6px;height:22px;overflow:hidden">
            <div id="bar-air" style="height:100%;width:0%;background:#ffd166;transition:width .08s linear"></div>
          </div>
          <span class="mono" id="val-air" style="color:#ffd166">0.0</span>
        </div>
        <div class="btn-row">
          <button class="btn primary" id="race-play">▶ Run the race</button>
          <button class="btn" id="race-reset">⟲ Reset</button>
        </div>
      </div>
    </div>

    <div class="mystery">
      <strong>So how does air-strafing work at all?</strong> Weak boost only limits how fast you
      catch up <em>in the target direction</em>. It says nothing about speed you already have
      sideways to that. Chapter 5 turns the target direction away from straight-ahead and shows
      what that sideways speed does.
    </div>

    <a class="next-link" href="#ch5-angle-mystery">Continue → Chapter 5: the angle mystery</a>
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
    const g = pmAccelerateSteps(groundV, wishdir, wishspeed, 10, frametime);
    while (!g.next().done) {}
    const a = pmAccelerateSteps(airV, wishdir, wishspeed, 1, frametime);
    while (!a.next().done) {}
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
