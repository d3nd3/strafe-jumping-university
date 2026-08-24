
function mountCh1Hook(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 1 · The Hook</div>
    <h1>Top running speed is 300. So how is he going 480?</h1>
    <p class="lede">
      In Quake&nbsp;2, running on the ground never goes faster than 300 units per second. That
      limit is real — it's checked every instant. Yet good players fly through the air noticeably
      faster than that. Not a cheat. A trick hidden in a few lines of 1997 code.
    </p>
    <div class="panel">
      <div class="panel-row">
        <div class="panel-col">
          <canvas class="scene" id="hook-canvas"></canvas>
          <p class="muted" style="font-size:13px;margin-top:8px">
            <b>What you're looking at:</b> a bird's-eye view of one player. The dot is them; the
            line is the path they just flew. This is real, running physics — not a decoration —
            it's the same replay you'll be able to build yourself by Chapter&nbsp;5.
          </p>
        </div>
        <div class="panel-col">
          <div class="hud">
            <div class="hud-stat"><span class="k">SPEED RIGHT NOW</span><span class="v" id="hook-speed">300</span></div>
            <div class="hud-stat warn"><span class="k">GROUND TOP SPEED</span><span class="v">300</span></div>
          </div>
          <div class="mystery">
            <strong>The mystery:</strong> the 300 limit never gets raised anywhere. And yet the
            number on the left keeps climbing past it, just by turning while flying. By the end,
            you'll know exactly why — and exactly how to do it yourself.
          </div>
        </div>
      </div>
    </div>
    <a class="next-link" href="#ch2-wishdir">Start → Chapter 2: what your keys actually do</a>
  `;

  const canvas = section.querySelector("#hook-canvas");
  const speedEl = section.querySelector("#hook-speed");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.5, scale: 0.5 });

  // Real physics, not a decoration: this is one bounded "jump" run through
  // the exact same pmAirMoveSteps generator every later chapter uses, at a
  // turning speed picked (in Chapter 5's own sweep) to climb cleanly. It
  // loops: fly for ~0.7s, hold the final speed a moment, then reset.
  const TICKS = 70;
  const DT = 0.01;
  const TURN_DEG_PER_SEC = 170;
  const HOLD_FRAMES = 45;

  let state, pos, trail, tickCount, holdCount;
  function reset() {
    state = { velocity: [300, 0, 0], yaw: 0 };
    pos = [0, 0];
    trail = [[0, 0]];
    tickCount = 0;
    holdCount = 0;
  }
  reset();

  function frame() {
    if (tickCount < TICKS) {
      state.yaw += ((TURN_DEG_PER_SEC * Math.PI) / 180) * DT;
      const gen = pmAirMoveSteps(state, { forwardmove: 400, sidemove: 400 }, DT);
      while (!gen.next().done) {}
      pos = [pos[0] + state.velocity[0] * DT, pos[1] + state.velocity[1] * DT];
      trail.push([...pos]);
      tickCount++;
    } else if (holdCount++ > HOLD_FRAMES) {
      reset();
    }

    const speed = VectorLength(state.velocity);
    scene.clear();
    scene.grid();
    for (let i = 1; i < trail.length; i++) {
      const p0 = [trail[i - 1][0] * 0.35, trail[i - 1][1] * 0.35];
      const p1 = [trail[i][0] * 0.35, trail[i][1] * 0.35];
      const alpha = i / trail.length;
      scene.line(p0, p1, { color: `rgba(125,255,176,${alpha * 0.85})`, dash: [], width: 2.5 });
    }
    const last = trail[trail.length - 1];
    scene.point([last[0] * 0.35, last[1] * 0.35], { color: "#eafff2", radius: 5 });

    speedEl.textContent = speed.toFixed(0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
