
const CH5_FRAMETIME = 0.01; // 100 ticks/sec, matches a classic sv_fps 100 server

function runJump(turnDegPerTick, ticks) {
  const state = { velocity: [300, 0, 0], yaw: 0 };
  const path = [[0, 0]];
  let pos = [0, 0];
  const speeds = [300];
  for (let t = 0; t < ticks; t++) {
    state.yaw += (turnDegPerTick * Math.PI) / 180;
    const cmd = { forwardmove: 400, sidemove: 400 };
    const gen = pmAirMoveSteps(state, cmd, CH5_FRAMETIME);
    while (!gen.next().done) {}
    pos = [pos[0] + state.velocity[0] * CH5_FRAMETIME, pos[1] + state.velocity[1] * CH5_FRAMETIME];
    path.push(pos);
    speeds.push(VectorLength(state.velocity));
  }
  return { finalSpeed: speeds[speeds.length - 1], path, speeds };
}

function sweep(ticks, maxTurn = 15, step = 0.15) {
  const pts = [];
  for (let turn = 0; turn <= maxTurn; turn += step) {
    pts.push([turn, runJump(turn, ticks).finalSpeed]);
  }
  return pts;
}

function mountCh5AngleMystery(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 5 · The Angle Mystery</div>
    <h1>There's a "sweet spot" turn rate — and it's not what you'd guess</h1>
    <p class="lede">
      Chapter 3 showed that <code>PM_Accelerate</code> only adds speed <em>along wishdir</em>,
      and leaves whatever's sideways to it untouched. Chapter 4 showed that in the air this
      happens slowly (accel = 1). Put those together: if you keep your view turning while holding
      forward + strafe, <code>wishdir</code> rotates a little every tick — and every tick, a
      little more speed gets added along a slightly different direction than before. That's air
      strafing. This chapter asks the obvious next question: how much should you turn?
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col">
          <canvas class="scene" id="am-canvas"></canvas>
          <div class="legend"><span><span class="swatch" style="background:#7dffb0"></span>trajectory during one jump's air time</span></div>
        </div>
        <div class="panel-col controls">
          <div class="control-row">
            <label><span>air time (this jump's duration)</span><span id="am-ticks-val">50 ticks (0.50s)</span></label>
            <input type="range" id="am-ticks" min="20" max="90" step="5" value="50" />
          </div>
          <div class="control-row">
            <label><span>turn rate (mouse speed, °/tick)</span><span id="am-turn-val">2.0°</span></label>
            <input type="range" id="am-turn" min="0" max="15" step="0.1" value="2" />
          </div>
          <div class="hud">
            <div class="hud-stat"><span class="k">SPEED AT LANDING</span><span class="v" id="am-final">—</span></div>
            <div class="hud-stat warn"><span class="k">BEST POSSIBLE (this air time)</span><span class="v" id="am-best">—</span></div>
          </div>
          <div class="btn-row">
            <button class="btn primary" id="am-snap">Snap to the optimum</button>
          </div>
        </div>
      </div>
    </div>

    <h2>The full picture: every turn rate, one jump</h2>
    <p class="muted">This is exhaustively simulated with the real <code>pmAirMoveSteps</code> code, not fitted or faked — every point on the curve is one full simulated jump at that turn rate.</p>
    <canvas class="scene" id="am-graph" style="height:260px"></canvas>

    <h2>Why a sweet spot exists at all</h2>
    <p>
      Recall <code>currentspeed = |velocity| · cos θ</code>, where θ is the angle between your
      velocity and wishdir, and <code>addspeed = wishspeed − currentspeed</code> (wishspeed is
      capped at 300 here since you're holding two full-strength keys).
    </p>
    <div class="callout">
      <strong>Turn too slowly</strong> (θ stays small): wishdir barely differs from where you're
      already going. <code>cos θ</code> stays close to 1, so <code>currentspeed</code> shoots up
      to meet <code>wishspeed</code> almost immediately — after that, <code>addspeed ≤ 0</code>
      and PM_Accelerate stops contributing anything for the rest of the jump. You "use up" your
      one tick of real acceleration too early.
    </div>
    <div class="callout">
      <strong>Turn too quickly</strong> (θ grows large fast): each tick's <code>accelspeed</code>
      does get added, but it's pointed further and further away from your actual direction of
      travel — you're spending your limited per-tick accel budget rotating your velocity in
      circles rather than building up its magnitude. Push θ towards 180° and you're actively
      decelerating yourself.
    </div>
    <div class="callout good">
      <strong>The sweet spot</strong> keeps <code>currentspeed</code> just barely below
      <code>wishspeed</code> for as much of the jump as possible — every single tick gets to
      contribute a little bit of <code>addspeed</code>, for the entire time you're airborne. It
      depends on how long you're in the air, which is exactly why the graph's peak shifts when
      you drag the air-time slider: a longer jump rewards a gentler, more patient turn.
    </div>

    <a class="next-link" href="#ch6-simulator">Continue → Chapter 6: try it yourself in the live simulator</a>
  `;

  const canvas = section.querySelector("#am-canvas");
  const scene = createScene(canvas, { originX: 0.5, originY: 0.5, scale: 0.9 });
  const graphCanvas = section.querySelector("#am-graph");
  const gctx = graphCanvas.getContext("2d");

  const ticksInput = section.querySelector("#am-ticks");
  const turnInput = section.querySelector("#am-turn");
  const ticksVal = section.querySelector("#am-ticks-val");
  const turnVal = section.querySelector("#am-turn-val");
  const finalEl = section.querySelector("#am-final");
  const bestEl = section.querySelector("#am-best");
  const snapBtn = section.querySelector("#am-snap");

  let curve = [];
  let bestTurn = 0;

  function resizeGraph() {
    const rect = graphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    graphCanvas.width = rect.width * dpr;
    graphCanvas.height = rect.height * dpr;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function recomputeCurve() {
    const ticks = +ticksInput.value;
    curve = sweep(ticks);
    let best = curve[0];
    for (const p of curve) if (p[1] > best[1]) best = p;
    bestTurn = best[0];
    bestEl.textContent = best[1].toFixed(0);
  }

  function drawGraph() {
    resizeGraph();
    const rect = graphCanvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    gctx.fillStyle = "#0b0f0c";
    gctx.fillRect(0, 0, w, h);

    const maxTurn = 15;
    const ys = curve.map((p) => p[1]);
    const minY = Math.min(300, ...ys) - 5;
    const maxY = Math.max(...ys) + 10;
    const xOf = (turn) => 40 + (turn / maxTurn) * (w - 60);
    const yOf = (speed) => h - 30 - ((speed - minY) / (maxY - minY)) * (h - 50);

    // axes
    gctx.strokeStyle = "rgba(255,255,255,0.15)";
    gctx.beginPath();
    gctx.moveTo(40, 10);
    gctx.lineTo(40, h - 30);
    gctx.lineTo(w - 20, h - 30);
    gctx.stroke();

    // 300 reference line
    gctx.strokeStyle = "rgba(255,107,107,0.4)";
    gctx.setLineDash([4, 4]);
    gctx.beginPath();
    gctx.moveTo(40, yOf(300));
    gctx.lineTo(w - 20, yOf(300));
    gctx.stroke();
    gctx.setLineDash([]);
    gctx.fillStyle = "rgba(255,107,107,0.7)";
    gctx.font = "11px monospace";
    gctx.fillText("pm_maxspeed = 300", 46, yOf(300) - 6);

    gctx.strokeStyle = "#7dffb0";
    gctx.lineWidth = 2;
    gctx.beginPath();
    curve.forEach((p, i) => {
      const x = xOf(p[0]), y = yOf(p[1]);
      if (i === 0) gctx.moveTo(x, y);
      else gctx.lineTo(x, y);
    });
    gctx.stroke();

    // current turn marker
    const turn = +turnInput.value;
    const cx = xOf(turn);
    gctx.strokeStyle = "rgba(255,255,255,0.5)";
    gctx.beginPath();
    gctx.moveTo(cx, 10);
    gctx.lineTo(cx, h - 30);
    gctx.stroke();

    // peak marker
    const px = xOf(bestTurn);
    const py = yOf(curve.reduce((m, p) => (p[1] > m ? p[1] : m), 0));
    gctx.fillStyle = "#ffd166";
    gctx.beginPath();
    gctx.arc(px, py, 4, 0, Math.PI * 2);
    gctx.fill();

    gctx.fillStyle = "#8fa89a";
    gctx.font = "11px monospace";
    gctx.fillText("0°/tick", 36, h - 14);
    gctx.fillText(maxTurn + "°/tick", w - 60, h - 14);
    gctx.textAlign = "left";
  }

  function drawJump() {
    const turn = +turnInput.value;
    const ticks = +ticksInput.value;
    const { finalSpeed, path } = runJump(turn, ticks);
    finalEl.textContent = finalSpeed.toFixed(0);

    scene.clear();
    scene.grid();
    for (let i = 1; i < path.length; i++) {
      const t = i / path.length;
      scene.line([path[i - 1][0] * 0.4, path[i - 1][1] * 0.4], [path[i][0] * 0.4, path[i][1] * 0.4], {
        color: `rgba(125,255,176,${0.3 + t * 0.6})`,
        width: 2.5,
        dash: [],
      });
    }
    scene.point([path[0][0] * 0.4, path[0][1] * 0.4], { color: "#fff", label: "jump start" });
    const last = path[path.length - 1];
    scene.point([last[0] * 0.4, last[1] * 0.4], { color: "#7dffb0", label: "landing" });
  }

  function render() {
    turnVal.textContent = (+turnInput.value).toFixed(1) + "°";
    ticksVal.textContent = `${ticksInput.value} ticks (${(+ticksInput.value / 100).toFixed(2)}s)`;
    drawGraph();
    drawJump();
  }

  ticksInput.addEventListener("input", () => {
    recomputeCurve();
    render();
  });
  turnInput.addEventListener("input", render);
  snapBtn.addEventListener("click", () => {
    turnInput.value = bestTurn.toFixed(1);
    render();
  });
  window.addEventListener("resize", drawGraph);

  recomputeCurve();
  render();
}
