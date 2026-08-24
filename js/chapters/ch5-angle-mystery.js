
const CH5_FRAMETIME = 0.01; // 100 ticks/sec, matches a classic sv_fps 100 server

// turnDegPerSec: how fast the view turns, in degrees per second.
function runJump(turnDegPerSec, ticks) {
  const state = { velocity: [300, 0, 0], yaw: 0 };
  const path = [[0, 0]];
  let pos = [0, 0];
  const speeds = [300];
  for (let t = 0; t < ticks; t++) {
    state.yaw += (turnDegPerSec * CH5_FRAMETIME * Math.PI) / 180;
    const cmd = { forwardmove: 400, sidemove: 400 };
    const gen = pmAirMoveSteps(state, cmd, CH5_FRAMETIME);
    while (!gen.next().done) {}
    pos = [pos[0] + state.velocity[0] * CH5_FRAMETIME, pos[1] + state.velocity[1] * CH5_FRAMETIME];
    path.push(pos);
    speeds.push(VectorLength(state.velocity));
  }
  return { finalSpeed: speeds[speeds.length - 1], path, speeds };
}

function sweep(ticks, maxTurn = 1500, step = 15) {
  const pts = [];
  for (let turn = 0; turn <= maxTurn; turn += step) {
    pts.push([turn, runJump(turn, ticks).finalSpeed]);
  }
  return pts;
}

function mountCh5AngleMystery(section) {
  section.innerHTML = `
    <div class="chapter-kicker">Chapter 5 · The Angle Mystery</div>
    <h1>There's a "just right" turning speed</h1>
    <p class="lede">
      Hold forward + strafe and keep turning your view: the target direction rotates a little
      each instant, so a little more speed keeps getting added, pointing a little differently
      each time. That's air-strafing. Question: how fast should you turn?
    </p>

    <div class="panel">
      <div class="panel-row">
        <div class="panel-col sticky-controls controls" style="flex:0 0 260px">
          <div class="control-row">
            <label><span>time in the air</span><span id="am-ticks-val">0.50s</span></label>
            <input type="range" id="am-ticks" min="20" max="90" step="5" value="50" />
          </div>
          <div class="control-row">
            <label><span>turning speed</span><span id="am-turn-val">200°/s</span></label>
            <input type="range" id="am-turn" min="0" max="1500" step="10" value="200" />
          </div>
          <div class="hud" style="flex-direction:column">
            <div class="hud-stat"><span class="k">SPEED AT LANDING</span><span class="v" id="am-final">—</span></div>
            <div class="hud-stat warn"><span class="k">BEST POSSIBLE</span><span class="v" id="am-best">—</span></div>
          </div>
          <div class="btn-row">
            <button class="btn primary" id="am-snap">Snap to the best turning speed</button>
          </div>
          <p class="muted" style="font-size:12.5px;margin:10px 0 0">These controls stay put while you scroll — they drive both charts.</p>
        </div>
        <div class="panel-col" style="flex:1 1 420px">
          <canvas class="scene" id="am-canvas"></canvas>
          <div class="legend"><span><span class="swatch" style="background:#7dffb0"></span>path during one jump</span></div>

          <h2 style="margin-top:28px">Every turning speed, tested</h2>
          <p class="muted">Each point is one full simulated jump, run for real at that turning speed.</p>
          <canvas class="scene" id="am-graph" style="height:260px"></canvas>
        </div>
      </div>
    </div>

    <h2>Why "just right" beats both extremes</h2>
    <div class="callout">
      <strong>Turn too slowly</strong> and your target direction barely moves — you catch up to
      your target speed almost right away, and then there's no room left to gain any more for the
      rest of the jump.
    </div>
    <div class="callout">
      <strong>Turn too fast</strong> and the target direction swings past where you're actually
      going. You're spending your boost fighting your own motion instead of building it up.
    </div>
    <div class="callout good">
      <strong>Just right</strong> keeps a little room to speed up available for the <em>whole</em>
      time you're in the air. Jump longer, and a gentler turn wins — that's why the graph's peak
      moves when you drag the air-time slider.
    </div>

    <a class="next-link" href="#ch6-simulator">Continue → Chapter 6: fly it yourself</a>
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

    const maxTurn = 1500;
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
    gctx.fillText("top speed = 300", 46, yOf(300) - 6);

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
    gctx.fillText("turning slower", 44, h - 14);
    gctx.fillText("turning faster", w - 110, h - 14);
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
    scene.point([path[0][0] * 0.4, path[0][1] * 0.4], { color: "#fff", label: "start" });
    const last = path[path.length - 1];
    scene.point([last[0] * 0.4, last[1] * 0.4], { color: "#7dffb0", label: "landing" });
  }

  function render() {
    turnVal.textContent = turnInput.value + "°/s";
    ticksVal.textContent = `${(+ticksInput.value / 100).toFixed(2)}s`;
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
  scene.setRedraw(drawJump);

  recomputeCurve();
  render();
}
